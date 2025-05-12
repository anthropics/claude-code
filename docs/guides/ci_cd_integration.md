# CI/CD Integration Guide

This guide explains how to integrate the recursive debugging tools into your CI/CD pipeline, ensuring that recursive issues are automatically detected and fixed during your development process.

## GitHub Actions Integration

The Claude Neural Framework provides ready-to-use GitHub Actions workflows for recursive debugging:

1. **Recursive Debug Check** - runs on every push and pull request to check for recursive issues
2. **Auto-Fix Recursive Issues** - can be triggered manually or by issues to fix recursive problems

### Setting Up Recursive Debug Check

The `recursive_debug_check.yml` workflow automatically detects files with recursive functions and analyzes them for potential issues. It will:

1. Scan your repository for recursive patterns in JavaScript and Python files
2. Run the appropriate debugging workflow on each file
3. Categorize issues by severity (critical, high, medium, low)
4. Fail the workflow if critical or high-severity issues are found

To enable this in your own project:

1. Copy the workflow file:
   ```bash
   mkdir -p .github/workflows
   cp /path/to/claude-code/.github/workflows/recursive_debug_check.yml .github/workflows/
   ```

2. Customize the settings as needed (e.g., branches to check, severity thresholds)

3. Commit and push the workflow file:
   ```bash
   git add .github/workflows/recursive_debug_check.yml
   git commit -m "Add recursive debug check workflow"
   git push
   ```

### Setting Up Auto-Fix Workflow

The `auto_fix_recursive.yml` workflow can automatically fix recursive issues. It can be triggered in two ways:

1. **Manually** - via the GitHub Actions interface, providing the file path to fix
2. **Via Issues** - when an issue is created with the label `recursion-bug`

To enable this in your own project:

1. Copy the workflow file and issue template:
   ```bash
   mkdir -p .github/workflows .github/ISSUE_TEMPLATE
   cp /path/to/claude-code/.github/workflows/auto_fix_recursive.yml .github/workflows/
   cp /path/to/claude-code/.github/issue_template.md .github/ISSUE_TEMPLATE/recursive_bug.md
   ```

2. Commit and push the files:
   ```bash
   git add .github/workflows/auto_fix_recursive.yml .github/ISSUE_TEMPLATE/recursive_bug.md
   git commit -m "Add auto-fix workflow for recursive issues"
   git push
   ```

## GitLab CI Integration

For GitLab CI, you can use the following `.gitlab-ci.yml` configuration:

```yaml
stages:
  - test
  - fix

recursive_check:
  stage: test
  image: node:16
  script:
    - npm ci || npm install
    - mkdir -p ~/.claude/config
    - cp core/config/debug_workflow_config.json ~/.claude/config/ || echo '{"workflows":{"standard":[{"command":"debug-recursive","options":{"template":"recursive_bug_analysis"}}]}}' > ~/.claude/config/debug_workflow_config.json
    - |
      JS_FILES=$(find . -name "*.js" -type f -not -path "./node_modules/*" -not -path "./dist/*" | xargs grep -l "function.*(.*).*{.*\1\s*(" || echo "")
      PY_FILES=$(find . -name "*.py" -type f -not -path "./venv/*" -not -path "./.tox/*" | xargs grep -l "def.*(.*).*:.*\1\s*(" || echo "")
      
      CRITICAL=0
      HIGH=0
      
      for file in $JS_FILES $PY_FILES; do
        echo "Checking $file"
        node scripts/debug_workflow_engine.js run standard --file "$file" --output json > "$file.debug.json" || true
        
        if grep -q '"severity":"critical"' "$file.debug.json"; then
          CRITICAL=$((CRITICAL+1))
        elif grep -q '"severity":"high"' "$file.debug.json"; then
          HIGH=$((HIGH+1))
        fi
      done
      
      if [ $CRITICAL -gt 0 ] || [ $HIGH -gt 0 ]; then
        echo "Critical or high severity recursive issues found!"
        exit 1
      fi
  artifacts:
    paths:
      - "**/*.debug.json"
    reports:
      junit: test-results.xml

auto_fix:
  stage: fix
  image: node:16
  script:
    - npm ci || npm install
    - mkdir -p ~/.claude/config
    - cp core/config/debug_workflow_config.json ~/.claude/config/ || echo '{"workflows":{"standard":[{"command":"debug-recursive","options":{"template":"recursive_bug_analysis"}},{"command":"optimize-recursive","options":{"strategy":"auto"}}]}}' > ~/.claude/config/debug_workflow_config.json
    - |
      if [ -z "$FILE_PATH" ]; then
        echo "No file path provided"
        exit 1
      fi
      
      if [ ! -f "$FILE_PATH" ]; then
        echo "File $FILE_PATH does not exist"
        exit 1
      fi
      
      # Create backup
      cp "$FILE_PATH" "${FILE_PATH}.bak"
      
      # Run debug workflow with fix
      node scripts/debug_workflow_engine.js run standard --file "$FILE_PATH" --save --output json > fix-result.json
      
      # Check if file was modified
      if cmp -s "$FILE_PATH" "${FILE_PATH}.bak"; then
        echo "No changes were made to the file"
      else
        echo "File was fixed"
        
        # Create MR if GitLab API token is available
        if [ -n "$GITLAB_API_TOKEN" ]; then
          git config --global user.email "claude-bot@example.com"
          git config --global user.name "Claude Bot"
          git checkout -b fix-recursive-$CI_JOB_ID
          git add "$FILE_PATH"
          git commit -m "Auto-fix recursive issues in $FILE_PATH"
          git push -u origin fix-recursive-$CI_JOB_ID
          
          # Create MR
          curl --request POST \
            --header "PRIVATE-TOKEN: $GITLAB_API_TOKEN" \
            --header "Content-Type: application/json" \
            --data "{\"source_branch\":\"fix-recursive-$CI_JOB_ID\",\"target_branch\":\"$CI_COMMIT_REF_NAME\",\"title\":\"Auto-fix recursive issues in $FILE_PATH\"}" \
            "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests"
        fi
      fi
  rules:
    - if: '$FILE_PATH != null'
      when: manual
  artifacts:
    paths:
      - fix-result.json
      - "$FILE_PATH.bak"
```

