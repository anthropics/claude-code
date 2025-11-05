# 🎬 NIVEAU 1 : SURVOL INTERACTIF COMPLET

> **🎯 Objectif :** Comprendre ET pratiquer l'ENSEMBLE de l'architecture Claude Code CLI en 60 minutes
> **🧠 Science :** Active Learning + Immediate Feedback + Low Cognitive Load + Metacognition
> **📊 Progression :** [■□□□□□□□□□] 10% du parcours total
> **⏱️ Durée :** 60 minutes

---

## 🎮 ACTIVATION : Avant de Commencer

### 🤔 Question Réflexive (Metacognition)

> Imagine que tu veux créer un assistant AI qui aide les développeurs à coder.
>
> **Réfléchis 30 secondes :**
> - Quels outils devrait-il avoir ? (lire des fichiers, écrire du code, exécuter des commandes...)
> - Comment devrait-il fonctionner ? (commandes textuelles, plugins, automatisation...)
> - Qu'est-ce qui le rendrait vraiment utile ?

**💭 Réfléchis avant de scroller...**

---

**🎯 C'est exactement ce que tu vas apprendre à construire !**

Claude Code CLI est un assistant AI en ligne de commande qui :
- 🤖 Converse avec Claude (l'IA d'Anthropic)
- 🛠️ Utilise des outils (lire/écrire fichiers, exécuter bash, chercher code)
- 🔌 S'étend via des plugins
- 🤝 Orchestre plusieurs agents spécialisés en parallèle
- 🪝 Intercepte les actions avec des hooks pour plus de contrôle

**Dans cette formation, tu vas construire ça de A à Z.**

---

## 🗺️ CARTE DU TERRITOIRE : Les 6 Chapitres

```
┌─────────────────────────────────────────────────────────────────┐
│                   ARCHITECTURE CLAUDE CODE CLI                  │
└─────────────────────────────────────────────────────────────────┘
         │
         ├─ 📱 CH1: CLI & ARCHITECTURE
         │   └─ Interface utilisateur, commandes, configuration
         │
         ├─ 🛠️ CH2: OUTILS BUILT-IN
         │   └─ Read, Write, Edit, Grep, Glob, Bash
         │
         ├─ 🤖 CH3: CLAUDE API & CONVERSATION
         │   └─ Appels API, contexte, multi-turn, tools
         │
         ├─ 🔌 CH4: PLUGINS & SLASH COMMANDS
         │   └─ Markdown parsing, plugin loading, /commands
         │
         ├─ 🪝 CH5: HOOKS & MULTI-AGENTS
         │   └─ Pre/Post hooks, orchestration parallèle
         │
         └─ 🏗️ CH6: PROJET FINAL
             └─ Intégration complète
```

---

## 📚 CHAPITRE 1 APERÇU : CLI & Architecture (15 min)

### 💡 CONCEPT PRINCIPAL

**En une phrase :** Un CLI (Command Line Interface) est un programme qui s'exécute dans le terminal et prend des commandes textuelles.

**🎨 Analogie :**
> Un CLI, c'est comme parler à un assistant dans le terminal.
> Au lieu de cliquer sur des boutons, tu tapes des commandes :
> - `claude-cli /commit` → "Crée un commit git"
> - `claude-cli /review` → "Analyse mon code"

### 🔍 EXEMPLE DE CODE : CLI Minimal avec Node.js

```javascript
#!/usr/bin/env node
// my-cli.js

// 1. Lire les arguments de la ligne de commande
const args = process.argv.slice(2); // Enlève 'node' et 'my-cli.js'

// 2. Parser la commande
const command = args[0];

// 3. Exécuter l'action correspondante
if (command === 'hello') {
    const name = args[1] || 'World';
    console.log(`👋 Hello, ${name}!`);
} else if (command === 'help') {
    console.log(`
📖 Commandes disponibles:
  - hello [name]  : Dit bonjour
  - help          : Affiche l'aide
    `);
} else {
    console.log(`❌ Commande inconnue: ${command}`);
    console.log(`💡 Tape 'help' pour voir les commandes`);
}
```

**Comment l'utiliser :**
```bash
node my-cli.js hello Alice
# 👋 Hello, Alice!

node my-cli.js help
# 📖 Commandes disponibles: ...
```

### 🎮 PRATIQUE IMMÉDIATE : Ton Premier CLI

**🎯 Défi :** Crée un CLI qui gère une liste de tâches

**📝 Cahier des charges :**
- `todo add "ma tâche"` → Ajoute une tâche
- `todo list` → Liste toutes les tâches
- `todo done 0` → Marque la tâche 0 comme complétée

**💡 Squelette de code :**

```javascript
#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];

// Stockage simple en mémoire (pour commencer)
let todos = [];

switch (command) {
    case 'add':
        const task = args[1];
        // TODO: Ajouter la tâche à la liste
        console.log(`✅ Tâche ajoutée: ${task}`);
        break;

    case 'list':
        // TODO: Afficher toutes les tâches
        console.log('📋 Liste des tâches:');
        break;

    case 'done':
        const index = parseInt(args[1]);
        // TODO: Marquer comme complété
        console.log(`✓ Tâche ${index} complétée!`);
        break;

    default:
        console.log('❌ Commande inconnue');
}
```

**✅ Solution Complète :**

<details>
<summary>💡 Cliquez pour voir la solution</summary>

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0];

// Fichier de stockage persistant
const TODO_FILE = path.join(__dirname, 'todos.json');

// Lire les tâches depuis le fichier
function loadTodos() {
    if (!fs.existsSync(TODO_FILE)) {
        return [];
    }
    const data = fs.readFileSync(TODO_FILE, 'utf8');
    return JSON.parse(data);
}

