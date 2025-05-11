/**
 * Rekursions-Dashboard für Debugging und Visualisierung
 * ====================================================
 * 
 * Ein interaktives Dashboard zur Visualisierung und Analyse von
 * rekursiven Datenstrukturen, Callstacks und Optimierungspotenzialen.
 * 
 * Verwendet React, D3.js und TailwindCSS für eine moderne UI.
 */

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import {
  Tabs, TabList, Tab, TabPanel,
  Card, CardContent, CardHeader, CardTitle,
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
  Button, Select, Switch, Badge, Progress
} from './ui-components';
import {
  Code, GitBranch, GitMerge, FileCode, AlertTriangle,
  BrainCircuit, Lightning, Sparkles, BarChart2, 
  Zap, Clipboard, ArrowDownUp, RefreshCcw
} from 'lucide-react';

// Mock-Daten (in realer App würden diese vom Backend kommen)
const MOCK_RECURSIVE_FUNCTIONS = [
  {
    id: 'func1',
    name: 'fibonacci',
    language: 'javascript',
    file: 'algorithms/fibonacci.js',
    calls: 12580,
    depth: 21,
    complexity: 8,
    isOptimized: false,
    issues: ['no_memoization', 'deep_recursion'],
    code: `function fibonacci(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`
  },
  {
    id: 'func2',
    name: 'traverse',
    language: 'python',
    file: 'utils/tree_traversal.py',
    calls: 876,
    depth: 15,
    complexity: 5,
    isOptimized: false,
    issues: ['no_cycle_detection'],
    code: `def traverse(node):
    if node is None:
        return
    process(node.data)
    traverse(node.left)
    traverse(node.right)`
  },
  {
    id: 'func3',
    name: 'quicksort',
    language: 'javascript',
    file: 'algorithms/sorting.js',
    calls: 430,
    depth: 9,
    complexity: 7,
    isOptimized: true,
    issues: [],
    code: `function quicksort(arr) {
  if (arr.length <= 1) return arr;
  
  const pivot = arr[0];
  const left = [];
  const right = [];
  
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < pivot) left.push(arr[i]);
    else right.push(arr[i]);
  }
  
  return [...quicksort(left), pivot, ...quicksort(right)];
}`
  },
  {
    id: 'func4',
    name: 'calculateFactorial',
    language: 'typescript',
    file: 'math/factorial.ts',
    calls: 50,
    depth: 6,
    complexity: 3,
    isOptimized: true,
    issues: [],
    code: `function calculateFactorial(n: number, memo: Record<number, number> = {}): number {
  if (n <= 1) return 1;
  if (memo[n]) return memo[n];
  
  memo[n] = n * calculateFactorial(n - 1, memo);
  return memo[n];
}`
  },
  {
    id: 'func5',
    name: 'deepClone',
    language: 'javascript',
    file: 'utils/object_utils.js',
    calls: 320,
    depth: 12,
    complexity: 9,
    isOptimized: false,
    issues: ['circular_reference', 'deep_recursion'],
    code: `function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  let clone = Array.isArray(obj) ? [] : {};
  
  for (let key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = deepClone(obj[key]);
    }
  }
  
  return clone;
}`
  }
];

