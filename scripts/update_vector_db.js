#!/usr/bin/env node

/**
 * Vector-DB-Update für Multi-Sprachen-Code-Analyse
 * ================================================
 * 
 * Aktualisiert die Vektordatenbank mit Code-Embeddingen aus verschiedenen 
 * Programmiersprachen für verbesserte Analyse und automatisches Debugging.
 * 
 * Unterstützte Sprachen:
 * - JavaScript/TypeScript
 * - Python
 * - Java
 * - C/C++
 * - Rust
 * - Go
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { program } = require('commander');
const crypto = require('crypto');

// SQLite für die Vektordatenbank (in Produktion könnte ChromaDB oder LanceDB verwendet werden)
let sqlite3;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (error) {
  console.error('SQLite3 ist nicht installiert. Installiere mit: npm install sqlite3');
  console.error('Fallback auf Dateibasierte Speicherung...');
}

// Konfiguration
const PROJECT_ROOT = execSync('git rev-parse --show-toplevel 2>/dev/null || echo "."', { encoding: 'utf8' }).trim();
const CLAUDE_DIR = path.join(PROJECT_ROOT, '.claude');
const VECTOR_DB_DIR = path.join(CLAUDE_DIR, 'vectordb');
const VECTOR_DB_PATH = path.join(VECTOR_DB_DIR, 'code_vectors.db');
const FALLBACK_DB_PATH = path.join(VECTOR_DB_DIR, 'code_vectors.json');

// Spracherkennung basierend auf Dateierweiterungen
const LANGUAGE_MAPPINGS = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.rs': 'rust',
  '.go': 'go'
};

// Funktionsmuster für jede Sprache (reguläre Ausdrücke zur Erkennung rekursiver Funktionen)
const RECURSIVE_PATTERNS = {
  javascript: /function\s+(\w+)\s*\([^)]*\)\s*\{[\s\S]*?\1\s*\(/,
  typescript: /function\s+(\w+)\s*\([^)]*\)\s*[\:\s\w<>\[\],\|]*\{[\s\S]*?\1\s*\(/,
  python: /def\s+(\w+)\s*\([^)]*\)[\s\S]*?\1\s*\(/,
  java: /\b(?:public|private|protected|static)?\s+\w+\s+(\w+)\s*\([^)]*\)[\s\S]*?\1\s*\(/,
  c: /\b(\w+)\s*\([^)]*\)[\s\S]*?\1\s*\(/,
  cpp: /\b(\w+)\s*\([^)]*\)[\s\S]*?\1\s*\(/,
  rust: /fn\s+(\w+)\s*\([^)]*\)[\s\S]*?\1\s*\(/,
  go: /func\s+(\w+)\s*\([^)]*\)[\s\S]*?\1\s*\(/
};

// Schwellenwerte für Warnungen
const WARNING_THRESHOLDS = {
  recursion_depth: 100,
  code_complexity: 15  // zyklomatische Komplexität
};

// CLI-Konfiguration
program
  .name('update-vector-db')
  .description('Aktualisiert Vector-DB für Multi-Language-Code-Analyse')
  .version('1.0.0');

program
  .command('index')
  .description('Indexiert alle unterstützten Code-Dateien im Repository')
  .option('-l, --language <lang>', 'Nur eine bestimmte Sprache indexieren')
  .option('-p, --path <path>', 'Spezifischen Pfad indexieren', PROJECT_ROOT)
  .action(options => {
    setupVectorDB();
    indexCodeFiles(options.path, options.language);
  });
  
program
  .command('analyze')
  .description('Analysiert Code auf rekursive Probleme und aktualisiert die Vektordatenbank')
  .option('-f, --file <file>', 'Eine spezifische Datei analysieren')
  .option('-r, --recursive', 'Nur rekursive Funktionen analysieren', false)
  .action(options => {
    setupVectorDB();
    if (options.file) {
      analyzeFile(options.file, options.recursive);
    } else {
      console.error('Fehler: Bitte geben Sie eine Datei mit --file an');
    }
  });

program
  .command('search')
  .description('Sucht nach ähnlichem Code oder Problemen in der Vektordatenbank')
  .argument('<query>', 'Suchabfrage (Code-Snippet oder Problemtyp)')
  .option('-t, --type <type>', 'Suchtyp (code, problem, pattern)', 'code')
  .option('-l, --language <lang>', 'Sprache filtern')
  .option('-n, --limit <number>', 'Maximale Anzahl an Ergebnissen', '5')
  .action((query, options) => {
    setupVectorDB();
    searchVectorDB(query, options);
  });

program
  .command('branch')
  .description('Analysiert alle Dateien in einem Git-Branch')
  .argument('<branch-name>', 'Name des Git-Branches')
  .action(branchName => {
    setupVectorDB();
    analyzeBranch(branchName);
  });

program.parse();

// Datenbank einrichten
function setupVectorDB() {
  // Claude-Verzeichnisse erstellen, falls nicht vorhanden
  if (!fs.existsSync(CLAUDE_DIR)) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  }
  if (!fs.existsSync(VECTOR_DB_DIR)) {
    fs.mkdirSync(VECTOR_DB_DIR, { recursive: true });
  }
  
  // SQLite-Datenbank einrichten, falls verfügbar
  if (sqlite3) {
    const db = new sqlite3.Database(VECTOR_DB_PATH);
    
    db.serialize(() => {
      // Code-Vectors-Tabelle
      db.run(`CREATE TABLE IF NOT EXISTS code_vectors (
        id TEXT PRIMARY KEY,
        file_path TEXT,
        language TEXT,
        code_snippet TEXT,
        function_name TEXT,
        is_recursive INTEGER,
        complexity INTEGER,
        embedding BLOB,
        created_at TEXT,
        updated_at TEXT
      )`);
      
      // Problem-Vectors-Tabelle
      db.run(`CREATE TABLE IF NOT EXISTS problem_vectors (
        id TEXT PRIMARY KEY,
        file_path TEXT,
        problem_type TEXT,
        description TEXT,
        severity TEXT,
        embedding BLOB,
        created_at TEXT,
        updated_at TEXT
      )`);
      
      // Lösungs-Vectors-Tabelle
      db.run(`CREATE TABLE IF NOT EXISTS solution_vectors (
        id TEXT PRIMARY KEY,
        problem_id TEXT,
        solution_code TEXT,
        effectiveness INTEGER,
        embedding BLOB,
        created_at TEXT,
        FOREIGN KEY(problem_id) REFERENCES problem_vectors(id)
      )`);
    });
    
    db.close();
    console.log(`Vector-Datenbank eingerichtet: ${VECTOR_DB_PATH}`);
  } else {
    // Fallback auf JSON-Datei
    if (!fs.existsSync(FALLBACK_DB_PATH)) {
      fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify({
        code_vectors: [],
        problem_vectors: [],
        solution_vectors: []
      }));
    }
    console.log(`Fallback-Vector-Datenbank eingerichtet: ${FALLBACK_DB_PATH}`);
  }
}

// Code-Dateien indexieren
function indexCodeFiles(basePath, languageFilter) {
  console.log(`Indexiere Code-Dateien in: ${basePath}`);
  
  try {
    // Git ls-files für bessere Performance, falls in Git-Repository
    let files = [];
    try {
      const output = execSync(`git ls-files --exclude-standard -- "${basePath}"`, { encoding: 'utf8' });
      files = output.split('\n').filter(Boolean);
    } catch (error) {
      // Fallback auf rekursive Verzeichnis-Durchsuchung
      files = getAllFiles(basePath);
    }
    
    // Nach Sprache filtern
    const supportedExtensions = Object.keys(LANGUAGE_MAPPINGS);
    files = files.filter(file => {
      const ext = path.extname(file);
      const language = LANGUAGE_MAPPINGS[ext];
      
      if (!supportedExtensions.includes(ext)) return false;
      if (languageFilter && language !== languageFilter) return false;
      
      return true;
    });
    
    console.log(`${files.length} unterstützte Code-Dateien gefunden`);
    
    // Dateien verarbeiten
    files.forEach(file => {
      try {
        analyzeFile(file, false);
      } catch (error) {
        console.error(`Fehler bei der Analyse von ${file}:`, error.message);
      }
    });
    
    console.log('Indexierung abgeschlossen');
  } catch (error) {
    console.error('Fehler bei der Indexierung:', error.message);
  }
}

// Datei analysieren
function analyzeFile(filePath, onlyRecursive) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Datei nicht gefunden: ${fullPath}`);
    return;
  }
  
  const ext = path.extname(fullPath);
  const language = LANGUAGE_MAPPINGS[ext];
  
  if (!language) {
    console.error(`Nicht unterstützte Dateiendung: ${ext}`);
    return;
  }
  
  console.log(`Analysiere ${language}-Datei: ${fullPath}`);
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Funktionen extrahieren (stark vereinfacht - in Produktion würde man AST-Parser verwenden)
    const functions = extractFunctions(content, language);
    
    if (functions.length === 0) {
      console.log('Keine Funktionen gefunden');
      return;
    }
    
    console.log(`${functions.length} Funktionen gefunden`);
    
    // Rekursive Funktionen identifizieren
    let hasRecursiveFunctions = false;
    
    functions.forEach(func => {
      const isRecursive = isRecursiveFunction(func.code, func.name, language);
      func.isRecursive = isRecursive;
      
      if (isRecursive) {
        hasRecursiveFunctions = true;
        console.log(`Rekursive Funktion gefunden: ${func.name}`);
      }
      
      // Komplexität schätzen
      func.complexity = estimateComplexity(func.code, language);
      
      // Nur verarbeiten, wenn entweder alle oder nur rekursive Funktionen gewünscht sind
      if (!onlyRecursive || func.isRecursive) {
        // Code-Vektor erstellen und speichern
        storeCodeVector(func, fullPath, language);
        
        // Auf Probleme prüfen
        const problems = detectProblems(func, language);
        if (problems.length > 0) {
          problems.forEach(problem => {
            storeProblemVector(problem, fullPath, language);
          });
        }
      }
    });
    
    if (onlyRecursive && !hasRecursiveFunctions) {
      console.log('Keine rekursiven Funktionen gefunden');
    }
  } catch (error) {
    console.error(`Fehler bei der Analyse von ${fullPath}:`, error.message);
  }
}

// Funktionen extrahieren (vereinfachte Implementierung)
function extractFunctions(content, language) {
  const functions = [];
  
  // Sehr vereinfachte Extraktionslogik - in der Praxis AST-Parser verwenden
  switch (language) {
    case 'javascript':
    case 'typescript':
      // Reguläre Funktion: function name() {...}
      const funcRegex = /function\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n\})/g;
      let match;
      while ((match = funcRegex.exec(content)) !== null) {
        functions.push({
          name: match[1],
          code: `function ${match[1]}${match[0].substring(match[1].length + 8)}`,
          language
        });
      }
      
      // Arrow-Funktionen und Methoden hinzufügen (vereinfacht)
      break;
    
    case 'python':
      // Python-Funktionen: def name():
      const pyFuncRegex = /def\s+(\w+)\s*\([^)]*\)[\s\S]*?(?=\n\S|$)/g;
      while ((match = pyFuncRegex.exec(content)) !== null) {
        functions.push({
          name: match[1],
          code: match[0],
          language
        });
      }
      break;
    
    case 'java':
      // Java-Methoden
      const javaMethodRegex = /(?:public|private|protected|static)?\s+\w+\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n\s*\})/g;
      while ((match = javaMethodRegex.exec(content)) !== null) {
        functions.push({
          name: match[1],
          code: match[0],
          language
        });
      }
      break;
    
    // Weitere Sprachen hier hinzufügen...
    
    default:
      console.warn(`Funktionsextraktion für ${language} ist noch nicht vollständig implementiert`);
      break;
  }
  
  return functions;
}

// Prüfen, ob eine Funktion rekursiv ist
function isRecursiveFunction(code, functionName, language) {
  const pattern = RECURSIVE_PATTERNS[language];
  
  if (!pattern) return false;
  
  // Spezifischere Prüfung auf Selbstaufruf
  const namePattern = new RegExp(`\\b${functionName}\\s*\\(`, 'g');
  const calls = code.match(namePattern);
  
  // Mindestens zwei Vorkommen (Definition + Aufruf)
  return calls && calls.length >= 2;
}

// Komplexität schätzen (vereinfachte zyklomatische Komplexität)
function estimateComplexity(code, language) {
  // Einfache Heuristik: Anzahl der Verzweigungen zählen
  let complexity = 1; // Basiswert
  
  const commonPatterns = [
    /if\s*\(/g,           // if
    /else\s+if\s*\(/g,    // else if
    /else\s*\{/g,         // else
    /for\s*\(/g,          // for
    /while\s*\(/g,        // while
    /do\s*\{/g,           // do-while
    /case\s+/g,           // case in switch
    /catch\s*\(/g,        // catch
    /\?\s*:/g             // ternary
  ];
  
  // Gemeinsame Muster zählen
  commonPatterns.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  });
  
  // Sprachspezifische Muster
  switch (language) {
    case 'python':
      // Python-spezifische Muster (z.B. list comprehensions)
      const pythonPatterns = [
        /for\s+\w+\s+in/g,
        /if\s+.+\s+in/g
      ];
      
      pythonPatterns.forEach(pattern => {
        const matches = code.match(pattern);
        if (matches) {
          complexity += matches.length;
        }
      });
      break;
      
    // Weitere Sprachen hier...
  }
  
  return complexity;
}

// Probleme erkennen
function detectProblems(func, language) {
  const problems = [];
  
  // Rekursive Funktion ohne klaren Abbruch
  if (func.isRecursive) {
    // Prüfen auf fehlende Basisfall-Prüfung
    let hasBaseCase = false;
    
    switch (language) {
      case 'javascript':
      case 'typescript':
        // Einfache Prüfung auf if-Statement am Anfang der Funktion
        hasBaseCase = /function\s+\w+\s*\([^)]*\)\s*\{\s*if\s*\(/.test(func.code);
        break;
      
      case 'python':
        // Einfache Prüfung auf if-Statement nach Funktionsdefinition
        hasBaseCase = /def\s+\w+\s*\([^)]*\)[\s\S]*?\n\s*if\s+/.test(func.code);
        break;
      
      // Weitere Sprachen...
    }
    
    if (!hasBaseCase) {
      problems.push({
        type: 'missing_base_case',
        description: 'Rekursive Funktion ohne erkennbaren Basisfall',
        severity: 'high',
        function: func.name
      });
    }
    
    // Hohe Komplexität
    if (func.complexity > WARNING_THRESHOLDS.code_complexity) {
      problems.push({
        type: 'high_complexity',
        description: `Hohe Komplexität (${func.complexity}) in rekursiver Funktion`,
        severity: 'medium',
        function: func.name
      });
    }
    
    // Keine Memoization in komplexer rekursiver Funktion
    if (func.complexity > 8) {
      const hasMemoization = (
        language === 'javascript' && /(?:cache|memo|memoize|memoization)/.test(func.code) ||
        language === 'python' && /@(?:functools\.lru_cache|lru_cache|cache)/.test(func.code)
      );
      
      if (!hasMemoization) {
        problems.push({
          type: 'no_memoization',
          description: 'Komplexe rekursive Funktion ohne Memoization',
          severity: 'medium',
          function: func.name
        });
      }
    }
  }
  
  return problems;
}

// Code-Vektor speichern
function storeCodeVector(func, filePath, language) {
  const id = generateId(filePath, func.name);
  const now = new Date().toISOString();
  
  // Einfaches "Embedding" (Simuliert - eigentlich würde hier ein echtes Embedding-Modell verwendet)
  const embeddingSimulation = generateFakeEmbedding(func.code);
  
  if (sqlite3) {
    const db = new sqlite3.Database(VECTOR_DB_PATH);
    
    // Existierende Einträge prüfen und aktualisieren/einfügen
    db.get('SELECT id FROM code_vectors WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Fehler beim Datenbankzugriff:', err.message);
        db.close();
        return;
      }
      
      if (row) {
        // Aktualisieren
        db.run(
          'UPDATE code_vectors SET code_snippet = ?, is_recursive = ?, complexity = ?, embedding = ?, updated_at = ? WHERE id = ?',
          [func.code, func.isRecursive ? 1 : 0, func.complexity, Buffer.from(embeddingSimulation), now, id],
          function(err) {
            if (err) {
              console.error('Fehler beim Aktualisieren:', err.message);
            } else {
              console.log(`Funktion ${func.name} aktualisiert`);
            }
          }
        );
      } else {
        // Neu einfügen
        db.run(
          'INSERT INTO code_vectors (id, file_path, language, code_snippet, function_name, is_recursive, complexity, embedding, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, filePath, language, func.code, func.name, func.isRecursive ? 1 : 0, func.complexity, Buffer.from(embeddingSimulation), now, now],
          function(err) {
            if (err) {
              console.error('Fehler beim Einfügen:', err.message);
            } else {
              console.log(`Funktion ${func.name} zum Index hinzugefügt`);
            }
          }
        );
      }
      
      db.close();
    });
  } else {
    // Fallback auf JSON-Datei
    try {
      const data = JSON.parse(fs.readFileSync(FALLBACK_DB_PATH, 'utf8'));
      
      const existingIndex = data.code_vectors.findIndex(cv => cv.id === id);
      
      if (existingIndex >= 0) {
        // Aktualisieren
        data.code_vectors[existingIndex] = {
          id,
          file_path: filePath,
          language,
          code_snippet: func.code,
          function_name: func.name,
          is_recursive: func.isRecursive,
          complexity: func.complexity,
          embedding_signature: hashString(func.code),  // Vereinfachte Repräsentation
          updated_at: now
        };
      } else {
        // Neu einfügen
        data.code_vectors.push({
          id,
          file_path: filePath,
          language,
          code_snippet: func.code,
          function_name: func.name,
          is_recursive: func.isRecursive,
          complexity: func.complexity,
          embedding_signature: hashString(func.code),  // Vereinfachte Repräsentation
          created_at: now,
          updated_at: now
        });
      }
      
      fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(data, null, 2));
      console.log(`Funktion ${func.name} im Fallback-Index gespeichert`);
    } catch (error) {
      console.error('Fehler beim Speichern des Fallback-Index:', error.message);
    }
  }
}

// Problem-Vektor speichern
function storeProblemVector(problem, filePath, language) {
  const id = generateId(filePath, problem.type + problem.function);
  const now = new Date().toISOString();
  
  // Einfaches "Embedding" (Simuliert)
  const embeddingSimulation = generateFakeEmbedding(problem.description);
  
  if (sqlite3) {
    const db = new sqlite3.Database(VECTOR_DB_PATH);
    
    // Prüfen und aktualisieren/einfügen
    db.get('SELECT id FROM problem_vectors WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Fehler beim Datenbankzugriff:', err.message);
        db.close();
        return;
      }
      
      if (row) {
        // Aktualisieren
        db.run(
          'UPDATE problem_vectors SET description = ?, severity = ?, embedding = ?, updated_at = ? WHERE id = ?',
          [problem.description, problem.severity, Buffer.from(embeddingSimulation), now, id],
          function(err) {
            if (err) {
              console.error('Fehler beim Aktualisieren des Problems:', err.message);
            } else {
              console.log(`Problem ${problem.type} aktualisiert`);
            }
          }
        );
      } else {
        // Neu einfügen
        db.run(
          'INSERT INTO problem_vectors (id, file_path, problem_type, description, severity, embedding, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, filePath, problem.type, problem.description, problem.severity, Buffer.from(embeddingSimulation), now, now],
          function(err) {
            if (err) {
              console.error('Fehler beim Einfügen des Problems:', err.message);
            } else {
              console.log(`Problem ${problem.type} zum Index hinzugefügt`);
            }
          }
        );
      }
      
      db.close();
    });
  } else {
    // Fallback auf JSON-Datei
    try {
      const data = JSON.parse(fs.readFileSync(FALLBACK_DB_PATH, 'utf8'));
      
      const existingIndex = data.problem_vectors.findIndex(pv => pv.id === id);
      
      if (existingIndex >= 0) {
        // Aktualisieren
        data.problem_vectors[existingIndex] = {
          id,
          file_path: filePath,
          problem_type: problem.type,
          description: problem.description,
          severity: problem.severity,
          embedding_signature: hashString(problem.description),
          updated_at: now
        };
      } else {
        // Neu einfügen
        data.problem_vectors.push({
          id,
          file_path: filePath,
          problem_type: problem.type,
          description: problem.description,
          severity: problem.severity,
          embedding_signature: hashString(problem.description),
          created_at: now,
          updated_at: now
        });
      }
      
      fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(data, null, 2));
      console.log(`Problem ${problem.type} im Fallback-Index gespeichert`);
    } catch (error) {
      console.error('Fehler beim Speichern des Fallback-Index:', error.message);
    }
  }
}

// Vektordatenbank durchsuchen
function searchVectorDB(query, options) {
  console.log(`Suche in Vektordatenbank: "${query}"`);
  
  const limit = parseInt(options.limit) || 5;
  
  // In echter Implementierung würde hier ein Embedding-Modell verwendet
  const queryEmbedding = generateFakeEmbedding(query);
  
  if (sqlite3) {
    const db = new sqlite3.Database(VECTOR_DB_PATH);
    
    let sqlQuery, params;
    
    switch (options.type) {
      case 'problem':
        sqlQuery = `
          SELECT id, file_path, problem_type, description, severity
          FROM problem_vectors
          WHERE 1=1
        `;
        
        if (options.language) {
          sqlQuery += ' AND file_path LIKE ?';
          params = [`%.${options.language}`];
        } else {
          params = [];
        }
        
        sqlQuery += ' LIMIT ?';
        params.push(limit);
        
        db.all(sqlQuery, params, (err, rows) => {
          if (err) {
            console.error('Fehler bei der Problemsuche:', err.message);
            db.close();
            return;
          }
          
          console.log(`${rows.length} Probleme gefunden:`);
          rows.forEach(row => {
            console.log(`- [${row.severity.toUpperCase()}] ${row.problem_type}: ${row.description}`);
            console.log(`  Datei: ${row.file_path}`);
            console.log();
          });
          
          db.close();
        });
        break;
      
      case 'pattern':
        sqlQuery = `
          SELECT id, file_path, function_name, is_recursive, complexity, code_snippet
          FROM code_vectors
          WHERE code_snippet LIKE ?
        `;
        
        params = [`%${query}%`];
        
        if (options.language) {
          sqlQuery += ' AND language = ?';
          params.push(options.language);
        }
        
        sqlQuery += ' LIMIT ?';
        params.push(limit);
        
        db.all(sqlQuery, params, (err, rows) => {
          if (err) {
            console.error('Fehler bei der Mustersuche:', err.message);
            db.close();
            return;
          }
          
          console.log(`${rows.length} Codemuster gefunden:`);
          rows.forEach(row => {
            console.log(`- ${row.function_name} (${row.is_recursive ? 'rekursiv' : 'nicht-rekursiv'}, Komplexität: ${row.complexity})`);
            console.log(`  Datei: ${row.file_path}`);
            console.log(`  Code-Snippet: ${row.code_snippet.substring(0, 100)}...`);
            console.log();
          });
          
          db.close();
        });
        break;
      
      case 'code':
      default:
        sqlQuery = `
          SELECT id, file_path, function_name, is_recursive, complexity, code_snippet
          FROM code_vectors
          WHERE 1=1
        `;
        
        if (options.language) {
          sqlQuery += ' AND language = ?';
          params = [options.language];
        } else {
          params = [];
        }
        
        sqlQuery += ' LIMIT ?';
        params.push(limit);
        
        db.all(sqlQuery, params, (err, rows) => {
          if (err) {
            console.error('Fehler bei der Codesuche:', err.message);
            db.close();
            return;
          }
          
          console.log(`${rows.length} Funktionen gefunden:`);
          rows.forEach(row => {
            console.log(`- ${row.function_name} (${row.is_recursive ? 'rekursiv' : 'nicht-rekursiv'}, Komplexität: ${row.complexity})`);
            console.log(`  Datei: ${row.file_path}`);
            console.log(`  Code-Snippet: ${row.code_snippet.substring(0, 100)}...`);
            console.log();
          });
          
          db.close();
        });
        break;
    }
  } else {
    // Fallback auf JSON-Datei
    try {
      const data = JSON.parse(fs.readFileSync(FALLBACK_DB_PATH, 'utf8'));
      
      let results;
      
      switch (options.type) {
        case 'problem':
          results = data.problem_vectors
            .filter(pv => {
              if (options.language) {
                return pv.file_path.endsWith(`.${options.language}`);
              }
              return true;
            })
            .slice(0, limit);
          
          console.log(`${results.length} Probleme gefunden:`);
          results.forEach(row => {
            console.log(`- [${row.severity.toUpperCase()}] ${row.problem_type}: ${row.description}`);
            console.log(`  Datei: ${row.file_path}`);
            console.log();
          });
          break;
        
        case 'pattern':
          results = data.code_vectors
            .filter(cv => {
              const matchesPattern = cv.code_snippet.includes(query);
              const matchesLanguage = options.language ? cv.language === options.language : true;
              return matchesPattern && matchesLanguage;
            })
            .slice(0, limit);
          
          console.log(`${results.length} Codemuster gefunden:`);
          results.forEach(row => {
            console.log(`- ${row.function_name} (${row.is_recursive ? 'rekursiv' : 'nicht-rekursiv'}, Komplexität: ${row.complexity})`);
            console.log(`  Datei: ${row.file_path}`);
            console.log(`  Code-Snippet: ${row.code_snippet.substring(0, 100)}...`);
            console.log();
          });
          break;
        
        case 'code':
        default:
          results = data.code_vectors
            .filter(cv => {
              return options.language ? cv.language === options.language : true;
            })
            .slice(0, limit);
          
          console.log(`${results.length} Funktionen gefunden:`);
          results.forEach(row => {
            console.log(`- ${row.function_name} (${row.is_recursive ? 'rekursiv' : 'nicht-rekursiv'}, Komplexität: ${row.complexity})`);
            console.log(`  Datei: ${row.file_path}`);
            console.log(`  Code-Snippet: ${row.code_snippet.substring(0, 100)}...`);
            console.log();
          });
          break;
      }
    } catch (error) {
      console.error('Fehler beim Durchsuchen des Fallback-Index:', error.message);
    }
  }
}

// Git-Branch analysieren
function analyzeBranch(branchName) {
  console.log(`Analysiere Branch: ${branchName}`);
  
  try {
    // Branch auschecken, falls nicht schon aktiv
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    
    if (currentBranch !== branchName) {
      console.log(`Wechsle zu Branch ${branchName}...`);
      execSync(`git checkout ${branchName}`);
    }
    
    // Alle Dateien im Branch abrufen
    const files = execSync('git ls-tree -r HEAD --name-only', { encoding: 'utf8' }).split('\n').filter(Boolean);
    
    // Nach Codetypische Dateien filtern
    const codeFiles = files.filter(file => {
      const ext = path.extname(file);
      return Object.keys(LANGUAGE_MAPPINGS).includes(ext);
    });
    
    console.log(`${codeFiles.length} Code-Dateien im Branch gefunden`);
    
    // Jede Datei analysieren
    codeFiles.forEach(file => {
      try {
        analyzeFile(file, false);
      } catch (error) {
        console.error(`Fehler bei der Analyse von ${file}:`, error.message);
      }
    });
    
    console.log(`Branch-Analyse abgeschlossen: ${branchName}`);
  } catch (error) {
    console.error('Fehler bei der Branch-Analyse:', error.message);
  }
}

// Hilfsfunktionen
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function generateId(filePath, functionName) {
  return crypto.createHash('md5').update(`${filePath}:${functionName}`).digest('hex');
}

function hashString(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function generateFakeEmbedding(text) {
  // Dies ist nur eine Simulation eines Embedding-Vektors
  // In einer echten Implementierung würde hier ein Embedding-Modell verwendet
  const hash = crypto.createHash('sha256').update(text).digest();
  return Array.from(hash).map(b => b / 255);
}