// Sauvegarder les tâches
function saveTodos(todos) {
    fs.writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2));
}

let todos = loadTodos();

switch (command) {
    case 'add':
        const task = args.slice(1).join(' ');
        todos.push({ task, done: false });
        saveTodos(todos);
        console.log(`✅ Tâche ajoutée: ${task}`);
        break;

    case 'list':
        console.log('📋 Liste des tâches:');
        todos.forEach((todo, i) => {
            const status = todo.done ? '✓' : '○';
            console.log(`  ${i}. [${status}] ${todo.task}`);
        });
        break;

    case 'done':
        const index = parseInt(args[1]);
        if (todos[index]) {
            todos[index].done = true;
            saveTodos(todos);
            console.log(`✓ Tâche ${index} complétée!`);
        } else {
            console.log(`❌ Tâche ${index} introuvable`);
        }
        break;

    default:
        console.log('❌ Commande inconnue');
        console.log('💡 Commandes: add, list, done');
}
```

**Tester :**
```bash
node todo-cli.js add "Apprendre Claude Code"
node todo-cli.js add "Construire mon CLI"
node todo-cli.js list
node todo-cli.js done 0
node todo-cli.js list
```

</details>

### 📊 POINTS CLÉS

- ✅ Un CLI lit `process.argv` pour les arguments
- ✅ `#!/usr/bin/env node` rend le fichier exécutable
- ✅ `fs` module permet de lire/écrire des fichiers
- ✅ JSON est pratique pour stocker des données simples

---

## 🛠️ CHAPITRE 2 APERÇU : Outils Built-in (10 min)

### 💡 CONCEPT PRINCIPAL

**En une phrase :** Les outils built-in permettent à Claude de manipuler des fichiers, chercher du code et exécuter des commandes.

**🎨 Analogie :**
> Claude sans outils = un cerveau sans mains
>
> Les outils sont les "mains" de Claude :
> - **Read** : Lire un fichier
> - **Write** : Créer/écraser un fichier
> - **Edit** : Modifier une partie d'un fichier
> - **Grep** : Chercher du texte dans les fichiers
> - **Glob** : Trouver des fichiers par pattern
> - **Bash** : Exécuter des commandes shell

### 🔍 EXEMPLE : Outil Read Simple

```javascript
// tools/read.js

const fs = require('fs');

function readFile(filePath, offset = 0, limit = 2000) {
    try {
        // Lire le fichier
        const content = fs.readFileSync(filePath, 'utf8');

        // Découper en lignes
        const lines = content.split('\n');

        // Appliquer offset et limit
        const selectedLines = lines.slice(offset, offset + limit);

        // Retourner avec numéros de ligne
        return selectedLines
            .map((line, i) => `${offset + i + 1}\t${line}`)
            .join('\n');
    } catch (error) {
        return `❌ Erreur: ${error.message}`;
    }
}

// Test
console.log(readFile('./my-cli.js', 0, 10));
```

### 🎮 PRATIQUE : Outil Write

**🎯 Défi :** Crée un outil `writeFile` qui écrit du contenu dans un fichier

```javascript
function writeFile(filePath, content) {
    // TODO: Écrire le contenu dans le fichier
    // Gérer les erreurs
    // Retourner un message de succès
}

// Test
writeFile('./test.txt', 'Hello, World!');
```

<details>
<summary>✅ Solution</summary>

```javascript
const fs = require('fs');
const path = require('path');

function writeFile(filePath, content) {
    try {
        // Créer le dossier parent si nécessaire
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Écrire le fichier
        fs.writeFileSync(filePath, content, 'utf8');

        return `✅ Fichier écrit: ${filePath} (${content.length} caractères)`;
    } catch (error) {
        return `❌ Erreur: ${error.message}`;
    }
}

// Test
console.log(writeFile('./test.txt', 'Hello, World!'));
console.log(writeFile('./data/notes.txt', 'Ma note'));
```

</details>

### 🔍 EXEMPLE : Outil Grep (Recherche)

```javascript
const fs = require('fs');
const path = require('path');

function grep(pattern, directory = '.', options = {}) {
    const results = [];
    const regex = new RegExp(pattern, options.caseInsensitive ? 'i' : '');

    function searchInFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                if (regex.test(line)) {
                    results.push({
                        file: filePath,
                        line: index + 1,
                        content: line.trim()
                    });
                }
            });
        } catch (error) {
            // Ignorer les fichiers non lisibles
        }
    }

    function searchInDirectory(dir) {
        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory() && !file.startsWith('.')) {
                searchInDirectory(fullPath);
            } else if (stat.isFile() && file.endsWith('.js')) {
                searchInFile(fullPath);
            }
        });
    }

    searchInDirectory(directory);
    return results;
}

// Test : Chercher "function" dans tous les fichiers .js
const results = grep('function', '.', { caseInsensitive: false });
console.log(`🔍 Trouvé ${results.length} résultats:`);
results.slice(0, 5).forEach(r => {
    console.log(`  ${r.file}:${r.line} - ${r.content.substring(0, 60)}...`);
});
```

### 📊 POINTS CLÉS

- ✅ `fs.readFileSync()` lit un fichier de manière synchrone
- ✅ `fs.writeFileSync()` écrit dans un fichier
- ✅ `path.join()` construit des chemins cross-platform
- ✅ Les regex permettent des recherches puissantes

---

## 🤖 CHAPITRE 3 APERÇU : Claude API & Conversation (15 min)

### 💡 CONCEPT PRINCIPAL

**En une phrase :** L'API Claude permet d'envoyer des messages et de recevoir des réponses intelligentes, avec la possibilité d'utiliser des outils.

