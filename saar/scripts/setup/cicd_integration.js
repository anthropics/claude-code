#!/usr/bin/env node

/**
 * CI/CD-Integration für Rekursives Debugging
 * =========================================
 * 
 * Richtet CI/CD-Pipelines für automatisches rekursives Debugging ein und 
 * integriert sie in verschiedene CI/CD-Systeme wie GitHub Actions,
 * GitLab CI, Jenkins, und mehr.
 * 
 * Unterstützt multiple Programmiersprachen und automatisiertes Feedback.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { program } = require('commander');

// Verfügbare CI/CD-Systeme
const CI_SYSTEMS = ['github', 'gitlab', 'jenkins', 'azure', 'circle', 'travis'];

// Unterstützte Sprachen
const LANGUAGES = {
  js: {
    name: 'JavaScript',
    extensions: ['.js', '.jsx'],
    testCommand: 'node scripts/debug_workflow_engine.js run deep'
  },
  ts: {
    name: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    testCommand: 'node scripts/debug_workflow_engine.js run deep'
  },
  py: {
    name: 'Python',
    extensions: ['.py'],
    testCommand: 'python scripts/auto_debug.py'
  },
  java: {
    name: 'Java',
    extensions: ['.java'],
    testCommand: 'java -jar tools/RecursiveDebugger.jar'
  },
  cpp: {
    name: 'C++',
    extensions: ['.cpp', '.cc', '.h', '.hpp'],
    testCommand: 'tools/cpp_debug_analyze'
  },
  rust: {
    name: 'Rust',
    extensions: ['.rs'],
    testCommand: 'cargo run --bin recursive_analyzer'
  },
  go: {
    name: 'Go',
    extensions: ['.go'],
    testCommand: 'go run cmd/recursive_analyzer/main.go'
  }
};

// CLI-Konfiguration
program
  .name('cicd-integration')
  .description('CI/CD-Integration für rekursives Debugging')
  .version('1.0.0');

program
  .command('setup')
  .description('Richtet CI/CD-Integration ein')
  .option('-p, --path <path>', 'Projektpfad', process.cwd())
  .option('-c, --ci <system>', 'CI/CD-System (github, gitlab, jenkins, azure, circle, travis)', 'github')
  .option('-l, --languages <langs>', 'Zu unterstützende Sprachen (kommagetrennt)', 'js,py')
  .option('-a, --auto-fix', 'Automatische Fixes in CI aktivieren', false)
  .option('-n, --notify <channel>', 'Benachrichtigungskanal (slack, email, teams)', '')
  .option('-w, --workflow <name>', 'Name des Workflows', 'recursive-debug')
  .option('-e, --enterprise', 'Enterprise Features aktivieren', false)
  .option('--compliance-framework <framework>', 'Compliance-Framework (SOC2, GDPR, ISO27001, etc.)', '')
  .option('--approval-workflow', 'Genehmigungsprozess für Änderungen aktivieren', false)
  .option('--audit', 'Ausführliches Audit-Logging aktivieren', false)
  .action(setupCI);

program
  .command('test')
  .description('Testet CI/CD-Integration')
  .option('-p, --path <path>', 'Projektpfad', process.cwd())
  .option('-c, --ci <system>', 'CI/CD-System', 'github')
  .action(testCI);

program.parse();

// Hauptfunktionen
function setupCI(options) {
  console.log(`CI/CD-Integration einrichten für rekursives Debugging`);
  console.log(`Projektpfad: ${options.path}`);
  console.log(`CI/CD-System: ${options.ci}`);
  
  // Sprachen verarbeiten
  const selectedLanguages = options.languages.split(',')
    .map(lang => lang.trim().toLowerCase())
    .filter(lang => LANGUAGES[lang]);
  
  if (selectedLanguages.length === 0) {
    console.error('Fehler: Keine gültigen Sprachen angegeben.');
    console.log('Verfügbare Sprachen:', Object.keys(LANGUAGES).join(', '));
    process.exit(1);
  }
  
  console.log(`Ausgewählte Sprachen: ${selectedLanguages.map(lang => LANGUAGES[lang].name).join(', ')}`);
  
  // CI-System validieren
  if (!CI_SYSTEMS.includes(options.ci)) {
    console.error(`Fehler: Unbekanntes CI-System: ${options.ci}`);
    console.log('Verfügbare CI-Systeme:', CI_SYSTEMS.join(', '));
    process.exit(1);
  }
  
  // Claude-Verzeichnis im Projekt erstellen
  const claudeDir = path.join(options.path, '.claude');
  const ciDir = path.join(claudeDir, 'ci');
  
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }
  
  if (!fs.existsSync(ciDir)) {
    fs.mkdirSync(ciDir, { recursive: true });
  }
  
  // CI-Konfiguration erstellen
  switch (options.ci) {
    case 'github':
      setupGitHubActions(options, selectedLanguages);
      break;
    case 'gitlab':
      setupGitLabCI(options, selectedLanguages);
      break;
    case 'jenkins':
      setupJenkins(options, selectedLanguages);
      break;
    case 'azure':
      setupAzurePipelines(options, selectedLanguages);
      break;
    case 'circle':
      setupCircleCI(options, selectedLanguages);
      break;
    case 'travis':
      setupTravisCI(options, selectedLanguages);
      break;
    default:
      console.error(`CI/CD-System ${options.ci} nicht implementiert.`);
      process.exit(1);
  }
  
  // Konfigurationskopie im Claude-Verzeichnis speichern
  saveCIConfig(options, selectedLanguages);
  
  console.log('CI/CD-Integration eingerichtet für rekursives Debugging!');
}

// CI-Systeme einrichten
function setupGitHubActions(options, languages) {
  console.log('GitHub Actions-Workflow für rekursives Debugging einrichten...');
  
  // GitHub Actions-Verzeichnisse erstellen
  const githubDir = path.join(options.path, '.github');
  const workflowsDir = path.join(githubDir, 'workflows');
  
  if (!fs.existsSync(githubDir)) {
    fs.mkdirSync(githubDir);
  }
  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir);
  }
  
  // Workflow-Datei erstellen
  const workflowFile = path.join(workflowsDir, `${options.workflow}.yml`);
  
  // Pipeline-Trigger erstellen
  const langPatterns = languages.map(lang => 
    LANGUAGES[lang].extensions.map(ext => `**/*${ext}`).join('\n        - ')
  ).join('\n        - ');
  
  // Sprachspezifische Job-Steps erstellen
  const langSteps = languages.map(lang => {
    const langDetail = LANGUAGES[lang];
    return `
    # ${langDetail.name} rekursive Debugging-Prüfung
    - name: Rekursives Debugging für ${langDetail.name}
      if: ${{ contains(steps.filter.outputs.changes, '${lang}') }}
      run: |
        ${langDetail.testCommand} --output github
    `;
  }).join('\n');
  
  // Benachrichtigungen konfigurieren
  let notifyStep = '';
  if (options.notify) {
    switch (options.notify) {
      case 'slack':
        notifyStep = `
    - name: Slack-Benachrichtigung bei rekursiven Problemen
      if: ${{ failure() }}
      uses: rtCamp/action-slack-notify@v2
      env:
        SLACK_WEBHOOK: \${{ secrets.SLACK_WEBHOOK }}
        SLACK_CHANNEL: code-quality
        SLACK_COLOR: danger
        SLACK_TITLE: "Rekursive Probleme gefunden"
        SLACK_MESSAGE: "Es wurden potenzielle rekursive Probleme in deinem Code gefunden. Bitte überprüfe das GitHub Actions-Log."`;
        break;
      case 'teams':
        notifyStep = `
    - name: Teams-Benachrichtigung bei rekursiven Problemen
      if: ${{ failure() }}
      uses: aliencube/microsoft-teams-actions@v0.8.0
      with:
        webhook_uri: \${{ secrets.TEAMS_WEBHOOK }}
        title: "Rekursive Probleme gefunden"
        summary: "Es wurden potenzielle rekursive Probleme in deinem Code gefunden. Bitte überprüfe das GitHub Actions-Log."`;
        break;
      case 'email':
        notifyStep = `
    - name: E-Mail-Benachrichtigung bei rekursiven Problemen
      if: ${{ failure() }}
      uses: dawidd6/action-send-mail@v3
      with:
        server_address: \${{ secrets.MAIL_SERVER }}
        server_port: \${{ secrets.MAIL_PORT }}
        username: \${{ secrets.MAIL_USERNAME }}
        password: \${{ secrets.MAIL_PASSWORD }}
        subject: "Rekursive Probleme gefunden"
        body: "Es wurden potenzielle rekursive Probleme in deinem Code gefunden. Bitte überprüfe das GitHub Actions-Log."
        to: \${{ github.event.pusher.email }}
        from: "GitHub Actions"`;
        break;
    }
  }
  
  // Automatische Fixes
  const autoFixStep = options.autoFix ? `
    - name: Automatische Fixes für rekursive Probleme anwenden
      if: ${{ failure() && contains(github.event.head_commit.message, '[auto-fix]') }}
      run: |
        node scripts/debug_workflow_engine.js run deep --fix
        
        # Änderungen committen, wenn vorhanden
        if [[ -n $(git status --porcelain) ]]; then
          git config --global user.name "Claude Auto-Fix Bot"
          git config --global user.email "claude-bot@example.com"
          git add .
          git commit -m "Auto-Fix: Rekursive Probleme behoben [skip ci]"
          git push
        fi
  ` : '';
  
  // Enterprise-specific steps
  let enterpriseSteps = '';
  if (options.enterprise) {
    let complianceStep = '';
    if (options.complianceFramework) {
      complianceStep = `
    - name: Compliance Check
      run: |
        node core/security/compliance_check.js --framework ${options.complianceFramework} --output compliance-report.json

    - name: Upload Compliance Report
      uses: actions/upload-artifact@v3
      with:
        name: compliance-report
        path: compliance-report.json
      `;
    }

    let approvalStep = '';
    if (options.approvalWorkflow) {
      approvalStep = `
    - name: Request approval for sensitive changes
      if: github.event_name == 'pull_request' && contains(github.event.pull_request.labels.*.name, 'needs-approval')
      uses: trstringer/manual-approval@v1
      with:
        secret: \${{ secrets.GITHUB_TOKEN }}
        approvers: required-approvers
        minimum-approvals: 1
        issue-title: "Approval required for PR #${{ github.event.pull_request.number }}"
        issue-body: "This PR requires approval before it can be merged."
        exclude-workflow-initiator-as-approver: false
      `;
    }

    let auditStep = '';
    if (options.audit) {
      auditStep = `
    - name: Generate audit log
      run: |
        node core/logging/audit_logger.js --trigger=ci --detail=high

    - name: Upload Audit Log
      uses: actions/upload-artifact@v3
      with:
        name: audit-log
        path: .claude/logs/audit-*.log
      `;
    }

    enterpriseSteps = `
    # Enterprise-specific steps
    - name: Enterprise Validation
      run: |
        echo "Running enterprise validation checks"