## Jenkins Integration

For Jenkins, create a `Jenkinsfile` in your repository:

```groovy
pipeline {
    agent {
        docker {
            image 'node:16'
        }
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm ci || npm install'
                sh 'mkdir -p ~/.claude/config'
                sh 'cp core/config/debug_workflow_config.json ~/.claude/config/ || echo \'{"workflows":{"standard":[{"command":"debug-recursive","options":{"template":"recursive_bug_analysis"}}]}}\' > ~/.claude/config/debug_workflow_config.json'
            }
        }
        
        stage('Detect Recursive Files') {
            steps {
                sh '''
                    JS_FILES=$(find . -name "*.js" -type f -not -path "./node_modules/*" -not -path "./dist/*" | xargs grep -l "function.*(.*).*{.*\\1\\s*(" || echo "")
                    PY_FILES=$(find . -name "*.py" -type f -not -path "./venv/*" -not -path "./.tox/*" | xargs grep -l "def.*(.*).*:.*\\1\\s*(" || echo "")
                    
                    echo "$JS_FILES $PY_FILES" > recursive_files.txt
                '''
                stash includes: 'recursive_files.txt', name: 'recursive-files'
            }
        }
        
        stage('Analyze Recursive Files') {
            steps {
                unstash 'recursive-files'
                sh '''
                    CRITICAL=0
                    HIGH=0
                    MEDIUM=0
                    LOW=0
                    
                    for file in $(cat recursive_files.txt); do
                        [ -z "$file" ] && continue
                        echo "Checking $file"
                        node scripts/debug_workflow_engine.js run standard --file "$file" --output json > "$file.debug.json" || true
                        
                        if grep -q \'"severity":"critical"\' "$file.debug.json"; then
                            CRITICAL=$((CRITICAL+1))
                        elif grep -q \'"severity":"high"\' "$file.debug.json"; then
                            HIGH=$((HIGH+1))
                        elif grep -q \'"severity":"medium"\' "$file.debug.json"; then
                            MEDIUM=$((MEDIUM+1))
                        elif grep -q \'"severity":"low"\' "$file.debug.json"; then
                            LOW=$((LOW+1))
                        fi
                    done
                    
                    echo "Critical: $CRITICAL" > severity_counts.txt
                    echo "High: $HIGH" >> severity_counts.txt
                    echo "Medium: $MEDIUM" >> severity_counts.txt
                    echo "Low: $LOW" >> severity_counts.txt
                    
                    if [ $CRITICAL -gt 0 ] || [ $HIGH -gt 0 ]; then
                        echo "Critical or high severity recursive issues found!"
                        exit 1
                    fi
                '''
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: '**/*.debug.json', allowEmptyArchive: true
            archiveArtifacts artifacts: 'severity_counts.txt', allowEmptyArchive: true
        }
    }
}
```

## Configuration Options

You can customize the CI/CD integration with the following options:

### Severity Thresholds

Adjust which severity levels cause the pipeline to fail:

```yaml
# GitHub Actions example
- name: Analyze results
  run: |
    # Only fail on critical issues
    if [ $CRITICAL -gt 0 ]; then
      echo "::set-output name=success::false"
    else
      echo "::set-output name=success::true"
    fi
```

### Workflow Types

Choose different workflow types based on the branch or context:

```yaml
# Different workflows for different branches
if [[ "$BRANCH_NAME" == "production" ]]; then
  WORKFLOW="deep"
elif [[ "$BRANCH_NAME" == "develop" ]]; then
  WORKFLOW="standard"
else
  WORKFLOW="quick"
fi

node scripts/debug_workflow_engine.js run $WORKFLOW --file "$FILE_PATH"
```

### Notification Integration

Add notification steps to alert teams about recursive issues:

```yaml
- name: Notify on Slack
  if: steps.analyze.outputs.critical > 0
  uses: slackapi/slack-github-action@v1.23.0
  with:
    channel-id: 'recursive-alerts'
    slack-message: 'Critical recursive issues found in ${{ github.repository }}! Please check the CI/CD results.'
  env:
    SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

## Best Practices

1. **Regular Checks**: Run recursive debugging checks on every commit to catch issues early
2. **Scheduled Deep Analysis**: Run more comprehensive checks (e.g., "deep" workflow) on a scheduled basis
3. **Auto-Fix with Review**: Use auto-fix capabilities but always review the changes before merging
4. **Custom Thresholds**: Adjust severity thresholds based on your project's needs and maturity
5. **Progressive Implementation**: Start with non-blocking checks and gradually make them stricter as your codebase improves
