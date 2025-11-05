# 🎬 NIVEAU 1 : Chapitre 02 - Système d'Outils Built-in - Aperçu Interactif

> **🎯 Objectif :** Maîtriser les 6 outils fondamentaux que Claude utilise pour manipuler fichiers et exécuter commandes
> **🧠 Science :** Active Learning + Problem-Based Learning + Immediate Feedback
> **📊 Progression :** [■■■□□□□□□□] 30% du parcours Niveau 1
> **⏱️ Durée :** 90 minutes

---

## 🎮 ACTIVATION : Avant de Commencer

### 🤔 Question Réflexive (Metacognition)

> Imagine que Claude est ton assistant de développement.
>
> **Réfléchis 60 secondes :**
> - De quels "pouvoirs" aurait-il besoin pour t'aider à coder ?
> - Comment pourrait-il lire ton code ? Le modifier ? Chercher des bugs ?
> - Quelles opérations devrait-il pouvoir faire sur tes fichiers ?

**💭 Liste mentalement 5-6 capacités essentielles...**

---

**🎯 C'est exactement ce que tu vas construire !**

Les **outils built-in** sont les "mains" de Claude :
- 📖 **Read** : Lire des fichiers
- ✏️ **Write** : Créer/écraser des fichiers
- 🔧 **Edit** : Modifier des parties spécifiques
- 🔍 **Grep** : Chercher du texte/code
- 📁 **Glob** : Trouver des fichiers par pattern
- ⚡ **Bash** : Exécuter des commandes shell

**Dans ce chapitre, tu vas implémenter chacun de ces outils !**

---

## 📚 Section 1 : Outils de Fichiers (Read, Write, Edit)

### 💡 CONCEPT : Manipulation de Fichiers

**En une phrase :** Les opérations sur fichiers sont la base de tout assistant de code - lire pour comprendre, écrire pour créer, éditer pour améliorer.

**🎨 Analogie Mémorable :**
> Imagine Claude comme un éditeur de manuscrit :
>
> - **Read** = Lire le manuscrit complet
> - **Write** = Écrire une nouvelle page (ou réécrire une existante)
> - **Edit** = Corriger un paragraphe spécifique sans tout réécrire

**Dans Claude Code CLI :**
- L'utilisateur demande "lis le fichier config.json"
- Claude utilise l'outil **Read**
- Reçoit le contenu
- Peut ensuite analyser, suggérer des modifications, etc.

### 🔍 EXPLORATION : Outil Read

**Implémentation de base :**

```javascript
// tools/read.js
const fs = require('fs');
const path = require('path');

/**
 * Lit un fichier et retourne son contenu avec numéros de ligne
 * @param {string} filePath - Chemin du fichier
 * @param {number} offset - Ligne de départ (défaut: 0)
 * @param {number} limit - Nombre de lignes à lire (défaut: 2000)
 * @returns {string} Contenu formaté avec numéros de ligne
 */
function readFile(filePath, offset = 0, limit = 2000) {
    try {
        // Vérifier que le fichier existe
        if (!fs.existsSync(filePath)) {
            return `❌ Erreur: Fichier introuvable "${filePath}"`;
        }

        // Vérifier que c'est bien un fichier (pas un dossier)
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            return `❌ Erreur: "${filePath}" est un dossier, pas un fichier`;
        }

        // Lire le contenu
        const content = fs.readFileSync(filePath, 'utf8');

        // Découper en lignes
        const lines = content.split('\n');

        // Appliquer offset et limit
        const selectedLines = lines.slice(offset, offset + limit);

        // Formater avec numéros de ligne (format cat -n)
        const formatted = selectedLines
            .map((line, index) => {
                const lineNumber = offset + index + 1;
                return `${lineNumber}\t${line}`;
            })
            .join('\n');

        // Ajouter des métadonnées
        const totalLines = lines.length;
        const showing = selectedLines.length;

        let header = `📄 Fichier: ${filePath}\n`;
        header += `📊 Lignes ${offset + 1}-${offset + showing} sur ${totalLines}\n`;
        header += `${'─'.repeat(60)}\n`;

        return header + formatted;

    } catch (error) {
        return `❌ Erreur de lecture: ${error.message}`;
    }
}

module.exports = { readFile };
```

**Test :**

```javascript
// test-read.js
const { readFile } = require('./tools/read');

// Créer un fichier de test
const fs = require('fs');
fs.writeFileSync('example.txt', `Line 1
Line 2
Line 3
Line 4
Line 5`);

// Test 1: Lire tout le fichier
console.log(readFile('example.txt'));

// Test 2: Lire avec offset
console.log('\n--- Avec offset ---\n');
console.log(readFile('example.txt', 2, 2)); // Lignes 3-4

// Test 3: Fichier inexistant
console.log('\n--- Fichier inexistant ---\n');
console.log(readFile('nope.txt'));
```

