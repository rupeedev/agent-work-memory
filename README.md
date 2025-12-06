# Work Memory 🧠

SQLite-based CLI tool for tracking work sessions, changelog entries, features, decisions, and issues across multiple projects.

## Features

✅ **Session Tracking** - Log work sessions with commands, decisions, and issues
✅ **Changelog Management** - Track changes with types (COMPLETED, ADDED, FIXED, etc.)
✅ **Feature Tracking** - Manage features through their lifecycle (pending → in_progress → completed)
✅ **Decision Logging** - Document technical decisions with context and alternatives
✅ **Issue Management** - Track bugs with severity levels and resolutions
✅ **Report Generation** - Generate professional changelog reports in markdown/text
✅ **Multi-Project Support** - Track multiple projects in one database
✅ **Claude CLI Integration** - Auto-capture sessions with `/workmem-capture`
✅ **Local SQLite** - All data stored locally in `~/.work-memory/memory.db`

## Installation

```bash
npm install -g work-memory
```

Or from source:

```bash
git clone <repository>
cd work-memory
npm install
npm link
```

## Commands

### Basic Work Memory (`workmem`)

```bash
# Add entry
workmem add "Fixed authentication bug"
workmem add "Decided to use PKL" --type decision --tags "infra"

# View entries
workmem today           # Today's work
workmem yesterday       # Yesterday's work
workmem recall          # Last 7 days
workmem recall --days 30

# Search
workmem search "authentication"
workmem stats           # View statistics
```

### Session Tracking (`workmem-session`)

#### Session Management

```bash
# Start a session (comprehensive project summary)
workmem-session session-start -p "project-name"

# Create session handoff
workmem-session handoff \
  --summary "Implemented feature X" \
  --duration "2 hours" \
  --files "file1.js,file2.go" \
  --project "project-name"

# View sessions
workmem-session list-sessions
workmem-session list-sessions -p "project-name"
```

#### Commands Logging

```bash
# Log command
workmem-session cmd "docker compose build" \
  --desc "Build containers" \
  --category "docker" \
  --project "project-name"

# View commands
workmem-session list-commands
workmem-session list-commands --category "git"
```

#### Technical Decisions

```bash
# Log decision
workmem-session decision "Use SQLite for storage" \
  --context "Need local database" \
  --solution "Use better-sqlite3" \
  --alternatives "PostgreSQL, MongoDB" \
  --category "technology" \
  --project "project-name"

# View decisions
workmem-session list-decisions
workmem-session list-decisions --category "architecture"
```

#### Issue Tracking

```bash
# Log issue
workmem-session issue "API timeout on large requests" \
  --severity "high" \
  --desc "Requests >1MB timeout after 30s" \
  --workaround "Split into smaller requests" \
  --project "project-name"

# Resolve issue
workmem-session resolve <issue-id> \
  --resolution "Increased timeout to 120s"

# View issues
workmem-session list-issues --open
workmem-session list-issues --resolved
```

#### Current State

```bash
# Update project state
workmem-session state \
  --project "project-name" \
  --completed "Feature X, Bug Y" \
  --in-progress "Feature Z" \
  --next "Add tests, Deploy to staging" \
  --notes "Database migration pending"

# View state
workmem-session show-state -p "project-name"
```

#### Changelog Tracking

```bash
# Add changelog entry
workmem-session changelog "SQLite storage implemented" \
  -p "project-name" \
  -t COMPLETED \
  -c feature \
  -d "Replaced in-memory storage with SQLite" \
  -v "v1.0.0"

# View changelog
workmem-session show-changelog -p "project-name"
workmem-session show-changelog -p "project-name" --format markdown

# Entry types: COMPLETED, ADDED, CHANGED, FIXED, REMOVED, IN_PROGRESS, PENDING
# Categories: feature, bugfix, enhancement, documentation, infrastructure
```

#### Feature Tracking

```bash
# Add/update feature
workmem-session feature "User authentication" \
  -p "project-name" \
  --status completed \
  --priority high \
  -d "OAuth2 implementation" \
  --tags "auth,security"

# View features
workmem-session list-features -p "project-name"
workmem-session list-completed-features -p "project-name"
workmem-session show-pending-features -p "project-name"

# Statuses: pending, in_progress, completed, blocked
# Priorities: critical, high, medium, low
```

#### Release Management

```bash
# Create release
workmem-session release "v1.0.0" \
  -p "project-name" \
  --type major \
  --summary "Initial production release" \
  --notes "First stable version"
```

#### Report Generation

```bash
# Generate markdown changelog
workmem-session generate-report \
  -p "project-name" \
  --format markdown \
  --output CHANGELOG.md

# Generate text report
workmem-session generate-report \
  -p "project-name" \
  --format text

# Report since specific date
workmem-session generate-report \
  -p "project-name" \
  --since "2025-01-01"
```

