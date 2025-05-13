#!/bin/bash

# SAAR Startup - Specialized Components Setup
# Initializes specialized components like Neural Framework, Recursive Debugging, A2A, etc.

# Source common functions if running standalone
if [ -z "$LOG_FILE" ]; then
  source "$(dirname "$0")/00_common.sh"
fi

# Setup Neural Framework Integration
setup_neural_framework() {
  log "INFO" "Setting up Neural Framework Integration"

  if [ -f "$WORKSPACE_DIR/scripts/setup/setup_neural_framework.sh" ]; then
    chmod +x "$WORKSPACE_DIR/scripts/setup/setup_neural_framework.sh"
    
    # Execute with error handling and provide rollback command
    run_command "\"$WORKSPACE_DIR/scripts/setup/setup_neural_framework.sh\"" \
                "Failed to setup Neural Framework Integration" \
                "log \"INFO\" \"Rolling back Neural Framework Integration setup\""
                
    log "INFO" "Neural Framework Integration setup complete"
  else
    log "WARN" "Neural Framework setup script not found. Skipping Neural Framework setup."
  fi
}

# Verify Neural Framework connections
verify_neural_framework() {
  local status=0
  log "INFO" "Verifying Neural Framework connections"
  
  # Check for key directories and files
  if [ ! -d "$WORKSPACE_DIR/src/neural" ]; then
    log "WARN" "Neural Framework directory not found: $WORKSPACE_DIR/src/neural"
    status=1
  else
    # Check embedding service
    if [ ! -f "$WORKSPACE_DIR/src/neural/embedding/TextChunker.js" ]; then
      log "WARN" "Text Chunker not found: $WORKSPACE_DIR/src/neural/embedding/TextChunker.js"
      status=1
    else
      log "DEBUG" "Found Text Chunker component"
    fi
    
    # Check model provider
    if [ ! -f "$WORKSPACE_DIR/src/neural/models/ModelProvider.js" ]; then
      log "WARN" "Model Provider not found: $WORKSPACE_DIR/src/neural/models/ModelProvider.js"
      status=1
    else
      log "DEBUG" "Found Model Provider component"
    fi
    
    # Check embedding service
    if [ ! -f "$WORKSPACE_DIR/src/neural/services/EmbeddingService.js" ]; then
      log "WARN" "Embedding Service not found: $WORKSPACE_DIR/src/neural/services/EmbeddingService.js"
      status=1
    else
      log "DEBUG" "Found Embedding Service component"
    fi
  fi
  
  # Verify RAG components if available
  if [ -d "$WORKSPACE_DIR/core/rag" ]; then
    if [ ! -f "$WORKSPACE_DIR/core/rag/setup_database.py" ]; then
      log "WARN" "RAG database setup script not found: $WORKSPACE_DIR/core/rag/setup_database.py"
      status=1
    else
      log "DEBUG" "Found RAG database setup script"
    fi
    
    if [ ! -f "$WORKSPACE_DIR/core/rag/rag_framework.py" ]; then
      log "WARN" "RAG framework not found: $WORKSPACE_DIR/core/rag/rag_framework.py"
      status=1
    else
      log "DEBUG" "Found RAG framework"
    fi
  else
    log "WARN" "RAG components directory not found: $WORKSPACE_DIR/core/rag"
    status=1
  fi
  
  if [ $status -eq 0 ]; then
    log "INFO" "Neural Framework verification passed"
  else
    log "WARN" "Neural Framework verification completed with warnings"
  fi
  
  return $status
}

# Setup Recursive Debugging
setup_recursive_debugging() {
  log "INFO" "Setting up Recursive Debugging tools"

  if [ -f "$WORKSPACE_DIR/scripts/setup/install_recursive_debugging.sh" ]; then
    chmod +x "$WORKSPACE_DIR/scripts/setup/install_recursive_debugging.sh"
    
    # Execute with error handling and provide rollback command
    run_command "\"$WORKSPACE_DIR/scripts/setup/install_recursive_debugging.sh\" \"$WORKSPACE_DIR\"" \
                "Failed to setup Recursive Debugging" \
                "log \"INFO\" \"Rolling back Recursive Debugging setup\""
                
    log "INFO" "Recursive Debugging tools setup complete"
  else
    log "WARN" "Recursive Debugging setup script not found. Skipping Recursive Debugging setup."
  fi
}

# Verify Recursive Debugging installation
verify_recursive_debugging() {
  local status=0
  log "INFO" "Verifying Recursive Debugging installation"
  
  # Check for key directories and files
  if [ ! -f "$WORKSPACE_DIR/scripts/debug_workflow_engine.js" ]; then
    log "WARN" "Debug workflow engine not found: $WORKSPACE_DIR/scripts/debug_workflow_engine.js"
    status=1
  else
    log "DEBUG" "Found debug workflow engine"
  fi
  
  if [ ! -f "$WORKSPACE_DIR/core/config/debug_workflow_config.json" ]; then
    log "WARN" "Debug workflow configuration not found: $WORKSPACE_DIR/core/config/debug_workflow_config.json"
    status=1
  else
    log "DEBUG" "Found debug workflow configuration"
  fi
  
  if [ ! -d "$WORKSPACE_DIR/docs/examples/recursive_debugging" ]; then
    log "WARN" "Recursive debugging examples not found: $WORKSPACE_DIR/docs/examples/recursive_debugging"
    status=1
  else
    log "DEBUG" "Found recursive debugging examples"
  fi
  
  if [ ! -f "$WORKSPACE_DIR/core/dashboard/recursive_dashboard.js" ]; then
    log "WARN" "Recursive dashboard not found: $WORKSPACE_DIR/core/dashboard/recursive_dashboard.js"
    status=1
  else
    log "DEBUG" "Found recursive dashboard"
  fi
  
  if [ $status -eq 0 ]; then
    log "INFO" "Recursive Debugging verification passed"
  else
    log "WARN" "Recursive Debugging verification completed with warnings"
  fi
  
  return $status
}

