#!/usr/bin/env node
const { Command } = require('commander');
const chalk = require('chalk');
const { db, DB_PATH } = require('./db');

const program = new Command();

program
  .name('workmem')
  .description('Simple CLI tool for tracking daily work context and decisions')
  .version('1.0.0');

// Add entry
program
  .command('add <content>')
  .description('Add a new entry (note, meeting, decision, or context)')
  .option('-t, --type <type>', 'Type: note, meeting, decision, context', 'note')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('-p, --project <project>', 'Project name')
  .action((content, options) => {
    const timestamp = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO entries (timestamp, type, content, tags, project)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      timestamp,
      options.type,
      content,
      options.tags || null,
      options.project || null
    );

    console.log(chalk.green('✓ Entry added:'));
    console.log(chalk.gray(`  ID: ${result.lastInsertRowid}`));
    console.log(chalk.gray(`  Type: ${options.type}`));
    console.log(chalk.gray(`  Content: ${content}`));
    if (options.tags) console.log(chalk.gray(`  Tags: ${options.tags}`));
    if (options.project) console.log(chalk.gray(`  Project: ${options.project}`));
  });

// Show today's entries
program
  .command('today')
  .description('Show today\'s entries')
  .action(() => {
    const today = new Date().toISOString().split('T')[0];
    const entries = db.prepare(`
      SELECT * FROM entries
      WHERE DATE(timestamp) = ?
      ORDER BY timestamp DESC
    `).all(today);

    if (entries.length === 0) {
      console.log(chalk.yellow('No entries for today'));
      return;
    }

    console.log(chalk.blue.bold(`\n📅 Today (${today})`));
    console.log(chalk.gray('='.repeat(50)));

    entries.forEach((entry, idx) => {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const icon = getTypeIcon(entry.type);
      console.log(`\n${chalk.gray(`${idx + 1}.`)} ${icon} ${chalk.bold(entry.type.toUpperCase())}`);
      console.log(`   ${chalk.gray('Time:')} ${time}`);
      console.log(`   ${entry.content}`);
      if (entry.tags) console.log(`   ${chalk.gray('Tags:')} ${entry.tags}`);
      if (entry.project) console.log(`   ${chalk.gray('Project:')} ${entry.project}`);
    });

    console.log(chalk.gray('\n' + '='.repeat(50)));
    console.log(chalk.green(`Total: ${entries.length} entries\n`));
  });

// Show yesterday's entries
program
  .command('yesterday')
  .description('Show yesterday\'s entries')
  .action(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const entries = db.prepare(`
      SELECT * FROM entries
      WHERE DATE(timestamp) = ?
      ORDER BY timestamp DESC
    `).all(yesterdayStr);

    if (entries.length === 0) {
      console.log(chalk.yellow('No entries for yesterday'));
      return;
    }

    console.log(chalk.blue.bold(`\n📅 Yesterday (${yesterdayStr})`));
    console.log(chalk.gray('='.repeat(50)));

    entries.forEach((entry, idx) => {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const icon = getTypeIcon(entry.type);
      console.log(`\n${chalk.gray(`${idx + 1}.`)} ${icon} ${chalk.bold(entry.type.toUpperCase())}`);
      console.log(`   ${chalk.gray('Time:')} ${time}`);
      console.log(`   ${entry.content}`);
      if (entry.tags) console.log(`   ${chalk.gray('Tags:')} ${entry.tags}`);
      if (entry.project) console.log(`   ${chalk.gray('Project:')} ${entry.project}`);
    });

    console.log(chalk.gray('\n' + '='.repeat(50)));
    console.log(chalk.green(`Total: ${entries.length} entries\n`));
  });

// Search entries
program
  .command('search <query>')
  .description('Search entries by content, tags, or project')
  .option('-d, --days <days>', 'Search last N days', '30')
  .action((query, options) => {
    const entries = db.prepare(`
      SELECT * FROM entries
      WHERE (content LIKE ? OR tags LIKE ? OR project LIKE ?)
      AND DATE(timestamp) >= DATE('now', '-' || ? || ' days')
      ORDER BY timestamp DESC
      LIMIT 20
    `).all(`%${query}%`, `%${query}%`, `%${query}%`, options.days);

    if (entries.length === 0) {
      console.log(chalk.yellow(`No entries found matching "${query}"`));
      return;
    }

    console.log(chalk.blue.bold(`\n🔍 Search Results for "${query}"`));
    console.log(chalk.gray('='.repeat(50)));

    entries.forEach((entry, idx) => {
      const date = new Date(entry.timestamp).toLocaleDateString();
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const icon = getTypeIcon(entry.type);
      console.log(`\n${chalk.gray(`${idx + 1}.`)} ${icon} ${chalk.bold(entry.type.toUpperCase())} ${chalk.gray(`- ${date} ${time}`)}`);
      console.log(`   ${entry.content}`);
      if (entry.tags) console.log(`   ${chalk.gray('Tags:')} ${entry.tags}`);
      if (entry.project) console.log(`   ${chalk.gray('Project:')} ${entry.project}`);
    });

    console.log(chalk.gray('\n' + '='.repeat(50)));
    console.log(chalk.green(`Total: ${entries.length} entries\n`));
  });

