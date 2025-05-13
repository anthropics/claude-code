#!/usr/bin/env node

/**
 * Setup Git Agent
 * ==============
 * 
 * Sets up the Git agent for A2A communication in the Claude Neural Framework.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue.bold('\n=== Claude Neural Framework - Git Agent Setup ===\n'));

// Check if git is installed
try {
  execSync('git --version', { stdio: 'ignore' });
  console.log(chalk.green('✓ Git is installed'));
} catch (error) {
  console.error(chalk.red('✗ Git is not installed. Please install Git and try again.'));
  process.exit(1);
}

// Check if required packages are installed
const requiredPackages = ['chalk', 'uuid'];
const packageJsonPath = path.resolve(__dirname, '../../package.json');

let packageJson;
try {
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (error) {
  console.error(chalk.red(`✗ Could not read package.json: ${error.message}`));
  process.exit(1);
}

const dependencies = packageJson.dependencies || {};
const missingPackages = requiredPackages.filter(pkg => !dependencies[pkg]);

if (missingPackages.length > 0) {
  console.log(chalk.yellow(`Installing missing packages: ${missingPackages.join(', ')}`));
  
  try {
    execSync(`npm install --save ${missingPackages.join(' ')}`, { stdio: 'inherit' });
    console.log(chalk.green('✓ Required packages installed'));
  } catch (error) {
    console.error(chalk.red(`✗ Failed to install packages: ${error.message}`));
    process.exit(1);
  }
}

// Check if scripts directory exists
const scriptsDir = path.resolve(__dirname, '../git');
if (!fs.existsSync(scriptsDir)) {
  fs.mkdirSync(scriptsDir, { recursive: true });
  console.log(chalk.green(`✓ Created directory: ${scriptsDir}`));
}

// Create git-helper.js script
const gitHelperPath = path.join(scriptsDir, 'git-helper.js');
const gitHelperContent = `#!/usr/bin/env node

/**
 * Git Helper
 * ==========
 * 
 * Helper script for Git operations in the Claude Neural Framework.
 */

const { execSync } = require('child_process');
const chalk = require('chalk');
const a2aManager = require('../../core/mcp/a2a_manager');

/**
 * Send a Git command through A2A
 * @param {Object} params - Git command parameters
 */
