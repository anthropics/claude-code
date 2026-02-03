#!/bin/bash

# Database Migration Safety Hook
# Warns about potentially dangerous database operations

# Read the tool input from stdin
INPUT=$(cat)

# Extract the command being executed
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# If no command, pass through
if [ -z "$COMMAND" ]; then
    echo '{"result": "approve"}'
    exit 0
fi

# Convert to lowercase for matching
COMMAND_LOWER=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')

# Check for dangerous SQL operations
WARNINGS=""

# Check for DROP TABLE
if echo "$COMMAND_LOWER" | grep -qE "drop\s+table"; then
    WARNINGS="$WARNINGS\n- DROP TABLE detected: Ensure you have a backup before proceeding"
fi

# Check for DROP COLUMN
if echo "$COMMAND_LOWER" | grep -qE "drop\s+column"; then
    WARNINGS="$WARNINGS\n- DROP COLUMN detected: Verify this column is not in use"
fi

# Check for TRUNCATE
if echo "$COMMAND_LOWER" | grep -qE "truncate\s+table"; then
    WARNINGS="$WARNINGS\n- TRUNCATE detected: This will delete ALL data from the table"
fi

# Check for DELETE without WHERE
if echo "$COMMAND_LOWER" | grep -qE "delete\s+from" && ! echo "$COMMAND_LOWER" | grep -qE "where"; then
    WARNINGS="$WARNINGS\n- DELETE without WHERE: This will delete ALL rows"
fi

# Check for UPDATE without WHERE
if echo "$COMMAND_LOWER" | grep -qE "update\s+\w+\s+set" && ! echo "$COMMAND_LOWER" | grep -qE "where"; then
    WARNINGS="$WARNINGS\n- UPDATE without WHERE: This will update ALL rows"
fi

# Check for migration commands
if echo "$COMMAND_LOWER" | grep -qE "(prisma\s+migrate\s+deploy|knex\s+migrate|typeorm\s+migration:run|drizzle-kit\s+push)"; then
    WARNINGS="$WARNINGS\n- Production migration detected: Ensure this has been tested on staging first"
fi

# Check for ALTER TABLE on potentially large operations
if echo "$COMMAND_LOWER" | grep -qE "alter\s+table.*add\s+column.*not\s+null" && ! echo "$COMMAND_LOWER" | grep -qE "default"; then
    WARNINGS="$WARNINGS\n- Adding NOT NULL column without DEFAULT may fail on existing rows"
fi

# If no warnings, approve
if [ -z "$WARNINGS" ]; then
    echo '{"result": "approve"}'
else
    # Output warning but still approve (informational)
    echo "{\"result\": \"approve\", \"message\": \"Database Safety Warning:$WARNINGS\"}"
fi