**🎨 Analogie :**
> Appeler l'API Claude = envoyer un SMS à un ami très intelligent
>
> Tu envoies :
> - Ton message ("Peux-tu m'aider à écrire du code ?")
> - Le contexte (fichiers lus, historique conversation)
> - Les outils disponibles (Read, Write, Bash...)
>
> Claude répond :
> - Avec du texte ("Bien sûr ! Voici comment...")
> - OU en utilisant des outils ("Je vais d'abord lire le fichier X...")

### 🔍 EXEMPLE : Premier Appel API

```javascript
// claude-api.js
const Anthropic = require('@anthropic-ai/sdk');

// Initialiser le client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY, // Clé API dans variable d'env
});

async function askClaude(question) {
    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 1024,
            messages: [
                {
                    role: 'user',
                    content: question
                }
            ]
        });

        return response.content[0].text;
    } catch (error) {
        return `❌ Erreur API: ${error.message}`;
    }
}

// Test
(async () => {
    const answer = await askClaude('Explique-moi en une phrase ce qu\'est un CLI');
    console.log('🤖 Claude:', answer);
})();
```

**Sortie attendue :**
```
🤖 Claude: Un CLI (Command Line Interface) est un programme qui s'exécute dans
le terminal et permet d'interagir avec un système ou une application via des
commandes textuelles plutôt que via une interface graphique.
```

### 🔍 EXEMPLE AVANCÉ : Claude avec Outils

```javascript
async function claudeWithTools(userMessage) {
    const messages = [{ role: 'user', content: userMessage }];

    // Définir les outils disponibles
    const tools = [
        {
            name: 'read_file',
            description: 'Lit le contenu d\'un fichier',
            input_schema: {
                type: 'object',
                properties: {
                    file_path: {
                        type: 'string',
                        description: 'Le chemin du fichier à lire'
                    }
                },
                required: ['file_path']
            }
        },
        {
            name: 'write_file',
            description: 'Écrit du contenu dans un fichier',
            input_schema: {
                type: 'object',
                properties: {
                    file_path: { type: 'string' },
                    content: { type: 'string' }
                },
                required: ['file_path', 'content']
            }
        }
    ];

    let continueLoop = true;

    while (continueLoop) {
        // Appel à Claude
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 4096,
            tools: tools,
            messages: messages
        });

        console.log(`🤖 Claude (stop_reason: ${response.stop_reason})`);

        // Vérifier si Claude veut utiliser un outil
        if (response.stop_reason === 'tool_use') {
            // Ajouter la réponse de Claude à l'historique
            messages.push({ role: 'assistant', content: response.content });

            const toolResults = [];

            // Exécuter chaque outil demandé
            for (const contentBlock of response.content) {
                if (contentBlock.type === 'tool_use') {
                    const toolName = contentBlock.name;
                    const toolInput = contentBlock.input;

                    console.log(`🛠️ Utilise outil: ${toolName}`, toolInput);

                    // Exécuter l'outil
                    let result;
                    if (toolName === 'read_file') {
                        result = readFile(toolInput.file_path);
                    } else if (toolName === 'write_file') {
                        result = writeFile(toolInput.file_path, toolInput.content);
                    }

                    toolResults.push({
                        type: 'tool_result',
                        tool_use_id: contentBlock.id,
                        content: result
                    });
                }
            }

            // Renvoyer les résultats à Claude
            messages.push({ role: 'user', content: toolResults });

        } else if (response.stop_reason === 'end_turn') {
            // Claude a terminé
            const textContent = response.content.find(c => c.type === 'text');
            if (textContent) {
                console.log(`💬 Réponse finale: ${textContent.text}`);
            }
            continueLoop = false;
        }
    }
}

// Test
(async () => {
    await claudeWithTools('Lis le fichier package.json et dis-moi le nom du projet');
})();
```

**Ce qui se passe :**
```
1. User: "Lis le fichier package.json..."
2. Claude: "Je vais utiliser read_file" (tool_use)
3. System: Exécute read_file('package.json') → contenu
4. Claude reçoit le contenu
5. Claude: "Le projet s'appelle 'my-cli'" (end_turn)
```

### 🎮 PRATIQUE : Conversation Multi-Turn

**🎯 Défi :** Crée une boucle de conversation où l'utilisateur peut poser plusieurs questions

```javascript
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function chatLoop() {
    const conversationHistory = [];

    function askQuestion() {
        rl.question('You: ', async (input) => {
            if (input.toLowerCase() === 'exit') {
                console.log('👋 Au revoir!');
                rl.close();
                return;
            }

            // TODO: Ajouter le message à l'historique
            // TODO: Appeler Claude avec l'historique
            // TODO: Afficher la réponse
            // TODO: Ajouter la réponse à l'historique

            askQuestion(); // Continuer la boucle
        });
    }

    console.log('🤖 Claude CLI - Tape "exit" pour quitter\n');
    askQuestion();
}

chatLoop();
```

<details>
<summary>✅ Solution Complète</summary>

```javascript
const Anthropic = require('@anthropic-ai/sdk');
const readline = require('readline');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function chatLoop() {
    const conversationHistory = [];

    async function askQuestion() {
        rl.question('You: ', async (input) => {
            if (input.toLowerCase() === 'exit') {
                console.log('👋 Au revoir!');
                rl.close();
                return;
            }

            // Ajouter le message utilisateur
            conversationHistory.push({
                role: 'user',
                content: input
            });

            try {
                // Appeler Claude
                const response = await anthropic.messages.create({
                    model: 'claude-sonnet-4-5-20250929',
                    max_tokens: 1024,
                    messages: conversationHistory
                });

                const assistantMessage = response.content[0].text;

                // Ajouter la réponse à l'historique
                conversationHistory.push({
                    role: 'assistant',
                    content: assistantMessage
                });

                console.log(`\n🤖 Claude: ${assistantMessage}\n`);

            } catch (error) {
                console.error(`❌ Erreur: ${error.message}\n`);
            }

            askQuestion(); // Continuer
        });
    }

    console.log('🤖 Claude CLI - Tape "exit" pour quitter\n');
    askQuestion();
}

chatLoop();
```

