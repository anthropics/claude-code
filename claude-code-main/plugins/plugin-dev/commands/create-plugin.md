---
description: Guided end-to-end plugin creation workflow with component design, implementation, and validation
argument-hint: Optional plugin description
allowed-tools: ["Read", "Write", "Grep", "Glob", "Bash", "TodoWrite", "AskUserQuestion", "Skill", "Task"]
---

# Plugin Creation Workflow

Guide the user through creating a complete, high-quality Claude Code plugin from initial concept to tested implementation. Follow a systematic approach: understand requirements, design components, clarify details, implement following best practices, validate, and test.

## Core Principles

- **Ask clarifying questions**: Identify all ambiguities about plugin purpose, triggering, scope, and components. Ask specific, concrete questions rather than making assumptions. Wait for user answers before proceeding with implementation.
- **Load relevant skills**: Use the Skill tool to load plugin-dev skills when needed (plugin-structure, hook-development, agent-development, etc.)
- **Use specialized agents**: Leverage agent-creator, plugin-validator, and skill-reviewer agents for AI-assisted development
- **Follow best practices**: Apply patterns from plugin-dev's own implementation
- **Progressive disclosure**: Create lean skills with references/examples
- **Use TodoWrite**: Track all progress throughout all phases

**Initial request:** $ARGUMENTS

---

## Phase 1: Discovery

**Goal**: Understand what plugin needs to be built and what problem it solves

**Actions**:
1. Create todo list with all 7 phases
2. If plugin purpose is clear from arguments:
   - Summarize understanding
   - Identify plugin type (integration, workflow, analysis, toolkit, etc.)
3. If plugin purpose is unclear, ask user:
   - What problem does this plugin solve?
   - Who will use it and when?
   - What should it do?
   - Any similar plugins to reference?
4. Summarize understanding and confirm with user before proceeding

**Output**: Clear statement of plugin purpose and target users

---

## Phase 2: Component Planning

**Goal**: Determine what plugin components are needed

**MUST load plugin-structure skill** using Skill tool before this phase.

**Actions**:
1. Load plugin-structure skill to understand component types
2. Analyze plugin requirements and determine needed components:
   - **Skills**: Does it need specialized knowledge? (hooks API, MCP patterns, etc.)
   - **Commands**: User-initiated actions? (deploy, configure, analyze)
   - **Agents**: Autonomous tasks? (validation, generation, analysis)
   - **Hooks**: Event-driven automation? (validation, notifications)
   - **MCP**: External service integration? (databases, APIs)
   - **Settings**: User configuration? (.local.md files)
3. For each component type needed, identify:
   - How many of each type
   - What each one does
   - Rough triggering/usage patterns
4. Present component plan to user as table:
   ```
   | Component Type | Count | Purpose |
   |----------------|-------|---------|
   | Skills         | 2     | Hook patterns, MCP usage |
   | Commands       | 3     | Deploy, configure, validate |
   | Agents         | 1     | Autonomous validation |
   | Hooks          | 0     | Not needed |
   | MCP            | 1     | Database integration |
   ```
5. Get user confirmation or adjustments

**Output**: Confirmed list of components to create

---

## Phase 3: Detailed Design & Clarifying Questions

**Goal**: Specify each component in detail and resolve all ambiguities

**CRITICAL**: This is one of the most important phases. DO NOT SKIP.

**Actions**:
1. For each component in the plan, identify underspecified aspects:
   - **Skills**: What triggers them? What knowledge do they provide? How detailed?
   - **Commands**: What arguments? What tools? Interactive or automated?
   - **Agents**: When to trigger (proactive/reactive)? What tools? Output format?
   - **Hooks**: Which events? Prompt or command based? Validation criteria?
   - **MCP**: What server type? Authentication? Which tools?
   - **Settings**: What fields? Required vs optional? Defaults?

2. **Present all questions to user in organized sections** (one section per component type)

3. **Wait for answers before proceeding to implementation**

4. If user says "whatever you think is best", provide specific recommendations and get explicit confirmation

**Example questions for a skill**:
- What specific user queries should trigger this skill?
- Should it include utility scripts? What functionality?
- How detailed should the core SKILL.md be vs references/?
- Any real-world examples to include?

**Example questions for an agent**:
- Should this agent trigger proactively after certain actions, or only when explicitly requested?
- What tools does it need (Read, Write, Bash, etc.)?
- What should the output format be?
- Any specific quality standards to enforce?

**Output**: Detailed specification for each component

---

## Phase 4: Plugin Structure Creation

**Goal**: Create plugin directory structure and manifest

**Actions**:
1. Determine plugin name (kebab-case, descriptive)
2. Choose plugin location:
   - Ask user: "Where should I create the plugin?"
   - Offer options: current directory, ../new-plugin-name, custom path