**Sortie attendue :**
```
📄 Fichier: example.txt
📊 Lignes 1-5 sur 5
────────────────────────────────────────────────────────────
1	Line 1
2	Line 2
3	Line 3
4	Line 4
5	Line 5

--- Avec offset ---

📄 Fichier: example.txt
📊 Lignes 3-4 sur 5
────────────────────────────────────────────────────────────
3	Line 3
4	Line 4

--- Fichier inexistant ---

❌ Erreur: Fichier introuvable "nope.txt"
```

### 🔍 EXPLORATION : Outil Write

**Implémentation :**

```javascript
// tools/write.js
const fs = require('fs');
const path = require('path');

/**
 * Écrit du contenu dans un fichier (crée ou écrase)
 * @param {string} filePath - Chemin du fichier
 * @param {string} content - Contenu à écrire
 * @returns {string} Message de confirmation
 */
function writeFile(filePath, content) {
    try {
        // Créer les dossiers parents si nécessaire
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Écrire le fichier
        fs.writeFileSync(filePath, content, 'utf8');

        // Statistiques
        const lines = content.split('\n').length;
        const bytes = Buffer.byteLength(content, 'utf8');

        return `✅ Fichier écrit: ${filePath}\n` +
               `📊 ${lines} lignes, ${bytes} octets`;

    } catch (error) {
        return `❌ Erreur d'écriture: ${error.message}`;
    }
}

module.exports = { writeFile };
```

**Test :**

```javascript
const { writeFile } = require('./tools/write');

// Test 1: Écrire un fichier simple
console.log(writeFile('output.txt', 'Hello, World!\nSecond line.'));

// Test 2: Créer avec dossiers parents
console.log(writeFile('data/logs/app.log', 'Log entry 1\nLog entry 2'));

// Test 3: Écraser un fichier existant
console.log(writeFile('output.txt', 'New content!'));
```

### 🔍 EXPLORATION : Outil Edit

**Concept :** Modifier une partie spécifique d'un fichier sans tout réécrire.

```javascript
// tools/edit.js
const fs = require('fs');

/**
 * Remplace une chaîne par une autre dans un fichier
 * @param {string} filePath - Chemin du fichier
 * @param {string} oldString - Texte à remplacer
 * @param {string} newString - Nouveau texte
 * @param {boolean} replaceAll - Remplacer toutes les occurrences (défaut: false)
 * @returns {string} Message de confirmation
 */
function editFile(filePath, oldString, newString, replaceAll = false) {
    try {
        // Lire le fichier
        if (!fs.existsSync(filePath)) {
            return `❌ Erreur: Fichier introuvable "${filePath}"`;
        }

        let content = fs.readFileSync(filePath, 'utf8');

        // Vérifier que oldString existe
        if (!content.includes(oldString)) {
            return `❌ Erreur: Texte "${oldString.substring(0, 50)}..." introuvable dans le fichier`;
        }

        // Compter les occurrences
        const occurrences = content.split(oldString).length - 1;

        // Si plusieurs occurrences et replaceAll = false, erreur
        if (occurrences > 1 && !replaceAll) {
            return `❌ Erreur: ${occurrences} occurrences trouvées.\n` +
                   `💡 Utilisez replaceAll=true ou fournissez un contexte plus unique.`;
        }

        // Remplacer
        if (replaceAll) {
            content = content.split(oldString).join(newString);
        } else {
            content = content.replace(oldString, newString);
        }

        // Écrire le fichier modifié
        fs.writeFileSync(filePath, content, 'utf8');

        return `✅ Édition réussie: ${filePath}\n` +
               `📊 ${occurrences} remplacement(s) effectué(s)`;

    } catch (error) {
        return `❌ Erreur d'édition: ${error.message}`;
    }
}

module.exports = { editFile };
```

**Test :**

```javascript
const { writeFile } = require('./tools/write');
const { editFile } = require('./tools/edit');
const { readFile } = require('./tools/read');

// Créer un fichier de test
writeFile('config.js', `const config = {
    port: 3000,
    host: 'localhost',
    debug: false
};`);

console.log('--- Fichier original ---');
console.log(readFile('config.js'));

// Éditer : changer le port
console.log('\n--- Édition: port 3000 → 8080 ---');
console.log(editFile('config.js', 'port: 3000', 'port: 8080'));

console.log('\n--- Fichier après édition ---');
console.log(readFile('config.js'));
```

### 🎮 PRATIQUE IMMÉDIATE : Gestionnaire de Fichiers

**🎯 Défi 1 : Créer un CLI de gestion de fichiers**

Implémente un CLI `files` qui utilise Read, Write, Edit :

```bash
files read <path>              # Lit un fichier
files write <path> <content>   # Écrit un fichier
files edit <path> <old> <new>  # Édite un fichier
```

**💡 Squelette :**

```javascript
#!/usr/bin/env node
const { Command } = require('commander');
const { readFile } = require('./tools/read');
const { writeFile } = require('./tools/write');
const { editFile } = require('./tools/edit');