**Test :**
```
🤖 Claude CLI - Tape "exit" pour quitter

You: Bonjour, comment ça va ?
🤖 Claude: Bonjour ! Je vais très bien, merci. Comment puis-je vous aider ?

You: Peux-tu m'expliquer ce qu'est un CLI ?
🤖 Claude: Un CLI (Command Line Interface) est...

You: exit
👋 Au revoir!
```

</details>

### 📊 POINTS CLÉS

- ✅ `anthropic.messages.create()` appelle l'API Claude
- ✅ Les messages ont un rôle (`user` ou `assistant`)
- ✅ L'historique permet une conversation multi-turn
- ✅ `tools` définit les outils disponibles pour Claude
- ✅ `stop_reason: 'tool_use'` signifie que Claude veut utiliser un outil

---

## 🔌 CHAPITRE 4 APERÇU : Plugins & Slash Commands (10 min)

### 💡 CONCEPT PRINCIPAL

**En une phrase :** Les plugins ajoutent des fonctionnalités à Claude Code via des fichiers Markdown qui définissent des commandes.

**🎨 Analogie :**
> Un plugin = une app sur ton smartphone
>
> Au lieu de coder en dur toutes les fonctionnalités, tu :
> - Crées des fichiers `.md` avec des instructions
> - Claude lit ces fichiers et exécute les tâches
> - Exemple : `/commit` → lit `commit.md` → crée un commit git

### 🔍 EXEMPLE : Structure d'un Slash Command

**Fichier : `commands/hello.md`**

```markdown
---
description: Dit bonjour à l'utilisateur
allowed-tools: Bash(echo:*)
---

# Hello Command

Dis bonjour à l'utilisateur de manière amicale.

## Context
- Nom de l'utilisateur: !`whoami`
- Date actuelle: !`date +%Y-%m-%d`

## Your task
Affiche un message de bienvenue personnalisé en utilisant ces informations.
```

**Concepts clés :**
- **YAML Frontmatter** (entre `---`) : Métadonnées
- **`description`** : Description de la commande
- **`allowed-tools`** : Outils que Claude peut utiliser
- **`!` prefix** : Exécute une commande bash et injecte le résultat

### 🔍 EXEMPLE : Parser un Slash Command

```javascript
const fs = require('fs');
const matter = require('gray-matter'); // npm install gray-matter

function parseCommand(commandPath) {
    // Lire le fichier
    const fileContent = fs.readFileSync(commandPath, 'utf8');

    // Parser le frontmatter YAML et le contenu Markdown
    const { data: frontmatter, content } = matter(fileContent);

    return {
        description: frontmatter.description || '',
        allowedTools: frontmatter['allowed-tools'] || '',
        content: content.trim()
    };
}

// Injecter les résultats des commandes !`...`
async function injectContext(content) {
    const { execSync } = require('child_process');

    // Trouver tous les !`command`
    const regex = /!`([^`]+)`/g;
    let processedContent = content;

    const matches = [...content.matchAll(regex)];
    for (const match of matches) {
        const command = match[1];
        try {
            const result = execSync(command, { encoding: 'utf8' }).trim();
            processedContent = processedContent.replace(match[0], result);
        } catch (error) {
            processedContent = processedContent.replace(match[0], `[Erreur: ${error.message}]`);
        }
    }

    return processedContent;
}

// Test
const command = parseCommand('./commands/hello.md');
console.log('📋 Frontmatter:', command);

injectContext(command.content).then(injected => {
    console.log('\n📝 Contenu avec contexte injecté:\n', injected);
});
```

**Sortie :**
```
📋 Frontmatter: {
  description: 'Dit bonjour à l\'utilisateur',
  allowedTools: 'Bash(echo:*)',
  content: '# Hello Command\n\nDis bonjour...\n\n## Context\n- Nom...'
}

📝 Contenu avec contexte injecté:
# Hello Command
...
## Context
- Nom de l'utilisateur: john
- Date actuelle: 2025-01-15
...
```

### 🎮 PRATIQUE : Créer un Slash Command `/commit`

**🎯 Défi :** Crée un slash command qui génère un message de commit git

**Fichier : `commands/commit.md`**

```markdown
---
description: Crée un commit git avec un message généré
allowed-tools: Bash(git:*)
---

# Git Commit Command

Analyse les changements git et crée un commit avec un message descriptif.

## Context
- Statut git: !`git status --short`
- Diff des changements: !`git diff --staged`
- Derniers commits: !`git log --oneline -5`

## Your task
1. Analyse les changements
2. Génère un message de commit conventionnel (feat:, fix:, chore:, etc.)
3. Crée le commit avec git commit -m "message"
```

**Code pour exécuter le command :**

```javascript
async function executeSlashCommand(commandName, userArgs = []) {
    // 1. Charger le command
    const commandPath = `./commands/${commandName}.md`;
    if (!fs.existsSync(commandPath)) {
        console.log(`❌ Commande /${commandName} introuvable`);
        return;
    }

    // 2. Parser le command
    const command = parseCommand(commandPath);
    console.log(`📝 Exécution de: ${command.description}\n`);

    // 3. Injecter le contexte
    const promptWithContext = await injectContext(command.content);

    // 4. Appeler Claude avec le prompt + tools autorisés
    console.log('🤖 Claude analyse les changements...\n');

    // TODO: Implémenter l'appel à Claude avec:
    // - Le prompt: promptWithContext
    // - Les tools: parsés depuis command.allowedTools
    // - La conversation loop pour exécuter les tools

    console.log('✅ Commit créé!');
}

// Test
executeSlashCommand('commit');
```

<details>
<summary>✅ Implémentation Complète</summary>

```javascript
const fs = require('fs');
const matter = require('gray-matter');
const { execSync } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

function parseCommand(commandPath) {
    const fileContent = fs.readFileSync(commandPath, 'utf8');
    const { data: frontmatter, content } = matter(fileContent);

    return {
        description: frontmatter.description || '',
        allowedTools: frontmatter['allowed-tools'] || '',
        content: content.trim()
    };
}

async function injectContext(content) {
    const regex = /!`([^`]+)`/g;
    let processedContent = content;

    const matches = [...content.matchAll(regex)];
    for (const match of matches) {
        const command = match[1];
        try {
            const result = execSync(command, { encoding: 'utf8', timeout: 5000 }).trim();
            processedContent = processedContent.replace(match[0], result);
        } catch (error) {
            processedContent = processedContent.replace(match[0], `[Erreur: ${error.message}]`);
        }
    }

    return processedContent;
}

async function executeSlashCommand(commandName) {
    const commandPath = `./commands/${commandName}.md`;
    if (!fs.existsSync(commandPath)) {
        console.log(`❌ Commande /${commandName} introuvable`);
        return;
    }

    const command = parseCommand(commandPath);
    console.log(`📝 ${command.description}\n`);

    const promptWithContext = await injectContext(command.content);

    // Définir l'outil Bash
    const tools = [{
        name: 'bash',
        description: 'Exécute une commande bash',
        input_schema: {
            type: 'object',
            properties: {
                command: { type: 'string' }
            },
            required: ['command']
        }
    }];

    const messages = [{ role: 'user', content: promptWithContext }];

    let continueLoop = true;
    while (continueLoop) {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 2048,
            tools: tools,
            messages: messages
        });

        if (response.stop_reason === 'tool_use') {
            messages.push({ role: 'assistant', content: response.content });

            const toolResults = [];
            for (const block of response.content) {
                if (block.type === 'tool_use') {
                    console.log(`🛠️ Exécution: ${block.input.command}`);
                    try {
                        const result = execSync(block.input.command, {
                            encoding: 'utf8',
                            timeout: 10000
                        });
                        console.log(result);
                        toolResults.push({
                            type: 'tool_result',
                            tool_use_id: block.id,
                            content: result
                        });
                    } catch (error) {
                        toolResults.push({
                            type: 'tool_result',
                            tool_use_id: block.id,
                            content: `Erreur: ${error.message}`
                        });
                    }
                }
            }

            messages.push({ role: 'user', content: toolResults });
        } else {
            const textBlock = response.content.find(c => c.type === 'text');
            if (textBlock) {
                console.log(`\n✅ ${textBlock.text}`);
            }
            continueLoop = false;
        }
    }
}

// Test
executeSlashCommand('commit');
```