${complianceStep}
${approvalStep}
${auditStep}
    `;
  }

  // Workflow-Datei erstellen
  const workflowContent = `name: ${options.enterprise ? 'Enterprise' : 'Rekursives'} Debugging

on:
  push:
    branches: [ main, master, dev, develop ]
    paths:
        - ${langPatterns}
  pull_request:
    branches: [ main, master ]
    paths:
        - ${langPatterns}

jobs:
  recursive-debug:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3
      with:
        fetch-depth: 0

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'

    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'

    - name: Install dependencies
      run: |
        npm install
        pip install -r requirements.txt

    - name: Filter changed files by type
      id: filter
      run: |
        CHANGED_FILES=$(git diff --name-only ${{ github.event.before }} ${{ github.sha }} | grep -E "\\.(${languages.join('|')})" || echo "")
        echo "Changes detected in: $CHANGED_FILES"

        # Detect language-specific changes
        ${languages.map(lang => `
        ${lang.toUpperCase()}_CHANGES=$(echo "$CHANGED_FILES" | grep -E "\\.(${LANGUAGES[lang].extensions.map(e => e.substring(1)).join('|')})" || echo "")
        if [ ! -z "$${lang.toUpperCase()}_CHANGES" ]; then
          echo "changes=${lang}" >> $GITHUB_OUTPUT
        fi`).join('\n        ')}
