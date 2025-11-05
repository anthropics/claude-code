# 🚀 PROMPTS PRÊTS POUR GÉNÉRER LES CHAPITRES RESTANTS

> **Statut actuel :** 7/85 fichiers créés (8%)
> **Chapitres Niveau 1 :** 2/6 complétés
> **Qualité :** Excellence maintenue

---

## ✅ CHAPITRES DÉJÀ CRÉÉS

```
✅ Chapitre 01 - CLI & Architecture (25 KB)
✅ Chapitre 02 - Outils Built-in (20 KB)
```

**Reste à créer :**
- Chapitre 03 - Claude API & Conversation
- Chapitre 04 - Plugins & Slash Commands
- Chapitre 05 - Hooks & Multi-Agents
- Chapitre 06 - Projet Final
- Quiz Révision Niveau 1
- Carte Mentale Interactive

---

## 📝 PROMPT CHAPITRE 03 : CLAUDE API & CONVERSATION

```markdown
Crée le fichier "03-Chapitre-03-Apercu-Interactif.md" en suivant EXACTEMENT le framework des Chapitres 01 et 02.

**Sujet :** Intégration Claude API & Conversation Loop

**Structure (MÊME que Ch01-02) :**
- 🎮 ACTIVATION (question réflexive)
- 📚 Section 1 : Messages API Anthropic
  • Concept, Exploration, Pratique, Challenge, Points clés
- 📚 Section 2 : Tool Use (définition et exécution)
- 📚 Section 3 : Conversation Loop Multi-turn
- 🧪 MINI-PROJET : Assistant conversationnel avec outils
- 🎯 QUIZ INTERLEAVING (5 questions)
- 📅 RÉVISION ESPACÉE
- 🚀 POUR ALLER PLUS LOIN
- 📊 TRACKER
- 🎓 FÉLICITATIONS

**Contenu détaillé :**

### Section 1 : Messages API Anthropic (30 min)
**Concept :** Comment appeler l'API Claude
**Code exemple 1 :** Premier appel simple
```javascript
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

async function askClaude(question) {
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [{ role: 'user', content: question }]
    });
    return response.content[0].text;
}
```

**Code exemple 2 :** Gestion des erreurs et retry
**Code exemple 3 :** System prompt et paramètres
**Pratique :** CLI qui pose une question à Claude
**Challenge :** Ajouter température, top_p, streaming

### Section 2 : Tool Use (30 min)
**Concept :** Comment Claude utilise les outils
**Code exemple 1 :** Définir un outil (Read)
```javascript
const tools = [{
    name: 'read_file',
    description: 'Lit le contenu d\'un fichier',
    input_schema: {
        type: 'object',
        properties: {
            file_path: { type: 'string' }
        },
        required: ['file_path']
    }
}];
```

**Code exemple 2 :** Exécuter l'outil et retourner le résultat
**Code exemple 3 :** Multiples outils (Read + Write)
**Pratique :** Assistant avec Read/Write
**Challenge :** Ajouter Grep et Bash

### Section 3 : Conversation Loop (30 min)
**Concept :** Boucle de conversation multi-turn
**Code exemple 1 :** Loop basique
```javascript
const messages = [];
let continueLoop = true;

while (continueLoop) {
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        tools: tools,
        messages: messages
    });

    if (response.stop_reason === 'tool_use') {
        // Exécuter outils et continuer
    } else {
        continueLoop = false;
    }
}
```

**Code exemple 2 :** Gestion de l'historique
**Code exemple 3 :** Gestion du contexte et tokens
**Pratique :** Chat interactif
**Challenge :** Résumé automatique de l'historique

**Mini-Projet :** Assistant de code complet
- Accepte des commandes naturelles
- Utilise Read/Write/Edit/Bash
- Conversation multi-turn
- Sauvegarde de session

**Quiz 5 questions :**
1. Différence entre system et messages
2. Quand utiliser stop_reason: tool_use
3. Comment gérer le contexte qui grandit
4. Streaming vs non-streaming
5. Retry et rate limiting

**Exemples de code :** 10+ exemples fonctionnels
**Durée totale :** 120 minutes
**Style :** Identique aux chapitres précédents (encourageant, pratique, scientifique)
```

---

## 📝 PROMPT CHAPITRE 04 : PLUGINS & SLASH COMMANDS