</details>

### 📊 POINTS CLÉS

- ✅ `gray-matter` parse le YAML frontmatter
- ✅ `!`command`` injecte du contexte dynamique
- ✅ `allowed-tools` limite ce que Claude peut faire
- ✅ Les commands sont déclaratifs (Markdown) pas impératifs (code)

---

## 🪝 CHAPITRE 5 APERÇU : Hooks & Multi-Agents (15 min)

### 💡 CONCEPT PRINCIPAL - HOOKS

**En une phrase :** Les hooks interceptent les appels d'outils AVANT ou APRÈS leur exécution pour ajouter de la logique.

**🎨 Analogie :**
> Un hook = un garde de sécurité à l'entrée d'un bâtiment
>
> Avant qu'un outil s'exécute (PreToolUse) :
> - Le hook peut vérifier si c'est autorisé
> - Afficher des warnings
> - Bloquer l'exécution si dangereux
>
> Après qu'un outil s'exécute (PostToolUse) :
> - Logger ce qui s'est passé
> - Modifier le résultat
> - Déclencher d'autres actions

### 🔍 EXEMPLE : Hook de Sécurité

**Fichier : `hooks/hooks.json`**

```json
{
  "description": "Security reminder hook",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ./hooks/security_check.py"
          }
        ]
      }
    ]
  }
}
```

**Fichier : `hooks/security_check.py`**

```python
#!/usr/bin/env python3
import sys
import json

# Lire l'input du hook (stdin)
hook_input = json.loads(sys.stdin.read())

tool_name = hook_input['tool_name']
tool_input = hook_input['tool_input']

# Vérifier le contenu du fichier
if tool_name in ['Edit', 'Write']:
    content = tool_input.get('content', '') or tool_input.get('new_string', '')

    # Patterns dangereux
    dangerous_patterns = [
        'eval(',
        'exec(',
        'dangerouslySetInnerHTML',
        'innerHTML =',
        'child_process.exec('
    ]

    for pattern in dangerous_patterns:
        if pattern in content:
            # Écrire le warning sur stderr
            warning = f"""
⚠️  AVERTISSEMENT DE SÉCURITÉ ⚠️

Pattern dangereux détecté: {pattern}

Fichier: {tool_input.get('file_path', 'unknown')}

Ce pattern peut introduire des vulnérabilités.
Assurez-vous de bien valider les entrées utilisateur.
"""
            sys.stderr.write(warning)

            # Exit code 1 = Warning mais continuer
            # Exit code 2 = Bloquer l'exécution
            sys.exit(1)

# Exit code 0 = OK, continuer
sys.exit(0)
```

**Comment ça fonctionne :**

