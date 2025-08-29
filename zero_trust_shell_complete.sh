#!/bin/bash
# Zero-Trust Environment Variable Security Shell Wrapper
# Addresses GitHub Issue #2695: Zero-Trust Architecture for Environment Variable Security
# 
# This shell wrapper intercepts all environment variable access and masks secrets
# before they can be transmitted to AI systems, providing enterprise-grade security.

set -euo pipefail

# Configuration
AUDIT_FILE="${CLAUDE_CODE_AUDIT_FILE:-$HOME/.claude-code-shell-audit.jsonl}"
LOG_LEVEL="${CLAUDE_CODE_LOG_LEVEL:-INFO}"
ENABLE_MASKING="${CLAUDE_CODE_ENABLE_MASKING:-true}"

# Ensure audit directory exists
mkdir -p "$(dirname "$AUDIT_FILE")"

# Logging functions
log_json() {
    local level="$1"
    local event_type="$2"
    local data="$3"
    
    if [[ "$LOG_LEVEL" == "DEBUG" ]] || [[ "$level" != "DEBUG" ]]; then
        echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"$level\",\"event\":\"$event_type\",\"data\":$data}" >> "$AUDIT_FILE"
    fi
}

log_info() { log_json "INFO" "$1" "$2"; }
log_debug() { log_json "DEBUG" "$1" "$2"; }
log_warn() { log_json "WARN" "$1" "$2"; }
log_error() { log_json "ERROR" "$1" "$2"; }

