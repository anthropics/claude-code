#!/bin/bash
# SAAR - Memory Integration Module
# 
# This module implements the memory persistence and categorization
# system for the SAAR framework and MCP tools.

# Function to setup memory components
setup_memory_components() {
  log "INFO" "Setting up Memory Components..."

  # Create the necessary directories
  mkdir -p "$CONFIG_DIR/memory" "$TOOLS_DIR/memory" 
  mkdir -p "$CONFIG_DIR/memory/categories" "$CONFIG_DIR/memory/thoughts"
  
  # Setup the memory configuration
  setup_memory_config
  
  # Copy the memory persistence module
  mkdir -p "$TOOLS_DIR/memory"
  cp "$SCRIPT_DIR/startup/memory_persistence.js" "$TOOLS_DIR/memory/"
  chmod +x "$TOOLS_DIR/memory/memory_persistence.js"
  
  # Create a symlink to the memory module for easy access
  if [ -f "$CONFIG_DIR/saar/startup/memory_persistence.js" ]; then
    ln -sf "$CONFIG_DIR/saar/startup/memory_persistence.js" "$CONFIG_DIR/tools/memory/memory_persistence.js"
  else
    mkdir -p "$CONFIG_DIR/saar/startup"
    cp "$SCRIPT_DIR/startup/memory_persistence.js" "$CONFIG_DIR/saar/startup/"
    chmod +x "$CONFIG_DIR/saar/startup/memory_persistence.js"
  fi
  
  log "SUCCESS" "Memory Components setup completed"
}

# Function to setup memory configuration
setup_memory_config() {
  log "INFO" "Setting up Memory Configuration..."
  
  # Create default configuration if it doesn't exist
  if [ ! -f "$CONFIG_DIR/memory/config.json" ]; then
    cat > "$CONFIG_DIR/memory/config.json" << 'EOF'
{
  "memory": {
    "enabled": true,
    "max_thoughts": 10000,
    "auto_categorize": true,
    "auto_relate": true,
    "search_depth": 5,
    "retention_policy": "access_based"
  },
  "categories": {
    "problem_analysis": {
      "description": "Analysis of problem statements and requirements",
      "tags": ["analysis", "problem", "requirements"]
    },
    "solution_design": {
      "description": "Design and architecture of solutions",
      "tags": ["design", "architecture", "solution"]
    },
    "implementation": {
      "description": "Implementation details and code",
      "tags": ["implementation", "code", "development"]
    },
    "testing": {
      "description": "Testing strategies and approaches",
      "tags": ["testing", "validation", "verification"]
    },
    "learning": {
      "description": "Learning and insights from experiences",
      "tags": ["learning", "insight", "knowledge"]
    }
  },
  "relationships": {
    "builds_on": "foundation_for",
    "contradicts": "contradicted_by",
    "supports": "supported_by",
    "refines": "refined_by",
    "extends": "extended_by",
    "related": "related"
  },
  "integration": {
    "deepthink": true,
    "mcp": true,
    "autonomy": true
  }
}
EOF
    log "SUCCESS" "Created default memory configuration"
  else
    log "INFO" "Memory configuration already exists"
  fi
}

# Function to create node.js script for memory CLI
setup_memory_cli() {
  log "INFO" "Setting up Memory CLI..."
  
  # Create a CLI wrapper for memory functions
  cat > "$TOOLS_DIR/memory/memory_cli.js" << 'EOF'
#!/usr/bin/env node

/**
 * Memory CLI
 * 
 * Command-line interface for interacting with the memory system.
 */

const fs = require('fs');
const path = require('path');

// Load memory module
const CONFIG_DIR = process.env.HOME + '/.claude';
const memoryModulePath = path.join(CONFIG_DIR, 'saar', 'startup', 'memory_persistence.js');

let memory;
try {
  memory = require(memoryModulePath);
  console.log('Memory persistence module loaded successfully');
} catch (err) {
  console.error(`Error loading memory module: ${err.message}`);
  process.exit(1);
}

// Define commands
const commands = {
  'stats': () => {
    const stats = memory.getMemoryStats();
    console.log(JSON.stringify(stats, null, 2));
  },
  
  'search': (args) => {
    if (args.length < 1) {
      console.error('Search query required');
      process.exit(1);
    }
    
    const query = args[0];
    const category = args.length > 1 ? args[1] : null;
    const limit = args.length > 2 ? parseInt(args[2], 10) : 10;
    
    const results = memory.searchThoughts(query, category, limit);
    
    console.log(`Found ${results.length} results for "${query}"`);
    results.forEach((thought, index) => {
      console.log(`\n[${index + 1}] ${thought.id} (${thought.categories.join(', ')})`);
      console.log('-'.repeat(80));
      console.log(thought.content.substring(0, 200) + (thought.content.length > 200 ? '...' : ''));
      console.log('-'.repeat(80));
    });
  },
  
  'get': (args) => {
    if (args.length < 1) {
      console.error('Thought ID required');
      process.exit(1);
    }
    
    const thoughtId = args[0];
    const thought = memory.retrieveThought(thoughtId);
    
    if (!thought) {
      console.error(`Thought not found: ${thoughtId}`);
      process.exit(1);
    }
    
    console.log(JSON.stringify(thought, null, 2));
  },
  
  'store': (args) => {
    if (args.length < 1) {
      console.error('Content or file path required');
      process.exit(1);
    }
    
    let content = args[0];
    
    // Check if the argument is a file path
    if (content.startsWith('/') && fs.existsSync(content)) {
      try {
        content = fs.readFileSync(content, 'utf8');
      } catch (err) {
        console.error(`Error reading file: ${err.message}`);
        process.exit(1);
      }
    }
    
    const category = args.length > 1 ? args[1] : memory.categorizeThought(content);
    const result = memory.storeThought({ content }, category, 'cli');
    
    if (result) {
      console.log(`Thought stored with ID: ${result.id}`);
      console.log(`Category: ${category}`);
    } else {
      console.error('Failed to store thought');
      process.exit(1);
    }
  },
  
  'relate': (args) => {
    if (args.length < 2) {
      console.error('Source and target thought IDs required');
      process.exit(1);
    }
    
    const sourceId = args[0];
    const targetId = args[1];
    const relationship = args.length > 2 ? args[2] : 'related';
    
    const result = memory.relateThoughts(sourceId, targetId, relationship);
    
    if (result) {
      console.log(`Related thought ${sourceId} to ${targetId} with relationship "${relationship}"`);
    } else {
      console.error('Failed to relate thoughts');
      process.exit(1);
    }
  },
  
  'help': () => {
    console.log('Memory CLI Usage:');
    console.log('  stats                      Show memory statistics');
    console.log('  search <query> [category] [limit]  Search thoughts');
    console.log('  get <id>                   Get a specific thought');
    console.log('  store <content|file> [category]  Store a new thought');
    console.log('  relate <source-id> <target-id> [relationship]  Relate two thoughts');
    console.log('  help                       Show this help message');
  }
};

// Parse arguments
const args = process.argv.slice(2);
const command = args.shift() || 'help';

// Execute command
if (commands[command]) {
  commands[command](args);
} else {
  console.error(`Unknown command: ${command}`);
  commands.help();
  process.exit(1);
}
EOF

  # Make CLI executable
  chmod +x "$TOOLS_DIR/memory/memory_cli.js"
  
  log "SUCCESS" "Memory CLI created"
}