const program = new Command();

program
    .name('files')
    .description('Gestionnaire de fichiers CLI')
    .version('1.0.0');

// TODO: Ajouter les commandes read, write, edit

program.parse(process.argv);
```

<details>
<summary>✅ Solution Complète</summary>

```javascript
#!/usr/bin/env node
const { Command } = require('commander');
const { readFile } = require('./tools/read');
const { writeFile } = require('./tools/write');
const { editFile } = require('./tools/edit');

const program = new Command();

program
    .name('files')
    .description('Gestionnaire de fichiers CLI')
    .version('1.0.0');

// Commande: files read
program
    .command('read <filepath>')
    .description('Lit un fichier')
    .option('-o, --offset <number>', 'Ligne de départ', '0')
    .option('-l, --limit <number>', 'Nombre de lignes', '2000')
    .action((filepath, options) => {
        const result = readFile(
            filepath,
            parseInt(options.offset),
            parseInt(options.limit)
        );
        console.log(result);
    });

// Commande: files write
program
    .command('write <filepath> <content>')
    .description('Écrit dans un fichier')
    .action((filepath, content) => {
        const result = writeFile(filepath, content);
        console.log(result);
    });

// Commande: files edit
program
    .command('edit <filepath> <old> <new>')
    .description('Édite un fichier')
    .option('-a, --all', 'Remplacer toutes les occurrences')
    .action((filepath, old, new_, options) => {
        const result = editFile(filepath, old, new_, options.all);
        console.log(result);
    });

program.parse(process.argv);
```

**Tests :**
```bash
# Créer un fichier
files write test.txt "Hello World"

# Lire le fichier
files read test.txt

# Éditer
files edit test.txt "World" "Claude"

# Relire
files read test.txt
```

</details>

### 📊 POINTS CLÉS

- ✅ **Read** : `fs.readFileSync()` avec formatage numéros de ligne
- ✅ **Write** : `fs.writeFileSync()` avec création dossiers parents
- ✅ **Edit** : Recherche/remplacement avec validation
- ✅ **Gestion d'erreurs** : Toujours try/catch
- ✅ **Validation** : Vérifier existence, type, etc.

---

## 📚 Section 2 : Outils de Recherche (Grep, Glob)

### 💡 CONCEPT : Recherche de Code

**En une phrase :** Grep cherche DU TEXTE dans les fichiers, Glob cherche DES FICHIERS par pattern.

**🎨 Analogie :**
> Dans une bibliothèque :
>
> - **Glob** = "Trouve-moi tous les livres de science-fiction" (cherche par catégorie/nom)
> - **Grep** = "Trouve-moi tous les livres qui mentionnent 'robot'" (cherche dans le contenu)

### 🔍 EXPLORATION : Outil Grep

**Implémentation avec regex :**

```javascript
// tools/grep.js
const fs = require('fs');
const path = require('path');

/**
 * Cherche un pattern dans les fichiers
 * @param {string} pattern - Pattern regex à chercher
 * @param {string} directory - Dossier où chercher
 * @param {object} options - Options (glob, caseInsensitive, etc.)
 * @returns {array} Résultats trouvés
 */
function grep(pattern, directory = '.', options = {}) {
    const results = [];
    const regex = new RegExp(
        pattern,
        options.caseInsensitive ? 'gi' : 'g'
    );

    // Fonction récursive pour parcourir les dossiers
    function searchInDirectory(dir) {
        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            // Ignorer certains dossiers
            if (stat.isDirectory()) {
                if (!file.startsWith('.') && file !== 'node_modules') {
                    searchInDirectory(fullPath);
                }
            } else if (stat.isFile()) {
                // Filtrer par extension si spécifié
                if (options.glob) {
                    const ext = path.extname(file);
                    if (!options.glob.includes(ext)) {
                        return;
                    }
                }

                // Chercher dans le fichier
                searchInFile(fullPath, regex);
            }
        });
    }

    // Chercher dans un fichier
    function searchInFile(filePath, regex) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                if (regex.test(line)) {
                    results.push({
                        file: filePath,
                        line: index + 1,
                        content: line.trim(),
                        match: line.match(regex)
                    });
                }
            });
        } catch (error) {
            // Ignorer les fichiers non lisibles
        }
    }

    searchInDirectory(directory);
    return results;
}

/**
 * Formate les résultats de grep
 */