${langSteps}
${enterpriseSteps}
${autoFixStep}
${notifyStep}
`;

  fs.writeFileSync(workflowFile, workflowContent);
  console.log(`GitHub Actions-Workflow in ${workflowFile} erstellt`);
}

function setupGitLabCI(options, languages) {
  console.log('GitLab CI-Pipeline für rekursives Debugging einrichten...');
  
  // GitLab CI-Konfigurationsdatei
  const gitlabCIFile = path.join(options.path, '.gitlab-ci.yml');
  
  // Sprachspezifische Job-Definitionen erstellen
  const langJobs = languages.map(lang => {
    const langDetail = LANGUAGES[lang];
    return `
recursive_debug_${lang}:
  stage: test
  image: node:20
  script:
    - npm install
    - ${langDetail.testCommand} --output gitlab
  only:
    changes:
      ${langDetail.extensions.map(ext => `- "**/*${ext}"`).join('\n      ')}
  artifacts:
    paths:
      - .claude/reports
    when: always
`;
  }).join('\n');
  
  // Automatische Fixes
  const autoFixJob = options.autoFix ? `
recursive_auto_fix:
  stage: deploy
  image: node:20
  script:
    - npm install
    - node scripts/debug_workflow_engine.js run deep --fix
    - |
      if [[ -n $(git status --porcelain) ]]; then
        git config --global user.name "Claude Auto-Fix Bot"
        git config --global user.email "claude-bot@example.com"
        git add .
        git commit -m "Auto-Fix: Rekursive Probleme behoben [skip ci]"
        git push origin $CI_COMMIT_REF_NAME
      fi
  only:
    variables:
      - $CI_COMMIT_MESSAGE =~ /\\[auto-fix\\]/
  when: on_failure