const MOCK_CALLGRAPH_DATA = {
  nodes: [
    { id: 'main', name: 'main', type: 'entry', color: '#4ade80' },
    { id: 'fibonacci', name: 'fibonacci', type: 'recursive', color: '#f87171' },
    { id: 'traverse', name: 'traverse', type: 'recursive', color: '#f87171' },
    { id: 'quicksort', name: 'quicksort', type: 'recursive', color: '#f87171' },
    { id: 'calculateFactorial', name: 'calculateFactorial', type: 'recursive', color: '#60a5fa' },
    { id: 'deepClone', name: 'deepClone', type: 'recursive', color: '#f87171' },
    { id: 'process', name: 'process', type: 'normal', color: '#a3a3a3' },
    { id: 'helper', name: 'helper', type: 'normal', color: '#a3a3a3' }
  ],
  links: [
    { source: 'main', target: 'fibonacci', value: 10 },
    { source: 'main', target: 'traverse', value: 5 },
    { source: 'main', target: 'quicksort', value: 8 },
    { source: 'main', target: 'deepClone', value: 7 },
    { source: 'fibonacci', target: 'fibonacci', value: 15 },
    { source: 'traverse', target: 'process', value: 4 },
    { source: 'traverse', target: 'traverse', value: 12 },
    { source: 'quicksort', target: 'quicksort', value: 9 },
    { source: 'deepClone', target: 'deepClone', value: 11 },
    { source: 'helper', target: 'calculateFactorial', value: 6 },
    { source: 'calculateFactorial', target: 'calculateFactorial', value: 7 }
  ]
};

const MOCK_PERFORMANCE_DATA = [
  { name: 'fibonacci', original: 2580, optimized: 12 },
  { name: 'traverse', original: 876, optimized: 876 },
  { name: 'quicksort', original: 430, optimized: 180 },
  { name: 'calculateFactorial', original: 120, optimized: 50 },
  { name: 'deepClone', original: 320, optimized: 90 }
];