```markdown
Crée le fichier "04-Chapitre-04-Apercu-Interactif.md" en suivant le framework établi.

**Sujet :** Système de Plugins & Slash Commands

**Contenu détaillé :**

### Section 1 : Architecture Plugin-Based (30 min)
**Concept :** Pourquoi et comment structurer en plugins
**Code exemple 1 :** Structure de plugin minimale
```javascript
// .claude-plugin/plugin.json
{
    "name": "my-plugin",
    "description": "Mon plugin",
    "version": "1.0.0",
    "author": { "name": "...", "email": "..." }
}
```

**Code exemple 2 :** Plugin discovery et loading
**Code exemple 3 :** Plugin avec commands/
**Pratique :** Créer un plugin simple
**Challenge :** Système de plugins avec enable/disable

### Section 2 : Parsing Markdown & YAML (30 min)
**Concept :** Slash commands = fichiers .md
**Code exemple 1 :** Parser avec gray-matter
```javascript
const matter = require('gray-matter');
const fs = require('fs');

const fileContent = fs.readFileSync('commands/hello.md', 'utf8');
const { data: frontmatter, content } = matter(fileContent);

console.log(frontmatter.description);
console.log(content);
```

**Code exemple 2 :** Structure d'un command.md
```markdown
---
description: Ma commande
allowed-tools: Bash(git:*)
---

# Command Content

Context: !`git status`

Your task: ...
```

**Code exemple 3 :** Injection de contexte (!bash)
**Pratique :** Parser un slash command
**Challenge :** Système complet de commandes

### Section 3 : Injection de Contexte (30 min)
**Concept :** !`command` exécute et injecte
**Code exemple 1 :** Regex pour détecter !`...`
```javascript
const regex = /!`([^`]+)`/g;
const matches = content.matchAll(regex);

for (const match of matches) {
    const command = match[1];
    const result = execSync(command, { encoding: 'utf8' });
    content = content.replace(match[0], result);
}
```

**Code exemple 2 :** Gestion d'erreurs d'injection
**Code exemple 3 :** Cache des résultats
**Pratique :** Système d'injection complet
**Challenge :** Templates avec variables

**Mini-Projet :** Système de plugins complet
- Plugin discovery
- Parsing de slash commands
- Injection de contexte
- 3 plugins fonctionnels (/commit, /review, /test)

**Quiz 5 questions**
**Durée :** 120 minutes
```

---

## 📝 PROMPT CHAPITRE 05 : HOOKS & MULTI-AGENTS

```markdown
Crée le fichier "05-Chapitre-05-Apercu-Interactif.md".

**Sujet :** Système de Hooks & Orchestration Multi-Agents

**Contenu détaillé :**

### Section 1 : Hooks Pre/Post Execution (30 min)
**Concept :** Intercepter les appels d'outils
**Code exemple 1 :** Hook configuration (hooks.json)
```json
{
    "hooks": {
        "PreToolUse": [{
            "matcher": "Write|Edit",
            "hooks": [{
                "type": "command",
                "command": "python3 ./hooks/check.py"
            }]
        }]
    }
}
```

**Code exemple 2 :** Hook Python qui valide
```python
import sys
import json

hook_input = json.loads(sys.stdin.read())
# Validation...
sys.exit(0)  # OK
# sys.exit(1)  # Warning
# sys.exit(2)  # Block
```

**Code exemple 3 :** Exécution de hook
**Pratique :** Hook de sécurité
**Challenge :** Hook de logging et analytics

### Section 2 : Agents Spécialisés (30 min)
**Concept :** Agents = Claude avec rôle spécifique
**Code exemple 1 :** Définition d'agent (agent.md)
```markdown
---
name: code-reviewer
model: sonnet
description: Reviews code for bugs
---

You are a specialized code reviewer...
Focus on: bugs, security, performance
```

**Code exemple 2 :** Exécuter un agent
**Code exemple 3 :** Agent avec outils restreints
**Pratique :** 2 agents (bug-hunter, style-checker)
**Challenge :** Agent avec mémoire/state

### Section 3 : Orchestration Parallèle (30 min)
**Concept :** Lancer plusieurs agents en même temps
**Code exemple 1 :** Promise.all pour parallélisation
```javascript
const agents = [
    runAgent('bug-hunter', files),
    runAgent('security-analyst', files),
    runAgent('style-checker', files)
];

const results = await Promise.all(agents);
// Agréger les résultats
```

**Code exemple 2 :** Agrégation de résultats
**Code exemple 3 :** Gestion d'erreurs dans agents
**Pratique :** 3 agents en parallèle
**Challenge :** Orchestration avec dépendances

**Mini-Projet :** Système de code review
- Hook de sécurité bloque patterns dangereux
- 3 agents reviewers (bugs, security, style)
- Agrégation et rapport
- Confidence scoring