async function sendGitCommand(params) {
  const message = {
    from: 'git-helper',
    to: 'git-agent',
    task: 'git-operation',
    params
  };
  
  try {
    const response = await a2aManager.sendMessage(message);
    
    if (response.params?.status === 'success') {
      console.log(response.params.output);
    } else {
      console.error(\`Error: \${response.params?.error || 'Unknown error'}\`);
      process.exit(1);
    }
  } catch (error) {
    console.error(\`Error: \${error.message}\`);
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: node git-helper.js <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  status              Show repository status');
    console.log('  commit <message>    Commit changes with message');
    console.log('  pull [branch]       Pull changes from remote');
    console.log('  push [branch]       Push changes to remote');
    console.log('  log [n]             Show commit history (n entries)');
    console.log('  branch [name]       List or create branches');
    console.log('  checkout <branch>   Switch to branch');
    console.log('  diff [file]         Show changes');
    return;
  }
  
  const command = args[0];
  
  switch (command) {
    case 'status':
      await sendGitCommand({ operation: 'status' });
      break;
    
    case 'commit':
      if (args.length < 2) {
        console.error('Error: Commit message required');
        process.exit(1);
      }
      await sendGitCommand({ 
        operation: 'commit', 
        message: args[1],
        all: args.includes('--all') || args.includes('-a')
      });
      break;
    
    case 'pull':
      await sendGitCommand({ 
        operation: 'pull',
        branch: args[1]
      });
      break;
    
    case 'push':
      await sendGitCommand({ 
        operation: 'push',
        branch: args[1]
      });
      break;
    
    case 'log':
      await sendGitCommand({ 
        operation: 'log',
        limit: args[1] ? parseInt(args[1]) : undefined
      });
      break;
    
    case 'branch':
      await sendGitCommand({ 
        operation: 'branch',
        name: args[1]
      });
      break;
    
    case 'checkout':
      if (args.length < 2) {
        console.error('Error: Branch name required');
        process.exit(1);
      }
      await sendGitCommand({ 
        operation: 'checkout',
        branch: args[1]
      });
      break;
    
    case 'diff':
      await sendGitCommand({ 
        operation: 'diff',
        file: args[1]
      });
      break;
    
    default:
      console.error(\`Unknown command: \${command}\`);
      process.exit(1);
  }
}

main().catch(console.error);
`;

fs.writeFileSync(gitHelperPath, gitHelperContent);
fs.chmodSync(gitHelperPath, 0o755);
console.log(chalk.green(`✓ Created git helper script: ${gitHelperPath}`));

// Update package.json with git scripts
if (!packageJson.scripts) {
  packageJson.scripts = {};
}

const gitScripts = {
  'git:status': 'node scripts/git/git-helper.js status',
  'git:commit': 'node scripts/git/git-helper.js commit',
  'git:pull': 'node scripts/git/git-helper.js pull',
  'git:push': 'node scripts/git/git-helper.js push',
  'git:log': 'node scripts/git/git-helper.js log',
  'git:branch': 'node scripts/git/git-helper.js branch',
  'git:checkout': 'node scripts/git/git-helper.js checkout',
  'git:diff': 'node scripts/git/git-helper.js diff'
};

let scriptsUpdated = false;
for (const [name, script] of Object.entries(gitScripts)) {
  if (!packageJson.scripts[name]) {
    packageJson.scripts[name] = script;
    scriptsUpdated = true;
  }
}

if (scriptsUpdated) {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log(chalk.green('✓ Updated package.json with git scripts'));
}

// Add to SAAR script
const saarPath = path.resolve(__dirname, '../../saar.sh');
if (fs.existsSync(saarPath)) {
  let saarContent = fs.readFileSync(saarPath, 'utf8');
  
  // Check if git command already exists
  if (!saarContent.includes('do_git()')) {
    // Find the main() function
    const mainFunctionMatch = saarContent.match(/main\(\) \{[^}]*\}/s);
    
    if (mainFunctionMatch) {
      // Add git function
      const gitFunction = `
# Git operations function
do_git() {
  check_dependencies
  
  echo -e "${chalk.blue.bold('Running Git operations...')}${chalk.reset}"
  
  if [ $# -eq 0 ]; then
    node scripts/git/git-helper.js
    exit 0
  fi
  
  # Command parser
  case "$1" in
    status)
      shift
      node scripts/git/git-helper.js status "$@"
      ;;
    commit)
      shift
      node scripts/git/git-helper.js commit "$@"
      ;;
    pull)
      shift
      node scripts/git/git-helper.js pull "$@"
      ;;
    push)
      shift
      node scripts/git/git-helper.js push "$@"
      ;;
    log)
      shift
      node scripts/git/git-helper.js log "$@"
      ;;
    branch)
      shift
      node scripts/git/git-helper.js branch "$@"
      ;;
    checkout)
      shift
      node scripts/git/git-helper.js checkout "$@"
      ;;
    diff)
      shift
      node scripts/git/git-helper.js diff "$@"
      ;;
    *)
      echo -e "${chalk.red('Error: Unknown git command')} '$1'${chalk.reset}"
      node scripts/git/git-helper.js
      exit 1
      ;;
  esac
}
`;
      
      // Add git case to main function
      const updatedMainFunction = mainFunctionMatch[0].replace(
        /case "\$1" in/,
        'case "$1" in\n    git)\n      shift\n      do_git "$@"\n      ;;'
      );
      
      // Replace main function
      saarContent = saarContent.replace(mainFunctionMatch[0], updatedMainFunction);
      
      // Add git function before main
      saarContent = saarContent.replace(
        /# Main function/,
        `${gitFunction}\n# Main function`
      );
      
      // Add git to help text
      saarContent = saarContent.replace(
        /echo "  help        Show this help message"/,
        'echo "  help        Show this help message"\n  echo "  git         Git operations through A2A"'
      );
      
      fs.writeFileSync(saarPath, saarContent);
      console.log(chalk.green('✓ Added git commands to SAAR script'));
    } else {
      console.warn(chalk.yellow('! Could not find main function in SAAR script. Git commands not added.'));
    }
  } else {
    console.log(chalk.green('✓ SAAR script already has git commands'));
  }
} else {
  console.warn(chalk.yellow('! SAAR script not found. Git commands not added.'));
}

// Update CLAUDE.md
const claudeMdPath = path.resolve(__dirname, '../../CLAUDE.md');
if (fs.existsSync(claudeMdPath)) {
  let claudeMdContent = fs.readFileSync(claudeMdPath, 'utf8');
  
  // Check if Git section already exists
  if (!claudeMdContent.includes('### Git Operations')) {
    // Find the right spot to add Git section
    const saarSection = claudeMdContent.match(/### Quick Start with SAAR[^#]*/s);
    
    if (saarSection) {
      const gitSection = `
### Git Operations with A2A

Git operations are integrated with the Agent-to-Agent protocol:

\`\`\`bash
# Using SAAR
./saar.sh git status
./saar.sh git commit "Commit message" --all
./saar.sh git pull main
./saar.sh git log 5

# Using npm scripts
npm run git:status
npm run git:commit -- "Commit message" --all
npm run git:pull -- main
npm run git:log -- 5

# Using A2A directly
node core/mcp/a2a_manager.js --to=git-agent --task=git-operation --params='{"operation": "status"}'
\`\`\`
`;
      
      // Add Git section after SAAR section
      claudeMdContent = claudeMdContent.replace(
        saarSection[0],
        `${saarSection[0]}${gitSection}`
      );
      
      fs.writeFileSync(claudeMdPath, claudeMdContent);
      console.log(chalk.green('✓ Added Git section to CLAUDE.md'));
    } else {
      console.warn(chalk.yellow('! Could not find SAAR section in CLAUDE.md. Git section not added.'));
    }
  } else {
    console.log(chalk.green('✓ CLAUDE.md already has Git section'));
  }
} else {
  console.warn(chalk.yellow('! CLAUDE.md not found. Git section not added.'));
}

console.log(chalk.green.bold('\n✓ Git agent setup complete!'));
console.log('\nYou can now use the Git agent with the following commands:');
console.log('  ./saar.sh git status');
console.log('  npm run git:status');
console.log('  node core/mcp/a2a_manager.js --to=git-agent --task=git-operation --params=\'{"operation": "status"}\'');