# Run memory operations (for SAAR chain)
run_memory_operation() {
  local operation=${1:-"help"}
  shift
  
  # Check if memory components are installed
  if [ ! -d "$CONFIG_DIR/memory" ] || [ ! -f "$TOOLS_DIR/memory/memory_cli.js" ]; then
    log "WARN" "Memory components not found. Installing..."
    setup_memory_components
    setup_memory_cli
  fi
  
  # Switch based on operation
  case $operation in
    stats)
      # Show memory statistics
      log "INFO" "Memory System Statistics"
      node "$TOOLS_DIR/memory/memory_cli.js" stats
      ;;
      
    search)
      # Search thoughts
      log "INFO" "Searching memory..."
      node "$TOOLS_DIR/memory/memory_cli.js" search "$@"
      ;;
      
    get)
      # Get a specific thought
      log "INFO" "Retrieving thought..."
      node "$TOOLS_DIR/memory/memory_cli.js" get "$@"
      ;;
      
    store)
      # Store a new thought
      log "INFO" "Storing thought..."
      node "$TOOLS_DIR/memory/memory_cli.js" store "$@"
      ;;
      
    relate)
      # Relate two thoughts
      log "INFO" "Relating thoughts..."
      node "$TOOLS_DIR/memory/memory_cli.js" relate "$@"
      ;;
      
    status)
      # Show memory system status
      log "INFO" "Memory System Status"
      
      echo -e "${BOLD}Memory System:${NC}"
      
      # Check configuration
      if [ -f "$CONFIG_DIR/memory/config.json" ]; then
        echo -e "Configuration: ${GREEN}Found${NC}"
        
        # Parse some key settings
        if command -v jq &> /dev/null; then
          local memory_enabled=$(jq -r '.memory.enabled' "$CONFIG_DIR/memory/config.json" 2>/dev/null || echo "false")
          local max_thoughts=$(jq -r '.memory.max_thoughts' "$CONFIG_DIR/memory/config.json" 2>/dev/null || echo "Unknown")
          
          echo -e "Memory enabled: ${memory_enabled}"
          echo -e "Maximum thoughts: ${max_thoughts}"
        fi
      else
        echo -e "Configuration: ${YELLOW}Not found${NC}"
      fi
      
      # Check thought storage
      if [ -d "$CONFIG_DIR/memory/thoughts" ]; then
        local thought_count=$(find "$CONFIG_DIR/memory/thoughts" -name "*.json" 2>/dev/null | wc -l)
        echo -e "Stored thoughts: ${thought_count}"
      else
        echo -e "Thought storage: ${YELLOW}Not found${NC}"
      fi
      
      # Show categories
      if [ -f "$CONFIG_DIR/memory/config.json" ] && command -v jq &> /dev/null; then
        echo -e "\nThought Categories:"
        jq -r '.categories | keys[]' "$CONFIG_DIR/memory/config.json" 2>/dev/null | while read -r category; do
          echo -e "- $category"
        done
      fi
      
      # Run stats command to get more detailed information
      if [ -f "$TOOLS_DIR/memory/memory_cli.js" ]; then
        echo -e "\nDetailed Statistics:"
        node "$TOOLS_DIR/memory/memory_cli.js" stats
      fi
      ;;
      
    install)
      # Install memory components
      setup_memory_components
      setup_memory_cli
      ;;
      
    help|*)
      echo "Memory System Usage:"
      echo "  $0 memory stats               - Show memory statistics"
      echo "  $0 memory search <query>      - Search thoughts"
      echo "  $0 memory get <id>            - Get a specific thought"
      echo "  $0 memory store <content>     - Store a new thought"
      echo "  $0 memory relate <src> <dst>  - Relate two thoughts"
      echo "  $0 memory status              - Show memory system status"
      echo "  $0 memory install             - Install memory components"
      echo "  $0 memory help                - Show this help message"
      ;;
  esac
}