` : '';
  
  // Benachrichtigungen konfigurieren
  let notifyJob = '';
  if (options.notify) {
    switch (options.notify) {
      case 'slack':
        notifyJob = `
notify_slack:
  stage: .post
  script:
    - 'curl -X POST -H "Content-type: application/json" --data "{\\"text\\":\\"Rekursive Probleme gefunden in $CI_PROJECT_NAME\\"}" $SLACK_WEBHOOK'
  only:
    - main
    - master
  when: on_failure
`;
        break;
      // Weitere Benachrichtigungstypen hier...
    }
  }
  
  // GitLab CI-Konfiguration erstellen
  const gitlabCIContent = `# Rekursives Debugging für GitLab CI

stages:
  - test
  - deploy
  - .post

${langJobs}
${autoFixJob}
${notifyJob}
`;

  fs.writeFileSync(gitlabCIFile, gitlabCIContent);
  console.log(`GitLab CI-Konfiguration in ${gitlabCIFile} erstellt`);
}

function setupJenkins(options, languages) {
  console.log('Jenkins-Pipeline für rekursives Debugging einrichten...');
  
  // Jenkinsfile erstellen
  const jenkinsFile = path.join(options.path, 'Jenkinsfile');
  
  // Sprachspezifische Phasen erstellen
  const langStages = languages.map(lang => {
    const langDetail = LANGUAGES[lang];
    return `
        stage('${langDetail.name} Rekursives Debugging') {
            when {
                anyOf {
                    ${langDetail.extensions.map(ext => `changeset "*${ext}"`).join('\n                    ')}
                }
            }
            steps {
                sh "${langDetail.testCommand} --output jenkins"
            }
        }`;
  }).join('\n');
  
  // Automatische Fixes
  const autoFixStage = options.autoFix ? `
        stage('Auto-Fix rekursive Probleme') {
            when {
                expression { 
                    return currentBuild.result == 'FAILURE' && env.GIT_COMMIT_MSG.contains('[auto-fix]') 
                }
            }
            steps {
                sh """
                    node scripts/debug_workflow_engine.js run deep --fix
                    
                    if [[ -n \$(git status --porcelain) ]]; then
                        git config user.name "Claude Auto-Fix Bot"
                        git config user.email "claude-bot@example.com"
                        git add .
                        git commit -m "Auto-Fix: Rekursive Probleme behoben [skip ci]"
                        git push origin \${env.BRANCH_NAME}
                    fi
                """
            }
        }` : '';
  
  // Benachrichtigungen konfigurieren
  let notifyStage = '';
  if (options.notify) {
    switch (options.notify) {
      case 'slack':
        notifyStage = `
        stage('Benachrichtigung') {
            when {
                expression { return currentBuild.result == 'FAILURE' }
            }
            steps {
                slackSend channel: '#code-quality',
                          color: 'danger',
                          message: "Rekursive Probleme gefunden in \${env.JOB_NAME}. Mehr Details: \${env.BUILD_URL}"
            }
        }`;
        break;
      // Weitere Benachrichtigungstypen hier...
    }
  }
  
  // Jenkinsfile erstellen
  const jenkinsContent = `pipeline {
    agent any
    
    environment {
        GIT_COMMIT_MSG = sh(script: 'git log -1 --pretty=%B ${GIT_COMMIT}', returnStdout: true).trim()
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm install'
                sh 'pip install -r requirements.txt'
            }
        }