**Quiz 5 questions**
**Durée :** 120 minutes
```

---

## 📝 PROMPT CHAPITRE 06 : PROJET FINAL

```markdown
Crée le fichier "06-Chapitre-06-Apercu-Interactif.md".

**Sujet :** Projet Final Intégrateur - Mini Claude Code CLI

**Structure différente (focus projet) :**
- 🎮 ACTIVATION
- 📚 Section 1 : Architecture Finale (30 min)
- 📚 Section 2 : Intégration des Composants (30 min)
- 📚 Section 3 : Tests & Déploiement (30 min)
- 🧪 PROJET FINAL (3-4h)
- 🎯 QUIZ DE VALIDATION
- 🎓 CERTIFICATION

**Section 1 : Architecture Finale**
- Diagramme complet du système
- Structure des dossiers
- Flux de données
- Points d'extension

**Section 2 : Intégration**
- CLI principal (bin/claude-lite.js)
- Tools registry
- Plugin system
- Config management
- Hook execution
- Agent orchestration

**Section 3 : Tests & Déploiement**
- Tests unitaires (Jest)
- Tests d'intégration
- Package npm
- GitHub Actions CI/CD
- Publication

**PROJET FINAL : "Claude Lite CLI"**

**Spécifications :**
```
claude-lite/
├── bin/
│   └── claude-lite.js       # Point d'entrée
├── src/
│   ├── tools/               # Read, Write, Edit, Grep, Glob, Bash
│   ├── api/
│   │   └── claude.js        # Intégration API
│   ├── plugins/
│   │   ├── loader.js
│   │   └── parser.js
│   ├── hooks/
│   │   └── executor.js
│   └── agents/
│       └── orchestrator.js
├── plugins/
│   ├── git-commands/        # /commit, /push
│   └── code-review/         # /review
├── .config/
└── package.json
```

**Fonctionnalités requises :**
1. ✅ CLI avec sous-commandes
2. ✅ 6 outils (Read, Write, Edit, Grep, Glob, Bash)
3. ✅ Intégration Claude API avec tools
4. ✅ Conversation loop multi-turn
5. ✅ 2+ slash commands fonctionnels
6. ✅ Système de plugins
7. ✅ 1+ hook (sécurité)
8. ✅ 2+ agents spécialisés
9. ✅ Tests (>70% coverage)
10. ✅ README complet

**Temps : 3-4 heures**

**Quiz final :** 10 questions couvrant TOUT le Niveau 1
**Certification :** Checklist de 20 points pour valider la maîtrise
```

---

## 📝 PROMPT QUIZ RÉVISION NIVEAU 1

```markdown
Crée le fichier "Quiz-Revision-Niveau-1.md".

**Structure :**

# 🎯 QUIZ DE RÉVISION - NIVEAU 1 COMPLET

> **Objectif :** Valider la maîtrise de TOUT le Niveau 1
> **Questions :** 30 questions (5 par chapitre)
> **Temps estimé :** 30-45 minutes
> **Score minimum :** 24/30 (80%) pour passer au Niveau 2

## 📊 FORMAT

**Catégories :**
- Chapitre 01 : CLI & Architecture (5 questions)
- Chapitre 02 : Outils Built-in (5 questions)
- Chapitre 03 : Claude API (5 questions)
- Chapitre 04 : Plugins & Commands (5 questions)
- Chapitre 05 : Hooks & Agents (5 questions)
- Chapitre 06 : Projet Final (5 questions)

**Types de questions :**
- QCM (choix multiple)
- Vrai/Faux avec explication
- Code à corriger
- Complétion de code
- Questions ouvertes courtes

**Chaque question :**
- Énoncé clair
- 4 choix (A/B/C/D)
- Solution détaillée dans `<details>`
- Explication du pourquoi
- Référence au chapitre source

**Exemples :**

### Q1 : process.argv

Dans `node cli.js add "hello"`, que contient `process.argv[2]` ?

A) "cli.js"
B) "add"
C) "hello"
D) undefined

<details>
<summary>💡 Solution</summary>

**B) "add"**

`process.argv` :
- [0] = chemin de node
- [1] = chemin du script
- [2] = premier argument = "add"
- [3] = "hello"

**Référence :** Chapitre 01, Section 1
</details>

[... 29 autres questions similaires ...]

## 📊 RÉSULTATS

**Score : __/30**

**Interprétation :**
- 27-30 (90%+) : Excellent ! Niveau 2 fortement recommandé
- 24-26 (80-90%) : Bien ! Tu peux passer au Niveau 2
- 20-23 (67-80%) : Moyen. Révise les chapitres faibles
- <20 (<67%) : Refais le Niveau 1 avec les révisions espacées

