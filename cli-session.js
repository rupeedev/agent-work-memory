#!/usr/bin/env node
const { Command} = require('commander');
const chalk = require('chalk');
const { db, DB_PATH } = require('./db');

const program = new Command();

program
  .name('workmem-session')
  .description('Session tracking commands for Claude CLI integration')
  .version('1.0.0');

// Start session handoff
program
  .command('handoff')
  .description('Create session handoff entry')
  .option('-s, --summary <summary>', 'Session summary')
  .option('-d, --duration <duration>', 'Session duration')
  .option('-f, --files <files>', 'Files modified (comma-separated)')
  .option('-p, --project <project>', 'Project name')
  .action((options) => {
    const stmt = db.prepare(`
      INSERT INTO session_handoffs (session_end, duration, summary, files_modified, project)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      new Date().toISOString(),
      options.duration || 'N/A',
      options.summary || '',
      options.files || '',
      options.project || null
    );

    console.log(chalk.green(`✓ Session handoff created (ID: ${result.lastInsertRowid})`));

    // Return session ID for use in subsequent commands
    console.log(chalk.gray(`Session ID: ${result.lastInsertRowid}`));
  });

// Log command
program
  .command('cmd <command>')
  .description('Log a command')
  .option('-d, --desc <description>', 'Command description')
  .option('-c, --category <category>', 'Category (git, docker, aws, build, etc)')
  .option('-s, --session <id>', 'Session ID')
  .option('-p, --project <project>', 'Project name')
  .option('--fail', 'Mark as failed')
  .action((command, options) => {
    const stmt = db.prepare(`
      INSERT INTO commands_log (command, description, category, success, session_id, project)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      command,
      options.desc || '',
      options.category || 'general',
      options.fail ? 0 : 1,
      options.session || null,
      options.project || null
    );

    console.log(chalk.green(`✓ Command logged (ID: ${result.lastInsertRowid})`));
  });

// Log decision
program
  .command('decision <title>')
  .description('Log a technical decision')
  .option('--context <context>', 'Decision context')
  .option('--solution <solution>', 'Chosen solution')
  .option('--alternatives <alternatives>', 'Alternatives considered')
  .option('--tradeoffs <tradeoffs>', 'Trade-offs')
  .option('-c, --category <category>', 'Category (architecture, technology, etc)')
  .option('--impact <impact>', 'Impact description')
  .option('-s, --session <id>', 'Session ID')
  .option('-p, --project <project>', 'Project name')
  .action((title, options) => {
    const stmt = db.prepare(`
      INSERT INTO decisions (title, context, solution, alternatives, tradeoffs, category, impact, session_id, project)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title,
      options.context || '',
      options.solution || '',
      options.alternatives || '',
      options.tradeoffs || '',
      options.category || 'general',
      options.impact || '',
      options.session || null,
      options.project || null
    );

    console.log(chalk.green(`✓ Decision logged (ID: ${result.lastInsertRowid})`));
  });

// Log issue
program
  .command('issue <title>')
  .description('Log an issue')
  .option('--severity <severity>', 'Severity (critical, high, medium, low)')
  .option('--desc <description>', 'Issue description')
  .option('--workaround <workaround>', 'Temporary workaround')
  .option('--root-cause <cause>', 'Root cause')
  .option('-s, --session <id>', 'Session ID')
  .option('-p, --project <project>', 'Project name')
  .action((title, options) => {
    const stmt = db.prepare(`
      INSERT INTO issues (title, severity, description, workaround, root_cause, session_id, project)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title,
      options.severity || 'medium',
      options.desc || '',
      options.workaround || '',
      options.rootCause || '',
      options.session || null,
      options.project || null
    );

    console.log(chalk.green(`✓ Issue logged (ID: ${result.lastInsertRowid})`));
  });

// Resolve issue
program
  .command('resolve <issueId>')
  .description('Mark issue as resolved')
  .option('--resolution <resolution>', 'How it was resolved')
  .action((issueId, options) => {
    const stmt = db.prepare(`
      UPDATE issues
      SET status = 'resolved', resolution = ?, resolved_at = ?
      WHERE id = ?
    `);

    stmt.run(options.resolution || '', new Date().toISOString(), issueId);
    console.log(chalk.green(`✓ Issue #${issueId} marked as resolved`));
  });

// Update current state
program
  .command('state')
  .description('Update current state for project')
  .requiredOption('-p, --project <project>', 'Project name')
  .option('--completed <completed>', 'Recently completed items')
  .option('--in-progress <progress>', 'Currently in progress')
  .option('--next <next>', 'Next session tasks')
  .option('--notes <notes>', 'Important notes')
  .action((options) => {
    const stmt = db.prepare(`
      INSERT INTO current_state (project, last_updated, completed_recently, in_progress, next_session, important_notes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project) DO UPDATE SET
        last_updated = excluded.last_updated,
        completed_recently = excluded.completed_recently,
        in_progress = excluded.in_progress,
        next_session = excluded.next_session,
        important_notes = excluded.important_notes
    `);

    stmt.run(
      options.project,
      new Date().toISOString(),
      options.completed || '',
      options.inProgress || '',
      options.next || '',
      options.notes || ''
    );

    console.log(chalk.green(`✓ Current state updated for project: ${options.project}`));
  });