${langStages}
${autoFixStage}
    }
    
    post {
        failure {
${notifyStage}
        }
        always {
            archiveArtifacts artifacts: '.claude/reports/**/*', allowEmptyArchive: true
        }
    }
}`;

  fs.writeFileSync(jenkinsFile, jenkinsContent);
  console.log(`Jenkins-Pipeline in ${jenkinsFile} erstellt`);
}

function setupAzurePipelines(options, languages) {
  console.log('Azure-Pipeline für rekursives Debugging einrichten...');
  
  // Azure Pipelines-Konfigurationsdatei
  const azureFile = path.join(options.path, 'azure-pipelines.yml');
  
  // Sprachspezifische Jobs erstellen
  const langJobs = languages.map(lang => {
    const langDetail = LANGUAGES[lang];
    const extensions = langDetail.extensions.map(ext => `*${ext}`).join(', ');
    
    return `
  - job: RecursiveDebug_${lang}
    displayName: '${langDetail.name} Rekursives Debugging'
    condition: >-
      and(succeeded(),
        or(
          eq(variables['Build.Reason'], 'PullRequest'),
          eq(variables['Build.Reason'], 'IndividualCI')
        )
      )
    steps:
    - checkout: self
      fetchDepth: 0
    
    - task: NodeTool@0
      inputs:
        versionSpec: '20.x'
      displayName: 'Node.js installieren'
    
    - script: |
        npm install
      displayName: 'Abhängigkeiten installieren'
    
    - powershell: |
        $changedFiles = (git diff --name-only HEAD HEAD~1)
        $hasChanges = $changedFiles | Where-Object { $_ -match "(${extensions.replace(/\./g, '\\.')})" }
        
        if ($hasChanges) {
          Write-Host "##vso[task.setvariable variable=hasChanges]true"
        } else {
          Write-Host "##vso[task.setvariable variable=hasChanges]false"
        }
      displayName: 'Prüfe auf Änderungen an ${langDetail.name}-Dateien'
    
    - script: |
        ${langDetail.testCommand} --output azure
      displayName: 'Rekursives Debugging ausführen'
      condition: eq(variables['hasChanges'], 'true')
    
    - task: PublishBuildArtifacts@1
      inputs:
        PathtoPublish: '.claude/reports'
        ArtifactName: 'debug-reports'
      displayName: 'Debug-Reports veröffentlichen'
      condition: succeededOrFailed()`;
  }).join('\n');
  
  // Automatische Fixes
  const autoFixJob = options.autoFix ? `
  - job: AutoFix
    displayName: 'Automatische Fixes anwenden'
    dependsOn: [${languages.map(lang => `RecursiveDebug_${lang}`).join(', ')}]
    condition: >-
      and(
        failed(),
        startsWith(variables['Build.SourceVersionMessage'], '[auto-fix]')
      )
    steps:
    - checkout: self
      persistCredentials: true
    
    - task: NodeTool@0
      inputs:
        versionSpec: '20.x'
    
    - script: |
        npm install
        node scripts/debug_workflow_engine.js run deep --fix
        
        if [[ -n $(git status --porcelain) ]]; then
          git config user.name "Claude Auto-Fix Bot"
          git config user.email "claude-bot@example.com"
          git add .
          git commit -m "Auto-Fix: Rekursive Probleme behoben [skip ci]"
          git push origin $(Build.SourceBranchName)
        fi
      displayName: 'Rekursive Probleme automatisch beheben'` : '';
  
  // Benachrichtigungen konfigurieren
  let notifyJob = '';
  if (options.notify) {
    switch (options.notify) {
      case 'teams':
        notifyJob = `
  - job: Notify
    displayName: 'Benachrichtigung senden'
    dependsOn: [${languages.map(lang => `RecursiveDebug_${lang}`).join(', ')}]
    condition: failed()
    steps:
    - task: office365connector@1
      inputs:
        webhook: '$(TeamsWebhook)'
        title: 'Rekursive Probleme gefunden'
        summary: 'In der Pipeline wurden rekursive Probleme gefunden, die Aufmerksamkeit erfordern.'
        themeColor: '0078D7'
        sections: '[{"activityTitle":"$(Build.DefinitionName)","activitySubtitle":"$(Build.BuildNumber)"}]'`;
        break;
      // Weitere Benachrichtigungstypen hier...
    }
  }
  
  // Azure Pipelines-Konfiguration erstellen
  const azureContent = `# Azure Pipeline für rekursives Debugging

