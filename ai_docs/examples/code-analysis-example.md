# Code Analysis Example: Dependency Graph Generation

This example demonstrates how to use Claude Code to analyze a project's dependency structure and generate a visualization of module relationships.

## Use Case

Understanding complex codebases often requires visualizing how different modules and components interact. This example shows how Claude Code can:

1. Parse a project's structure
2. Identify import/require statements and module dependencies
3. Generate a directed graph representation
4. Visualize the result

## Implementation

### Step 1: Initialize the analysis

```typescript
// dependency-analyzer.ts
import * as fs from 'fs';
import * as path from 'path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

interface DependencyNode {
  id: string;
  path: string;
  dependencies: string[];
}

interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  addNode(id: string, filePath: string): void;
  addDependency(sourceId: string, targetId: string): void;
  toJSON(): Record<string, any>;
}

class ProjectDependencyGraph implements DependencyGraph {
  nodes: Map<string, DependencyNode> = new Map();
  
  addNode(id: string, filePath: string): void {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        id,
        path: filePath,
        dependencies: []
      });
    }
  }
  
  addDependency(sourceId: string, targetId: string): void {
    const sourceNode = this.nodes.get(sourceId);
    if (sourceNode && !sourceNode.dependencies.includes(targetId)) {
      sourceNode.dependencies.push(targetId);
    }
  }
  
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
}
```

### Step 2: File parsing and dependency extraction

```typescript
// analyzer-core.ts
function parseFile(filePath: string, graph: DependencyGraph): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath);
  const moduleId = path.basename(filePath, ext);
  
  graph.addNode(moduleId, filePath);
  
  // Parse the file with appropriate configuration based on extension
  const ast = parser.parse(content, {
    sourceType: 'module',
    plugins: [
      'jsx',
      'typescript',
      'classProperties',
      'decorators-legacy'
    ]
  });
  
  // Traverse the AST and find all imports/requires
  traverse(ast, {
    ImportDeclaration({ node }) {
      const importPath = node.source.value;
      if (!importPath.startsWith('.')) return; // Skip external modules
      
      const resolvedPath = path.resolve(path.dirname(filePath), importPath);
      const importedModuleId = path.basename(
        importPath.endsWith('.ts') || importPath.endsWith('.js') 
          ? importPath 
          : `${importPath}.ts`
      );
      
      graph.addDependency(moduleId, importedModuleId);
    },
    
    CallExpression({ node }) {
      if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
        if (node.arguments.length && node.arguments[0].type === 'StringLiteral') {
          const importPath = node.arguments[0].value;
          if (!importPath.startsWith('.')) return; // Skip external modules
          
          const importedModuleId = path.basename(importPath);
          graph.addDependency(moduleId, importedModuleId);
        }
      }
    }
  });
}
```

### Step 3: Project scanning and visualization

```typescript
// visualize-dependencies.ts
import * as d3 from 'd3';
import { glob } from 'glob';

async function analyzeDependencies(rootDir: string): Promise<DependencyGraph> {
  const graph = new ProjectDependencyGraph();
  const files = await glob('**/*.{ts,js,tsx,jsx}', { cwd: rootDir, ignore: ['node_modules/**', 'dist/**'] });
  
  for (const file of files) {
    const filePath = path.join(rootDir, file);
    parseFile(filePath, graph);
  }
  
  return graph;
}

function generateVisualization(graph: DependencyGraph, outputPath: string): void {
  const data = graph.toJSON();
  
  // Generate an HTML file with D3 visualization
  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Project Dependency Graph</title>
      <script src="https://d3js.org/d3.v7.min.js"></script>
      <style>
        body { margin: 0; font-family: Arial, sans-serif; }
        .links line { stroke: #999; stroke-opacity: 0.6; }
        .nodes circle { stroke: #fff; stroke-width: 1.5px; }
        .node-label { font-size: 10px; }
      </style>
    </head>
    <body>
      <svg width="1200" height="800"></svg>
      <script>
        const data = ${JSON.stringify(data)};
        
        const svg = d3.select("svg");
        const width = +svg.attr("width");
        const height = +svg.attr("height");
        
        const simulation = d3.forceSimulation(data.nodes)
          .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
          .force("charge", d3.forceManyBody().strength(-300))
          .force("center", d3.forceCenter(width / 2, height / 2));
          
        const link = svg.append("g")
          .attr("class", "links")
          .selectAll("line")
          .data(data.links)
          .enter().append("line");
          
        const node = svg.append("g")
          .attr("class", "nodes")
          .selectAll("g")
          .data(data.nodes)
          .enter().append("g");
          
        node.append("circle")
          .attr("r", 5)
          .attr("fill", d => d3.schemeCategory10[d.id.length % 10]);
          
        node.append("text")
          .attr("class", "node-label")
          .attr("dx", 8)
          .attr("dy", ".35em")
          .text(d => d.id);
          
        node.append("title")
          .text(d => d.path);
          
        simulation.on("tick", () => {
          link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
            
          node.attr("transform", d => `translate(${d.x},${d.y})`);
        });
      </script>
    </body>
  </html>
  `;
  
  fs.writeFileSync(outputPath, html);
}

// Usage
const projectRoot = process.argv[2] || './src';
const outputFile = process.argv[3] || './dependency-graph.html';

analyzeDependencies(projectRoot)
  .then(graph => {
    generateVisualization(graph, outputFile);
    console.log(`Dependency graph generated at: ${outputFile}`);
  })
  .catch(error => {
    console.error('Error analyzing dependencies:', error);
  });
```

## Usage Example

To analyze a project's dependencies:

```bash
# Install dependencies
npm install @babel/parser @babel/traverse glob d3

# Run the analysis
npx ts-node visualize-dependencies.ts ./path/to/project ./output-graph.html
```

## Outcome

The generated HTML file will contain an interactive visualization of your project's module dependencies, where:

- Each node represents a module/file
- Edges represent import/require relationships
- Hovering over nodes shows the full file path
- The graph uses force-directed layout for optimal viewing

This visualization helps identify:
- Core modules with many dependents
- Circular dependencies
- Isolated or unused modules
- Natural boundaries for refactoring or modularization

## Extensions

This basic implementation can be extended with:
1. Different colors for different types of files
2. Node size based on complexity metrics
3. Edge thickness based on the number of imports
4. Filtering capabilities for large projects
5. Integration with CI/CD to track dependency changes over time