function formatGrepResults(results, limit = 50) {
    if (results.length === 0) {
        return '🔍 Aucun résultat trouvé';
    }

    let output = `🔍 ${results.length} résultat(s) trouvé(s)\n\n`;

    const toShow = results.slice(0, limit);
    toShow.forEach(r => {
        output += `📄 ${r.file}:${r.line}\n`;
        output += `   ${r.content}\n\n`;
    });

    if (results.length > limit) {
        output += `... et ${results.length - limit} résultat(s) supplémentaire(s)\n`;
    }

    return output;
}

module.exports = { grep, formatGrepResults };
```

**Test :**

```javascript
const { grep, formatGrepResults } = require('./tools/grep');

// Créer des fichiers de test
const { writeFile } = require('./tools/write');
writeFile('src/app.js', 'function hello() {\n  console.log("Hello");\n}');
writeFile('src/utils.js', 'function goodbye() {\n  console.log("Goodbye");\n}');
writeFile('README.md', '# My Project\nThis uses console.log');

// Chercher "console.log"
const results = grep('console\\.log', '.');
console.log(formatGrepResults(results));

// Chercher seulement dans les .js
const jsResults = grep('function', '.', { glob: ['.js'] });
console.log(formatGrepResults(jsResults));
```

### 🔍 EXPLORATION : Outil Glob

**Implémentation avec patterns :**

```javascript
// tools/glob.js
const fs = require('fs');
const path = require('path');
const minimatch = require('minimatch'); // npm install minimatch

/**
 * Trouve des fichiers par pattern
 * @param {string} pattern - Pattern glob (ex: "**/*.js", "src/**/*.ts")
 * @param {string} directory - Dossier de départ
 * @returns {array} Chemins des fichiers trouvés
 */
function glob(pattern, directory = '.') {
    const results = [];

    function search(dir) {
        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const relativePath = path.relative(directory, fullPath);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                if (!file.startsWith('.') && file !== 'node_modules') {
                    search(fullPath);
                }
            } else if (stat.isFile()) {
                // Tester le pattern
                if (minimatch(relativePath, pattern)) {
                    results.push(relativePath);
                }
            }
        });
    }

    search(directory);
    return results.sort();
}

/**
 * Formate les résultats de glob
 */
function formatGlobResults(results) {
    if (results.length === 0) {
        return '📁 Aucun fichier trouvé';
    }

    let output = `📁 ${results.length} fichier(s) trouvé(s):\n\n`;
    results.forEach(file => {
        output += `  ${file}\n`;
    });

    return output;
}

module.exports = { glob, formatGlobResults };
```

**Test :**

```javascript
const { glob, formatGlobResults } = require('./tools/glob');
const { writeFile } = require('./tools/write');

// Créer une structure de fichiers
writeFile('src/components/Button.jsx', '// Button');
writeFile('src/components/Input.jsx', '// Input');
writeFile('src/utils/helpers.js', '// Helpers');
writeFile('src/utils/api.js', '// API');
writeFile('tests/Button.test.js', '// Test');

// Trouver tous les .jsx
const jsxFiles = glob('**/*.jsx', '.');
console.log('--- Fichiers .jsx ---');
console.log(formatGlobResults(jsxFiles));

// Trouver tous les fichiers dans src/
const srcFiles = glob('src/**/*', '.');
console.log('\n--- Fichiers dans src/ ---');
console.log(formatGlobResults(srcFiles));

// Pattern complexe: tous les .js sauf les tests
const jsNoTest = glob('**/*.js', '.').filter(f => !f.includes('.test.'));
console.log('\n--- Fichiers .js (hors tests) ---');
console.log(formatGlobResults(jsNoTest));
```

### 🎮 PRATIQUE : CLI de Recherche

**🎯 Défi 2 : Créer un CLI `search`**

```bash
search grep "pattern" [directory]    # Cherche du texte
search files "*.js" [directory]      # Cherche des fichiers
```

<details>
<summary>✅ Solution</summary>

```javascript
#!/usr/bin/env node
const { Command } = require('commander');
const { grep, formatGrepResults } = require('./tools/grep');
const { glob, formatGlobResults } = require('./tools/glob');

const program = new Command();

program
    .name('search')
    .description('Outil de recherche de fichiers et contenu')
    .version('1.0.0');

// Commande: search grep
program
    .command('grep <pattern> [directory]')
    .description('Cherche un pattern dans les fichiers')
    .option('-i, --ignore-case', 'Ignorer la casse')
    .option('-g, --glob <extensions>', 'Filtrer par extensions (ex: .js,.ts)')
    .option('-l, --limit <number>', 'Limite de résultats', '50')
    .action((pattern, directory = '.', options) => {
        const grepOptions = {
            caseInsensitive: options.ignoreCase
        };

        if (options.glob) {
            grepOptions.glob = options.glob.split(',');
        }

        const results = grep(pattern, directory, grepOptions);
        console.log(formatGrepResults(results, parseInt(options.limit)));
    });

