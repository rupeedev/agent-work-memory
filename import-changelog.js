#!/usr/bin/env node
const fs = require('fs');
const { db } = require('./db');
const chalk = require('chalk');

/**
 * Import changelog entries from a text file to SQLite database
 *
 * Usage: node import-changelog.js <changelog-file> <project-name> [version]
 */

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(chalk.yellow('Usage: node import-changelog.js <changelog-file> <project-name> [version]'));
  console.log(chalk.gray('Example: node import-changelog.js ~/path/to/ChangeLog.txt "AI-Infra" "Phase 1"'));
  process.exit(1);
}

const [changelogFile, projectName, version] = args;

if (!fs.existsSync(changelogFile)) {
  console.log(chalk.red(`File not found: ${changelogFile}`));
  process.exit(1);
}

console.log(chalk.blue.bold('\n📥 Importing Changelog\n'));
console.log(chalk.gray(`File: ${changelogFile}`));
console.log(chalk.gray(`Project: ${projectName}`));
console.log(chalk.gray(`Version: ${version || 'Unreleased'}\n`));

const content = fs.readFileSync(changelogFile, 'utf-8');

// Parse the changelog content
const parseChangelog = (content) => {
  const entries = [];
  const features = [];

  // Split by common section markers
  const lines = content.split('\n');
  let currentSection = null;
  let currentEntry = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    // Detect completed items (✅, -, •)
    if (line.match(/^[✅✓•\-]\s+(.+)/)) {
      const title = line.replace(/^[✅✓•\-]\s+/, '').trim();

      // Determine category and type from context
      let category = 'feature';
      let type = 'COMPLETED';

      if (title.toLowerCase().includes('fix')) {
        type = 'FIXED';
        category = 'bugfix';
      } else if (title.toLowerCase().includes('add')) {
        type = 'ADDED';
      } else if (title.toLowerCase().includes('update') || title.toLowerCase().includes('chang')) {
        type = 'CHANGED';
      } else if (title.toLowerCase().includes('implement')) {
        type = 'COMPLETED';
      }

      if (title.toLowerCase().includes('docker') || title.toLowerCase().includes('infrastructure')) {
        category = 'infrastructure';
      } else if (title.toLowerCase().includes('doc')) {
        category = 'documentation';
      } else if (title.toLowerCase().includes('api') || title.toLowerCase().includes('endpoint')) {
        category = 'feature';
      }

      currentEntry = {
        title: title,
        type: type,
        category: category,
        description: '',
        section: currentSection
      };

      entries.push(currentEntry);
    }
    // Detect pending items (⏳, TODO, 🔄)
    else if (line.match(/^[⏳🔄]\s+(.+)/) || line.toLowerCase().includes('todo') || line.toLowerCase().includes('pending')) {
      const title = line.replace(/^[⏳🔄]\s+/, '').replace(/todo:/i, '').trim();

      currentEntry = {
        title: title,
        type: 'PENDING',
        category: 'feature',
        description: '',
        section: currentSection
      };

      entries.push(currentEntry);
    }
    // Detect section headers
    else if (line.match(/^#+\s+(.+)/) || line.match(/^[A-Z][^a-z]{5,}/)) {
      currentSection = line.replace(/^#+\s+/, '').trim();
    }
    // Add to description of current entry
    else if (currentEntry && line.length > 10 && !line.match(/^[=\-]{3,}/)) {
      currentEntry.description += (currentEntry.description ? ' ' : '') + line;
    }
  }

  // Extract features from entries
  entries.forEach(entry => {
    if (entry.title.length > 10 && !entry.title.match(/^(http|\/\/)/)) {
      features.push({
        name: entry.title.substring(0, 100),
        status: entry.type === 'COMPLETED' || entry.type === 'FIXED' || entry.type === 'ADDED' ? 'completed' :
                entry.type === 'PENDING' ? 'pending' : 'in_progress',
        description: entry.description.substring(0, 500),
        priority: entry.type === 'FIXED' ? 'high' : 'medium'
      });
    }
  });

  return { entries, features };
};

const { entries, features } = parseChangelog(content);

console.log(chalk.gray(`Found ${entries.length} changelog entries`));
console.log(chalk.gray(`Found ${features.length} potential features\n`));

// Import changelog entries
const stmtChangelog = db.prepare(`
  INSERT INTO changelog_entries (project, version, entry_type, category, title, description, date)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const stmtFeature = db.prepare(`
  INSERT INTO features (project, feature_name, status, priority, description)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT DO NOTHING
`);

let changelogCount = 0;
let featureCount = 0;

// Insert changelog entries
db.transaction(() => {
  entries.forEach(entry => {
    try {
      stmtChangelog.run(
        projectName,
        version || null,
        entry.type,
        entry.category,
        entry.title,
        entry.description || '',
        new Date().toISOString()
      );
      changelogCount++;
    } catch (err) {
      // Skip duplicates
    }
  });

  // Insert features
  features.forEach(feature => {
    try {
      stmtFeature.run(
        projectName,
        feature.name,
        feature.status,
        feature.priority,
        feature.description || ''
      );
      featureCount++;
    } catch (err) {
      // Skip duplicates
    }
  });
})();

console.log(chalk.green.bold('✅ Import Complete!\n'));
console.log(chalk.gray(`Imported ${changelogCount} changelog entries`));
console.log(chalk.gray(`Imported ${featureCount} features\n`));

console.log(chalk.blue('View imported data:'));
console.log(chalk.gray(`  workmem-session show-changelog -p "${projectName}"`));
console.log(chalk.gray(`  workmem-session list-completed-features -p "${projectName}"`));
console.log(chalk.gray(`  workmem-session generate-report -p "${projectName}" --output CHANGELOG.md\n`));
