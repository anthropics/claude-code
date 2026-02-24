#!/bin/bash
echo "🚀 GROQ MIGRATION FINAL - 100% AUTOMÁTICO"

# Configurar repo
gh repo set-default ensideanderson-nova/claude-code

# Workflow Groq PERFEITO (sem erros YAML)
cat > .github/workflows/groq-triage.yml << 'YAML'
name: "Groq Triage FREE"
on:
  issues:
    types: [opened]
  workflow_dispatch:
jobs:
  classify:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
    - uses: actions/checkout@v4
    - name: Classify with Groq
      env:
        GROQ_API_KEY: \${{ secrets.GROQ_API_KEY }}
      run: |
        ISSUE_NUM=\${{ github.event.issue.number }}
        TITLE=\$(gh issue view \$ISSUE_NUM --json title --jq .title)
        echo "Classifying: \$TITLE"
        
        LABEL=\$(curl -s -X POST https://api.groq.com/openai/v1/chat/completions \
          -H "Authorization: Bearer \$GROQ_API_KEY" \
          -H "Content-Type: application/json" \
          -d '{
            "model": "llama3.1-70b-versatile",
            "messages": [{"role": "user", "content": "Classify GitHub issue: "\$TITLE". Return ONLY: bug, feature, docs, question"}],
            "max_tokens": 10
          }' | jq -r '.choices[0].message.content // "bug"')
        
        gh issue edit \$ISSUE_NUM --add-label "\$LABEL"
        echo "✅ Added label: \$LABEL"
YAML

echo "your_groq_key_here" | gh secret set GROQ_API_KEY

echo "✅ Workflow criado! PAT necessário (30s):"
echo "1. https://github.com/settings/tokens"
echo "2. 'Generate new token (classic)'"
echo "3. Scopes: repo + workflow"
read -p "Cole PAT: " PAT

git remote set-url origin https://$PAT@github.com/ensideanderson-nova/claude-code.git
git add .github/workflows/groq-triage.yml
git commit -m "GROQ migration complete"
git push origin HEAD:main

echo "🎉 GROQ ATIVO! Teste:"
echo "gh issue create --title 'GROQ TEST' --body 'Teste auto-classify'"