```
1. Claude veut écrire du code avec eval()
2. PreToolUse hook s'active
3. security_check.py détecte eval()
4. Affiche le warning à Claude
5. Claude voit le warning et change d'approche
```

### 💡 CONCEPT PRINCIPAL - AGENTS

**En une phrase :** Les agents sont des instances Claude spécialisées avec des rôles spécifiques qui travaillent en parallèle.

**🎨 Analogie :**
> Multi-agents = une équipe de spécialistes
>
> Au lieu d'un généraliste qui fait tout, tu lances :
> - **Agent Explorer** : Trouve les fichiers pertinents
> - **Agent Architect** : Conçoit l'architecture
> - **Agent Reviewer** : Vérifie le code
>
> Chacun travaille en parallèle, puis tu agrèges les résultats.

### 🔍 EXEMPLE : Définir un Agent

**Fichier : `agents/code-reviewer.md`**

```markdown
---
name: code-reviewer
description: Reviews code for bugs and best practices
model: sonnet
---

You are a specialized code reviewer.

## Your Focus
1. **Bugs**: Obvious logic errors, off-by-one, null checks
2. **Best Practices**: DRY, SOLID, naming conventions
3. **Security**: Input validation, XSS, injection

## Rules
- Only report OBVIOUS issues (confidence ≥80%)
- Provide code snippets for context
- Suggest concrete fixes

## Output Format
### Issue 1: [Title]
**Severity**: High/Medium/Low
**Confidence**: 85%
**Location**: file.ts:42
**Description**: [What's wrong]
**Fix**: [How to fix it]
```

### 🔍 EXEMPLE : Orchestrer 3 Agents en Parallèle

```javascript
async function multiAgentCodeReview(files) {
    console.log('🚀 Lancement de 3 agents de review...\n');

    // Définir 3 agents avec des focuses différents
    const agents = [
        {
            name: 'bug-hunter',
            focus: 'Find obvious bugs and logic errors',
            files: files
        },
        {
            name: 'security-analyst',
            focus: 'Find security vulnerabilities',
            files: files
        },
        {
            name: 'style-checker',
            focus: 'Check code style and best practices',
            files: files
        }
    ];

    // Lancer les 3 agents en parallèle
    const agentPromises = agents.map(agent => runAgent(agent));
    const results = await Promise.all(agentPromises);

    // Agréger les résultats
    console.log('\n📊 RÉSULTATS DE LA REVIEW\n');
    results.forEach((result, i) => {
        console.log(`\n--- ${agents[i].name.toUpperCase()} ---`);
        console.log(result);
    });

    return results;
}

async function runAgent(agentConfig) {
    // Charger l'agent definition
    const agentDef = parseCommand(`./agents/${agentConfig.name}.md`);

    // Lire les fichiers à analyser
    const filesContent = agentConfig.files.map(f => {
        return `File: ${f}\n${fs.readFileSync(f, 'utf8')}`;
    }).join('\n\n---\n\n');

    // Construire le prompt
    const prompt = `${agentDef.content}\n\n## Files to Review\n${filesContent}\n\n## Focus\n${agentConfig.focus}`;

    // Appeler Claude
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
    });

    return response.content[0].text;
}

// Test
multiAgentCodeReview(['./src/auth.js', './src/utils.js']);
```

**Sortie attendue :**
```
🚀 Lancement de 3 agents de review...

📊 RÉSULTATS DE LA REVIEW

--- BUG-HUNTER ---
### Issue 1: Off-by-one error in loop
**Severity**: Medium
**Confidence**: 90%
**Location**: src/utils.js:23
**Description**: Loop goes to i <= arr.length instead of i < arr.length
**Fix**: Change to i < arr.length

--- SECURITY-ANALYST ---
### Issue 1: Unvalidated user input
**Severity**: High
**Confidence**: 95%
**Location**: src/auth.js:15
**Description**: User input directly used in SQL query
**Fix**: Use parameterized queries

--- STYLE-CHECKER ---
### Issue 1: Inconsistent naming
**Severity**: Low
**Confidence**: 85%
**Location**: src/auth.js:8
**Description**: Function named getUserData but variable is user_data
**Fix**: Use consistent camelCase
```

### 🎮 PRATIQUE : Hook + Multi-Agents

**🎯 Défi :** Crée un système qui :
1. Hook qui bloque les fichiers de plus de 10KB
2. Si OK, lance 2 agents pour analyser le code
3. Agrège les résultats

<details>
<summary>✅ Solution Complète</summary>

**Fichier : `hooks/size_check.py`**

```python
#!/usr/bin/env python3
import sys
import json

hook_input = json.loads(sys.stdin.read())
tool_input = hook_input['tool_input']

if 'content' in tool_input:
    content = tool_input['content']
    size_kb = len(content) / 1024

    if size_kb > 10:
        sys.stderr.write(f"""
⚠️  FICHIER TROP GROS ⚠️

Taille: {size_kb:.2f} KB (limite: 10 KB)
Fichier: {tool_input.get('file_path', 'unknown')}

Raison: Les gros fichiers doivent être découpés en modules.
        """)
        sys.exit(2)  # Bloquer