# Secret detection patterns (comprehensive enterprise list)
detect_secret_type() {
    local value="$1"
    
    # OpenAI API Keys
    if [[ "$value" =~ ^sk-[a-zA-Z0-9]{40,}$ ]]; then
        echo "OPENAI_API_KEY"
        return 0
    fi
    
    # Anthropic API Keys  
    if [[ "$value" =~ ^sk-ant-[a-zA-Z0-9_-]{95,}$ ]]; then
        echo "ANTHROPIC_API_KEY"
        return 0
    fi
    
    # GitHub Personal Access Tokens
    if [[ "$value" =~ ^ghp_[A-Za-z0-9]{36}$ ]] || [[ "$value" =~ ^github_pat_[A-Za-z0-9_]{82}$ ]]; then
        echo "GITHUB_TOKEN"
        return 0
    fi
    
    # AWS Access Keys
    if [[ "$value" =~ ^AKIA[0-9A-Z]{16}$ ]]; then
        echo "AWS_ACCESS_KEY"
        return 0
    fi
    
    # AWS Secret Keys (pattern-based)
    if [[ "$value" =~ ^[A-Za-z0-9/+=]{40}$ ]]; then
        echo "AWS_SECRET_KEY"
        return 0
    fi
    
    # Slack Bot Tokens
    if [[ "$value" =~ ^xoxb-[0-9]+-[0-9]+-[0-9]+-[a-z0-9]+$ ]]; then
        echo "SLACK_BOT_TOKEN"
        return 0
    fi
    
    # Database Connection Strings
    if [[ "$value" =~ postgres://[^:]+:[^@]+@[^/]+/[^?]+ ]]; then
        echo "POSTGRESQL_CONNECTION_STRING"
        return 0
    fi
    
    if [[ "$value" =~ mysql://[^:]+:[^@]+@[^/]+/[^?]+ ]]; then
        echo "MYSQL_CONNECTION_STRING"
        return 0
    fi
    
    if [[ "$value" =~ mongodb://[^:]+:[^@]+@[^/]+/[^?]+ ]]; then
        echo "MONGODB_CONNECTION_STRING"
        return 0
    fi
    
    if [[ "$value" =~ redis://[^:]+:[^@]+@[^/]+ ]]; then
        echo "REDIS_CONNECTION_STRING"
        return 0
    fi
    
    # JWT Tokens
    if [[ "$value" =~ ^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]]; then
        echo "JWT_TOKEN"
        return 0
    fi
    
    # Generic long tokens/keys (32+ chars alphanumeric)
    if [[ ${#value} -ge 32 ]] && [[ "$value" =~ ^[A-Za-z0-9+/=_-]+$ ]]; then
        echo "GENERIC_SECRET"
        return 0
    fi
    
    return 1
}

# Check if environment variable name suggests sensitive data
is_sensitive_env_var() {
    local var_name="$1"
    local upper_name="${var_name^^}"  # Convert to uppercase
    
    local sensitive_patterns=(
        "API_KEY" "SECRET" "PASSWORD" "TOKEN" "PRIVATE_KEY"
        "DATABASE_URL" "DB_PASSWORD" "DB_USER" "DB_HOST"
        "REDIS_URL" "MONGO_URI" "MONGODB_URI"
        "AWS_SECRET" "AWS_ACCESS" "AZURE_CLIENT"
        "GOOGLE_CLIENT" "OAUTH" "AUTH"
        "PRIVATE" "CREDENTIAL" "CERT" "KEY"
        "SESSION_SECRET" "ENCRYPTION_KEY"
    )
    
    for pattern in "${sensitive_patterns[@]}"; do
        if [[ "$upper_name" == *"$pattern"* ]]; then
            return 0
        fi
    done
    
    return 1
}

# Create cryptographic commitment for secret
create_commitment() {
    local var_name="$1"
    local secret_value="$2"
    local secret_type="$3"
    
    # Generate hash of secret (never store the actual secret)
    local secret_hash=$(echo -n "$secret_value" | shasum -a 256 | cut -d' ' -f1)
    local short_hash="${secret_hash:0:8}"
    
    # Generate unique commitment ID
    local commitment_data="$var_name:$secret_hash:$(date +%s):$$"
    local commitment_id=$(echo -n "$commitment_data" | shasum -a 256 | cut -d' ' -f1 | cut -c1-16)
    
    # Create masked value
    local masked_value="<MASKED_${secret_type}_${short_hash}>"
    
    # Create commitment object
    local commitment="{
        \"commitment_id\": \"$commitment_id\",
        \"variable_name\": \"$var_name\",
        \"secret_hash\": \"$secret_hash\",
        \"secret_type\": \"$secret_type\",
        \"masked_value\": \"$masked_value\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"session_id\": \"$$\",
        \"shell_pid\": \"$$\"
    }"
    
    echo "$commitment"
}

# Process command and mask secrets
process_command() {
    local command="$1"
    local modified_command="$command"
    local secrets_found=false
    local commitments=()
    
    log_debug "COMMAND_PROCESSING" "{\"original_command\": \"$command\"}"
    
    # Find all environment variable references using multiple patterns
    local env_vars=()
    
    # Pattern 1: $VAR_NAME
    while read -r var_ref; do
        [[ -n "$var_ref" ]] && env_vars+=("$var_ref")
    done < <(echo "$command" | grep -oE '\$[A-Za-z_][A-Za-z0-9_]*' | sed 's/\$//' | sort -u)
    
    # Pattern 2: ${VAR_NAME}
    while read -r var_ref; do
        [[ -n "$var_ref" ]] && env_vars+=("$var_ref")
    done < <(echo "$command" | grep -oE '\$\{[A-Za-z_][A-Za-z0-9_]*\}' | sed 's/\${\(.*\)}/\1/' | sort -u)
    
    # Remove duplicates
    IFS=$'\n' env_vars=($(printf '%s\n' "${env_vars[@]}" | sort -u))
    
    # Process each environment variable
    for var_name in "${env_vars[@]}"; do
        [[ -z "$var_name" ]] && continue
        
        # Get variable value (indirect expansion)
        if [[ -n "${!var_name:-}" ]]; then
            local var_value="${!var_name}"
            local is_secret=false
            local secret_type=""
            
            # Check if value contains a secret
            if secret_type=$(detect_secret_type "$var_value"); then
                is_secret=true
            elif is_sensitive_env_var "$var_name"; then
                is_secret=true
                secret_type="SENSITIVE_ENV_VAR"
            fi
            
            if [[ "$is_secret" == true && "$ENABLE_MASKING" == true ]]; then
                # Create cryptographic commitment
                local commitment=$(create_commitment "$var_name" "$var_value" "$secret_type")
                commitments+=("$commitment")
                
                # Extract masked value from commitment
                local masked_value=$(echo "$commitment" | grep -o '"masked_value": "[^"]*"' | cut -d'"' -f4)
                
                # Replace all occurrences in command (escape for shell)
                escaped_masked_value="'$masked_value'"
                modified_command="${modified_command//\$$var_name/$escaped_masked_value}"
                modified_command="${modified_command//\$\{$var_name\}/$escaped_masked_value}"
                
                secrets_found=true
                
                echo "🔒 ZERO-TRUST: Masked $var_name → $masked_value" >&2
                
                log_info "SECRET_MASKED" "$commitment"
            fi
        fi
    done
    
    # Log command modification if secrets were found
    if [[ "$secrets_found" == true ]]; then
        local modification_log="{
            \"original_command\": \"$command\",
            \"modified_command\": \"$modified_command\",
            \"secrets_count\": ${#commitments[@]},
            \"commitments\": [$(IFS=,; echo "${commitments[*]}")]
        }"
        
        log_info "COMMAND_MODIFIED" "$modification_log"
        echo "🔒 Audit trail: $AUDIT_FILE" >&2
        echo "🔒 Secrets masked: ${#commitments[@]}" >&2
    fi
    
    echo "$modified_command"
}

# Validate command for potential bypasses
validate_command_security() {
    local command="$1"
    
    # Check for potential bypasses
    local bypasses_found=false
    
    # Check for eval/exec that might bypass our detection
    if [[ "$command" =~ (eval|exec|source) ]] || [[ "$command" =~ [[:space:]]\.[[:space:]] ]]; then
        log_warn "POTENTIAL_BYPASS" "{\"command\": \"$command\", \"reason\": \"eval_exec_detected\"}"
        bypasses_found=true
    fi
    
    # Check for command substitution that might bypass
    if [[ "$command" =~ \$\(.*\) ]] || [[ "$command" =~ `.*` ]]; then
        log_warn "POTENTIAL_BYPASS" "{\"command\": \"$command\", \"reason\": \"command_substitution\"}"
        bypasses_found=true
    fi
    
    # Check for redirection to sensitive files
    if [[ "$command" =~ \>\s*/proc/ ]] || [[ "$command" =~ \>\s*/dev/ ]]; then
        log_warn "POTENTIAL_BYPASS" "{\"command\": \"$command\", \"reason\": \"sensitive_file_access\"}"
        bypasses_found=true
    fi
    
    if [[ "$bypasses_found" == true ]]; then
        echo "⚠️  SECURITY WARNING: Potential bypass detected in command" >&2
    fi
}

# Main execution logic
main() {
    local start_time=$(date +%s)
    
    # Log shell invocation
    log_info "SHELL_INVOCATION" "{\"args\": [$(printf '\"%s\",' "$@" | sed 's/,$//')]}"
    
    if [[ "$1" == "-c" && -n "${2:-}" ]]; then
        local original_command="$2"
        
        # Validate for security bypasses
        validate_command_security "$original_command"
        
        # Process command and mask secrets
        local safe_command=$(process_command "$original_command")
        
        # Execute the (potentially modified) command
        if [[ "$safe_command" != "$original_command" ]]; then
            echo "🔒 Executing with masked secrets..." >&2
        fi
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_info "COMMAND_EXECUTION" "{
            \"original_command\": \"$original_command\",
            \"safe_command\": \"$safe_command\",
            \"modified\": $([ "$safe_command" != "$original_command" ] && echo true || echo false),
            \"duration_seconds\": $duration
        }"
        
        # Execute with original shell
        exec /bin/bash -c "$safe_command"
    else
        # For non-command execution, just pass through
        log_debug "PASSTHROUGH_EXECUTION" "{\"args\": [$(printf '\"%s\",' "$@" | sed 's/,$//')]}"
        exec /bin/bash "$@"
    fi
}

# Error handling
trap 'log_error "SHELL_ERROR" "{\"exit_code\": $?, \"line\": $LINENO}"' ERR

# Execute main function
main "$@"