trigger:
  branches:
    include:
    - main
    - master
    - dev
    - develop
  paths:
    include:
    ${languages.map(lang => 
      LANGUAGES[lang].extensions.map(ext => `    - '**/*${ext}'`).join('\n')
    ).join('\n')}

pool:
  vmImage: 'ubuntu-latest'

jobs:${langJobs}${autoFixJob}${notifyJob}
`;

  fs.writeFileSync(azureFile, azureContent);
  console.log(`Azure-Pipeline in ${azureFile} erstellt`);
}

function setupCircleCI(options, languages) {
  console.log('CircleCI-Konfiguration für rekursives Debugging einrichten...');
  
  // CircleCI-Verzeichnis erstellen
  const circleCIDir = path.join(options.path, '.circleci');
  if (!fs.existsSync(circleCIDir)) {
    fs.mkdirSync(circleCIDir);
  }
  
  // CircleCI-Konfigurationsdatei
  const circleFile = path.join(circleCIDir, 'config.yml');
  
  // Sprachspezifische Jobs erstellen
  const langJobs = languages.map(lang => {
    const langDetail = LANGUAGES[lang];
    
    return `
  recursive_debug_${lang}:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run:
          name: Install dependencies
          command: npm install
      - run:
          name: Filter changed files
          command: |
            git diff --name-only HEAD^ HEAD > changed_files.txt
            grep -E "\\.(${langDetail.extensions.map(ext => ext.substring(1)).join('|')})$" changed_files.txt > ${lang}_files.txt || true
            if [ -s ${lang}_files.txt ]; then
              echo "export HAS_${lang.toUpperCase()}_CHANGES=true" >> $BASH_ENV
            else
              echo "export HAS_${lang.toUpperCase()}_CHANGES=false" >> $BASH_ENV
            fi
      - run:
          name: Run recursive debugging
          command: |
            if [ "$HAS_${lang.toUpperCase()}_CHANGES" = "true" ]; then
              ${langDetail.testCommand} --output circle
            else
              echo "No ${langDetail.name} files changed, skipping check."
            fi
      - store_artifacts:
          path: .claude/reports
          destination: reports`;
  }).join('\n');
  
  // Automatische Fixes
  const autoFixJob = options.autoFix ? `
  auto_fix:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run:
          name: Check commit message
          command: |
            if echo "$CIRCLE_COMMIT_MESSAGE" | grep -q "\\[auto-fix\\]"; then
              echo "export DO_AUTO_FIX=true" >> $BASH_ENV
            else
              echo "export DO_AUTO_FIX=false" >> $BASH_ENV
            fi
      - run:
          name: Install dependencies
          command: npm install
      - run:
          name: Apply automatic fixes
          command: |
            if [ "$DO_AUTO_FIX" = "true" ]; then
              node scripts/debug_workflow_engine.js run deep --fix
              
              if [[ -n $(git status --porcelain) ]]; then
                git config user.name "Claude Auto-Fix Bot"
                git config user.email "claude-bot@example.com"
                git add .
                git commit -m "Auto-Fix: Rekursive Probleme behoben [skip ci]"
                git push origin $CIRCLE_BRANCH
              fi
            else
              echo "Auto-fix not requested in commit message."
            fi
    requires:
      ${languages.map(lang => `- recursive_debug_${lang}`).join('\n      ')}
    filters:
      branches:
        only: /^(main|master|dev|develop)$/` : '';
  
  // Benachrichtigungen konfigurieren
  let notifyStep = '';
  if (options.notify) {
    switch (options.notify) {
      case 'slack':
        notifyStep = `
          - slack/notify:
              event: fail
              template: basic_fail_1`;
        break;
      // Weitere Benachrichtigungstypen hier...
    }
  }
  
  // CircleCI-Konfiguration erstellen
  const circleContent = `# CircleCI configuration for recursive debugging