sys.exit(0)
```

**Code complet :**

```javascript
async function reviewWithHooks(filePath) {
    console.log(`📝 Analyse de ${filePath}\n`);

    // 1. Lire le fichier
    const content = fs.readFileSync(filePath, 'utf8');

    // 2. Simuler le hook de taille
    const sizeKB = Buffer.byteLength(content, 'utf8') / 1024;
    if (sizeKB > 10) {
        console.log(`❌ BLOQUÉ: Fichier trop gros (${sizeKB.toFixed(2)} KB > 10 KB)`);
        return;
    }

    console.log(`✅ Hook size: OK (${sizeKB.toFixed(2)} KB)\n`);

    // 3. Lancer 2 agents en parallèle
    console.log('🚀 Lancement de 2 agents...\n');

    const [bugResults, securityResults] = await Promise.all([
        runAgent({
            name: 'bug-hunter',
            focus: 'Find bugs',
            files: [filePath]
        }),
        runAgent({
            name: 'security-analyst',
            focus: 'Find security issues',
            files: [filePath]
        })
    ]);

    // 4. Agréger
    console.log('\n📊 RÉSULTATS\n');
    console.log('--- BUGS ---');
    console.log(bugResults);
    console.log('\n--- SECURITY ---');
    console.log(securityResults);
}

// Test
reviewWithHooks('./src/auth.js');
```

</details>

### 📊 POINTS CLÉS

- ✅ Hooks interceptent Pre/Post tool execution
- ✅ Exit code 0 = OK, 1 = Warning, 2 = Block
- ✅ Agents sont des Claudes spécialisés
- ✅ `Promise.all()` lance les agents en parallèle
- ✅ Agrégation permet de combiner les résultats

---

## 🏗️ CHAPITRE 6 APERÇU : Projet Final (5 min)

### 🎯 VISION DU PROJET FINAL

**Ce que tu vas construire :**

```
YOUR-CLAUDE-CLI/
├── bin/
│   └── cli.js                    # Point d'entrée
├── src/
│   ├── tools/
│   │   ├── read.js
│   │   ├── write.js
│   │   ├── edit.js
│   │   ├── grep.js
│   │   └── bash.js
│   ├── api/
│   │   └── claude.js             # Intégration API
│   ├── plugins/
│   │   ├── loader.js             # Chargement plugins
│   │   └── parser.js             # Parsing .md
│   ├── hooks/
│   │   └── executor.js           # Exécution hooks
│   └── agents/
│       └── orchestrator.js       # Multi-agents
├── plugins/
│   ├── commit-commands/
│   ├── code-review/
│   └── security/
├── .config/
│   └── settings.json
└── package.json
```

**Fonctionnalités :**
- ✅ CLI avec commandes (`init`, `run`, `plugin`)
- ✅ 5 outils (Read, Write, Edit, Grep, Bash)
- ✅ Conversation avec Claude + tools
- ✅ Système de plugins
- ✅ Slash commands (`/commit`, `/review`)
- ✅ Hooks de sécurité
- ✅ Multi-agent orchestration

**Usage final :**

```bash
$ your-cli init
✓ Configuration créée dans .config/

$ your-cli /commit
🤖 Analyse des changements...
✅ Commit créé: feat: Add authentication

$ your-cli /review src/auth.js
🚀 Lancement de 3 agents...
📊 2 issues trouvées