## Claude CLI Integration

### `/workmem-capture`

Automatically captures session data at end of work session.

**Location**: `~/.claude/commands/workmem-capture.md`

**Usage**: In Claude CLI, run:
```
/workmem-capture
```

**What it captures**:
- Session handoff with summary
- All bash commands executed
- Technical decisions made
- Issues found/fixed
- Changelog entries (COMPLETED, ADDED, FIXED, etc.)
- Features and their status
- Current project state

### `/start-session`

Starts new session with comprehensive project summary.

**Location**: `~/.claude/commands/start-session.md`

**Usage**: In Claude CLI, run:
```
/start-session
```

**What it shows**:
- Current project state
- Feature statistics
- Active features (in-progress, pending, blocked)
- Recent changelog entries
- Open issues
- Recent technical decisions
- Recent sessions
- Quick commands reference

## Daily Workflow

### Morning - Start Session

```bash
# In Claude CLI
/start-session

# Or in terminal
workmem-session session-start -p "project-name"
```

See where you left off, what's in progress, and what's next.

### During Day - Work & Track

```bash
# Work on features
# Fix bugs
# Make decisions
# Execute commands

# Quick notes
workmem add "Found performance issue in query"
```

### Evening - Capture Session

```bash
# In Claude CLI
/workmem-capture
```

Automatically logs:
- All work completed
- Commands executed
- Decisions made
- Changelog entries
- Feature updates
- Issues tracked

### Next Morning - Repeat

```bash
/start-session
```

See yesterday's progress and continue.

## Database Schema

All data stored in `~/.work-memory/memory.db` (SQLite):

**Tables**:
- `entries` - Basic work memory entries
- `sessions` - Daily summaries
- `session_handoffs` - Session handoffs with metadata
- `commands_log` - Executed commands
- `decisions` - Technical decisions
- `issues` - Bug tracking
- `current_state` - Project current state
- `changelog_entries` - Changelog tracking
- `features` - Feature lifecycle tracking
- `releases` - Version/release management

## Multi-Project Tracking

Track multiple projects simultaneously:

```bash
# Project A
workmem-session changelog "Feature X" -p "ProjectA" -t COMPLETED
workmem-session feature "Auth system" -p "ProjectA" --status completed

# Project B
workmem-session changelog "Feature Y" -p "ProjectB" -t IN_PROGRESS
workmem-session feature "Dashboard" -p "ProjectB" --status pending

# View project-specific data
workmem-session show-changelog -p "ProjectA"
workmem-session list-features -p "ProjectB"
workmem-session generate-report -p "ProjectA" --output ProjectA-CHANGELOG.md
```

## Import Existing Changelog

If you have an existing changelog file:

```bash
node import-changelog.js /path/to/ChangeLog.txt "project-name" "v1.0.0"
```

Automatically parses and imports entries into SQLite.

## Use Cases

**For Individual Developers**:
- Track daily work and decisions
- Generate changelogs for releases
- Remember context between sessions
- Document technical decisions
- Track feature progress

**For Teams**:
- Consistent changelog format
- Easy handoffs between team members
- Historical decision tracking
- Project progress visibility
- Professional reports for stakeholders

**For Projects**:
- Automated changelog generation
- Feature roadmap tracking
- Issue management
- Release notes generation
- Development history

## Database Location

```
~/.work-memory/memory.db
```

## Tech Stack

- **Node.js** - Runtime
- **better-sqlite3** - SQLite database
- **commander** - CLI framework
- **chalk** - Terminal styling

## Sharing

### NPM Package

```bash
# Package
npm pack

# Share tarball, colleague installs:
npm install -g work-memory-1.0.0.tgz
```

### Git Repository

```bash
git clone <repository>
cd work-memory
npm install
npm link
```

## Example Output

### session-start

```
🚀 Starting New Session: AI-Infra

📊 Current Project State
✅ Recently Completed: Feature X, Bug Y
🔄 In Progress: Feature Z
➡️  Next Steps: Add tests, deploy

🎯 Feature Overview
   ✅ completed: 15
   🔄 in_progress: 3
   ⏳ pending: 5

📝 Recent Changelog (last 15 entries grouped by type)
🐛 Open Issues (severity-sorted)
💡 Recent Decisions (last 5)
📅 Recent Sessions (last 3)
```

### generate-report (Markdown)

```markdown
# ProjectName - Changelog Report

## 📊 Feature Statistics
- ✅ completed: 15
- 🔄 in_progress: 3

## 📝 Changes

### v1.0.0

#### ✅ COMPLETED
- **SQLite storage** (_feature_)
- **Session tracking** (_feature_)

#### 🐛 FIXED
- **Null pointer error** (_bugfix_)
```

## License

MIT

## Author

Rupesh Panwar

---

**Simple. Powerful. Local. Production-Ready.** 🚀
