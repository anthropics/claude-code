---
allowed-tools: Bash(gh issue view:*), Bash(gh search:*), Bash(gh issue list:*), Bash(gh pr comment:*), Bash(gh pr diff:*), Bash(gh pr view:*), Bash(gh pr list:*), Bash(glab mr view:*), Bash(glab mr diff:*), Bash(glab mr note:*), Bash(glab mr list:*), Bash(glab api:*), Bash(git remote:*), Bash(git branch:*), Bash(git log:*), Bash(git blame:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(curl -s:*), mcp__github_inline_comment__create_inline_comment
description: Code review a pull request or merge request
---

Provide a code review for the current pull request (GitHub) or merge request (GitLab).

**Agent assumptions (applies to all agents and subagents):**
- All tools are functional and will work without error. Do not test tools or make exploratory calls. Make sure this is clear to every subagent that is launched.
- Only call a tool if it is required to complete the task. Every tool call should have a clear purpose.

To do this, follow these steps precisely:

1. Detect the platform. Do NOT use a subagent — run these commands directly yourself (2-3 commands max):
   a. Run `git remote get-url origin`. Parse the host from the URL (HTTPS: `https://host/owner/repo.git`, SSH: `git@host:owner/repo.git`).
   b. If host is `github.com` → GitHub. If host is `gitlab.com` → GitLab. Otherwise run `curl -s -o /dev/null -w "%{http_code}" https://<host>/api/v4/version` — if `200` → GitLab, else → GitHub Enterprise. If unclear, ask the user.
   c. Verify auth with exactly one command: `gh auth status` (GitHub) or `glab auth status` (GitLab). If it fails, tell the user to install/authenticate and stop.

   Based on the detected platform, use the matching values from the table below for ALL subsequent steps. Refer to these as PLATFORM values:

   | Value            | GitHub                                  | GitLab                                  |
   |------------------|-----------------------------------------|-----------------------------------------|
   | CLI              | `gh`                                    | `glab`                                  |
   | Term             | PR                                      | MR                                      |
   | View command     | `gh pr view`                            | `glab mr view`                          |
   | Diff command     | `gh pr diff`                            | `glab mr diff`                          |
   | Comment command  | `gh pr comment`                         | `glab mr note`                          |
   | Comments check   | `gh pr view <ID> --comments`            | `glab mr view <ID> --comments`          |
   | Link format      | `https://github.com/owner/repo/blob/<sha>/path#L<start>-L<end>` | `https://<host>/owner/repo/-/blob/<sha>/path#L<start>-<end>` |

2. Launch a haiku agent to check if any of the following are true:
   - The PR/MR is closed or merged
   - The PR/MR is a draft
   - The PR/MR does not need code review (e.g. automated, trivial change that is obviously correct)
   - Claude has already commented (use PLATFORM comments check command)

   If any condition is true, stop and do not proceed.

Note: Still review Claude-generated PR/MRs.

3. Launch a haiku agent to return a list of file paths (not their contents) for all relevant CLAUDE.md files including:
   - The root CLAUDE.md file, if it exists
   - Any CLAUDE.md files in directories containing files modified by the PR/MR

4. Launch a sonnet agent to view the PR/MR and return a summary of the changes. Use PLATFORM view and diff commands.

5. Launch 4 agents in parallel to independently review the changes. Each agent should return the list of issues, where each issue includes a description and the reason it was flagged (e.g. "CLAUDE.md adherence", "bug"). The agents should do the following:

   Agents 1 + 2: CLAUDE.md compliance sonnet agents
   Audit changes for CLAUDE.md compliance in parallel. Note: When evaluating CLAUDE.md compliance for a file, you should only consider CLAUDE.md files that share a file path with the file or parents.

   Agent 3: Opus bug agent (parallel subagent with agent 4)
   Scan for obvious bugs. Focus only on the diff itself without reading extra context. Flag only significant bugs; ignore nitpicks and likely false positives. Do not flag issues that you cannot validate without looking at context outside of the git diff.

   Agent 4: Opus bug agent (parallel subagent with agent 3)
   Look for problems that exist in the introduced code. This could be security issues, incorrect logic, etc. Only look for issues that fall within the changed code.

   **CRITICAL: We only want HIGH SIGNAL issues.** Flag issues where:
   - The code will fail to compile or parse (syntax errors, type errors, missing imports, unresolved references)
   - The code will definitely produce wrong results regardless of inputs (clear logic errors)
   - Clear, unambiguous CLAUDE.md violations where you can quote the exact rule being broken

   Do NOT flag:
   - Code style or quality concerns
   - Potential issues that depend on specific inputs or state
   - Subjective suggestions or improvements

   If you are not certain an issue is real, do not flag it. False positives erode trust and waste reviewer time.

   In addition to the above, each subagent should be told the PR/MR title and description. This will help provide context regarding the author's intent.

6. For each issue found in the previous step by agents 3 and 4, launch parallel subagents to validate the issue. These subagents should get the PR/MR title and description along with a description of the issue. The agent's job is to review the issue to validate that the stated issue is truly an issue with high confidence. For example, if an issue such as "variable is not defined" was flagged, the subagent's job would be to validate that is actually true in the code. Another example would be CLAUDE.md issues. The agent should validate that the CLAUDE.md rule that was violated is scoped for this file and is actually violated. Use Opus subagents for bugs and logic issues, and sonnet agents for CLAUDE.md violations.

7. Filter out any issues that were not validated in step 6. This step will give us our list of high signal issues for our review.

8. Output a summary of the review findings to the terminal:
   - If issues were found, list each issue with a brief description.
   - If no issues were found, state: "No issues found. Checked for bugs and CLAUDE.md compliance."

   If `--comment` argument was NOT provided, stop here. Do not post any comments.

   If `--comment` argument IS provided and NO issues were found, post a summary comment using PLATFORM comment command and stop.

   If `--comment` argument IS provided and issues were found, continue to step 9.

9. Create a list of all comments that you plan on leaving. This is only for you to make sure you are comfortable with the comments. Do not post this list anywhere.

10. Post inline comments for each issue. For each comment:
    - Provide a brief description of the issue
    - For small, self-contained fixes, include a committable suggestion block
    - For larger fixes (6+ lines, structural changes, or changes spanning multiple locations), describe the issue and suggested fix without a suggestion block
    - Never post a committable suggestion UNLESS committing the suggestion fixes the issue entirely. If follow up steps are required, do not leave a committable suggestion.

    **How to post inline comments by platform:**

    - **GitHub**: Use `mcp__github_inline_comment__create_inline_comment` with `confirmed: true`.
    - **GitLab**: First fetch the MR diff refs by running `glab api projects/<url-encoded-fullpath>/merge_requests/<MR_IID>` and extract `diff_refs.base_sha`, `diff_refs.start_sha`, and `diff_refs.head_sha`. Then post each inline comment using:
      ```
      glab api projects/<url-encoded-fullpath>/merge_requests/<MR_IID>/discussions -X POST \
        -f body="<comment>" \
        -f "position[position_type]=text" \
        -f "position[base_sha]=<base_sha>" \
        -f "position[start_sha]=<start_sha>" \
        -f "position[head_sha]=<head_sha>" \
        -f "position[new_path]=<file_path>" \
        -f "position[new_line]=<line_number>"
      ```

    **IMPORTANT: Only post ONE comment per unique issue. Do not post duplicate comments.**

Use this list when evaluating issues in Steps 5 and 6 (these are false positives, do NOT flag):

- Pre-existing issues
- Something that appears to be a bug but is actually correct
- Pedantic nitpicks that a senior engineer would not flag
- Issues that a linter will catch (do not run the linter to verify)
- General code quality concerns (e.g., lack of test coverage, general security issues) unless explicitly required in CLAUDE.md
- Issues mentioned in CLAUDE.md but explicitly silenced in the code (e.g., via a lint ignore comment)

Notes:

- Use PLATFORM CLI to interact with the platform (e.g., fetch PR/MRs, create comments). Do not use web fetch.
- Create a todo list before starting.
- You must cite and link each issue in inline comments (e.g., if referring to a CLAUDE.md, include a link to it).
- If no issues are found and `--comment` argument is provided, post a comment with the following format:

---

## Code review

No issues found. Checked for bugs and CLAUDE.md compliance.

---

- When linking to code in inline comments, use PLATFORM link format precisely, otherwise the Markdown preview won't render correctly.
  GitHub example: https://github.com/anthropics/claude-code/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15
  GitLab example: https://gitlab.com/owner/repo/-/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-15
  - Requires full git sha (not abbreviated)
  - You must provide the full sha. Commands like `$(git rev-parse HEAD)` will not work, since your comment will be directly rendered in Markdown.
  - Repo name must match the repo you're code reviewing
  - Use the host from step 1
  - Provide at least 1 line of context before and after, centered on the line you are commenting about (eg. if you are commenting about lines 5-6, you should link to `L4-7`)