3. Create directory structure using bash:
   ```bash
   mkdir -p plugin-name/.claude-plugin
   mkdir -p plugin-name/skills     # if needed
   mkdir -p plugin-name/commands   # if needed
   mkdir -p plugin-name/agents     # if needed
   mkdir -p plugin-name/hooks      # if needed
   ```
4. Create plugin.json manifest using Write tool:
   ```json
   {
     "name": "plugin-name",
     "version": "0.1.0",
     "description": "[brief description]",
     "author": {
       "name": "[author from user or default]",
       "email": "[email or default]"
     }
   }
   ```
5. Create README.md template
6. Create .gitignore if needed (for .claude/*.local.md, etc.)
7. Initialize git repo if creating new directory

**Output**: Plugin directory structure created and ready for components

---

## Phase 5: Component Implementation

**Goal**: Create each component following best practices

**LOAD RELEVANT SKILLS** before implementing each component type:
- Skills: Load skill-development skill
- Commands: Load command-development skill
- Agents: Load agent-development skill
- Hooks: Load hook-development skill
- MCP: Load mcp-integration skill
- Settings: Load plugin-settings skill

**Actions for each component**:

### For Skills:
1. Load skill-development skill using Skill tool
2. For each skill:
   - Ask user for concrete usage examples (or use from Phase 3)
   - Plan resources (scripts/, references/, examples/)
   - Create skill directory structure
   - Write SKILL.md with:
     - Third-person description with specific trigger phrases
     - Lean body (1,500-2,000 words) in imperative form
     - References to supporting files
   - Create reference files for detailed content
   - Create example files for working code
   - Create utility scripts if needed
3. Use skill-reviewer agent to validate each skill

### For Commands:
1. Load command-development skill using Skill tool
2. For each command:
   - Write command markdown with frontmatter
   - Include clear description and argument-hint
   - Specify allowed-tools (minimal necessary)
   - Write instructions FOR Claude (not TO user)
   - Provide usage examples and tips
   - Reference relevant skills if applicable

### For Agents:
1. Load agent-development skill using Skill tool
2. For each agent, use agent-creator agent:
   - Provide description of what agent should do
   - Agent-creator generates: identifier, whenToUse with examples, systemPrompt
   - Create agent markdown file with frontmatter and system prompt
   - Add appropriate model, color, and tools
   - Validate with validate-agent.sh script

### For Hooks:
1. Load hook-development skill using Skill tool
2. For each hook:
   - Create hooks/hooks.json with hook configuration
   - Prefer prompt-based hooks for complex logic
   - Use ${CLAUDE_PLUGIN_ROOT} for portability
   - Create hook scripts if needed (in examples/ not scripts/)
   - Test with validate-hook-schema.sh and test-hook.sh utilities

### For MCP:
1. Load mcp-integration skill using Skill tool
2. Create .mcp.json configuration with:
   - Server type (stdio for local, SSE for hosted)
   - Command and args (with ${CLAUDE_PLUGIN_ROOT})
   - extensionToLanguage mapping if LSP
   - Environment variables as needed
3. Document required env vars in README
4. Provide setup instructions

### For Settings:
1. Load plugin-settings skill using Skill tool
2. Create settings template in README
3. Create example .claude/plugin-name.local.md file (as documentation)
4. Implement settings reading in hooks/commands as needed
5. Add to .gitignore: `.claude/*.local.md`

**Progress tracking**: Update todos as each component is completed

**Output**: All plugin components implemented

---

## Phase 6: Validation & Quality Check

**Goal**: Ensure plugin meets quality standards and works correctly

**Actions**:
1. **Run plugin-validator agent**:
   - Use plugin-validator agent to comprehensively validate plugin
   - Check: manifest, structure, naming, components, security
   - Review validation report

2. **Fix critical issues**:
   - Address any critical errors from validation
   - Fix any warnings that indicate real problems

3. **Review with skill-reviewer** (if plugin has skills):
   - For each skill, use skill-reviewer agent
   - Check description quality, progressive disclosure, writing style
   - Apply recommendations

4. **Test agent triggering** (if plugin has agents):
   - For each agent, verify <example> blocks are clear
   - Check triggering conditions are specific
   - Run validate-agent.sh on agent files

5. **Test hook configuration** (if plugin has hooks):
   - Run validate-hook-schema.sh on hooks/hooks.json
   - Test hook scripts with test-hook.sh
   - Verify ${CLAUDE_PLUGIN_ROOT} usage

6. **Present findings**:
   - Summary of validation results
   - Any remaining issues
   - Overall quality assessment

7. **Ask user**: "Validation complete. Issues found: [count critical], [count warnings]. Would you like me to fix them now, or proceed to testing?"

**Output**: Plugin validated and ready for testing

---

## Phase 7: Testing & Verification

**Goal**: Test that plugin works correctly in Claude Code

**Actions**:
1. **Installation instructions**:
   - Show user how to test locally:
     ```bash
     cc --plugin-dir /path/to/plugin-name
     ```
   - Or copy to `.claude-plugin/` for project testing

2. **Verification checklist** for user to perform:
   - [ ] Skills load when triggered (ask questions with trigger phrases)
   - [ ] Commands appear in `/help` and execute correctly
   - [ ] Agents trigger on appropriate scenarios
   - [ ] Hooks activate on events (if applicable)
   - [ ] MCP servers connect (if applicable)
   - [ ] Settings files work (if applicable)

3. **Testing recommendations**:
   - For skills: Ask questions using trigger phrases from descriptions
   - For commands: Run `/plugin-name:command-name` with various arguments
   - For agents: Create scenarios matching agent examples
   - For hooks: Use `claude --debug` to see hook execution
   - For MCP: Use `/mcp` to verify servers and tools

4. **Ask user**: "I've prepared the plugin for testing. Would you like me to guide you through testing each component, or do you want to test it yourself?"

5. **If user wants guidance**, walk through testing each component with specific test cases

**Output**: Plugin tested and verified working

---

## Phase 8: Documentation & Next Steps

**Goal**: Ensure plugin is well-documented and ready for distribution

**Actions**:
1. **Verify README completeness**:
   - Check README has: overview, features, installation, prerequisites, usage
   - For MCP plugins: Document required environment variables
   - For hook plugins: Explain hook activation
   - For settings: Provide configuration templates

2. **Add marketplace entry** (if publishing):
   - Show user how to add to marketplace.json
   - Help draft marketplace description
   - Suggest category and tags

3. **Create summary**:
   - Mark all todos complete
   - List what was created:
     - Plugin name and purpose
     - Components created (X skills, Y commands, Z agents, etc.)
     - Key files and their purposes
     - Total file count and structure
   - Next steps:
     - Testing recommendations
     - Publishing to marketplace (if desired)
     - Iteration based on usage

4. **Suggest improvements** (optional):
   - Additional components that could enhance plugin
   - Integration opportunities
   - Testing strategies

**Output**: Complete, documented plugin ready for use or publication

---

## Important Notes

### Throughout All Phases

- **Use TodoWrite** to track progress at every phase
- **Load skills with Skill tool** when working on specific component types
- **Use specialized agents** (agent-creator, plugin-validator, skill-reviewer)
- **Ask for user confirmation** at key decision points
- **Follow plugin-dev's own patterns** as reference examples
- **Apply best practices**:
  - Third-person descriptions for skills
  - Imperative form in skill bodies
  - Commands written FOR Claude
  - Strong trigger phrases
  - ${CLAUDE_PLUGIN_ROOT} for portability
  - Progressive disclosure
  - Security-first (HTTPS, no hardcoded credentials)

### Key Decision Points (Wait for User)

1. After Phase 1: Confirm plugin purpose
2. After Phase 2: Approve component plan
3. After Phase 3: Proceed to implementation
4. After Phase 6: Fix issues or proceed
5. After Phase 7: Continue to documentation

### Skills to Load by Phase

- **Phase 2**: plugin-structure
- **Phase 5**: skill-development, command-development, agent-development, hook-development, mcp-integration, plugin-settings (as needed)
- **Phase 6**: (agents will use skills automatically)

### Quality Standards

Every component must meet these standards:
- ✅ Follows plugin-dev's proven patterns
- ✅ Uses correct naming conventions
- ✅ Has strong trigger conditions (skills/agents)
- ✅ Includes working examples
- ✅ Properly documented
- ✅ Validated with utilities
- ✅ Tested in Claude Code

---

## Example Workflow

### User Request
"Create a plugin for managing database migrations"

### Phase 1: Discovery
- Understand: Migration management, database schema versioning
- Confirm: User wants to create, run, rollback migrations

### Phase 2: Component Planning
- Skills: 1 (migration best practices)
- Commands: 3 (create-migration, run-migrations, rollback)
- Agents: 1 (migration-validator)
- MCP: 1 (database connection)

### Phase 3: Clarifying Questions
- Which databases? (PostgreSQL, MySQL, etc.)
- Migration file format? (SQL, code-based?)
- Should agent validate before applying?
- What MCP tools needed? (query, execute, schema)

### Phase 4-8: Implementation, Validation, Testing, Documentation

---

**Begin with Phase 1: Discovery**
