# Claude Merge Visualizer

An enhanced visual interface for AI-assisted git merges, giving Claude more presence and control during the merge process.

![Claude Merge Visualizer Screenshot](https://example.com/screenshot.png)

## Features

- **Rich Terminal UI**: Interactive terminal interface with Claude's avatar and styled text
- **Visual Merge Process**: Progress bars and animations for merge operations
- **Enhanced Conflict Visualization**: Visual representation of merge conflicts with context
- **Interactive Resolution Workflow**: Step-by-step guided conflict resolution with multiple options
- **AI-Driven Assistance**: Claude analyzes your repository context to provide informed merge guidance
- **Customizable Experience**: Options for how to handle merge situations

## Installation

1. Run the installer script:

   ```bash
   ./install-visualizer.sh
   ```

   This will:
   - Install required dependencies using npm
   - Make the visualizer script executable
   - Install the `claude-merge-visualizer` command in a location on your PATH
   - Optionally update your existing `claude-merge-main` script to use the visualizer
   - Optionally create a pull request for the submodule changes

2. (Optional) Create an alias for easier access:

   ```bash
   # Add to your ~/.bashrc, ~/.zshrc, or equivalent
   alias cmv='claude-merge-visualizer'
   ```

## Usage

Navigate to your git repository and run:

```bash
claude-merge-visualizer
```

The visualizer will:

1. Display Claude's avatar and welcome message
2. Check your repository status and current branch
3. Guide you through the merge process with visual cues
4. Help you understand and resolve any conflicts
5. Provide AI-powered assistance throughout the process

### Command Line Options

```
claude-merge-visualizer [options]

Options:
  --verify      Verify manual conflict resolutions
  --help, -h    Show this help message
  --version, -v Show version information
```

## Workflow Example

```
$ claude-merge-visualizer

     ____  _                 _        __  __
    / ___|| | __ _ _   _  __| | ___  |  \/  | ___ _ __ __ _  ___
   | |   | |/ _` | | | |/ _` |/ _ \ | |\/| |/ _ \ '__/ _` |/ _ \
   | |___| | (_| | |_| | (_| |  __/ | |  | |  __/ | | (_| |  __/
    \____|_|\__,_|\__,_|\__,_|\___| |_|  |_|\___|_|  \__, |\___|
                                                     |___/
               __  __                        
              |  \/  | ___ _ __ __ _  ___   
              | |\/| |/ _ \ '__/ _` |/ _ \  
              | |  | |  __/ | | (_| |  __/  
              |_|  |_|\___|_|  \__, |\___|  
                               |___/        

┌────────────────────────────────────────────────────────┐
│ Merging main into feature/new-ui                       │
└────────────────────────────────────────────────────────┘

   .--.         ┌────────────────────────────────────────────┐
  |o_o |        │ I'm going to fetch the latest changes      │
  |:_/ |        │ from the remote repository. This ensures   │
 //   \ \       │ we're working with the most up-to-date     │
(|     | )      │ code.                                      │
/'\\_   _/`\    │                                            │
\\___)=(___/    └────────────────────────────────────────────┘

Fetching latest changes... ✓

   .--.         ┌────────────────────────────────────────────┐
  |o_o |        │ Now I'll attempt to merge main into your   │
  |:_/ |        │ current branch. I'll handle any conflicts  │
 //   \ \       │ that arise and guide you through the       │
(|     | )      │ process.                                   │
/'\\_   _/`\    │                                            │
\\___)=(___/    └────────────────────────────────────────────┘

Merging: [██████████████████████████████] 100%

Merge Conflicts Detected:

1. src/components/Button.js
  Conflict markers:
  <<<<<<< HEAD
  ======= 
  >>>>>>> origin/main
  ... and 2 more conflict markers

How would you like to proceed with conflict resolution?
❯ Let Claude analyze and suggest resolutions for all conflicts
  Let Claude analyze specific files
  Use visual merge tool (if configured)
  Resolve manually and then let Claude verify
  Abort merge

```

## Integration with Claude Code

The visualizer integrates seamlessly with Claude Code. When you choose to have Claude analyze conflicts, it will:

1. Prepare a detailed prompt with context about your specific conflicts
2. Launch Claude Code with this context
3. Guide you through implementing the suggested resolutions

## Requirements

- Node.js and npm
- Git repository
- Bash-compatible shell
- Claude Code installed (`npm install -g @anthropic-ai/claude-code`)
- Terminal with ANSI color support

## Dependencies

The visualizer uses these Node.js packages:
- chalk - Terminal string styling
- ora - Elegant terminal spinners
- boxen - Create boxes in the terminal
- figlet - ASCII art from text
- inquirer - Interactive command line prompts

## Troubleshooting

If you encounter any issues with the visualizer:

1. Ensure you have the latest versions of Node.js and npm installed
2. Verify that your terminal supports ANSI colors and cursor positioning
3. Check that you have Claude Code installed and working
4. Try reinstalling with `./install-visualizer.sh`
5. Check the console output for specific error messages
6. If Claude doesn't launch correctly, try running `claude code` separately to verify it works

## Contributing

Feel free to enhance this visualizer with:
- Additional visual elements and animations
- More detailed conflict analysis views
- Enhanced AI prompt engineering
- Support for additional merge scenarios
- Theme customization options

## License

MIT