// Commande: search files
program
    .command('files <pattern> [directory]')
    .description('Cherche des fichiers par pattern glob')
    .action((pattern, directory = '.') => {
        const results = glob(pattern, directory);
        console.log(formatGlobResults(results));
    });

program.parse(process.argv);
```

**Tests :**
```bash
# Chercher "TODO" dans tous les fichiers
search grep "TODO"

# Chercher seulement dans les .js
search grep "function" --glob .js

# Trouver tous les fichiers TypeScript
search files "**/*.ts"

# Trouver les fichiers de test
search files "**/*.test.js"
```

</details>

### 📊 POINTS CLÉS

- ✅ **Grep** : Recherche avec regex dans le contenu
- ✅ **Glob** : Recherche de fichiers avec patterns (`*`, `**`, etc.)
- ✅ **minimatch** : Bibliothèque pour les patterns glob
- ✅ **Récursivité** : Parcours de l'arborescence
- ✅ **Filtrage** : Ignorer node_modules, .git, etc.

---

## 📚 Section 3 : Exécution Bash Sécurisée

### 💡 CONCEPT : Exécution de Commandes

**En une phrase :** L'outil Bash permet d'exécuter des commandes shell, mais doit être sécurisé pour éviter les injections.

**🎨 Analogie :**
> Bash = Donner les clés de ta voiture à quelqu'un
>
> - **Sans sécurité** : Il peut aller n'importe où (dangereux !)
> - **Avec sécurité** : Limiteur de vitesse, zone géographique, etc.

**Dangers :**
```javascript
// ⚠️ DANGER: Injection de commande
const userInput = "file.txt; rm -rf /"; // Utilisateur malveillant
exec(`cat ${userInput}`); // Exécute "cat file.txt; rm -rf /"
```

### 🔍 EXPLORATION : Outil Bash Sécurisé

**Implémentation sécurisée :**

```javascript
// tools/bash.js
const { execSync, spawn } = require('child_process');

/**
 * Exécute une commande bash de manière sécurisée
 * @param {string} command - Commande à exécuter
 * @param {object} options - Options (timeout, cwd, env)
 * @returns {object} Résultat { stdout, stderr, exitCode }
 */