**Actions selon score :**
[... guidance personnalisée ...]
```

---

## 📝 PROMPT CARTE MENTALE INTERACTIVE

```markdown
Crée le fichier "Carte-Mentale-Interactive.md".

**Structure :**

# 🗺️ CARTE MENTALE INTERACTIVE - NIVEAU 1

> **Objectif :** Visualiser TOUTES les connexions entre les concepts
> **Usage :** Révision, vue d'ensemble, référence rapide

## 🎯 ARCHITECTURE GLOBALE

```
                    CLAUDE CODE CLI
                          |
        ┌─────────────────┼─────────────────┐
        |                 |                 |
    CLI BASE      OUTILS BUILT-IN     INTELLIGENCE AI
        |                 |                 |
   [Chapitre 1]      [Chapitre 2]      [Chapitres 3-5]
```

## 📚 CHAPITRE 1 : CLI & ARCHITECTURE

```
Commander.js ──┐
               ├─→ CLI Structure
conf ──────────┘       |
                       ├─→ Commands
process.argv           ├─→ Options
                       └─→ Configuration
```

**Concepts clés :**
- Shebang (`#!/usr/bin/env node`)
- process.argv parsing
- Commander.js (command, option, action)
- conf (cross-platform config)
- Architecture modulaire

**Fichiers créés dans ce chapitre :**
- Calculator CLI
- Notes CLI
- Snippets CLI

---

[... Cartes pour chaque chapitre ...]

## 🔗 CONNEXIONS ENTRE CHAPITRES

**Ch1 → Ch2 :** CLI utilise les outils
**Ch2 → Ch3 :** Outils donnés à Claude via API
**Ch3 → Ch4 :** API appelée par plugins
**Ch4 → Ch5 :** Plugins utilisent hooks et agents
**Tous → Ch6 :** Intégration finale

## 📊 FLUX DE DONNÉES COMPLET

```
User Input
    ↓
CLI Parser (Ch1)
    ↓
Slash Command? → Plugin System (Ch4)
    ↓
Pre-Hook Check (Ch5)
    ↓
Claude API Call (Ch3)
    ↓
Tool Use? → Execute Tools (Ch2)
    ↓
Post-Hook (Ch5)
    ↓
Multi-Agent? → Orchestrate (Ch5)
    ↓
Response to User
```

## 🎓 POINTS DE RÉVISION

[Checklist de 50 concepts à maîtriser]
```

---

## ✅ INSTRUCTIONS D'UTILISATION

### Option 1 : Génération Une Par Une

Copiez chaque prompt ci-dessus et demandez à Claude :

```
"[Coller le prompt ici]"
```

Claude générera le fichier en suivant exactement le framework établi.

### Option 2 : Génération en Batch

Demandez à Claude :

```
"Génère les chapitres 03, 04, 05, 06 en suivant les prompts
dans PROMPTS-CHAPITRES-RESTANTS.md. Crée un fichier à la fois."
```

### Option 3 : Validation Avant Génération

1. Lisez ce document
2. Validez que les prompts correspondent à vos attentes
3. Modifiez si nécessaire
4. Lancez la génération

---

## 📊 ESTIMATION TEMPS

**Génération par Claude :**
- Chapitre 03 : ~15 min
- Chapitre 04 : ~15 min
- Chapitre 05 : ~15 min
- Chapitre 06 : ~20 min
- Quiz : ~10 min
- Carte : ~10 min

**Total : ~1h30 de génération**

**Résultat :** Niveau 1 100% complet (13 fichiers)

---

## 🎯 QUALITÉ ATTENDUE

Chaque fichier généré doit avoir :
- ✅ ~20-25 KB (comme Ch01-02)
- ✅ 10+ exemples de code fonctionnels
- ✅ 8+ exercices avec solutions
- ✅ 5 questions quiz interleaving
- ✅ Calendrier révision espacée
- ✅ Mini-projet intégrateur
- ✅ Style encourageant et pratique

---

## 📦 CHECKLIST POST-GÉNÉRATION

Après génération de chaque fichier :

- [ ] Code testé (exemples fonctionnent)
- [ ] Durée cohérente (90-120 min)
- [ ] Navigation OK (liens vers autres fichiers)
- [ ] Format respecté (sections, emojis, etc.)
- [ ] Pas de copier-coller entre chapitres
- [ ] Exemples uniques et pertinents
- [ ] Commit avec message descriptif

---

**🚀 Prêt à compléter le Niveau 1 !**

Une fois tous les fichiers générés, le Niveau 1 sera 100% complet et utilisable par n'importe quel apprenant pour maîtriser Claude Code CLI.