// Recall last N days
program
  .command('recall')
  .description('Recall entries from last N days')
  .option('-d, --days <days>', 'Number of days to recall', '7')
  .option('-t, --type <type>', 'Filter by type (note, meeting, decision, context)')
  .action((options) => {
    let query = `
      SELECT * FROM entries
      WHERE DATE(timestamp) >= DATE('now', '-' || ? || ' days')
    `;

    const params = [options.days];

    if (options.type) {
      query += ' AND type = ?';
      params.push(options.type);
    }

    query += ' ORDER BY timestamp DESC';

    const entries = db.prepare(query).all(...params);

    if (entries.length === 0) {
      console.log(chalk.yellow(`No entries in the last ${options.days} days`));
      return;
    }

    console.log(chalk.blue.bold(`\n🧠 Memory Recall - Last ${options.days} days`));
    console.log(chalk.gray('='.repeat(50)));

    // Group by date
    const byDate = {};
    entries.forEach(entry => {
      const date = entry.timestamp.split('T')[0];
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(entry);
    });

    Object.keys(byDate).sort().reverse().forEach(date => {
      console.log(chalk.blue.bold(`\n📅 ${date}`));
      byDate[date].forEach(entry => {
        const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        const icon = getTypeIcon(entry.type);
        console.log(`  ${icon} ${chalk.gray(time)} ${entry.content}`);
        if (entry.project) console.log(`     ${chalk.gray('Project:')} ${entry.project}`);
      });
    });

    console.log(chalk.gray('\n' + '='.repeat(50)));
    console.log(chalk.green(`Total: ${entries.length} entries\n`));
  });

// Stats
program
  .command('stats')
  .description('Show statistics')
  .option('-d, --days <days>', 'Stats for last N days', '30')
  .action((options) => {
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM entries
      WHERE DATE(timestamp) >= DATE('now', '-' || ? || ' days')
    `).get(options.days);

    const byType = db.prepare(`
      SELECT type, COUNT(*) as count FROM entries
      WHERE DATE(timestamp) >= DATE('now', '-' || ? || ' days')
      GROUP BY type
      ORDER BY count DESC
    `).all(options.days);

    const byProject = db.prepare(`
      SELECT project, COUNT(*) as count FROM entries
      WHERE project IS NOT NULL
      AND DATE(timestamp) >= DATE('now', '-' || ? || ' days')
      GROUP BY project
      ORDER BY count DESC
      LIMIT 5
    `).all(options.days);

    console.log(chalk.blue.bold(`\n📊 Statistics - Last ${options.days} days`));
    console.log(chalk.gray('='.repeat(50)));

    console.log(chalk.green(`\nTotal Entries: ${total.count}`));

    console.log(chalk.blue('\nBy Type:'));
    byType.forEach(row => {
      const icon = getTypeIcon(row.type);
      console.log(`  ${icon} ${row.type.padEnd(15)} ${row.count}`);
    });

    if (byProject.length > 0) {
      console.log(chalk.blue('\nTop Projects:'));
      byProject.forEach(row => {
        console.log(`  📦 ${row.project.padEnd(20)} ${row.count}`);
      });
    }

    console.log(chalk.gray('\n' + '='.repeat(50) + '\n'));
  });

// Info
program
  .command('info')
  .description('Show database info')
  .action(() => {
    const total = db.prepare('SELECT COUNT(*) as count FROM entries').get();
    const firstEntry = db.prepare('SELECT MIN(timestamp) as first FROM entries').get();
    const lastEntry = db.prepare('SELECT MAX(timestamp) as last FROM entries').get();

    console.log(chalk.blue.bold('\n💾 Work Memory Database Info'));
    console.log(chalk.gray('='.repeat(50)));
    console.log(`${chalk.gray('Location:')} ${DB_PATH}`);
    console.log(`${chalk.gray('Total Entries:')} ${total.count}`);
    if (firstEntry.first) {
      console.log(`${chalk.gray('First Entry:')} ${new Date(firstEntry.first).toLocaleDateString()}`);
      console.log(`${chalk.gray('Last Entry:')} ${new Date(lastEntry.last).toLocaleDateString()}`);
    }
    console.log(chalk.gray('='.repeat(50) + '\n'));
  });

// Helper function
function getTypeIcon(type) {
  const icons = {
    note: '📝',
    meeting: '🤝',
    decision: '✅',
    context: '🧠'
  };
  return icons[type] || '•';
}

program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