# Setup Specialized Agents
setup_specialized_agents() {
  log "INFO" "Setting up Specialized Agents"

  # Create agent configuration directory
  local agent_config_dir="$CONFIG_DIR/agents/specialized"
  ensure_directory "$agent_config_dir"

  # Create agent registry file if it doesn't exist
  local agent_registry="$CONFIG_DIR/agents/agent_registry.json"
  if [ ! -f "$agent_registry" ]; then
    echo "{\"agents\": [], \"lastUpdated\": \"$(get_timestamp)\"}" > "$agent_registry"
    log "DEBUG" "Created agent registry"
  fi

  # Identify available agent types from agents/commands/ directory
  log "INFO" "Scanning for available agent types"
  local agent_types=()

  if [ -d "$WORKSPACE_DIR/agents/commands" ]; then
    for agent_file in "$WORKSPACE_DIR"/agents/commands/*.md; do
      if [ -f "$agent_file" ]; then
        local agent_name=$(basename "$agent_file" .md)
        agent_types+=("$agent_name")
        log "DEBUG" "Found agent type: $agent_name"
      fi
    done
  else
    log "WARN" "agents/commands/ directory not found. Cannot determine available agent types."
    return 1
  fi

  # Set up each specialized agent
  for agent_type in "${agent_types[@]}"; do
    local agent_id="${agent_type//-/_}_agent"
    local agent_display_name="$(echo "$agent_type" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')"

    log "INFO" "Setting up $agent_display_name"

    # Create agent configuration
    local agent_config="$agent_config_dir/${agent_id}.json"
    cat > "$agent_config" << EOF
{
  "version": "1.0.0",
  "agentId": "$agent_id",
  "agentType": "$agent_type",
  "displayName": "$agent_display_name",
  "created": "$(get_timestamp)",
  "lastActive": "$(get_timestamp)",
  "capabilities": [
    "${agent_type}"
  ],
  "preferences": {
    "autoStart": false,
    "notificationLevel": "important"
  },
  "commandFile": "$WORKSPACE_DIR/agents/commands/${agent_type}.md",
  "status": "available"
}
EOF

    log "INFO" "$agent_display_name configured"

    # Add to registry if not already present
    if grep -q "\"agentId\": \"$agent_id\"" "$agent_registry"; then
      log "DEBUG" "Agent $agent_id already in registry"
    else
      # Read registry as a temporary variable
      local registry_content=$(cat "$agent_registry")
      # Extract agents array
      local agents_array=$(echo "$registry_content" | grep -o '"agents": \[.*\]' | sed 's/"agents": \[\(.*\)\]/\1/')
      # Add comma if there are existing agents
      if [ -n "$agents_array" ] && [ "$agents_array" != "[]" ]; then
        agents_array="${agents_array},"
      fi
      # Add new agent entry
      agents_array="${agents_array}{\"agentId\": \"$agent_id\", \"agentType\": \"$agent_type\", \"configPath\": \"$agent_config\"}"
      # Update registry
      local new_registry="{\"agents\": [${agents_array}], \"lastUpdated\": \"$(get_timestamp)\"}"
      echo "$new_registry" > "$agent_registry"
      log "DEBUG" "Added $agent_id to registry"
    fi
  done

  # Create A2A Manager configuration if it doesn't exist
  local a2a_config="$CONFIG_DIR/agents/a2a_config.json"
  if [ ! -f "$a2a_config" ]; then
    cat > "$a2a_config" << EOF
{
  "version": "1.0.0",
  "managerEnabled": true,
  "port": 3210,
  "registryPath": "$agent_registry",
  "logLevel": "info",
  "autoStartAgents": ["git_agent", "debug_recursive_agent"],
  "messageBroker": {
    "type": "local",
    "queueSize": 100,
    "retentionPeriod": 86400
  },
  "lastUpdated": "$(get_timestamp)"
}
EOF
    log "INFO" "A2A Manager configuration created"
  fi

  log "INFO" "Specialized Agents setup complete"
}

# Main specialized components setup function
setup_specialized_components() {
  # Check for startup lock
  check_startup_lock || return 1
  
  # Create lock
  create_startup_lock "specialized_components"
  
  # Setup Neural Framework
  setup_neural_framework
  
  # Verify Neural Framework (optional verification)
  verify_neural_framework
  
  # Setup Recursive Debugging
  setup_recursive_debugging
  
  # Verify Recursive Debugging (optional verification)
  verify_recursive_debugging
  
  # Setup Specialized Agents
  setup_specialized_agents
  
  # Release lock
  release_startup_lock
  
  log "INFO" "Specialized components setup complete"
  return 0
}

# If running as a script (not sourced), execute the main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  # Parse options
  parse_options "$@"
  
  # Run specialized components setup
  setup_specialized_components
fi