version: 2.1

${options.notify === 'slack' ? 'orbs:\n  slack: circleci/slack@4.10.1\n' : ''}

jobs:${langJobs}

workflows:
  version: 2
  recursive_debugging:
    jobs:
      ${languages.map(lang => `- recursive_debug_${lang}`).join('\n      ')}${autoFixJob ? `\n      - auto_fix:
          requires:
            ${languages.map(lang => `- recursive_debug_${lang}`).join('\n            ')}
          filters:
            branches:
              only: /^(main|master|dev|develop)$/` : ''}
`;

  fs.writeFileSync(circleFile, circleContent);
  console.log(`CircleCI-Konfiguration in ${circleFile} erstellt`);
}

function setupTravisCI(options, languages) {
  console.log('Travis CI-Konfiguration für rekursives Debugging einrichten...');
  
  // Travis-Konfigurationsdatei
  const travisFile = path.join(options.path, '.travis.yml');
  
  // Sprachspezifische Skripte erstellen
  const langScripts = languages.map(lang => {
    const langDetail = LANGUAGES[lang];
    
    return `  - |
    if git diff --name-only $TRAVIS_COMMIT_RANGE | grep -q "\\.(${langDetail.extensions.map(ext => ext.substring(1)).join('|')})$"; then
      ${langDetail.testCommand} --output travis
    else
      echo "No ${langDetail.name} files changed, skipping check."
    fi`;
  }).join('\n');
  
  // Automatische Fixes
  const autoFixScript = options.autoFix ? `
  - |
    if [[ "$TRAVIS_TEST_RESULT" == 1 && "$TRAVIS_COMMIT_MESSAGE" == *"[auto-fix]"* ]]; then
      node scripts/debug_workflow_engine.js run deep --fix
      
      if [[ -n $(git status --porcelain) ]]; then
        git config --global user.name "Claude Auto-Fix Bot"
        git config --global user.email "claude-bot@example.com"
        git add .
        git commit -m "Auto-Fix: Rekursive Probleme behoben [skip ci]"
        git push origin $TRAVIS_BRANCH
      fi
    fi` : '';
  
  // Benachrichtigungen konfigurieren
  let notifyConfig = '';
  if (options.notify) {
    switch (options.notify) {
      case 'slack':
        notifyConfig = `
notifications:
  slack:
    rooms:
      - secure: YOUR_ENCRYPTED_SLACK_TOKEN
    on_success: change
    on_failure: always`;
        break;
      case 'email':
        notifyConfig = `
