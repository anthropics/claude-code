# Abhängigkeitsgraph-Analyse für Codeprojekte

<metadata>
version: 1.1.0
author: Claude Neural Framework
last_updated: 2025-05-11
category: code_analysis
complexity: Intermediate
languages: TypeScript, JavaScript
</metadata>

## Anwendungsfall

Das Verständnis komplexer Codebasen erfordert oft die Visualisierung, wie verschiedene Module und Komponenten interagieren. Dieses Beispiel zeigt, wie das Claude Neural Framework zur Analyse von Projektabhängigkeiten eingesetzt werden kann:

1. Parsen der Projektstruktur
2. Identifizierung von Import-/Require-Anweisungen und Modulabhängigkeiten
3. Generierung einer gerichteten Graphdarstellung
4. Visualisierung des Ergebnisses mit interaktiven Elementen

## Architekturübersicht

Das System besteht aus drei Hauptkomponenten:

1. **Datenmodell** (`DependencyGraph`): Repräsentiert die Modulbeziehungen
2. **Parser** (`parseFile`): Extrahiert Abhängigkeiten aus einzelnen Dateien
3. **Visualisierer** (`generateVisualization`): Erstellt eine interaktive HTML-Darstellung

![Architekturdiagramm](https://example.com/dependency-analyzer-architecture.png)

## Implementierung

### 1. Initialisierung der Analyse

```typescript
// dependency_graph.ts
import * as fs from 'fs';
import * as path from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * Repräsentiert einen Knoten im Abhängigkeitsgraphen (eine Moduldatei)
 */
interface DependencyNode {
  id: string;           // Eindeutiger Bezeichner (normalerweise Dateiname ohne Erweiterung)
  path: string;         // Vollständiger Dateipfad
  dependencies: string[]; // IDs der Module, von denen dieses Modul abhängt
}

/**
 * Interface für den Abhängigkeitsgraphen
 */
interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  addNode(id: string, filePath: string): void;
  addDependency(sourceId: string, targetId: string): void;
  toJSON(): Record<string, any>;
}

/**
 * Implementierung des Abhängigkeitsgraphen
 */
export class ProjectDependencyGraph implements DependencyGraph {
  nodes: Map<string, DependencyNode> = new Map();
  
  /**
   * Fügt einen neuen Knoten zum Graphen hinzu, wenn er noch nicht existiert
   */
  addNode(id: string, filePath: string): void {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        id,
        path: filePath,
        dependencies: []
      });
    }
  }
  
  /**
   * Registriert eine Abhängigkeit zwischen zwei Modulen
   */
  addDependency(sourceId: string, targetId: string): void {
    const sourceNode = this.nodes.get(sourceId);
    if (sourceNode && !sourceNode.dependencies.includes(targetId)) {
      sourceNode.dependencies.push(targetId);
    }
  }
  
  /**
   * Konvertiert den Graphen in ein JSON-Format für die Visualisierung
   */
  toJSON(): Record<string, any> {
    const nodes = Array.from(this.nodes.values()).map(node => ({
      id: node.id,
      path: node.path
    }));
    
    const links = Array.from(this.nodes.values()).flatMap(node => 
      node.dependencies.map(target => ({
        source: node.id,
        target
      }))
    );
    
    return { nodes, links };
  }
  
  /**
   * Identifiziert zirkuläre Abhängigkeiten im Graphen
   */
  findCircularDependencies(): string[][] {
    const result: string[][] = [];
    const visited = new Set<string>();
    const path: string[] = [];
    
    const dfs = (nodeId: string) => {
      if (path.includes(nodeId)) {
        const cycle = [...path.slice(path.indexOf(nodeId)), nodeId];
        result.push(cycle);
        return;
      }
      
      if (visited.has(nodeId)) return;
      
      visited.add(nodeId);
      path.push(nodeId);
      
      const node = this.nodes.get(nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          dfs(dep);
        }
      }
      
      path.pop();
    };
    
    for (const nodeId of this.nodes.keys()) {
      dfs(nodeId);
    }
    
    return result;
  }
}
```

### 2. Dateianalyse und Abhängigkeitsextraktion

```typescript
// dependency_parser.ts
import * as fs from 'fs';
import * as path from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { DependencyGraph } from './dependency_graph';

/**
 * Analysiert eine einzelne Datei und extrahiert Abhängigkeiten
 */
export function parseFile(filePath: string, graph: DependencyGraph): void {
  try {
    // Dateiinhalt lesen
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath);
    const moduleId = path.basename(filePath, ext);
    
    // Modul zum Graphen hinzufügen
    graph.addNode(moduleId, filePath);
    
    // AST der Datei generieren mit passender Konfiguration
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'classProperties',
        'decorators-legacy'
      ]
    });
    
    // AST durchlaufen und alle Imports/Requires finden
    traverse(ast, {
      // ES Module Import-Statements (import x from 'y')
      ImportDeclaration({ node }) {
        const importPath = node.source.value;
        
        // Externe Module überspringen
        if (!importPath.startsWith('.')) return;
        
        const resolvedPath = path.resolve(path.dirname(filePath), importPath);
        const importedModuleId = path.basename(
          importPath.endsWith('.ts') || importPath.endsWith('.js') 
            ? importPath 
            : `${importPath}.ts`
        );
        
        graph.addDependency(moduleId, importedModuleId);
      },
      
      // CommonJS require()-Aufrufe
      CallExpression({ node }) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
          if (node.arguments.length && node.arguments[0].type === 'StringLiteral') {
            const importPath = node.arguments[0].value;
            
            // Externe Module überspringen
            if (!importPath.startsWith('.')) return;
            
            const importedModuleId = path.basename(importPath);
            graph.addDependency(moduleId, importedModuleId);
          }
        }
      }
    });
  } catch (error) {
    console.error(`Fehler beim Parsen von ${filePath}:`, error);
  }
}
```

### 3. Projektanalyse und Visualisierung

```typescript
// dependency_visualizer.ts
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { ProjectDependencyGraph } from './dependency_graph';
import { parseFile } from './dependency_parser';

/**
 * Analysiert ein gesamtes Projektverzeichnis und generiert einen Abhängigkeitsgraphen
 */
export async function analyzeDependencies(rootDir: string): Promise<ProjectDependencyGraph> {
  const graph = new ProjectDependencyGraph();
  
  // Alle relevanten Dateien im Projekt finden
  const files = await glob('**/*.{ts,js,tsx,jsx}', { 
    cwd: rootDir, 
    ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**'] 
  });
  
  console.log(`Analysiere ${files.length} Dateien in ${rootDir}...`);
  
  // Jede Datei parsen
  for (const file of files) {
    const filePath = path.join(rootDir, file);
    parseFile(filePath, graph);
  }
  
  // Prüfen auf zirkuläre Abhängigkeiten
  const cycles = graph.findCircularDependencies();
  if (cycles.length > 0) {
    console.warn(`⚠️ ${cycles.length} zirkuläre Abhängigkeiten gefunden:`);
    cycles.forEach(cycle => {
      console.warn(`  ${cycle.join(' → ')} → ${cycle[0]}`);
    });
  }
  
  return graph;
}

/**
 * Generiert eine interaktive HTML-Visualisierung des Abhängigkeitsgraphen
 */
export function generateVisualization(graph: ProjectDependencyGraph, outputPath: string): void {
  const data = graph.toJSON();
  
  // HTML-Datei mit D3-Visualisierung generieren
  const html = `
  <!DOCTYPE html>
  <html lang="de">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Projekt-Abhängigkeitsgraph</title>
      <script src="https://d3js.org/d3.v7.min.js"></script>
      <style>
        body { 
          margin: 0; 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #f8f9fa;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        
        h1 {
          color: #333;
          text-align: center;
          margin-bottom: 30px;
        }
        
        .controls {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
          gap: 15px;
        }
        
        button {
          padding: 8px 15px;
          background-color: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        button:hover {
          background-color: #45a049;
        }
        
        #search {
          padding: 8px;
          width: 250px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .graph-container {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        
        svg {
          display: block;
          width: 100%;
          height: 800px;
        }
        
        .links line {
          stroke: #999;
          stroke-opacity: 0.6;
          stroke-width: 1.5px;
        }
        
        .nodes circle {
          stroke: #fff;
          stroke-width: 2px;
        }
        
        .node-label {
          font-size: 10px;
          fill: #333;
        }
        
        .node-highlighted circle {
          stroke: #ff0000;
          stroke-width: 3px;
        }
        
        .link-highlighted {
          stroke: #ff0000 !important;
          stroke-width: 3px !important;
          stroke-opacity: 1 !important;
        }
        
        .info-panel {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 300px;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          padding: 15px;
          font-size: 14px;
          display: none;
        }
        
        .info-panel h3 {
          margin-top: 0;
          border-bottom: 1px solid #ddd;
          padding-bottom: 8px;
        }
        
        .info-title {
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .info-value {
          margin-bottom: 15px;
          word-break: break-all;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Projekt-Abhängigkeitsgraph</h1>
        
        <div class="controls">
          <input type="text" id="search" placeholder="Nach Modul suchen...">
          <button id="reset">Ansicht zurücksetzen</button>
          <button id="center">Zentrieren</button>
          <button id="toggle-labels">Labels ein/aus</button>
        </div>
        
        <div class="graph-container">
          <svg id="dependency-graph"></svg>
        </div>
        
        <div class="info-panel" id="info-panel">
          <h3>Modulinformationen</h3>
          <div class="info-title">Modul-ID:</div>
          <div class="info-value" id="info-id"></div>
          <div class="info-title">Dateipfad:</div>
          <div class="info-value" id="info-path"></div>
          <div class="info-title">Abhängigkeiten:</div>
          <div class="info-value" id="info-dependencies"></div>
          <div class="info-title">Abhängig von:</div>
          <div class="info-value" id="info-dependents"></div>
        </div>
      </div>
      
      <script>
        // Daten aus der Analyse
        const data = ${JSON.stringify(data)};
        
        // Berechnung der abhängigen Module (invers zu dependencies)
        const dependents = {};
        data.links.forEach(link => {
          if (!dependents[link.target]) {
            dependents[link.target] = [];
          }
          dependents[link.target].push(link.source);
        });
        
        // D3 Visualisierung einrichten
        const svg = d3.select("#dependency-graph");
        const width = svg.node().getBoundingClientRect().width;
        const height = +svg.attr("height") || 800;
        
        const color = d3.scaleOrdinal(d3.schemeCategory10);
        
        // Berechnungen für Knotengröße basierend auf Anzahl der Abhängigkeiten
        const dependencyCount = {};
        data.nodes.forEach(node => {
          dependencyCount[node.id] = 0;
        });
        
        data.links.forEach(link => {
          dependencyCount[link.source] = (dependencyCount[link.source] || 0) + 1;
          dependencyCount[link.target] = (dependencyCount[link.target] || 0) + 1;
        });
        
        const nodeSizeScale = d3.scaleLinear()
          .domain([0, d3.max(Object.values(dependencyCount))])
          .range([5, 15]);
        
        // Force-Simulation einrichten
        const simulation = d3.forceSimulation(data.nodes)
          .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
          .force("charge", d3.forceManyBody().strength(-300))
          .force("center", d3.forceCenter(width / 2, height / 2))
          .force("collision", d3.forceCollide().radius(d => nodeSizeScale(dependencyCount[d.id] || 0) + 5));
        
        // Zoom-Verhalten
        const zoom = d3.zoom()
          .scaleExtent([0.1, 8])
          .on("zoom", (event) => {
            g.attr("transform", event.transform);
          });
        
        svg.call(zoom);
        
        const g = svg.append("g");
        
        // Links (Verbindungen zwischen Knoten) zeichnen
        const link = g.append("g")
          .attr("class", "links")
          .selectAll("line")
          .data(data.links)
          .enter().append("line");
        
        // Knoten erstellen
        const node = g.append("g")
          .attr("class", "nodes")
          .selectAll("g")
          .data(data.nodes)
          .enter().append("g")
          .attr("class", "node")
          .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));
        
        // Kreise für die Knoten
        node.append("circle")
          .attr("r", d => nodeSizeScale(dependencyCount[d.id] || 0))
          .attr("fill", d => color(d.id.length % 10));
        
        // Textlabels für die Knoten
        const labels = node.append("text")
          .attr("class", "node-label")
          .attr("dx", d => nodeSizeScale(dependencyCount[d.id] || 0) + 3)
          .attr("dy", ".35em")
          .text(d => d.id);
        
        // Tooltip-Titel beim Hover
        node.append("title")
          .text(d => d.path);
        
        // Interaktivität
        node.on("click", showNodeInfo);
        
        // Simulation aktualisieren
        simulation.on("tick", () => {
          link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
            
          node.attr("transform", d => \`translate(\${d.x},\${d.y})\`);
        });
        
        // Suchfunktionalität
        document.getElementById("search").addEventListener("input", searchNodes);
        
        // Steuerelemente
        document.getElementById("reset").addEventListener("click", resetView);
        document.getElementById("center").addEventListener("click", centerView);
        document.getElementById("toggle-labels").addEventListener("click", toggleLabels);
        
        // Drag-Funktionen
        function dragstarted(event, d) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        }
        
        function dragged(event, d) {
          d.fx = event.x;
          d.fy = event.y;
        }
        
        function dragended(event, d) {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }
        
        // Info-Panel mit Moduldetails anzeigen
        function showNodeInfo(event, d) {
          // Hervorhebung zurücksetzen
          d3.selectAll(".node-highlighted").classed("node-highlighted", false);
          d3.selectAll(".link-highlighted").classed("link-highlighted", false);
          
          // Aktuellen Knoten hervorheben
          d3.select(this).classed("node-highlighted", true);
          
          // Abhängigkeitslinks hervorheben
          link.classed("link-highlighted", l => 
            (l.source.id === d.id || l.target.id === d.id)
          );
          
          // Info-Panel aktualisieren und anzeigen
          document.getElementById("info-id").textContent = d.id;
          document.getElementById("info-path").textContent = d.path;
          
          // Abhängigkeiten anzeigen
          const deps = data.links
            .filter(l => l.source.id === d.id)
            .map(l => l.target.id);
          document.getElementById("info-dependencies").textContent = 
            deps.length > 0 ? deps.join(", ") : "Keine";
          
          // Abhängig von anzeigen
          const depBy = dependents[d.id] || [];
          document.getElementById("info-dependents").textContent = 
            depBy.length > 0 ? depBy.join(", ") : "Keine";
          
          // Panel anzeigen
          document.getElementById("info-panel").style.display = "block";
        }
        
        // Nach Knoten suchen
        function searchNodes() {
          const searchTerm = document.getElementById("search").value.toLowerCase();
          
          if (searchTerm === "") {
            // Alle Knoten normal anzeigen
            node.classed("node-highlighted", false);
            link.classed("link-highlighted", false);
            return;
          }
          
          // Passende Knoten finden
          const matchingNodes = data.nodes.filter(n => 
            n.id.toLowerCase().includes(searchTerm) || 
            n.path.toLowerCase().includes(searchTerm)
          );
          
          if (matchingNodes.length > 0) {
            // Passende Knoten hervorheben
            node.classed("node-highlighted", d => 
              matchingNodes.some(n => n.id === d.id)
            );
            
            // Links zu/von passenden Knoten hervorheben
            link.classed("link-highlighted", l => 
              matchingNodes.some(n => n.id === l.source.id || n.id === l.target.id)
            );
            
            // Auf den ersten passenden Knoten zoomen
            const firstMatch = matchingNodes[0];
            zoomToNode(firstMatch);
          }
        }
        
        // Auf einen Knoten zoomen
        function zoomToNode(d) {
          const scale = 2;
          const transform = d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(scale)
            .translate(-d.x, -d.y);
          
          svg.transition().duration(750).call(zoom.transform, transform);
        }
        
        // Ansicht zurücksetzen
        function resetView() {
          svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity.translate(width / 2, height / 2).scale(1)
          );
          
          d3.selectAll(".node-highlighted").classed("node-highlighted", false);
          d3.selectAll(".link-highlighted").classed("link-highlighted", false);
          document.getElementById("info-panel").style.display = "none";
          document.getElementById("search").value = "";
        }
        
        // Ansicht zentrieren
        function centerView() {
          svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity.translate(width / 2, height / 2).scale(1)
          );
        }
        
        // Labels ein-/ausblenden
        function toggleLabels() {
          const labelsVisible = labels.style("opacity") !== "0";
          labels.style("opacity", labelsVisible ? 0 : 1);
        }
        
        // Initial zentrieren
        centerView();
      </script>
    </body>
  </html>
  `;
  
  fs.writeFileSync(outputPath, html);
  console.log(`✅ Abhängigkeitsgraph generiert unter: ${outputPath}`);
}
```

### 4. Hauptanwendungsmodul

```typescript
// index.ts
import * as path from 'path';
import { analyzeDependencies, generateVisualization } from './dependency_visualizer';

async function main() {
  // Projektverzeichnis und Ausgabedatei aus Befehlszeilenargumenten oder Standardwerten
  const projectRoot = process.argv[2] || './src';
  const outputFile = process.argv[3] || './dependency-graph.html';
  
  try {
    console.log(`📊 Abhängigkeitsanalyse für ${projectRoot} wird gestartet...`);
    
    // Projektabhängigkeiten analysieren
    const graph = await analyzeDependencies(projectRoot);
    
    // Statistiken ausgeben
    const nodeCount = graph.nodes.size;
    const linkCount = Object.values(Array.from(graph.nodes.values()))
      .reduce((sum, node) => sum + node.dependencies.length, 0);
    
    console.log(`📈 Analyse abgeschlossen:`);
    console.log(`  - ${nodeCount} Module gefunden`);
    console.log(`  - ${linkCount} Abhängigkeiten identifiziert`);
    
    // Ergebnisse visualisieren
    generateVisualization(graph, outputFile);
    
    console.log(`🔗 Öffne ${outputFile} im Browser, um den Abhängigkeitsgraphen zu erkunden.`);
  } catch (error) {
    console.error('❌ Fehler bei der Abhängigkeitsanalyse:', error);
    process.exit(1);
  }
}

// Programm ausführen
main();
```

## Verwendung

Um die Abhängigkeiten eines Projekts zu analysieren:

```bash
# Abhängigkeiten installieren
npm install @babel/parser @babel/traverse glob d3

# TypeScript kompilieren (wenn .ts-Dateien verwendet werden)
npx tsc

# Analyse ausführen
node dist/index.js ./pfad/zum/projekt ./ausgabe-graph.html

# Oder direkt mit ts-node
npx ts-node src/index.ts ./pfad/zum/projekt ./ausgabe-graph.html
```

## Ergebnis

Die generierte HTML-Datei enthält eine interaktive Visualisierung der Modulabhängigkeiten des Projekts:

- Knoten repräsentieren Module/Dateien
- Verbindungen repräsentieren Import-/Require-Beziehungen
- Die Größe der Knoten basiert auf der Anzahl ihrer Verbindungen
- Farben werden basierend auf dem Modulnamen zugewiesen
- Hover über Knoten zeigt den vollständigen Dateipfad
- Klick auf einen Knoten zeigt detaillierte Informationen
- Suchfunktion zum Finden bestimmter Module
- Zoom- und Pan-Funktionalität für große Graphen

Diese Visualisierung hilft bei der Identifizierung von:
- Kernmodulen mit vielen Abhängigkeiten
- Zirkulären Abhängigkeiten (die im Code auch explizit erkannt werden)
- Isolierten oder ungenutzten Modulen
- Natürlichen Grenzen für Refactoring oder Modularisierung

## Erweiterungsmöglichkeiten

Die Basisimplementierung kann erweitert werden mit:

1. **Metriken-Integration**: Codequalitäts- oder Komplexitätsmetriken in die Visualisierung einbinden
2. **Gruppierung nach Verzeichnissen**: Module nach ihrer Verzeichnisstruktur hierarchisch gruppieren
3. **Dynamisches Filtern**: UI-Elemente zur Filterung nach Dateityp, Verzeichnis oder Abhängigkeitsgrad
4. **Exportformate**: Unterstützung für andere Ausgabeformate wie JSON, GraphML oder SVG
5. **CI/CD-Integration**: Automatische Generierung von Abhängigkeitsgraphen bei jedem Build
6. **Historische Analyse**: Tracking von Abhängigkeitsänderungen im Zeitverlauf
7. **Empfehlungen**: Automatische Identifikation von Möglichkeiten zur Codeorganisation

## Technologische Herausforderungen

Bei der Implementierung dieses Tools sind einige Herausforderungen zu beachten:

1. **Auflösung relativer Importe**: Die korrekte Auflösung von relativen Importpfaden kann komplex sein, insbesondere bei Aliassen oder benutzerdefinierten Webpack-Konfigurationen.
2. **Skalierbarkeit**: Bei sehr großen Projekten kann die Visualisierung unübersichtlich werden; hierarchische Ansichten oder Clustering können helfen.
3. **Sprachunterstützung**: Die aktuelle Implementierung fokussiert sich auf JavaScript/TypeScript; für andere Sprachen wären zusätzliche Parser erforderlich.
4. **Dynamische Imports**: Bei dynamischen Imports oder Require-Aufrufen mit Variablen ist die statische Analyse begrenzt.

## Ressourcen

- [AST Explorer](https://astexplorer.net/) - Tool zum Experimentieren mit dem JavaScript/TypeScript AST
- [D3.js Dokumentation](https://d3js.org/getting-started) - Ressourcen zur Visualisierungsanpassung
- [Babel Parser Dokumentation](https://babeljs.io/docs/babel-parser) - Details zur AST-Generierung