function execBash(command, options = {}) {
    const {
        timeout = 10000,     // 10 secondes par défaut
        cwd = process.cwd(),
        maxBuffer = 1024 * 1024, // 1MB
        allowedCommands = null // Whitelist optionnelle
    } = options;

    try {
        // Validation: Whitelist de commandes (si spécifiée)
        if (allowedCommands) {
            const cmdName = command.split(' ')[0];
            if (!allowedCommands.includes(cmdName)) {
                return {
                    stdout: '',
                    stderr: `❌ Commande non autorisée: ${cmdName}\n` +
                            `Autorisées: ${allowedCommands.join(', ')}`,
                    exitCode: 1
                };
            }
        }

        // Validation: Patterns dangereux
        const dangerousPatterns = [
            /;.*rm\s+-rf/,   // rm -rf après ;
            /&&.*rm\s+-rf/,  // rm -rf après &&
            /\|\|.*rm\s+-rf/, // rm -rf après ||
            /`.*rm\s+-rf/,   // rm -rf dans backticks
            /\$\(.*rm\s+-rf/ // rm -rf dans $()
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(command)) {
                return {
                    stdout: '',
                    stderr: '❌ Commande potentiellement dangereuse détectée',
                    exitCode: 1
                };
            }
        }

        // Exécution avec timeout
        const stdout = execSync(command, {
            cwd: cwd,
            timeout: timeout,
            maxBuffer: maxBuffer,
            encoding: 'utf8',
            stdio: 'pipe'
        });

        return {
            stdout: stdout,
            stderr: '',
            exitCode: 0
        };

    } catch (error) {
        return {
            stdout: error.stdout ? error.stdout.toString() : '',
            stderr: error.stderr ? error.stderr.toString() : error.message,
            exitCode: error.status || 1
        };
    }
}

/**
 * Exécution interactive (pour commandes longues)
 */
function execBashInteractive(command, options = {}) {
    return new Promise((resolve, reject) => {
        const args = command.split(' ');
        const cmd = args[0];
        const cmdArgs = args.slice(1);

        const child = spawn(cmd, cmdArgs, {
            cwd: options.cwd || process.cwd(),
            stdio: 'pipe'
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
            if (options.onOutput) {
                options.onOutput(data.toString(), 'stdout');
            }
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
            if (options.onOutput) {
                options.onOutput(data.toString(), 'stderr');
            }
        });

        child.on('close', (code) => {
            resolve({
                stdout,
                stderr,
                exitCode: code
            });
        });

        child.on('error', (error) => {
            reject(error);
        });

        // Timeout
        if (options.timeout) {
            setTimeout(() => {
                child.kill();
                reject(new Error('Timeout dépassé'));
            }, options.timeout);
        }
    });
}

module.exports = { execBash, execBashInteractive };
```

**Test :**

```javascript
const { execBash } = require('./tools/bash');

// Test 1: Commande simple
console.log('--- ls ---');
const ls = execBash('ls -la');
console.log(ls.stdout);

// Test 2: Commande git
console.log('\n--- git status ---');
const git = execBash('git status');
console.log(git.stdout);

// Test 3: Commande avec erreur
console.log('\n--- Commande inexistante ---');
const bad = execBash('nonexistentcommand');
console.log('stderr:', bad.stderr);
console.log('exitCode:', bad.exitCode);

// Test 4: Commande dangereuse (bloquée)
console.log('\n--- Commande dangereuse ---');
const danger = execBash('ls; rm -rf /');
console.log('stderr:', danger.stderr);

// Test 5: Whitelist
console.log('\n--- Whitelist ---');
const whitelisted = execBash('git status', {
    allowedCommands: ['git', 'npm', 'node']
});
console.log(whitelisted.stdout);

const notAllowed = execBash('rm file.txt', {
    allowedCommands: ['git', 'npm', 'node']
});
console.log(notAllowed.stderr);
```

### 🎮 PRATIQUE : CLI avec Bash

**🎯 Défi 3 : Créer un CLI `run` pour exécuter des commandes**

```bash
run "ls -la"                    # Exécute une commande
run "git status" --timeout 5000 # Avec timeout
```

<details>
<summary>✅ Solution</summary>

```javascript
#!/usr/bin/env node
const { Command } = require('commander');
const { execBash, execBashInteractive } = require('./tools/bash');

const program = new Command();

program
    .name('run')
    .description('Exécute des commandes bash de manière sécurisée')
    .version('1.0.0');

program
    .argument('<command>', 'Commande à exécuter')
    .option('-t, --timeout <ms>', 'Timeout en millisecondes', '10000')
    .option('-w, --whitelist <commands>', 'Commandes autorisées (séparées par ,)')
    .option('-i, --interactive', 'Mode interactif (affiche sortie en temps réel)')
    .action(async (command, options) => {
        const execOptions = {
            timeout: parseInt(options.timeout)
        };

        if (options.whitelist) {
            execOptions.allowedCommands = options.whitelist.split(',');
        }

        if (options.interactive) {
            // Mode interactif
            console.log(`🚀 Exécution: ${command}\n`);
            execOptions.onOutput = (data, type) => {
                if (type === 'stdout') {
                    process.stdout.write(data);
                } else {
                    process.stderr.write(data);
                }
            };

            try {
                const result = await execBashInteractive(command, execOptions);
                console.log(`\n✅ Terminé (exit code: ${result.exitCode})`);
            } catch (error) {
                console.error(`\n❌ Erreur: ${error.message}`);
                process.exit(1);
            }
        } else {
            // Mode synchrone
            const result = execBash(command, execOptions);

            if (result.stdout) {
                console.log(result.stdout);
            }

            if (result.stderr) {
                console.error(result.stderr);
            }

            process.exit(result.exitCode);
        }
    });

program.parse(process.argv);
```

**Tests :**
```bash
# Commande simple
run "echo Hello World"

# Git status
run "git status"

# Avec whitelist
run "git log -1" --whitelist git,npm,node

# Commande bloquée
run "git log -1" --whitelist npm,node

# Mode interactif pour commande longue
run "npm install" --interactive
```

</details>

### 📊 POINTS CLÉS

- ✅ **execSync** : Pour commandes courtes et synchrones
- ✅ **spawn** : Pour commandes longues et interactives
- ✅ **Timeout** : Toujours limiter le temps d'exécution
- ✅ **Whitelist** : Limiter les commandes autorisées
- ✅ **Validation** : Bloquer les patterns dangereux
- ✅ **Gestion erreurs** : Capturer stdout, stderr, exitCode

---

## 🧪 MINI-PROJET DE CHAPITRE : CLI d'Automatisation

### 🎯 Mission Complète

Crée un CLI **`automate`** qui combine TOUS les outils pour automatiser des tâches.

**Fonctionnalités :**

1. **`automate backup <dir>`** :
   - Utilise **Glob** pour trouver tous les fichiers
   - Utilise **Read** pour lire chaque fichier
   - Utilise **Write** pour créer une archive
   - Utilise **Bash** pour compresser (tar/zip)

2. **`automate refactor <pattern> <replacement>`** :
   - Utilise **Glob** pour trouver les fichiers .js
   - Utilise **Grep** pour trouver les occurrences
   - Utilise **Edit** pour remplacer
   - Affiche un rapport

3. **`automate analyze <dir>`** :
   - Compte les lignes de code par extension
   - Trouve les fichiers les plus gros
   - Cherche les TODOs
   - Génère un rapport

**Temps estimé :** 60 minutes

**Structure suggérée :**

```javascript
#!/usr/bin/env node
const { Command } = require('commander');
const { readFile } = require('./tools/read');
const { writeFile } = require('./tools/write');
const { editFile } = require('./tools/edit');
const { grep } = require('./tools/grep');
const { glob } = require('./tools/glob');
const { execBash } = require('./tools/bash');

const program = new Command();

program
    .name('automate')
    .description('CLI d\'automatisation de tâches')
    .version('1.0.0');

// TODO: Implémenter les 3 commandes

program.parse(process.argv);
```

<details>
<summary>✅ Solution Partielle (Backup)</summary>

```javascript
program
    .command('backup <directory>')
    .description('Sauvegarde tous les fichiers d\'un dossier')
    .option('-o, --output <file>', 'Fichier de sortie', 'backup.tar.gz')
    .action((directory, options) => {
        console.log(`📦 Sauvegarde de ${directory}...`);

        // 1. Trouver tous les fichiers
        const files = glob('**/*', directory);
        console.log(`📁 ${files.length} fichiers trouvés`);

        // 2. Créer une liste
        const fileList = files.join('\n');
        writeFile('.backup-list.txt', fileList);

        // 3. Créer l'archive avec tar
        const tarCommand = `tar -czf ${options.output} -C ${directory} .`;
        const result = execBash(tarCommand);

        if (result.exitCode === 0) {
            console.log(`✅ Sauvegarde créée: ${options.output}`);

            // Afficher la taille
            const sizeResult = execBash(`du -h ${options.output}`);
            console.log(`📊 Taille: ${sizeResult.stdout.split('\t')[0]}`);
        } else {
            console.error(`❌ Erreur: ${result.stderr}`);
        }
    });
```

</details>

---

## 🎯 QUIZ INTERLEAVING

### Question 1 : Outil Read

Pourquoi retourner le contenu avec numéros de ligne ?

A) Pour faire joli
B) Pour que Claude puisse référencer précisément les lignes à modifier
C) Pour compter les lignes
D) Pour la compatibilité avec cat