$ your-cli plugin install my-plugin
✅ Plugin installé
```

---

## 🎯 QUIZ INTERLEAVING (Test de Rétention)

**🧠 Science :** Questions mélangées pour renforcer la mémoire

### Question 1 : Architecture

Quel est le bon ordre d'exécution ?

A) User → API Claude → Tools → Response
B) User → Tools → API Claude → Response
C) User → API Claude → Response → Tools
D) User → Slash Command → Parse → Inject Context → API Claude → Tools → Response

<details>
<summary>✅ Réponse</summary>

**D) User → Slash Command → Parse → Inject Context → API Claude → Tools → Response**

**Explication :**
1. L'utilisateur tape `/commit`
2. Le système charge `commit.md`
3. Parse le frontmatter YAML
4. Injecte le contexte (!`git status`)
5. Envoie le prompt à Claude
6. Claude utilise les tools
7. Retourne la réponse

</details>

### Question 2 : Code

Que fait ce code ?

```javascript
const { data, content } = matter(fileContent);
```

A) Lit un fichier
B) Parse YAML frontmatter et Markdown
C) Appelle l'API Claude
D) Exécute un hook

<details>
<summary>✅ Réponse</summary>

**B) Parse YAML frontmatter et Markdown**

`gray-matter` sépare le frontmatter YAML (metadata) du contenu Markdown.

</details>

### Question 3 : Hooks

Un hook avec `exit code 2` :

A) Continue normalement
B) Affiche un warning et continue
C) Bloque l'exécution de l'outil
D) Relance l'outil

<details>
<summary>✅ Réponse</summary>

**C) Bloque l'exécution de l'outil**

- Exit 0 = OK
- Exit 1 = Warning mais continue
- Exit 2 = Bloque

</details>

### Question 4 : API Claude

Quelle est la différence entre `stop_reason: 'tool_use'` et `stop_reason: 'end_turn'` ?

<details>
<summary>✅ Réponse</summary>

**`tool_use`** : Claude veut utiliser un outil. Vous devez :
1. Exécuter l'outil
2. Renvoyer le résultat à Claude
3. Continuer la boucle

**`end_turn`** : Claude a terminé sa réponse. La conversation peut s'arrêter.

</details>

### Question 5 : Multi-Agents

Pourquoi utiliser `Promise.all()` pour les agents ?

A) Pour économiser des tokens
B) Pour les lancer en parallèle
C) Pour éviter les erreurs
D) Pour les lancer séquentiellement

<details>
<summary>✅ Réponse</summary>

**B) Pour les lancer en parallèle**

`Promise.all([agent1(), agent2(), agent3()])` lance les 3 en même temps au lieu de séquentiellement, ce qui est beaucoup plus rapide.

</details>

---

## 📅 RÉVISION ESPACÉE - CALENDRIER

**🧠 Science :** La répétition espacée multiplie par 5 la rétention

### J+1 (Demain) : 30 minutes
- [ ] Refais le CLI todo (sans regarder la solution)
- [ ] Refais l'outil Read (sans regarder)
- [ ] Refais le parsing de slash command

### J+3 (Dans 3 jours) : 20 minutes
- [ ] Quiz de 10 questions sur tous les chapitres
- [ ] Explique à voix haute comment fonctionne l'architecture

### J+7 (Dans 1 semaine) : 45 minutes
- [ ] Crée une variante du CLI todo (ex: notes app)
- [ ] Crée un nouveau slash command `/test`
- [ ] Crée un hook qui log toutes les opérations

### J+14 (Dans 2 semaines) : 60 minutes
- [ ] Quiz mélangé de 20 questions
- [ ] Mini-projet : CLI météo avec API externe
- [ ] Explique l'architecture à quelqu'un d'autre

### J+30 (Dans 1 mois) : 90 minutes
- [ ] Challenge créatif libre
- [ ] Commence le Niveau 2 Chapitre 1

**📌 Note :** Ces révisions sont CRITIQUES. Ne les zappe pas ! C'est là que ton cerveau ancre les connaissances dans la mémoire long-terme.

---

## 🚀 PROCHAINES ÉTAPES

### 🎯 Tu as 3 options :

#### Option 1 : Approfondir un Chapitre (Niveau 1)
➡️ [Chapitre 01 - Aperçu Détaillé](./01-Chapitre-01-Apercu-Interactif.md)

**Bon si :**
- Tu veux plus de pratique sur un chapitre spécifique
- Tu as des doutes sur un concept
- Tu préfères avancer progressivement

#### Option 2 : Passer au Niveau 2
➡️ [Niveau 2 - Chapitre 01](../NIVEAU-2-MAITRISE-PRATIQUE/Chapitre-01-Fondamentaux-CLI-Architecture/Phase-1-Introduction.md)

**Bon si :**
- Tu as bien compris le survol
- Tu as réussi le quiz (>80%)
- Tu es prêt à coder sérieusement

#### Option 3 : Réviser et Consolider
➡️ [Quiz Révision Niveau 1](./Quiz-Revision-Niveau-1.md)

**Bon si :**
- Tu as terminé tous les aperçus
- Tu veux tester ta compréhension
- Tu veux identifier tes zones faibles

---

## 📊 AUTO-ÉVALUATION

**Réponds honnêtement :**

- [ ] Je comprends l'architecture globale de Claude Code CLI
- [ ] Je sais créer un CLI basique avec Node.js
- [ ] Je comprends comment fonctionnent les outils (Read, Write, Grep...)
- [ ] Je peux appeler l'API Claude avec tools
- [ ] Je comprends le principe des plugins et slash commands
- [ ] Je comprends comment fonctionnent les hooks et multi-agents

**Score :**
- **6/6** : 🎉 Excellent ! Passe au Niveau 2
- **4-5/6** : 👍 Bien ! Relis les sections difficiles puis passe au Niveau 2
- **2-3/6** : 🤔 Revois les aperçus des chapitres faibles
- **0-1/6** : 📚 Reprends ce survol lentement et pratique chaque exemple

---

## 🎓 FÉLICITATIONS !

**🌟 Ce que tu as accompli en 60 minutes :**

- ✅ **Compris** l'architecture complète de Claude Code CLI
- ✅ **Créé** un CLI de gestion de tâches fonctionnel
- ✅ **Implémenté** des outils (Read, Write, Grep)
- ✅ **Appelé** l'API Claude avec conversation multi-turn
- ✅ **Parsé** des fichiers Markdown avec frontmatter
- ✅ **Créé** un slash command `/commit`
- ✅ **Compris** les hooks et multi-agents

**🚀 Tu es maintenant prêt à construire ton propre Claude Code CLI !**

---

## 💡 CONSEILS AVANT DE CONTINUER

### Rythme d'Apprentissage

**Option Intensive (4 semaines) :**
- 10-12h par semaine
- 2h par jour
- Niveau 2 en parallèle des révisions

**Option Normale (8 semaines) :**
- 5-7h par semaine
- 1h par jour
- Révisions bien espacées

**Option Détendue (12 semaines) :**
- 3-4h par semaine
- 30-45 min par jour
- Beaucoup de projets créatifs

### Méthode d'Étude Recommandée

1. **Lis activement** : Code en même temps que tu lis
2. **Pratique immédiatement** : Ne passe pas à la suite sans avoir codé
3. **Explique à voix haute** : Force la compréhension
4. **Crée des variantes** : Ne te limite pas aux exemples donnés
5. **Révise régulièrement** : Respecte le calendrier de révision

### Quand tu bloques

1. **Relis la section** tranquillement
2. **Regarde la solution** et comprends-la ligne par ligne
3. **Refais l'exercice** de mémoire sans regarder
4. **Crée une variante** pour vérifier ta compréhension
5. **Passe à la suite** et reviens plus tard si besoin

---

**Navigation :**
- ➡️ [Chapitre 01 - Aperçu Détaillé](./01-Chapitre-01-Apercu-Interactif.md)
- ➡️ [Quiz Révision Niveau 1](./Quiz-Revision-Niveau-1.md)
- ➡️ [Niveau 2 - Chapitre 01](../NIVEAU-2-MAITRISE-PRATIQUE/Chapitre-01-Fondamentaux-CLI-Architecture/Phase-1-Introduction.md)
- 🏠 [Retour ROADMAP](../ROADMAP-FORMATION-COMPLETE.md)

---

*Cette formation combine 100 ans de recherche en sciences cognitives pour maximiser ton apprentissage. Chaque élément a une raison scientifique d'exister.*

**Version :** 1.0.0
**Temps de lecture estimé :** 60 minutes
**Temps de pratique estimé :** 90-120 minutes
**Score de rétention attendu :** 85% après révisions espacées
