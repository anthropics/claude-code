---
description: "Fetch PR comments with resolved/unresolved filtering"
argument-hint: "[unresolved|resolved|all]"
allowed-tools: ["Bash"]
---

# PR Comments

Fetch and display pull request review comments using GitHub's GraphQL API, with support for filtering by resolution status.

**Filter:** "$ARGUMENTS" (defaults to "all" if not specified)

## Steps

1. **Get PR context**
   ```bash
   gh pr view --json number,headRefName,headRepository
   ```
   Extract: `number`, `owner` (from headRepository.owner.login), `repo` (from headRepository.name), `branch`

2. **Fetch review threads via GraphQL**
   ```bash
   gh api graphql -f query='
   {
     repository(owner: "OWNER", name: "REPO") {
       pullRequest(number: NUMBER) {
         reviewThreads(first: 100) {
           nodes {
             isResolved
             comments(first: 20) {
               nodes {
                 body
                 path
                 line
                 diffHunk
                 author { login }
                 createdAt
               }
             }
           }
         }
       }
     }
   }'
   ```

3. **Filter based on argument**
   - `unresolved` → only threads where `isResolved == false`
   - `resolved` → only threads where `isResolved == true`
   - `all` or empty → show all threads

4. **Format output**
   For each thread, display:
   ```
   ### @author `path#line` [resolved/unresolved]
   ```diff
   [diffHunk]
   ```
   > [comment body]

   [replies indented]
   ```

5. **Handle edge cases**
   - If no PR exists for current branch: "No PR found for this branch"
   - If no comments: "No comments found"
   - If no unresolved comments (when filtering): "No unresolved comments found"

## Output Format

Return ONLY the formatted comments. Group by resolution status if showing all:

```markdown
## Unresolved Comments (X)

### @author `file.ts#42`
[content]

---

## Resolved Comments (X)

### @author `file.ts#10`
[content]
```