<details>
<summary>💡 Solution</summary>

**B) Pour que Claude puisse référencer précisément les lignes à modifier**

Quand Claude voit:
```
42  const PORT = 3000;
```

Il peut dire "ligne 42" dans ses instructions ou éditions futures. C'est crucial pour l'outil Edit qui doit savoir OÙ modifier.

</details>

### Question 2 : Différence Grep vs Glob

Quelle commande utiliser pour trouver tous les fichiers TypeScript contenant "interface" ?

A) `glob("interface")`
B) `grep("interface")` puis filtrer .ts
C) `glob("**/*.ts")` puis `grep("interface")` sur chaque fichier
D) `grep("interface", { glob: ['.ts'] })`

<details>
<summary>💡 Solution</summary>

**D) `grep("interface", { glob: ['.ts'] })`**

C'est la méthode la plus efficace car:
1. Glob est intégré dans grep via l'option
2. Une seule opération au lieu de deux
3. Filtre pendant la recherche, pas après

**C serait correct aussi** mais moins efficace.

</details>

### Question 3 : Sécurité Bash

Quel est le danger de ce code ?

```javascript
const filename = userInput; // "file.txt; rm -rf /"
execBash(`cat ${filename}`);
```

A) Le fichier n'existe peut-être pas
B) Injection de commande (exécute "rm -rf /")
C) Timeout dépassé
D) Mauvaise encodage

<details>
<summary>💡 Solution</summary>

**B) Injection de commande**

L'input utilisateur contient `;` qui permet d'exécuter une deuxième commande:
```bash
cat file.txt; rm -rf /
```

**Solutions :**
1. Valider l'input (whitelist de caractères autorisés)
2. Utiliser des arguments séparés (spawn avec array)
3. Détecter les patterns dangereux (`;`, `&&`, `||`, backticks)

</details>

### Question 4 : Edit vs Write

Quand utiliser Edit au lieu de Write ?

A) Toujours utiliser Edit
B) Quand on veut modifier UNE PARTIE d'un fichier
C) Quand le fichier est gros
D) Quand on veut créer un nouveau fichier

<details>
<summary>💡 Solution</summary>

**B) Quand on veut modifier UNE PARTIE d'un fichier**

**Edit** :
- Remplace une chaîne spécifique
- Préserve le reste du fichier
- Exemple: Changer un port dans config.js

**Write** :
- Remplace TOUT le contenu
- Crée ou écrase complètement
- Exemple: Créer un nouveau fichier

</details>

### Question 5 : Performance

Quelle approche est la plus rapide pour trouver "TODO" dans 1000 fichiers .js ?

A) Lire chaque fichier avec Read puis chercher
B) Utiliser Grep avec option glob: ['.js']
C) Utiliser Glob puis Grep sur chaque fichier
D) Exécuter `grep -r "TODO" *.js` avec Bash

