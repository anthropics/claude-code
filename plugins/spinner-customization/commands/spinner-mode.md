---
allowed-tools: Read, Write
description: "Switch spinner verb mode: /spinner-mode [quirky|plain|minimal|none]"
---

## Context

The user wants to change their spinner verb style. The argument provided is: `$ARGUMENTS`

Valid modes:
- **quirky** — restore the default playful verbs (removes the `spinnerVerbs` override)
- **plain** — descriptive, professional verbs
- **minimal** — single-word status indicators
- **none** — no spinner text at all (empty verbs)

## Spinner verb sets

### plain

```json
{
  "spinnerVerbs": {
    "mode": "replace",
    "verbs": [
      "Processing",
      "Analyzing",
      "Searching",
      "Reading",
      "Writing",
      "Computing",
      "Evaluating",
      "Preparing",
      "Generating",
      "Formatting",
      "Reviewing",
      "Compiling",
      "Resolving",
      "Building",
      "Scanning",
      "Indexing",
      "Checking",
      "Verifying",
      "Parsing",
      "Loading"
    ]
  }
}
```

### minimal

```json
{
  "spinnerVerbs": {
    "mode": "replace",
    "verbs": [
      "Working",
      "Thinking",
      "Running"
    ]
  }
}
```

### none

```json
{
  "spinnerVerbs": {
    "mode": "replace",
    "verbs": [""]
  }
}
```

### quirky

Remove the `spinnerVerbs` key entirely from settings to restore defaults.

## Your task

1. Validate the argument is one of: `quirky`, `plain`, `minimal`, `none`. If missing or invalid, list the available modes and ask the user to pick one.
2. Read `~/.claude/settings.json` (create it with `{}` if it does not exist).
3. Apply the selected mode:
   - For `quirky`: remove the `spinnerVerbs` key from the settings object.
   - For `plain`, `minimal`, `none`: set the `spinnerVerbs` key to the corresponding JSON object shown above.
4. Write the updated settings back to `~/.claude/settings.json`, preserving all other existing settings.
5. Confirm the change to the user with a one-line summary.

Do not modify any other settings. Do not add comments to the JSON.
