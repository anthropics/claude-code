#!/usr/bin/env node

/**
 * Dashboard-Server für Neural Recursive Debugging
 * ===============================================
 * 
 * Startet einen einfachen Webserver, der das Dashboard bereitstellt und
 * mit der Vektordatenbank und den Debugging-Tools kommuniziert.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

// Konfiguration
const PORT = process.env.PORT || 3000;
const app = express();

// Projektbezogene Pfade
let PROJECT_ROOT = process.env.PROJECT_ROOT || '.';
try {
  PROJECT_ROOT = execSync('git rev-parse --show-toplevel 2>/dev/null || echo "."', { encoding: 'utf8' }).trim();
} catch (error) {
  // Ignorieren, wenn kein Git-Repository
}

const CLAUDE_DIR = path.join(PROJECT_ROOT, '.claude');
const VECTOR_DB_DIR = path.join(CLAUDE_DIR, 'vectordb');
const VECTOR_DB_PATH = path.join(VECTOR_DB_DIR, 'code_vectors.db');
const FALLBACK_DB_PATH = path.join(VECTOR_DB_DIR, 'code_vectors.json');

// Statische Dateien
app.use(express.static(__dirname));
app.use(express.json());

// Hauptroute für das Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// API-Route für Projektinformationen
app.get('/api/project-info', (req, res) => {
  try {
    let projectName = path.basename(PROJECT_ROOT);
    let branchName = '';
    
    try {
      branchName = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (error) {
      // Ignorieren, wenn kein Git-Repository oder Branch
      branchName = 'kein-git-branch';
    }
    
    // Letzte Analyse aus .claude/history ermitteln
    let lastAnalysis = '';
    const historyDir = path.join(CLAUDE_DIR, 'history');
    if (fs.existsSync(historyDir)) {
      try {
        const historyFiles = fs.readdirSync(historyDir).filter(file => file.endsWith('.json'));
        if (historyFiles.length > 0) {
          // Nach Datum sortieren (neuestes zuerst)
          historyFiles.sort((a, b) => {
            const statA = fs.statSync(path.join(historyDir, a));
            const statB = fs.statSync(path.join(historyDir, b));
            return statB.mtime.getTime() - statA.mtime.getTime();
          });
          
          // Datum aus Dateinamen extrahieren oder Dateistatus verwenden
          const newestFile = historyFiles[0];
          const match = newestFile.match(/(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/);
          if (match) {
            const dateStr = match[1].replace(/-/g, ':').replace(/(\d+):(\d+):(\d+):(\d+):(\d+):(\d+)/, '$1-$2-$3 $4:$5:$6');
            lastAnalysis = dateStr;
          } else {
            const stat = fs.statSync(path.join(historyDir, newestFile));
            lastAnalysis = stat.mtime.toLocaleString();
          }
        }
      } catch (error) {
        console.error('Fehler beim Lesen des Verlaufs:', error.message);
        lastAnalysis = 'unbekannt';
      }
    } else {
      lastAnalysis = 'keine Analyse gefunden';
    }
    
    // Status ermitteln
    let status = {
      text: 'Bereit',
      code: 'ok',
      warnings: 0,
      errors: 0
    };
    
    const warningsFile = path.join(CLAUDE_DIR, 'warnings.json');
    if (fs.existsSync(warningsFile)) {
      try {
        const warningsData = JSON.parse(fs.readFileSync(warningsFile, 'utf8'));
        status.warnings = warningsData.warnings?.length || 0;
        status.errors = warningsData.errors?.length || 0;
        
        if (status.errors > 0) {
          status.text = `Fehler (${status.errors})`;
          status.code = 'error';
        } else if (status.warnings > 0) {
          status.text = `Warnungen (${status.warnings})`;
          status.code = 'warning';
        }
      } catch (error) {
        console.error('Fehler beim Lesen der Warnungen:', error.message);
      }
    }
    
    res.json({
      project: projectName,
      branch: branchName,
      lastAnalysis: lastAnalysis,
      status: status
    });
  } catch (error) {
    console.error('Fehler beim Abrufen der Projektinformationen:', error.message);
    res.status(500).json({ error: 'Interne Serverfehler' });
  }
});

// API-Route für Statistiken
app.get('/api/stats', (req, res) => {
  let stats = {
    analyzedFunctions: 0,
    recursiveFunctions: 0,
    optimizationPotential: 0,
    fixedIssues: 0,
    languages: {},
    recentChanges: {}
  };
  
  try {
    if (fs.existsSync(VECTOR_DB_PATH) && sqlite3) {
      // SQLite-Datenbank verwenden
      const db = new sqlite3.Database(VECTOR_DB_PATH);
      
      db.serialize(() => {
        // Gesamtzahl der Funktionen
        db.get('SELECT COUNT(*) as count FROM code_vectors', (err, row) => {
          if (!err && row) {
            stats.analyzedFunctions = row.count;
            
            // Rekursive Funktionen
            db.get('SELECT COUNT(*) as count FROM code_vectors WHERE is_recursive = 1', (err, row) => {
              if (!err && row) {
                stats.recursiveFunctions = row.count;
                
                // Optimierungspotenzial berechnen
                if (stats.recursiveFunctions > 0) {
                  db.get('SELECT COUNT(*) as count FROM problem_vectors WHERE severity IN ("high", "medium")', (err, row) => {
                    if (!err && row) {
                      stats.optimizationPotential = Math.round((row.count / stats.recursiveFunctions) * 100);
                      
                      // Behobene Probleme
                      db.get('SELECT COUNT(*) as count FROM solution_vectors', (err, row) => {
                        if (!err && row) {
                          stats.fixedIssues = row.count;
                          
                          // Sprachverteilung
                          db.all('SELECT language, COUNT(*) as count FROM code_vectors GROUP BY language', (err, rows) => {
                            if (!err && rows) {
                              rows.forEach(row => {
                                stats.languages[row.language] = row.count;
                              });
                              
                              res.json(stats);
                            } else {
                              res.json(stats);
                            }
                          });
                        } else {
                          res.json(stats);
                        }
                      });
                    } else {
                      res.json(stats);
                    }
                  });
                } else {
                  res.json(stats);
                }
              } else {
                res.json(stats);
              }
            });
          } else {
            res.json(stats);
          }
        });
      });
    } else if (fs.existsSync(FALLBACK_DB_PATH)) {
      // JSON-Fallback verwenden
      try {
        const data = JSON.parse(fs.readFileSync(FALLBACK_DB_PATH, 'utf8'));
        
        stats.analyzedFunctions = data.code_vectors?.length || 0;
        stats.recursiveFunctions = data.code_vectors?.filter(cv => cv.is_recursive)?.length || 0;
        
        // Optimierungspotenzial berechnen
        const problems = data.problem_vectors?.filter(pv => ['high', 'medium'].includes(pv.severity))?.length || 0;
        if (stats.recursiveFunctions > 0) {
          stats.optimizationPotential = Math.round((problems / stats.recursiveFunctions) * 100);
        }
        
        stats.fixedIssues = data.solution_vectors?.length || 0;
        
        // Sprachverteilung
        data.code_vectors?.forEach(cv => {
          const lang = cv.language;
          stats.languages[lang] = (stats.languages[lang] || 0) + 1;
        });
        
        res.json(stats);
      } catch (error) {
        console.error('Fehler beim Lesen der Fallback-Datenbank:', error.message);
        res.json(stats);
      }
    } else {
      // Demo-Daten zurückgeben, wenn keine DB existiert
      stats = {
        analyzedFunctions: 182,
        recursiveFunctions: 38,
        optimizationPotential: 72,
        fixedIssues: 24,
        languages: {
          javascript: 38,
          typescript: 27,
          python: 22,
          java: 8,
          cpp: 5
        },
        recentChanges: {
          analyzedFunctions: 12,
          fixedIssues: 3
        }
      };
      res.json(stats);
    }
  } catch (error) {
    console.error('Fehler beim Abrufen der Statistiken:', error.message);
    res.status(500).json({ error: 'Interne Serverfehler' });
  }
});

// API-Route für problematische Funktionen
app.get('/api/problematic-functions', (req, res) => {
  try {
    if (fs.existsSync(VECTOR_DB_PATH) && sqlite3) {
      // SQLite-Datenbank verwenden
      const db = new sqlite3.Database(VECTOR_DB_PATH);
      
      const query = `
        SELECT cv.function_name, cv.language, cv.file_path, cv.complexity, cv.is_recursive,
               pv.problem_type, pv.description, pv.severity
        FROM code_vectors cv
        JOIN problem_vectors pv ON cv.file_path = pv.file_path
        ORDER BY 
          CASE pv.severity 
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
            ELSE 4
          END,
          cv.complexity DESC
        LIMIT 10
      `;
      
      db.all(query, (err, rows) => {
        if (err) {
          console.error('Datenbankfehler:', err.message);
          res.json([]);
          return;
        }
        
        res.json(rows);
      });
    } else if (fs.existsSync(FALLBACK_DB_PATH)) {
      // JSON-Fallback verwenden
      try {
        const data = JSON.parse(fs.readFileSync(FALLBACK_DB_PATH, 'utf8'));
        
        // Funktionen mit Problemen zusammenführen
        const problemFunctions = [];
        
        data.problem_vectors?.forEach(problem => {
          const func = data.code_vectors?.find(cv => cv.file_path === problem.file_path);
          if (func) {
            problemFunctions.push({
              function_name: func.function_name,
              language: func.language,
              file_path: func.file_path,
              complexity: func.complexity,
              is_recursive: func.is_recursive,
              problem_type: problem.problem_type,
              description: problem.description,
              severity: problem.severity
            });
          }
        });
        
        // Nach Schweregrad und Komplexität sortieren
        problemFunctions.sort((a, b) => {
          const severityOrder = { 'high': 1, 'medium': 2, 'low': 3 };
          const aOrder = severityOrder[a.severity] || 4;
          const bOrder = severityOrder[b.severity] || 4;
          
          if (aOrder !== bOrder) return aOrder - bOrder;
          return b.complexity - a.complexity;
        });
        
        res.json(problemFunctions.slice(0, 10));
      } catch (error) {
        console.error('Fehler beim Lesen der Fallback-Datenbank:', error.message);
        res.json([]);
      }
    } else {
      // Demo-Daten zurückgeben, wenn keine DB existiert
      const demoFunctions = [
        {
          function_name: "processData",
          language: "JavaScript",
          file_path: "/src/utils/dataProcessor.js",
          complexity: 18,
          is_recursive: true,
          problem_type: "stack_overflow_risk",
          description: "Stack Overflow Risiko",
          severity: "high"
        },
        {
          function_name: "traverse_tree",
          language: "Python",
          file_path: "/src/analyzer/tree_utils.py",
          complexity: 9,
          is_recursive: true,
          problem_type: "no_cycle_detection",
          description: "Keine Zyklus-Erkennung",
          severity: "medium"
        },
        {
          function_name: "calculateFactorial",
          language: "TypeScript",
          file_path: "/src/core/math.ts",
          complexity: 3,
          is_recursive: true,
          problem_type: "no_memoization",
          description: "Keine Memoization",
          severity: "low"
        },
        {
          function_name: "parseJsonRecursive",
          language: "JavaScript",
          file_path: "/src/utils/parser.js",
          complexity: 12,
          is_recursive: true,
          problem_type: "deep_recursion",
          description: "Tiefe Rekursion",
          severity: "medium"
        },
        {
          function_name: "mergeSort",
          language: "Python",
          file_path: "/src/algorithms/sorting.py",
          complexity: 15,
          is_recursive: true,
          problem_type: "memory_overhead",
          description: "Speicher-Overhead",
          severity: "high"
        }
      ];
      
      res.json(demoFunctions);
    }
  } catch (error) {
    console.error('Fehler beim Abrufen der problematischen Funktionen:', error.message);
    res.status(500).json({ error: 'Interne Serverfehler' });
  }
});

// API-Route für Callgraph-Daten
app.get('/api/callgraph/:functionName', (req, res) => {
  const functionName = req.params.functionName;
  const depth = parseInt(req.query.depth || '5');
  
  try {
    // In einer vollständigen Implementierung würden hier die tatsächlichen
    // Callgraph-Daten aus der Datenbank geholt werden
    
    // Demo-Daten für verschiedene Funktionen
    let data;
    
    switch(functionName) {
      case 'processData':
        data = {
          name: "processData",
          children: [
            {
              name: "parseInput",
              children: [
                { name: "validateFormat" },
                { name: "cleanData" }
              ]
            },
            {
              name: "transformData",
              children: [
                { 
                  name: "processData", 
                  isRecursive: true 
                },
                { name: "applyTransformation" }
              ]
            },
            {
              name: "aggregateResults",
              children: [
                { name: "calculateSum" },
                { name: "formatOutput" }
              ]
            }
          ]
        };
        break;
      
      case 'traverse_tree':
        data = {
          name: "traverse_tree",
          children: [
            {
              name: "visit_node",
              children: [
                { name: "process_node" },
                {
                  name: "get_children",
                  children: [
                    {
                      name: "traverse_tree",
                      isRecursive: true
                    }
                  ]
                }
              ]
            },
            {
              name: "collect_results"
            }
          ]
        };
        break;
      
      case 'calculateFactorial':
        data = {
          name: "calculateFactorial",
          children: [
            {
              name: "validateInput"
            },
            {
              name: "calculateFactorial",
              isRecursive: true
            }
          ]
        };
        break;
      
      // Weitere Funktionen hier...
      
      default:
        data = {
          name: functionName,
          children: [
            {
              name: "subFunction1"
            },
            {
              name: "subFunction2",
              children: [
                {
                  name: functionName,
                  isRecursive: true
                }
              ]
            }
          ]
        };
    }
    
    res.json(data);
  } catch (error) {
    console.error('Fehler beim Abrufen der Callgraph-Daten:', error.message);
    res.status(500).json({ error: 'Interne Serverfehler' });
  }
});

// API-Route für Optimierungsvorschläge
app.get('/api/optimization-suggestions', (req, res) => {
  try {
    // Demo-Optimierungsvorschläge
    const suggestions = [
      {
        function_name: "calculateFactorial",
        language: "TypeScript",
        technique: "Memoization",
        performance_gain: 73,
        implementation_time: 3,
        solution_code: `function calculateFactorial(n, memo = {}) {
  if (n in memo) return memo[n];
  if (n <= 1) return 1;
  return memo[n] = n * calculateFactorial(n - 1, memo);
}`
      },
      {
        function_name: "processData",
        language: "JavaScript",
        technique: "Tail-Rekursion",
        performance_gain: 45,
        implementation_time: 7,
        solution_code: `function processData(data, results = []) {
  if (data.length === 0) return results;
  const [first, ...rest] = data;
  return processData(rest, [...results, transform(first)]);
}`
      },
      {
        function_name: "traverse_tree",
        language: "Python",
        technique: "Zyklus-Erkennung",
        performance_gain: 60,
        implementation_time: 5,
        solution_code: `def traverse_tree(node, visited=None):
    if visited is None:
        visited = set()
        
    if node is None or id(node) in visited:
        return []
        
    visited.add(id(node))
    
    results = [process_node(node)]
    
    for child in get_children(node):
        results.extend(traverse_tree(child, visited))
        
    return results`
      },
      {
        function_name: "mergeSort",
        language: "Python",
        technique: "Iterative Version",
        performance_gain: 62,
        implementation_time: 12,
        solution_code: `def merge_sort_iterative(arr):
    if len(arr) <= 1:
        return arr
        
    # Iterative bottom-up implementation
    size = 1
    while size < len(arr):
        for left in range(0, len(arr), 2*size):
            mid = min(left + size, len(arr))
            right = min(left + 2*size, len(arr))
            p = left
            q = mid
            temp = []
            
            # Merge subarrays
            while p < mid and q < right:
                if arr[p] <= arr[q]:
                    temp.append(arr[p])
                    p += 1
                else:
                    temp.append(arr[q])
                    q += 1
                    
            while p < mid:
                temp.append(arr[p])
                p += 1
                
            while q < right:
                temp.append(arr[q])
                q += 1
                
            # Copy back to original array
            for i in range(len(temp)):
                arr[left + i] = temp[i]
                
        size *= 2
        
    return arr`
      }
    ];
    
    res.json(suggestions);
  } catch (error) {
    console.error('Fehler beim Abrufen der Optimierungsvorschläge:', error.message);
    res.status(500).json({ error: 'Interne Serverfehler' });
  }
});

// API-Route für Aktivitätslog
app.get('/api/activity-log', (req, res) => {
  try {
    const historyDir = path.join(CLAUDE_DIR, 'history');
    let activities = [];
    
    if (fs.existsSync(historyDir)) {
      // Tatsächliche Aktivitäten aus den History-Dateien auslesen
      try {
        const historyFiles = fs.readdirSync(historyDir).filter(file => file.endsWith('.json'));
        
        // Neueste Dateien zuerst
        historyFiles.sort((a, b) => {
          const statA = fs.statSync(path.join(historyDir, a));
          const statB = fs.statSync(path.join(historyDir, b));
          return statB.mtime.getTime() - statA.mtime.getTime();
        });
        
        // Bis zu 10 neueste Aktivitäten verarbeiten
        for (let i = 0; i < Math.min(10, historyFiles.length); i++) {
          const file = historyFiles[i];
          const filePath = path.join(historyDir, file);
          
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Aktivität basierend auf dem Dateiinhalt erstellen
            const activity = {
              type: data.type || 'unknown',
              description: data.description || 'Unbekannte Aktivität',
              timestamp: data.timestamp || fs.statSync(filePath).mtime.toISOString(),
              user: data.user || 'System'
            };
            
            // Typ basierend auf Dateiinhalt bestimmen
            if (data.errors && data.errors.length > 0) {
              activity.type = 'error';
            } else if (data.warnings && data.warnings.length > 0) {
              activity.type = 'warning';
            } else if (data.fixes && data.fixes.length > 0) {
              activity.type = 'fix';
            } else if (data.type === 'setup' || data.type === 'initialization') {
              activity.type = 'setup';
            }
            
            activities.push(activity);
          } catch (error) {
            console.error(`Fehler beim Lesen der Aktivitätsdatei ${file}:`, error.message);
          }
        }
      } catch (error) {
        console.error('Fehler beim Lesen der Aktivitäten:', error.message);
      }
    }
    
    if (activities.length === 0) {
      // Demo-Aktivitäten zurückgeben, wenn keine echten vorhanden sind
      activities = [
        {
          type: 'fix',
          description: 'Problem behoben: Fakultäts-Funktion optimiert',
          timestamp: new Date().toISOString(),
          user: 'Jan S.'
        },
        {
          type: 'warning',
          description: 'Warnung: Neue rekursive Funktion erkannt',
          timestamp: new Date(Date.now() - 1000 * 60 * 73).toISOString(),
          user: 'Auto-Analyse'
        },
        {
          type: 'info',
          description: 'CI/CD: Pre-Commit-Hook aktiviert',
          timestamp: new Date(Date.now() - 1000 * 60 * 170).toISOString(),
          user: 'System'
        },
        {
          type: 'error',
          description: 'Kritisch: Stack Overflow in processData',
          timestamp: new Date(Date.now() - 1000 * 60 * 257).toISOString(),
          user: 'Runtime-Analyse'
        },
        {
          type: 'fix',
          description: 'Problem behoben: Tree-Traversierung optimiert',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
          user: 'Serhan K.'
        },
        {
          type: 'setup',
          description: 'Projekt-Setup abgeschlossen',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          user: 'System'
        }
      ];
    }
    
    res.json(activities);
  } catch (error) {
    console.error('Fehler beim Abrufen des Aktivitätslogs:', error.message);
    res.status(500).json({ error: 'Interne Serverfehler' });
  }
});

// Dashboard mit aktuellen Projektdaten integrieren
app.get('/dashboard.js', (req, res) => {
  // Dashboard-JavaScript mit dynamischen Daten
  const dashboardJs = `
  // Projektdaten
  const projectData = fetch('/api/project-info')
    .then(response => response.json())
    .then(data => {
      document.getElementById('projectName').textContent = data.project;
      document.getElementById('branchName').textContent = data.branch;
      document.getElementById('lastAnalysis').textContent = data.lastAnalysis;
      
      const statusElement = document.getElementById('status');
      statusElement.textContent = data.status.text;
      
      // Status-Farbe setzen
      if (data.status.code === 'error') {
        statusElement.className = 'ml-2 font-semibold text-red-500';
      } else if (data.status.code === 'warning') {
        statusElement.className = 'ml-2 font-semibold text-yellow-500';
      } else {
        statusElement.className = 'ml-2 font-semibold text-green-500';
      }
    })
    .catch(error => console.error('Fehler beim Laden der Projektdaten:', error));
  
  // Statistiken
  const statsData = fetch('/api/stats')
    .then(response => response.json())
    .then(data => {
      document.getElementById('analyzedFunctions').textContent = data.analyzedFunctions;
      document.getElementById('recursiveFunctions').textContent = data.recursiveFunctions;
      document.getElementById('optimizationPotential').textContent = data.optimizationPotential + '%';
      document.getElementById('fixedIssues').textContent = data.fixedIssues;
      
      // Prozentbalken aktualisieren
      document.querySelector('.progress-value').style.width = data.optimizationPotential + '%';
      
      // Sprachverteilung aktualisieren
      if (data.languages && Object.keys(data.languages).length > 0) {
        updateLanguageChart(data.languages);
      }
      
      // Änderungen anzeigen
      if (data.recentChanges) {
        if (data.recentChanges.analyzedFunctions) {
          const elem = document.querySelector('#analyzedFunctions + span');
          if (elem) elem.textContent = '+' + data.recentChanges.analyzedFunctions + ' heute';
        }
        
        if (data.recentChanges.fixedIssues) {
          const elem = document.querySelector('#fixedIssues + span');
          if (elem) elem.textContent = '+' + data.recentChanges.fixedIssues + ' heute';
        }
      }
    })
    .catch(error => console.error('Fehler beim Laden der Statistiken:', error));
  
  // Problematische Funktionen
  const problemsData = fetch('/api/problematic-functions')
    .then(response => response.json())
    .then(data => {
      updateProblematicFunctionsTable(data);
    })
    .catch(error => console.error('Fehler beim Laden der problematischen Funktionen:', error));
  
  // Aktualisiere die Problematischen Funktionen-Tabelle
  function updateProblematicFunctionsTable(functions) {
    if (!functions || functions.length === 0) return;
    
    const tableBody = document.querySelector('table tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = ''; // Tabelle leeren
    
    functions.forEach(func => {
      const row = document.createElement('tr');
      row.className = 'border-b border-gray-800 hover:bg-gray-800';
      
      // Funktion mit Rekursions-Indikator
      let indicatorColor = 'bg-orange-500';
      if (func.severity === 'high') indicatorColor = 'bg-red-500';
      else if (func.severity === 'medium') indicatorColor = 'bg-yellow-500';
      else if (func.severity === 'low') indicatorColor = 'bg-green-500';
      
      // Komplexitäts-Badge
      let complexityClass = 'bg-green-900 text-green-300';
      if (func.complexity > 15) complexityClass = 'bg-red-900 text-red-300';
      else if (func.complexity > 7) complexityClass = 'bg-yellow-900 text-yellow-300';
      
      // Problem-Text-Farbe
      let problemColor = 'text-orange-400';
      if (func.severity === 'high') problemColor = 'text-red-400';
      else if (func.severity === 'medium') problemColor = 'text-yellow-400';
      else if (func.severity === 'low') problemColor = 'text-green-400';
      
      row.innerHTML = \`
        <td class="py-3">
            <div class="flex items-center">
                <span class="recursive-indicator \${indicatorColor}"></span>
                <span>\${func.function_name}</span>
            </div>
        </td>
        <td class="py-3">\${func.language}</td>
        <td class="py-3 text-gray-400">\${func.file_path}</td>
        <td class="py-3">
            <span class="px-2 py-1 \${complexityClass} rounded-md text-xs">
                \${func.complexity > 15 ? 'Hoch' : func.complexity > 7 ? 'Mittel' : 'Niedrig'} 
                (\${func.complexity})
            </span>
        </td>
        <td class="py-3 \${problemColor}">\${func.description}</td>
      \`;
      
      tableBody.appendChild(row);
    });
  }
  
  // Aktualisiere das Sprach-Diagramm
  function updateLanguageChart(languages) {
    if (!languages || Object.keys(languages).length === 0) return;
    
    const languageNames = [];
    const languageCounts = [];
    
    // Bekannte Sprachen zuerst mit schönen Namen
    const knownLanguages = {
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      python: 'Python',
      java: 'Java',
      cpp: 'C++',
      csharp: 'C#',
      go: 'Go',
      rust: 'Rust'
    };
    
    // Bekannte Sprachen extrahieren
    Object.entries(knownLanguages).forEach(([key, name]) => {
      if (languages[key]) {
        languageNames.push(name);
        languageCounts.push(languages[key]);
        delete languages[key];
      }
    });
    
    // Restliche Sprachen hinzufügen
    Object.entries(languages).forEach(([lang, count]) => {
      languageNames.push(lang.charAt(0).toUpperCase() + lang.slice(1));
      languageCounts.push(count);
    });
    
    // Chart-Daten aktualisieren
    if (languageChart) {
      languageChart.data.labels = languageNames;
      languageChart.data.datasets[0].data = languageCounts;
      languageChart.update();
    }
  }
  
  // Optimierungsvorschläge laden
  fetch('/api/optimization-suggestions')
    .then(response => response.json())
    .then(data => {
      updateOptimizationSuggestions(data);
    })
    .catch(error => console.error('Fehler beim Laden der Optimierungsvorschläge:', error));
  
  // Optimierungsvorschläge aktualisieren
  function updateOptimizationSuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) return;
    
    const container = document.querySelector('.card:nth-of-type(2) > div');
    if (!container) return;
    
    container.innerHTML = ''; // Container leeren
    
    suggestions.forEach(suggestion => {
      const box = document.createElement('div');
      box.className = 'function-box p-3 mb-3';
      box.dataset.code = suggestion.solution_code;
      box.dataset.function = suggestion.function_name;
      
      box.innerHTML = \`
        <h3 class="font-semibold">\${suggestion.technique} für <span class="text-green-500">\${suggestion.function_name}</span></h3>
        <p class="text-gray-400 text-sm mb-2">Performance-Steigerung um \${suggestion.performance_gain}%</p>
        <div class="flex justify-between items-center">
            <span class="text-xs px-2 py-1 bg-gray-700 rounded-full">\${suggestion.implementation_time} Min. Umsetzung</span>
            <button class="text-green-500 hover:text-green-400 text-sm code-preview-btn">
                Code anzeigen
            </button>
        </div>
      \`;
      
      container.appendChild(box);
    });
    
    // Event-Listener für Code-Vorschau
    document.querySelectorAll('.code-preview-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const box = this.closest('.function-box');
        showCodePreview(box.dataset.function, box.dataset.code);
      });
    });
  }
  
  // Code-Vorschau anzeigen
  function showCodePreview(functionName, code) {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;
    
    tooltip.innerHTML = \`
      <div class="mb-2 font-semibold">Optimierte Lösung für \${functionName}:</div>
      <pre class="text-xs bg-gray-700 p-2 rounded-md">\${code}</pre>
    \`;
    
    // Positionierung in der Mitte des Bildschirms
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const tooltipWidth = 400; // Geschätzte Breite
    
    tooltip.style.left = \`\${(windowWidth - tooltipWidth) / 2}px\`;
    tooltip.style.top = \`\${windowHeight / 4}px\`;
    tooltip.style.opacity = 1;
    tooltip.style.width = \`\${tooltipWidth}px\`;
    
    // Schließen bei Klick außerhalb
    document.addEventListener('click', function closeTooltip(e) {
      if (!tooltip.contains(e.target)) {
        tooltip.style.opacity = 0;
        document.removeEventListener('click', closeTooltip);
      }
    });
  }
  
  // Aktivitätslog laden
  fetch('/api/activity-log')
    .then(response => response.json())
    .then(data => {
      updateActivityLog(data);
    })
    .catch(error => console.error('Fehler beim Laden des Aktivitätslogs:', error));
  
  // Aktivitätslog aktualisieren
  function updateActivityLog(activities) {
    if (!activities || activities.length === 0) return;
    
    const container = document.querySelector('.card:nth-of-type(3) > div');
    if (!container) return;
    
    container.innerHTML = ''; // Container leeren
    
    activities.forEach((activity, index) => {
      // Typ-spezifische Formatierung
      let borderColor = 'border-gray-500';
      let bgColor = 'bg-gray-500';
      
      if (activity.type === 'fix') {
        borderColor = 'border-green-500';
        bgColor = 'bg-green-500';
      } else if (activity.type === 'warning') {
        borderColor = 'border-yellow-500';
        bgColor = 'bg-yellow-500';
      } else if (activity.type === 'info') {
        borderColor = 'border-blue-500';
        bgColor = 'bg-blue-500';
      } else if (activity.type === 'error') {
        borderColor = 'border-red-500';
        bgColor = 'bg-red-500';
      }
      
      // Datum formatieren
      let formattedDate = 'unbekannt';
      try {
        const date = new Date(activity.timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
          formattedDate = 'Heute, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
          formattedDate = 'Gestern, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          formattedDate = date.toLocaleDateString() + ', ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      } catch (e) {
        console.error('Fehler beim Formatieren des Datums:', e);
      }
      
      const item = document.createElement('div');
      item.className = \`border-l-2 \${borderColor} pl-3 pb-5 relative\`;
      if (index === activities.length - 1) item.className = \`border-l-2 \${borderColor} pl-3 relative\`;
      
      item.innerHTML = \`
        <div class="absolute w-2 h-2 rounded-full \${bgColor}" style="left: -4.5px; top: 6px;"></div>
        <p class="text-sm text-gray-300 font-semibold">\${activity.description}</p>
        <p class="text-xs text-gray-500">\${formattedDate} - \${activity.user}</p>
      \`;
      
      container.appendChild(item);
    });
  }
  
  // Ereignis-Handler für UI-Elemente
  document.addEventListener('DOMContentLoaded', function() {
    // Aktualisieren-Button
    const refreshButton = document.getElementById('refreshButton');
    if (refreshButton) {
      refreshButton.addEventListener('click', function() {
        window.location.reload();
      });
    }
    
    // Einstellungen-Button
    const settingsButton = document.getElementById('settingsButton');
    if (settingsButton) {
      settingsButton.addEventListener('click', function() {
        alert('Einstellungen werden in einer zukünftigen Version verfügbar sein.');
      });
    }
  });
  `;
  
  res.type('application/javascript').send(dashboardJs);
});

// API-Route für das Starten einer Analyse
app.post('/api/analyze', (req, res) => {
  const options = req.body || {};
  
  try {
    // Pfad zu debug_workflow_engine.js
    const debugWorkflowPath = path.join(__dirname, '..', 'debug_workflow_engine.js');
    
    if (fs.existsSync(debugWorkflowPath)) {
      // Kommando zusammenstellen
      let cmd = `node "${debugWorkflowPath}" run`;
      
      // Workflow-Typ
      if (options.type) {
        cmd += ` ${options.type}`;
      } else {
        cmd += ' deep';
      }
      
      // Dateipfad
      if (options.file) {
        cmd += ` --file "${options.file}"`;
      } else if (options.directory) {
        cmd += ` --directory "${options.directory}"`;
      } else {
        cmd += ` --directory "${PROJECT_ROOT}"`;
      }
      
      // Weitere Optionen
      if (options.save) {
        cmd += ' --save';
      }
      
      // Outputformat
      cmd += ' --output json';
      
      // Analyse im Hintergrund ausführen
      const child = require('child_process').exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`Fehler bei der Analyse: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`Fehler-Ausgabe: ${stderr}`);
          return;
        }
        console.log(`Analyse abgeschlossen: ${stdout}`);
      });
      
      res.json({
        success: true,
        message: 'Analyse gestartet',
        pid: child.pid
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Debugging-Engine nicht gefunden',
        path: debugWorkflowPath
      });
    }
  } catch (error) {
    console.error('Fehler beim Starten der Analyse:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Fehler beim Starten der Analyse',
      error: error.message 
    });
  }
});

// Server starten
app.listen(PORT, () => {
  console.log(`Dashboard-Server läuft auf Port ${PORT}`);
  console.log(`Dashboard verfügbar unter: http://localhost:${PORT}`);
  console.log(`Projektverzeichnis: ${PROJECT_ROOT}`);
});