<details>
<summary>💡 Solution</summary>

**D) Exécuter `grep -r "TODO" *.js` avec Bash**

**Classement performance :**
1. **Bash + grep natif** : Le plus rapide (binaire C optimisé)
2. **Notre grep avec glob** : Rapide (une passe)
3. **Glob puis grep** : Moyen (deux passes)
4. **Read puis chercher** : Le plus lent (charge tout en mémoire)

**Mais attention :** Bash dépend de l'OS. Notre implémentation est cross-platform.

</details>

---

## 📅 RÉVISION ESPACÉE

### J+1 : 20 minutes
- [ ] Réimplémente Read sans regarder
- [ ] Réimplémente Write avec création dossiers parents
- [ ] Explique à voix haute la différence Grep/Glob

### J+3 : 15 minutes
- [ ] Quiz: 10 questions sur les 6 outils
- [ ] Crée un mini-CLI qui utilise 3 outils

### J+7 : 30 minutes
- [ ] Implémente une variante du mini-projet
- [ ] Ajoute une fonctionnalité de ton choix
- [ ] Compare avec la solution fournie

### J+14 : 45 minutes
- [ ] Quiz mélangé Chapitres 1-2
- [ ] Crée un CLI complexe utilisant tous les outils
- [ ] Explique comment Claude Code utilise ces outils

### J+30 : 60 minutes
- [ ] Challenge: Clone un outil existant (fd, rg, etc.)
- [ ] Étudie le code source du vrai Claude Code
- [ ] Compare ton implémentation avec la leur

---

## 🚀 POUR ALLER PLUS LOIN

### 🎯 Niveau 2 Disponible

➡️ **[Chapitre 02 Niveau 2](../NIVEAU-2-MAITRISE-PRATIQUE/Chapitre-02-Systeme-Outils-Builtin/Phase-1-Introduction.md)**

**Contenu :**
- Optimisations de performance
- Streaming de gros fichiers
- Recherche parallèle
- Gestion de la mémoire
- Tests de charge

### 💡 Projets Créatifs

1. **CLI de Code Review Automatisé**
   - Grep pour trouver les code smells
   - Edit pour proposer des fixes
   - Bash pour lancer les tests

2. **CLI de Migration de Code**
   - Glob pour trouver tous les fichiers
   - Grep pour identifier les patterns
   - Edit pour moderniser le code
   - Rapport détaillé

3. **CLI d'Analyse de Projet**
   - Statistiques lignes de code
   - Dépendances utilisées
   - TODOs/FIXMEs
   - Complexité cyclomatique

---

## 📊 TRACKER

```
Chapitre 2 : Système d'Outils Built-in
├── Section 1 : Read/Write/Edit    [●●●●●] Complété ✅
├── Section 2 : Grep/Glob           [●●●●●] Complété ✅
├── Section 3 : Bash sécurisé       [●●●●●] Complété ✅
├── Mini-Projet : Automatisation    [●●●●○] En cours...
└── Quiz                            [●●●○○] 3/5

Auto-Évaluation:
- [ ] Je peux implémenter Read avec numéros de ligne
- [ ] Je peux implémenter Write avec création dossiers
- [ ] Je peux implémenter Edit avec validation
- [ ] Je comprends la différence Grep vs Glob
- [ ] Je peux exécuter Bash de manière sécurisée
- [ ] Je peux combiner tous les outils dans un projet

Score: __/6
Temps: ___ min / 90 estimées
```

---

## 🎓 FÉLICITATIONS !

**Tu as maintenant les "mains" de Claude !**

**Ce que tu maîtrises :**
- ✅ Manipulation de fichiers (Read/Write/Edit)
- ✅ Recherche de code (Grep/Glob)
- ✅ Exécution sécurisée de commandes (Bash)
- ✅ Combinaison d'outils pour automatisation
- ✅ ~50% du système de Claude Code CLI

**Tu peux maintenant :**
- Créer des CLIs qui manipulent des fichiers
- Implémenter des outils de recherche de code
- Exécuter des commandes en toute sécurité
- Comprendre comment Claude interagit avec le code

---

**Navigation :**
- ⬅️ [Chapitre 01 - CLI & Architecture](./01-Chapitre-01-Apercu-Interactif.md)
- ➡️ [Chapitre 03 - Claude API](./03-Chapitre-03-Apercu-Interactif.md)
- 📚 [Niveau 2 Détaillé](../NIVEAU-2-MAITRISE-PRATIQUE/Chapitre-02-Systeme-Outils-Builtin/Phase-1-Introduction.md)
- 🏠 [ROADMAP](../ROADMAP-FORMATION-COMPLETE.md)

---

*Formation Claude Code CLI - Chapitre 02 complété*
**Prochaine étape : Intégration Claude API & Conversation Loop**