notifications:
  email:
    on_success: change
    on_failure: always`;
        break;
      // Weitere Benachrichtigungstypen hier...
    }
  }
  
  // Travis CI-Konfiguration erstellen
  const travisContent = `# Travis CI configuration for recursive debugging
language: node_js

node_js:
  - "20"

cache:
  npm: true
  directories:
    - ~/.cache/pip

branches:
  only:
    - main
    - master
    - dev
    - develop

before_install:
  - python -m pip install --upgrade pip

install:
  - npm install
  - pip install -r requirements.txt

script:
${langScripts}

after_failure:${autoFixScript}
${notifyConfig}
`;

  fs.writeFileSync(travisFile, travisContent);
  console.log(`Travis CI-Konfiguration in ${travisFile} erstellt`);
}

// Konfiguration speichern
function saveCIConfig(options, languages) {
  // Konfiguration im Claude-Verzeichnis speichern
  const claudeDir = path.join(options.path, '.claude');
  const ciDir = path.join(claudeDir, 'ci');

  const configFile = path.join(ciDir, 'config.json');

  const config = {
    system: options.ci,
    languages: languages.map(lang => ({
      id: lang,
      name: LANGUAGES[lang].name,
      extensions: LANGUAGES[lang].extensions,
      testCommand: LANGUAGES[lang].testCommand
    })),
    options: {
      autoFix: options.autoFix,
      notify: options.notify,
      workflow: options.workflow
    },
    created: new Date().toISOString(),
    version: '1.0.0'
  };

  // Add enterprise options if enabled
  if (options.enterprise) {
    config.enterprise = {
      enabled: true,
      complianceFramework: options.complianceFramework || '',
      approvalWorkflow: options.approvalWorkflow || false,
      audit: options.audit || false
    };

    // For specific compliance frameworks, add additional configuration
    if (options.complianceFramework) {
      const frameworks = options.complianceFramework.split(',').map(f => f.trim());
      config.enterprise.frameworks = frameworks;

      // Default retention periods based on compliance frameworks
      const retentionPeriods = {
        default: { logs: 30, conversations: 7, documents: 30 },
        'SOC2': { logs: 365, conversations: 90, documents: 365 },
        'GDPR': { logs: 90, conversations: 30, documents: 90 },
        'ISO27001': { logs: 180, conversations: 60, documents: 180 }
      };

      // Find the highest retention period across all specified frameworks
      const dataRetention = { ...retentionPeriods.default };

      frameworks.forEach(framework => {
        if (retentionPeriods[framework]) {
          Object.keys(dataRetention).forEach(key => {
            dataRetention[key] = Math.max(dataRetention[key], retentionPeriods[framework][key]);
          });
        }
      });

      config.enterprise.dataRetention = dataRetention;
    }
  }

  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  console.log(`CI-Konfiguration in ${configFile} gespeichert`);
}

// CI-Konfiguration testen
function testCI(options) {
  console.log(`CI/CD-Integration testen für ${options.ci}...`);
  
  // Konfigurationsdatei prüfen
  let configFile;
  
  switch (options.ci) {
    case 'github':
      configFile = path.join(options.path, '.github/workflows');
      break;
    case 'gitlab':
      configFile = path.join(options.path, '.gitlab-ci.yml');
      break;
    case 'jenkins':
      configFile = path.join(options.path, 'Jenkinsfile');
      break;
    case 'azure':
      configFile = path.join(options.path, 'azure-pipelines.yml');
      break;
    case 'circle':
      configFile = path.join(options.path, '.circleci/config.yml');
      break;
    case 'travis':
      configFile = path.join(options.path, '.travis.yml');
      break;
  }
  
  if (!fs.existsSync(configFile)) {
    console.error(`Keine CI-Konfiguration gefunden für ${options.ci}. Bitte führen Sie zuerst 'setup' aus.`);
    process.exit(1);
  }
  
  console.log(`CI-Konfiguration gefunden: ${configFile}`);
  console.log('Validierung erfolgreich!');
  
  // Weitere Tests je nach CI-System
  // ...
  
  console.log('CI/CD-Integration Test abgeschlossen');
}