// View session handoffs
program
  .command('list-sessions')
  .description('List recent session handoffs')
  .option('-n, --limit <limit>', 'Number of sessions to show', '10')
  .option('-p, --project <project>', 'Filter by project')
  .action((options) => {
    let query = 'SELECT * FROM session_handoffs';
    const params = [];

    if (options.project) {
      query += ' WHERE project = ?';
      params.push(options.project);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(options.limit));

    const sessions = db.prepare(query).all(...params);

    if (sessions.length === 0) {
      console.log(chalk.yellow('No sessions found'));
      return;
    }

    console.log(chalk.blue.bold('\n📋 Session Handoffs'));
    console.log(chalk.gray('='.repeat(60)));

    sessions.forEach((session, idx) => {
      console.log(`\n${chalk.bold(`#${session.id}`)} ${chalk.gray(new Date(session.session_end).toLocaleString())}`);
      console.log(`   ${chalk.gray('Duration:')} ${session.duration || 'N/A'}`);
      if (session.project) console.log(`   ${chalk.gray('Project:')} ${session.project}`);
      if (session.summary) console.log(`   ${chalk.gray('Summary:')} ${session.summary.substring(0, 100)}...`);
    });

    console.log(chalk.gray('\n' + '='.repeat(60) + '\n'));
  });

// View commands
program
  .command('list-commands')
  .description('List logged commands')
  .option('-n, --limit <limit>', 'Number of commands to show', '20')
  .option('-c, --category <category>', 'Filter by category')
  .option('-p, --project <project>', 'Filter by project')
  .action((options) => {
    let query = 'SELECT * FROM commands_log WHERE 1=1';
    const params = [];

    if (options.category) {
      query += ' AND category = ?';
      params.push(options.category);
    }

    if (options.project) {
      query += ' AND project = ?';
      params.push(options.project);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(options.limit));

    const commands = db.prepare(query).all(...params);

    if (commands.length === 0) {
      console.log(chalk.yellow('No commands found'));
      return;
    }

    console.log(chalk.blue.bold('\n💻 Commands Log'));
    console.log(chalk.gray('='.repeat(60)));

    commands.forEach((cmd, idx) => {
      const icon = cmd.success ? '✓' : '✗';
      const color = cmd.success ? chalk.green : chalk.red;
      console.log(`\n${color(icon)} ${chalk.cyan(cmd.command)}`);
      if (cmd.description) console.log(`   ${chalk.gray(cmd.description)}`);
      console.log(`   ${chalk.gray(`Category: ${cmd.category} | ${new Date(cmd.created_at).toLocaleString()}`)}`);
    });

    console.log(chalk.gray('\n' + '='.repeat(60) + '\n'));
  });

// View decisions
program
  .command('list-decisions')
  .description('List technical decisions')
  .option('-n, --limit <limit>', 'Number of decisions to show', '10')
  .option('-c, --category <category>', 'Filter by category')
  .option('-p, --project <project>', 'Filter by project')
  .action((options) => {
    let query = 'SELECT * FROM decisions WHERE 1=1';
    const params = [];

    if (options.category) {
      query += ' AND category = ?';
      params.push(options.category);
    }

    if (options.project) {
      query += ' AND project = ?';
      params.push(options.project);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(options.limit));

    const decisions = db.prepare(query).all(...params);

    if (decisions.length === 0) {
      console.log(chalk.yellow('No decisions found'));
      return;
    }

    console.log(chalk.blue.bold('\n✅ Technical Decisions'));
    console.log(chalk.gray('='.repeat(60)));

    decisions.forEach((dec, idx) => {
      console.log(`\n${chalk.bold(`#${dec.id} ${dec.title}`)}`);
      console.log(`   ${chalk.gray('Category:')} ${dec.category}`);
      console.log(`   ${chalk.gray('Date:')} ${new Date(dec.created_at).toLocaleDateString()}`);
      if (dec.solution) console.log(`   ${chalk.gray('Solution:')} ${dec.solution.substring(0, 100)}...`);
      if (dec.alternatives) console.log(`   ${chalk.gray('Alternatives:')} ${dec.alternatives.substring(0, 80)}...`);
    });

    console.log(chalk.gray('\n' + '='.repeat(60) + '\n'));
  });

// View issues
program
  .command('list-issues')
  .description('List issues')
  .option('--open', 'Show only open issues')
  .option('--resolved', 'Show only resolved issues')
  .option('-p, --project <project>', 'Filter by project')
  .action((options) => {
    let query = 'SELECT * FROM issues WHERE 1=1';
    const params = [];

    if (options.open) {
      query += ' AND status = ?';
      params.push('open');
    }

    if (options.resolved) {
      query += ' AND status = ?';
      params.push('resolved');
    }

    if (options.project) {
      query += ' AND project = ?';
      params.push(options.project);
    }

    query += ' ORDER BY created_at DESC';

    const issues = db.prepare(query).all(...params);

    if (issues.length === 0) {
      console.log(chalk.yellow('No issues found'));
      return;
    }

    console.log(chalk.blue.bold('\n🐛 Issues'));
    console.log(chalk.gray('='.repeat(60)));

    issues.forEach((issue, idx) => {
      const statusColor = issue.status === 'open' ? chalk.yellow : chalk.green;
      console.log(`\n${chalk.bold(`#${issue.id} ${issue.title}`)}`);
      console.log(`   ${statusColor(issue.status.toUpperCase())} ${chalk.gray(`Severity: ${issue.severity}`)}`);
      console.log(`   ${chalk.gray('Created:')} ${new Date(issue.created_at).toLocaleDateString()}`);
      if (issue.description) console.log(`   ${chalk.gray('Desc:')} ${issue.description.substring(0, 100)}...`);
      if (issue.resolution && issue.status === 'resolved') {
        console.log(`   ${chalk.green('✓ Resolved:')} ${issue.resolution.substring(0, 80)}...`);
      }
    });

    console.log(chalk.gray('\n' + '='.repeat(60) + '\n'));
  });

// View current state
program
  .command('show-state')
  .description('Show current state for project')
  .requiredOption('-p, --project <project>', 'Project name')
  .action((options) => {
    const state = db.prepare('SELECT * FROM current_state WHERE project = ?').get(options.project);

    if (!state) {
      console.log(chalk.yellow(`No state found for project: ${options.project}`));
      return;
    }

    console.log(chalk.blue.bold(`\n📊 Current State: ${options.project}`));
    console.log(chalk.gray('='.repeat(60)));
    console.log(`${chalk.gray('Last Updated:')} ${new Date(state.last_updated).toLocaleString()}`);

    if (state.completed_recently) {
      console.log(chalk.green.bold('\n✓ Completed Recently:'));
      console.log(state.completed_recently);
    }

    if (state.in_progress) {
      console.log(chalk.yellow.bold('\n⏳ In Progress:'));
      console.log(state.in_progress);
    }

    if (state.next_session) {
      console.log(chalk.blue.bold('\n➡️  Next Session:'));
      console.log(state.next_session);
    }

    if (state.important_notes) {
      console.log(chalk.red.bold('\n⚠️  Important Notes:'));
      console.log(state.important_notes);
    }

    console.log(chalk.gray('\n' + '='.repeat(60) + '\n'));
  });

// ============================================================================
// CHANGELOG & FEATURE TRACKING COMMANDS
// ============================================================================

// Add changelog entry
program
  .command('changelog <title>')
  .description('Add a changelog entry')
  .requiredOption('-p, --project <project>', 'Project name')
  .requiredOption('-t, --type <type>', 'Entry type (COMPLETED, PENDING, IN_PROGRESS, FIXED, ADDED, CHANGED, REMOVED)')
  .option('-c, --category <category>', 'Category (feature, bugfix, enhancement, documentation, infrastructure)')
  .option('-d, --desc <description>', 'Detailed description')
  .option('-v, --version <version>', 'Version or phase (e.g., "v1.0.0", "Phase 1")')
  .option('-s, --session <id>', 'Session ID')
  .option('--metadata <json>', 'Additional metadata as JSON string')
  .action((title, options) => {
    const validTypes = ['COMPLETED', 'PENDING', 'IN_PROGRESS', 'FIXED', 'ADDED', 'CHANGED', 'REMOVED'];
    if (!validTypes.includes(options.type.toUpperCase())) {
      console.log(chalk.red(`Invalid type. Must be one of: ${validTypes.join(', ')}`));
      return;
    }

    const stmt = db.prepare(`
      INSERT INTO changelog_entries (project, version, entry_type, category, title, description, metadata, date, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      options.project,
      options.version || null,
      options.type.toUpperCase(),
      options.category || 'feature',
      title,
      options.desc || '',
      options.metadata || null,
      new Date().toISOString(),
      options.session || null
    );

    console.log(chalk.green(`✓ Changelog entry added (ID: ${result.lastInsertRowid})`));
  });

// Add feature
program
  .command('feature <name>')
  .description('Add or update a feature')
  .requiredOption('-p, --project <project>', 'Project name')
  .requiredOption('--status <status>', 'Status (completed, pending, in_progress, blocked)')
  .option('-d, --desc <description>', 'Feature description')
  .option('--priority <priority>', 'Priority (critical, high, medium, low)')
  .option('--acceptance <criteria>', 'Acceptance criteria')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--blocked <reason>', 'Reason if blocked')
  .option('-s, --session <id>', 'Session ID')
  .action((name, options) => {
    const validStatuses = ['completed', 'pending', 'in_progress', 'blocked'];
    if (!validStatuses.includes(options.status.toLowerCase())) {
      console.log(chalk.red(`Invalid status. Must be one of: ${validStatuses.join(', ')}`));
      return;
    }

    // Check if feature already exists
    const existing = db.prepare('SELECT id FROM features WHERE project = ? AND feature_name = ?')
      .get(options.project, name);

    if (existing) {
      // Update existing feature
      const updateStmt = db.prepare(`
        UPDATE features
        SET status = ?, priority = ?, description = ?, acceptance_criteria = ?,
            blocked_reason = ?, tags = ?, session_id = ?, updated_at = ?,
            started_at = CASE WHEN status != 'in_progress' AND ? = 'in_progress' THEN ? ELSE started_at END,
            completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END
        WHERE id = ?
      `);

      const now = new Date().toISOString();
      updateStmt.run(
        options.status.toLowerCase(),
        options.priority || null,
        options.desc || null,
        options.acceptance || null,
        options.blocked || null,
        options.tags || null,
        options.session || null,
        now,
        options.status.toLowerCase(),
        now,
        options.status.toLowerCase(),
        now,
        existing.id
      );

      console.log(chalk.green(`✓ Feature updated (ID: ${existing.id})`));
    } else {
      // Insert new feature
      const stmt = db.prepare(`
        INSERT INTO features (project, feature_name, status, priority, description, acceptance_criteria,
                              blocked_reason, tags, session_id, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      const result = stmt.run(
        options.project,
        name,
        options.status.toLowerCase(),
        options.priority || 'medium',
        options.desc || '',
        options.acceptance || '',
        options.blocked || null,
        options.tags || '',
        options.session || null,
        options.status.toLowerCase() === 'in_progress' ? now : null,
        options.status.toLowerCase() === 'completed' ? now : null
      );

      console.log(chalk.green(`✓ Feature added (ID: ${result.lastInsertRowid})`));
    }
  });

// Add release/version
program
  .command('release <version>')
  .description('Create a release/version entry')
  .requiredOption('-p, --project <project>', 'Project name')
  .option('--type <type>', 'Release type (major, minor, patch, phase)', 'minor')
  .option('--summary <summary>', 'Release summary')
  .option('--notes <notes>', 'Release notes')
  .option('--date <date>', 'Release date (ISO format, defaults to now)')
  .action((version, options) => {
    const stmt = db.prepare(`
      INSERT INTO releases (project, version, release_date, release_type, summary, notes)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project, version) DO UPDATE SET
        release_date = excluded.release_date,
        release_type = excluded.release_type,
        summary = excluded.summary,
        notes = excluded.notes
    `);

    stmt.run(
      options.project,
      version,
      options.date || new Date().toISOString(),
      options.type,
      options.summary || '',
      options.notes || ''
    );

    console.log(chalk.green(`✓ Release ${version} created for ${options.project}`));
  });

// Show changelog
program
  .command('show-changelog')
  .description('Display changelog for project')
  .requiredOption('-p, --project <project>', 'Project name')
  .option('-v, --version <version>', 'Filter by version')
  .option('-t, --type <type>', 'Filter by entry type')
  .option('-n, --limit <limit>', 'Number of entries to show', '50')
  .option('--format <format>', 'Output format (text, markdown)', 'text')
  .action((options) => {
    let query = 'SELECT * FROM changelog_entries WHERE project = ?';
    const params = [options.project];

    if (options.version) {
      query += ' AND version = ?';
      params.push(options.version);
    }

    if (options.type) {
      query += ' AND entry_type = ?';
      params.push(options.type.toUpperCase());
    }

    query += ' ORDER BY date DESC, created_at DESC LIMIT ?';
    params.push(parseInt(options.limit));

    const entries = db.prepare(query).all(...params);

    if (entries.length === 0) {
      console.log(chalk.yellow(`No changelog entries found for project: ${options.project}`));
      return;
    }

    if (options.format === 'markdown') {
      console.log(`# Changelog: ${options.project}\n`);

      // Group by version
      const grouped = {};
      entries.forEach(entry => {
        const ver = entry.version || 'Unreleased';
        if (!grouped[ver]) grouped[ver] = [];
        grouped[ver].push(entry);
      });

      Object.keys(grouped).forEach(ver => {
        console.log(`## ${ver}\n`);
        grouped[ver].forEach(entry => {
          const typeEmoji = {
            COMPLETED: '✅',
            PENDING: '⏳',
            IN_PROGRESS: '🔄',
            FIXED: '🐛',
            ADDED: '✨',
            CHANGED: '🔧',
            REMOVED: '❌'
          }[entry.entry_type] || '📝';

          console.log(`- ${typeEmoji} **${entry.title}**${entry.category ? ` (_${entry.category}_)` : ''}`);
          if (entry.description) {
            console.log(`  ${entry.description}`);
          }
          console.log('');
        });
      });
    } else {
      console.log(chalk.blue.bold(`\n📝 Changelog: ${options.project}`));
      console.log(chalk.gray('='.repeat(70)));

      entries.forEach((entry, idx) => {
        const typeColors = {
          COMPLETED: chalk.green,
          PENDING: chalk.yellow,
          IN_PROGRESS: chalk.blue,
          FIXED: chalk.magenta,
          ADDED: chalk.cyan,
          CHANGED: chalk.yellow,
          REMOVED: chalk.red
        };
        const typeColor = typeColors[entry.entry_type] || chalk.white;

        console.log(`\n${typeColor(`[${entry.entry_type}]`)} ${chalk.bold(entry.title)}`);
        if (entry.version) console.log(`   ${chalk.gray('Version:')} ${entry.version}`);
        if (entry.category) console.log(`   ${chalk.gray('Category:')} ${entry.category}`);
        console.log(`   ${chalk.gray('Date:')} ${new Date(entry.date).toLocaleDateString()}`);
        if (entry.description) console.log(`   ${chalk.gray('Description:')} ${entry.description.substring(0, 150)}${entry.description.length > 150 ? '...' : ''}`);
      });

      console.log(chalk.gray('\n' + '='.repeat(70) + '\n'));
    }
  });

// List features
program
  .command('list-features')
  .description('List features by status')
  .requiredOption('-p, --project <project>', 'Project name')
  .option('--status <status>', 'Filter by status (completed, pending, in_progress, blocked)')
  .option('--priority <priority>', 'Filter by priority')
  .option('-n, --limit <limit>', 'Number to show', '50')
  .action((options) => {
    let query = 'SELECT * FROM features WHERE project = ?';
    const params = [options.project];

    if (options.status) {
      query += ' AND status = ?';
      params.push(options.status.toLowerCase());
    }

    if (options.priority) {
      query += ' AND priority = ?';
      params.push(options.priority.toLowerCase());
    }

    query += ' ORDER BY CASE priority WHEN "critical" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 WHEN "low" THEN 4 END, updated_at DESC LIMIT ?';
    params.push(parseInt(options.limit));

    const features = db.prepare(query).all(...params);

    if (features.length === 0) {
      console.log(chalk.yellow(`No features found for project: ${options.project}`));
      return;
    }

    console.log(chalk.blue.bold(`\n🎯 Features: ${options.project}`));
    console.log(chalk.gray('='.repeat(70)));

    const statusEmojis = {
      completed: '✅',
      pending: '⏳',
      in_progress: '🔄',
      blocked: '🚫'
    };

    const priorityColors = {
      critical: chalk.red.bold,
      high: chalk.red,
      medium: chalk.yellow,
      low: chalk.gray
    };

    features.forEach((feature, idx) => {
      const statusEmoji = statusEmojis[feature.status] || '📝';
      const priorityColor = priorityColors[feature.priority] || chalk.white;

      console.log(`\n${statusEmoji} ${chalk.bold(feature.feature_name)} ${priorityColor(`[${feature.priority || 'medium'}]`)}`);
      console.log(`   ${chalk.gray('Status:')} ${feature.status}`);
      if (feature.description) console.log(`   ${chalk.gray('Description:')} ${feature.description.substring(0, 100)}${feature.description.length > 100 ? '...' : ''}`);
      if (feature.tags) console.log(`   ${chalk.gray('Tags:')} ${feature.tags}`);
      if (feature.started_at) console.log(`   ${chalk.gray('Started:')} ${new Date(feature.started_at).toLocaleDateString()}`);
      if (feature.completed_at) console.log(`   ${chalk.green('Completed:')} ${new Date(feature.completed_at).toLocaleDateString()}`);
      if (feature.blocked_reason) console.log(`   ${chalk.red('Blocked:')} ${feature.blocked_reason}`);
    });

    console.log(chalk.gray('\n' + '='.repeat(70) + '\n'));
  });

// Shortcuts for feature statuses
program
  .command('list-completed-features')
  .description('List completed features')
  .requiredOption('-p, --project <project>', 'Project name')
  .option('-n, --limit <limit>', 'Number to show', '20')
  .action((options) => {
    const features = db.prepare('SELECT * FROM features WHERE project = ? AND status = ? ORDER BY completed_at DESC LIMIT ?')
      .all(options.project, 'completed', parseInt(options.limit));

    if (features.length === 0) {
      console.log(chalk.yellow('No completed features found'));
      return;
    }

    console.log(chalk.green.bold(`\n✅ Completed Features: ${options.project}`));
    console.log(chalk.gray('='.repeat(70)));

    features.forEach(f => {
      console.log(`\n✓ ${chalk.bold(f.feature_name)}`);
      if (f.description) console.log(`  ${f.description.substring(0, 120)}...`);
      if (f.completed_at) console.log(`  ${chalk.gray('Completed:')} ${new Date(f.completed_at).toLocaleDateString()}`);
    });

    console.log(chalk.gray('\n' + '='.repeat(70) + '\n'));
  });

program
  .command('show-pending-features')
  .description('Show pending features')
  .requiredOption('-p, --project <project>', 'Project name')
  .action((options) => {
    const features = db.prepare('SELECT * FROM features WHERE project = ? AND status = ? ORDER BY priority, created_at')
      .all(options.project, 'pending');

    if (features.length === 0) {
      console.log(chalk.yellow('No pending features found'));
      return;
    }

    console.log(chalk.yellow.bold(`\n⏳ Pending Features: ${options.project}`));
    console.log(chalk.gray('='.repeat(70)));

    features.forEach(f => {
      const priorityColor = { critical: chalk.red, high: chalk.yellow, medium: chalk.white, low: chalk.gray }[f.priority] || chalk.white;
      console.log(`\n⏳ ${chalk.bold(f.feature_name)} ${priorityColor(`[${f.priority}]`)}`);
      if (f.description) console.log(`  ${f.description.substring(0, 120)}...`);
    });

    console.log(chalk.gray('\n' + '='.repeat(70) + '\n'));
  });

// Generate changelog report
program
  .command('generate-report')
  .description('Generate comprehensive changelog report')
  .requiredOption('-p, --project <project>', 'Project name')
  .option('--format <format>', 'Output format (markdown, text)', 'markdown')
  .option('--since <date>', 'Show changes since date (ISO format)')
  .option('--output <file>', 'Save to file instead of stdout')
  .action((options) => {
    let query = 'SELECT * FROM changelog_entries WHERE project = ?';
    const params = [options.project];

    if (options.since) {
      query += ' AND date >= ?';
      params.push(options.since);
    }

    query += ' ORDER BY date DESC, created_at DESC';
    const entries = db.prepare(query).all(...params);

    // Get releases
    const releases = db.prepare('SELECT * FROM releases WHERE project = ? ORDER BY release_date DESC')
      .all(options.project);

    // Get feature stats
    const featureStats = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM features
      WHERE project = ?
      GROUP BY status
    `).all(options.project);

    let output = '';

    if (options.format === 'markdown') {
      output += `# ${options.project} - Changelog Report\n\n`;
      output += `Generated: ${new Date().toLocaleDateString()}\n\n`;

      // Feature stats
      output += `## 📊 Feature Statistics\n\n`;
      featureStats.forEach(stat => {
        const emoji = { completed: '✅', pending: '⏳', in_progress: '🔄', blocked: '🚫' }[stat.status] || '📝';
        output += `- ${emoji} ${stat.status}: ${stat.count}\n`;
      });
      output += `\n`;

      // Releases
      if (releases.length > 0) {
        output += `## 🚀 Releases\n\n`;
        releases.forEach(rel => {
          output += `### ${rel.version} - ${new Date(rel.release_date).toLocaleDateString()}\n\n`;
          if (rel.summary) output += `${rel.summary}\n\n`;
          if (rel.notes) output += `${rel.notes}\n\n`;
        });
      }

      // Group entries by version
      const grouped = {};
      entries.forEach(entry => {
        const ver = entry.version || 'Unreleased';
        if (!grouped[ver]) grouped[ver] = [];
        grouped[ver].push(entry);
      });

      output += `## 📝 Changes\n\n`;
      Object.keys(grouped).forEach(ver => {
        output += `### ${ver}\n\n`;

        // Group by type within version
        const byType = {};
        grouped[ver].forEach(e => {
          if (!byType[e.entry_type]) byType[e.entry_type] = [];
          byType[e.entry_type].push(e);
        });

        ['COMPLETED', 'ADDED', 'CHANGED', 'FIXED', 'REMOVED', 'IN_PROGRESS', 'PENDING'].forEach(type => {
          if (byType[type] && byType[type].length > 0) {
            const emoji = { COMPLETED: '✅', ADDED: '✨', CHANGED: '🔧', FIXED: '🐛', REMOVED: '❌', IN_PROGRESS: '🔄', PENDING: '⏳' }[type];
            output += `#### ${emoji} ${type}\n\n`;
            byType[type].forEach(e => {
              output += `- **${e.title}**${e.category ? ` (_${e.category}_)` : ''}\n`;
              if (e.description) output += `  - ${e.description}\n`;
            });
            output += `\n`;
          }
        });
      });
    } else {
      // Text format
      output += `${options.project} - Changelog Report\n`;
      output += `${'='.repeat(70)}\n`;
      output += `Generated: ${new Date().toLocaleDateString()}\n\n`;

      output += `Feature Statistics:\n`;
      featureStats.forEach(stat => {
        output += `  - ${stat.status}: ${stat.count}\n`;
      });
      output += `\n`;

      output += `Recent Changes:\n`;
      entries.slice(0, 30).forEach(e => {
        output += `  [${e.entry_type}] ${e.title}\n`;
        if (e.description) output += `    ${e.description.substring(0, 100)}...\n`;
      });
    }

    if (options.output) {
      require('fs').writeFileSync(options.output, output);
      console.log(chalk.green(`✓ Report saved to: ${options.output}`));
    } else {
      console.log(output);
    }
  });

// Start a new session - comprehensive summary
program
  .command('session-start')
  .description('Start a new session with comprehensive project summary')
  .requiredOption('-p, --project <project>', 'Project name')
  .option('--sessions <count>', 'Number of recent sessions to show', '3')
  .option('--changelog <count>', 'Number of changelog entries to show', '15')
  .option('--decisions <count>', 'Number of recent decisions to show', '5')
  .action((options) => {
    console.log(chalk.blue.bold(`\n🚀 Starting New Session: ${options.project}`));
    console.log(chalk.gray('='.repeat(70)));

    // 1. Current State
    const state = db.prepare('SELECT * FROM current_state WHERE project = ?').get(options.project);

    if (state) {
      console.log(chalk.cyan.bold('\n📊 Current Project State'));
      console.log(chalk.gray(`Last Updated: ${new Date(state.last_updated).toLocaleString()}\n`));

      if (state.completed_recently) {
        console.log(chalk.green('✅ Recently Completed:'));
        console.log(`   ${state.completed_recently}\n`);
      }

      if (state.in_progress) {
        console.log(chalk.yellow('🔄 In Progress:'));
        console.log(`   ${state.in_progress}\n`);
      }

      if (state.next_session) {
        console.log(chalk.blue('➡️  Next Steps:'));
        console.log(`   ${state.next_session}\n`);
      }

      if (state.important_notes) {
        console.log(chalk.red('⚠️  Important Notes:'));
        console.log(`   ${state.important_notes}\n`);
      }
    } else {
      console.log(chalk.yellow('\n⚠️  No current state found. This is the first session.\n'));
    }

    // 2. Feature Statistics
    const featureStats = db.prepare(`
      SELECT status, COUNT(*) as count,
             GROUP_CONCAT(CASE WHEN priority = 'critical' THEN 1 END) as critical_count,
             GROUP_CONCAT(CASE WHEN priority = 'high' THEN 1 END) as high_count
      FROM features
      WHERE project = ?
      GROUP BY status
    `).all(options.project);

    if (featureStats.length > 0) {
      console.log(chalk.cyan.bold('🎯 Feature Overview'));
      console.log(chalk.gray('-'.repeat(70)));

      const statusEmojis = { completed: '✅', in_progress: '🔄', pending: '⏳', blocked: '🚫' };
      let totalFeatures = 0;

      featureStats.forEach(stat => {
        totalFeatures += stat.count;
        const emoji = statusEmojis[stat.status] || '📝';
        console.log(`   ${emoji} ${stat.status.padEnd(15)}: ${stat.count}`);
      });

      console.log(chalk.gray(`   ${''.padEnd(15)}  ─────`));
      console.log(chalk.gray(`   ${'Total'.padEnd(15)}: ${totalFeatures}\n`));
    }

    // 3. In-Progress & Pending Features
    const activeFeatures = db.prepare(`
      SELECT feature_name, status, priority, description
      FROM features
      WHERE project = ? AND status IN ('in_progress', 'pending', 'blocked')
      ORDER BY
        CASE status WHEN 'in_progress' THEN 1 WHEN 'blocked' THEN 2 WHEN 'pending' THEN 3 END,
        CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END
      LIMIT 10
    `).all(options.project);

    if (activeFeatures.length > 0) {
      console.log(chalk.cyan.bold('📋 Active Features'));
      console.log(chalk.gray('-'.repeat(70)));

      const statusEmojis = { in_progress: '🔄', pending: '⏳', blocked: '🚫' };
      const priorityColors = {
        critical: chalk.red.bold,
        high: chalk.red,
        medium: chalk.yellow,
        low: chalk.gray
      };

      activeFeatures.forEach(f => {
        const emoji = statusEmojis[f.status];
        const priorityColor = priorityColors[f.priority] || chalk.white;
        console.log(`   ${emoji} ${chalk.bold(f.feature_name)} ${priorityColor(`[${f.priority}]`)}`);
        if (f.description) {
          console.log(chalk.gray(`      ${f.description.substring(0, 80)}${f.description.length > 80 ? '...' : ''}`));
        }
      });
      console.log('');
    }

    // 4. Recent Changelog Entries
    const changelog = db.prepare(`
      SELECT entry_type, title, description, date, category
      FROM changelog_entries
      WHERE project = ?
      ORDER BY date DESC, created_at DESC
      LIMIT ?
    `).all(options.project, parseInt(options.changelog));

    if (changelog.length > 0) {
      console.log(chalk.cyan.bold('📝 Recent Changelog'));
      console.log(chalk.gray('-'.repeat(70)));

      // Group by type
      const byType = {};
      changelog.forEach(e => {
        if (!byType[e.entry_type]) byType[e.entry_type] = [];
        byType[e.entry_type].push(e);
      });

      const typeOrder = ['COMPLETED', 'ADDED', 'CHANGED', 'FIXED', 'IN_PROGRESS', 'PENDING'];
      const typeEmojis = {
        COMPLETED: '✅',
        ADDED: '✨',
        CHANGED: '🔧',
        FIXED: '🐛',
        REMOVED: '❌',
        IN_PROGRESS: '🔄',
        PENDING: '⏳'
      };

      typeOrder.forEach(type => {
        if (byType[type] && byType[type].length > 0) {
          const emoji = typeEmojis[type];
          console.log(chalk.bold(`\n   ${emoji} ${type}`));
          byType[type].slice(0, 5).forEach(e => {
            const date = new Date(e.date).toLocaleDateString();
            console.log(chalk.gray(`      [${date}] ${e.title}`));
          });
        }
      });
      console.log('');
    }

    // 5. Open Issues
    const openIssues = db.prepare(`
      SELECT title, severity, description, workaround
      FROM issues
      WHERE project = ? AND status = 'open'
      ORDER BY
        CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
        created_at DESC
      LIMIT 5
    `).all(options.project);

    if (openIssues.length > 0) {
      console.log(chalk.cyan.bold('🐛 Open Issues'));
      console.log(chalk.gray('-'.repeat(70)));

      openIssues.forEach(issue => {
        const severityColor = {
          critical: chalk.red.bold,
          high: chalk.red,
          medium: chalk.yellow,
          low: chalk.gray
        }[issue.severity] || chalk.white;

        console.log(`   ${severityColor('⚠️')} ${chalk.bold(issue.title)} ${severityColor(`[${issue.severity}]`)}`);
        if (issue.description) {
          console.log(chalk.gray(`      ${issue.description.substring(0, 80)}${issue.description.length > 80 ? '...' : ''}`));
        }
        if (issue.workaround) {
          console.log(chalk.cyan(`      Workaround: ${issue.workaround.substring(0, 70)}...`));
        }
      });
      console.log('');
    }

    // 6. Recent Decisions
    const decisions = db.prepare(`
      SELECT title, solution, category, created_at
      FROM decisions
      WHERE project = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(options.project, parseInt(options.decisions));

    if (decisions.length > 0) {
      console.log(chalk.cyan.bold('💡 Recent Technical Decisions'));
      console.log(chalk.gray('-'.repeat(70)));

      decisions.forEach(d => {
        const date = new Date(d.created_at).toLocaleDateString();
        console.log(`   📌 ${chalk.bold(d.title)} ${chalk.gray(`[${d.category}]`)}`);
        if (d.solution) {
          console.log(chalk.gray(`      ${d.solution.substring(0, 80)}${d.solution.length > 80 ? '...' : ''}`));
        }
        console.log(chalk.gray(`      Date: ${date}`));
      });
      console.log('');
    }

    // 7. Recent Sessions
    const sessions = db.prepare(`
      SELECT session_end, duration, summary, files_modified
      FROM session_handoffs
      WHERE project = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(options.project, parseInt(options.sessions));

    if (sessions.length > 0) {
      console.log(chalk.cyan.bold('📅 Recent Sessions'));
      console.log(chalk.gray('-'.repeat(70)));

      sessions.forEach((s, idx) => {
        const date = new Date(s.session_end).toLocaleString();
        console.log(`   ${idx + 1}. ${chalk.gray(date)} ${chalk.dim(`(${s.duration || 'N/A'})`)}`);
        if (s.summary) {
          console.log(chalk.gray(`      ${s.summary.substring(0, 100)}${s.summary.length > 100 ? '...' : ''}`));
        }
      });
      console.log('');
    }

    // 8. Quick Commands Reference
    console.log(chalk.cyan.bold('🔧 Quick Commands'));
    console.log(chalk.gray('-'.repeat(70)));
    console.log(chalk.gray(`   View detailed state:       workmem-session show-state -p "${options.project}"`));
    console.log(chalk.gray(`   View changelog:            workmem-session show-changelog -p "${options.project}"`));
    console.log(chalk.gray(`   View pending features:     workmem-session show-pending-features -p "${options.project}"`));
    console.log(chalk.gray(`   View all features:         workmem-session list-features -p "${options.project}"`));
    console.log(chalk.gray(`   View open issues:          workmem-session list-issues -p "${options.project}" --open`));
    console.log(chalk.gray(`   At session end:            /workmem-capture\n`));

    console.log(chalk.green.bold('✨ Ready to start working!\n'));
    console.log(chalk.gray('='.repeat(70) + '\n'));
  });

program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