// Hauptkomponente
function RecursiveDashboard() {
  const [functions, setFunctions] = useState(MOCK_RECURSIVE_FUNCTIONS);
  const [callgraphData, setCallgraphData] = useState(MOCK_CALLGRAPH_DATA);
  const [performanceData, setPerformanceData] = useState(MOCK_PERFORMANCE_DATA);
  const [selectedFunction, setSelectedFunction] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [filter, setFilter] = useState('all');
  
  const svgRef = useRef();
  
  // Funktion auswählen
  const selectFunction = (func) => {
    setSelectedFunction(func);
    setActiveTab('details');
  };
  
  // D3.js Callgraph rendern
  useEffect(() => {
    if (!svgRef.current || activeTab !== 'callgraph') return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    const width = 600;
    const height = 400;
    
    // Simulation erstellen
    const simulation = d3.forceSimulation(callgraphData.nodes)
      .force("link", d3.forceLink(callgraphData.links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));
    
    // Links erstellen
    const link = svg.append("g")
      .selectAll("line")
      .data(callgraphData.links)
      .join("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => Math.sqrt(d.value));
    
    // Selbstreferenz-Pfade erstellen
    const selfLink = svg.append("g")
      .selectAll("path")
      .data(callgraphData.links.filter(d => d.source === d.target))
      .join("path")
      .attr("fill", "none")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => Math.sqrt(d.value));
    
    // Knoten erstellen
    const node = svg.append("g")
      .selectAll("circle")
      .data(callgraphData.nodes)
      .join("circle")
      .attr("r", 20)
      .attr("fill", d => d.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .call(drag(simulation));
    
    // Labels hinzufügen
    const label = svg.append("g")
      .selectAll("text")
      .data(callgraphData.nodes)
      .join("text")
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("dy", "0.35em")
      .text(d => d.name);
    
    // Simulation starten
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      
      selfLink
        .attr("d", d => {
          const x = d.source.x;
          const y = d.source.y;
          return `M${x},${y} C${x+40},${y-40} ${x+40},${y+40} ${x},${y}`;
        });
      
      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
      
      label
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });
    
    // Drag-Funktionalität
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      
      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      
      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
  }, [callgraphData, activeTab]);
  
  // Gefilterte Funktionen
  const filteredFunctions = functions.filter(func => {
    if (filter === 'all') return true;
    if (filter === 'issues') return func.issues.length > 0;
    if (filter === 'optimized') return func.isOptimized;
    if (filter === 'unoptimized') return !func.isOptimized;
    return true;
  });
  
  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="p-4 bg-white dark:bg-gray-800 shadow">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <BrainCircuit className="h-6 w-6 text-purple-600" />
            <h1 className="text-xl font-bold">Rekursions-Debugging Dashboard</h1>
          </div>
          <div className="flex space-x-2">
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm"
            >
              <option value="all">Alle Funktionen</option>
              <option value="issues">Mit Problemen</option>
              <option value="optimized">Optimiert</option>
              <option value="unoptimized">Nicht optimiert</option>
            </Select>
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Aktualisieren
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabList className="mb-4">
            <Tab value="overview">
              <BarChart2 className="h-4 w-4 mr-2" />
              Übersicht
            </Tab>
            <Tab value="callgraph">
              <GitBranch className="h-4 w-4 mr-2" />
              Callgraph
            </Tab>
            <Tab value="performance">
              <Lightning className="h-4 w-4 mr-2" />
              Performance
            </Tab>
            <Tab value="details" disabled={!selectedFunction}>
              <Code className="h-4 w-4 mr-2" />
              Funktionsdetails
            </Tab>
          </TabList>
          
          <TabPanel value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Rekursive Funktionen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{functions.length}</div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    in {new Set(functions.map(f => f.language)).size} Programmiersprachen
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Optimierungsstatus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {functions.filter(f => f.isOptimized).length}/{functions.length}
                  </div>
                  <Progress
                    value={(functions.filter(f => f.isOptimized).length / functions.length) * 100}
                    className="h-2"
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Probleme
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {functions.reduce((acc, f) => acc + f.issues.length, 0)}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    in {functions.filter(f => f.issues.length > 0).length} Funktionen
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Rekursive Funktionen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredFunctions.map(func => (
                    <Card key={func.id} className="p-0 overflow-hidden">
                      <div className="p-4 flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium">{func.name}</h3>
                            <Badge variant={func.language === 'javascript' ? 'yellow' : 
                                          func.language === 'python' ? 'blue' : 
                                          func.language === 'typescript' ? 'purple' : 'gray'}>
                              {func.language}
                            </Badge>
                            {func.issues.length > 0 && (
                              <Badge variant="destructive">
                                {func.issues.length} {func.issues.length === 1 ? 'Problem' : 'Probleme'}
                              </Badge>
                            )}
                            {func.isOptimized && (
                              <Badge variant="outline" className="border-green-500 text-green-500">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Optimiert
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{func.file}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => selectFunction(func)}>
                          Details
                        </Button>
                      </div>
                      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-mono">
                        <div className="flex justify-between mb-1">
                          <span>Rekursionstiefe: {func.depth}</span>
                          <span>Aufrufe: {func.calls}</span>
                          <span>Komplexität: {func.complexity}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabPanel>
          
          <TabPanel value="callgraph">
            <Card>
              <CardHeader>
                <CardTitle>Funktions-Callgraph</CardTitle>
              </CardHeader>
              <CardContent>
                <svg ref={svgRef} width="100%" height="400" />
              </CardContent>
            </Card>
          </TabPanel>
          
          <TabPanel value="performance">
            <Card>
              <CardHeader>
                <CardTitle>Performance-Vergleich</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={performanceData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis label={{ value: 'Funktionsaufrufe', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="original" name="Ursprünglich" fill="#f87171" />
                      <Bar dataKey="optimized" name="Optimiert" fill="#4ade80" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Optimierungspotenziale</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="w-full">
                    <AccordionItem value="memoization">
                      <AccordionTrigger>
                        <div className="flex items-center">
                          <Zap className="h-4 w-4 mr-2 text-amber-500" />
                          Memoization
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-sm mb-2">Caching für wiederholte Berechnungen hinzufügen.</p>
                        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono">
                          fibonacci, deepClone
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="tail-recursion">
                      <AccordionTrigger>
                        <div className="flex items-center">
                          <ArrowDownUp className="h-4 w-4 mr-2 text-blue-500" />
                          Tail-Recursion
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-sm mb-2">Stack-freundliche Rekursion durch Tail-Calls.</p>
                        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono">
                          fibonacci, quicksort
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="iteration">
                      <AccordionTrigger>
                        <div className="flex items-center">
                          <RefreshCcw className="h-4 w-4 mr-2 text-green-500" />
                          Iterative Umwandlung
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-sm mb-2">Rekursion in iterative Lösung umwandeln.</p>
                        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs font-mono">
                          fibonacci, traverse
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Effizienzmetriken</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">Speicherbedarf</span>
                        <span className="text-sm font-medium">
                          {Math.round((functions.reduce((acc, f) => acc + f.calls * f.depth, 0) / 1000))} KB
                        </span>
                      </div>
                      <Progress value={70} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">Ausführungszeit</span>
                        <span className="text-sm font-medium">
                          {Math.round(functions.reduce((acc, f) => acc + f.calls * f.complexity, 0) / 100)} ms
                        </span>
                      </div>
                      <Progress value={45} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">Stack-Auslastung</span>
                        <span className="text-sm font-medium">
                          {Math.max(...functions.map(f => f.depth))} Ebenen
                        </span>
                      </div>
                      <Progress value={80} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabPanel>
          
          {selectedFunction && (
            <TabPanel value="details">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Rekursionstiefe
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedFunction.depth}</div>
                    <Progress
                      value={(selectedFunction.depth / 30) * 100}
                      className="h-2"
                    />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Aufrufe
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedFunction.calls}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Komplexität
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedFunction.complexity}/10</div>
                    <Progress
                      value={(selectedFunction.complexity / 10) * 100}
                      className="h-2"
                    />
                  </CardContent>
                </Card>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Code</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto text-xs font-mono">
                      {selectedFunction.code}
                    </pre>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Probleme & Optimierungen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedFunction.issues.length > 0 ? (
                      <div className="space-y-4">
                        {selectedFunction.issues.map(issue => (
                          <div key={issue} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                            <div className="flex items-center text-red-800 dark:text-red-300">
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              <h4 className="font-medium">{
                                issue === 'no_memoization' ? 'Keine Memoization' :
                                issue === 'deep_recursion' ? 'Tiefe Rekursion' :
                                issue === 'circular_reference' ? 'Zirkuläre Referenz' :
                                issue === 'no_cycle_detection' ? 'Keine Zykluserkennung' :
                                issue
                              }</h4>
                            </div>
                            <p className="text-sm mt-1 text-red-700 dark:text-red-400">
                              {issue === 'no_memoization' ? 'Diese Funktion würde erheblich von Memoization profitieren, um redundante Berechnungen zu vermeiden.' :
                               issue === 'deep_recursion' ? 'Die Rekursionstiefe kann zu Stack-Overflows führen. Erwägen Sie eine iterative Implementierung.' :
                               issue === 'circular_reference' ? 'Die Funktion kann in eine Endlosschleife geraten, wenn zirkuläre Referenzen vorhanden sind.' :
                               issue === 'no_cycle_detection' ? 'Es fehlt eine Erkennung von Zyklen, was zu unendlicher Rekursion führen kann.' :
                               'Unbekanntes Problem'}
                            </p>
                          </div>
                        ))}
                        
                        <Button className="w-full mt-4">
                          <Sparkles className="h-4 w-4 mr-2" />
                          Auto-Optimierung anwenden
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3">
                        <div className="flex items-center text-green-800 dark:text-green-300">
                          <Sparkles className="h-4 w-4 mr-2" />
                          <h4 className="font-medium">Optimiert</h4>
                        </div>
                        <p className="text-sm mt-1 text-green-700 dark:text-green-400">
                          Diese Funktion ist bereits optimiert und folgt Best Practices für rekursive Implementierungen.
                        </p>
                      </div>
                    )}
                    
                    <div className="mt-6">
                      <h4 className="font-medium mb-2">Performance-Trace</h4>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={Array.from({ length: 10 }, (_, i) => ({
                              call: i + 1,
                              time: Math.random() * 10 + (selectedFunction.complexity * i / 2)
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="call" label={{ value: 'Aufruf #', position: 'insideBottomRight', offset: -5 }} />
                            <YAxis label={{ value: 'Zeit (ms)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Line type="monotone" dataKey="time" stroke="#8884d8" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {selectedFunction.issues.length > 0 && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Optimierungsvorschlag</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto text-xs font-mono">
                      {selectedFunction.name === 'fibonacci' ? 
                        `function fibonacci(n, memo = {}) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  
  // Bereits berechneten Wert zurückgeben, wenn vorhanden
  if (memo[n] !== undefined) return memo[n];
  
  // Berechnen und speichern
  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);
  return memo[n];
}` :
                      selectedFunction.name === 'deepClone' ?
                        `function deepClone(obj, visited = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  // Zykluserkennung
  if (visited.has(obj)) {
    return visited.get(obj);
  }
  
  let clone = Array.isArray(obj) ? [] : {};
  
  // Aktuelle Referenz speichern
  visited.set(obj, clone);
  
  for (let key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clone[key] = deepClone(obj[key], visited);
    }
  }
  
  return clone;
}` :
                      selectedFunction.name === 'traverse' ?
                        `def traverse(node, visited=None):
    if visited is None:
        visited = set()
        
    if node is None:
        return
    
    # Zykluserkennung
    if id(node) in visited:
        return
    
    visited.add(id(node))
    process(node.data)
    traverse(node.left, visited)
    traverse(node.right, visited)` :
                      selectedFunction.code
                      }
                    </pre>
                    
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Optimierungsdetails</h4>
                      <ul className="space-y-2 text-sm">
                        {selectedFunction.name === 'fibonacci' ? (
                          <>
                            <li className="flex items-start">
                              <Sparkles className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                              <span>Memoization hinzugefügt, um bereits berechnete Fibonacci-Zahlen wiederzuverwenden</span>
                            </li>
                            <li className="flex items-start">
                              <Sparkles className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                              <span>Reduziert Zeitkomplexität von O(2^n) auf O(n)</span>
                            </li>
                          </>
                        ) : selectedFunction.name === 'deepClone' ? (
                          <>
                            <li className="flex items-start">
                              <Sparkles className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                              <span>WeakMap zur Zykluserkennung hinzugefügt, um endlose Rekursion zu vermeiden</span>
                            </li>
                            <li className="flex items-start">
                              <Sparkles className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                              <span>Referenzen werden während der Rekursion verfolgt</span>
                            </li>
                          </>
                        ) : selectedFunction.name === 'traverse' ? (
                          <>
                            <li className="flex items-start">
                              <Sparkles className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                              <span>Set zur Zykluserkennung hinzugefügt</span>
                            </li>
                            <li className="flex items-start">
                              <Sparkles className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                              <span>Objekt-IDs werden verfolgt, um Zyklen in der Baumstruktur zu erkennen</span>
                            </li>
                          </>
                        ) : null}
                      </ul>
                    </div>
                    
                    <div className="flex space-x-4 mt-6">
                      <Button className="flex-1">
                        <Clipboard className="h-4 w-4 mr-2" />
                        Optimierten Code kopieren
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <GitMerge className="h-4 w-4 mr-2" />
                        Pull Request erstellen
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabPanel>
          )}
        </Tabs>
      </main>
      
      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 p-4 border-t">
        <div className="flex justify-between items-center text-sm text-gray-500">
          <div>
            Claude Rekursions-Debugging Dashboard v1.0
          </div>
          <div className="flex items-center space-x-4">
            <span>
              <FileCode className="h-4 w-4 inline mr-1" /> 
              {functions.length} rekursive Funktionen
            </span>
            <span>
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              {functions.reduce((acc, f) => acc + f.issues.length, 0)} Probleme
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// In einer realen Implementierung würde das Dashboard als React-Anwendung gerendert
export default RecursiveDashboard;

// Beispiel-Render-Funktion für die Dokumentation
function renderDashboard() {
  const container = document.getElementById('dashboard-container');
  if (container) {
    const root = createRoot(container);
    root.render(React.createElement(RecursiveDashboard));
  }
}
