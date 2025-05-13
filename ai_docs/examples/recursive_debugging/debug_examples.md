# Rekursives Debugging Beispiele

Diese Beispiele demonstrieren die Anwendung der Claude Code CLI Debugging-Befehle zur Analyse und Behebung von Fehlern in rekursiven Algorithmen.

## Beispiel 1: Buggy Fibonacci

Die Datei `buggy_fibonacci.js` enthält eine fehlerhafte Implementierung des Fibonacci-Algorithmus mit mehreren Problemen:

- Unzureichende Abbruchbedingungen
- Redundante Berechnungen
- Risiko eines Stack Overflow

### Debugging mit dem debug-recursive Befehl:

```bash
/debug-recursive file=docs/examples/recursive_debugging/buggy_fibonacci.js template=recursive_bug_analysis expected="Korrekte Fibonacci-Zahlen, effiziente Berechnung" observed="Stack Overflow bei größeren Werten"
```

### Optimierung mit dem optimize-recursive Befehl:

```bash
/optimize-recursive file=docs/examples/recursive_debugging/buggy_fibonacci.js strategy=memoization
```

## Beispiel 2: Buggy Tree Traversal

Die Datei `buggy_tree_traversal.py` enthält Implementierungen zur Baumtraversierung mit verschiedenen Problemen:

- Keine Zykluserkennung
- Fehlerhafte Rekursionslogik
- Ungünstige Datenstruktur
- Keine Tiefenbegrenzung

### Umfassende Bug-Jagd:

```bash
/bug-hunt path=docs/examples/recursive_debugging/buggy_tree_traversal.py focus=recursive depth=deep
```

### Systematisches Debugging mit mehreren Schritten:

```bash
# 1. Analyse des Problems
/debug-recursive file=docs/examples/recursive_debugging/buggy_tree_traversal.py template=systematic_debugging_workflow bugDescription="Rekursionsüberläufe bei Zyklen im Baum"

# 2. Optimierung nach der Fehlerbehebung
/optimize-recursive file=docs/examples/recursive_debugging/fixed_tree_traversal.py strategy=iterative
```

## Bekannte Fehler und Lösungen

### Fibonacci-Bugs:

1. **Fehlende Abbruchbedingung für n=1**  
   - Bug: Die Funktion prüft nur auf n<=0, aber nicht speziell auf n=1
   - Fix: Abbruchbedingung erweitern: `if (n <= 1) return n;`

2. **Redundante Berechnungen**  
   - Bug: Gleiche Fibonacci-Zahlen werden mehrfach berechnet
   - Fix: Memoization implementieren (Cache für berechnete Werte)

3. **Stack Overflow bei großen Werten**  
   - Bug: Zu viele rekursive Aufrufe bei großen Eingabewerten
   - Fix: Iterative Implementation oder Tail-Call-Optimierung

### Tree Traversal-Bugs:

1. **Fehlende Zykluserkennung**  
   - Bug: Endlose Rekursion bei zyklischen Baumstrukturen
   - Fix: Set zur Verfolgung besuchter Knoten verwenden

2. **Fehlende Null-Überprüfung**  
   - Bug: Kein Check für null/None Knoten
   - Fix: Abbruchbedingung für None-Knoten hinzufügen

3. **Mutable Default-Parameter**  
   - Bug: Liste als Default-Parameter wird über Aufrufe geteilt
   - Fix: Default-Parameter auf None setzen, Liste innerhalb der Funktion initialisieren

4. **Pfad nicht bereinigt**  
   - Bug: Pfad wird nicht bereinigt, wenn Ziel nicht gefunden wird
   - Fix: path.pop() vor dem Zurückgeben von None einfügen

## Optimierte Lösungen

### Optimierter Fibonacci-Algorithmus:

```javascript
function fibonacci(n, memo = {}) {
  // Validierung
  if (typeof n !== 'number' || n < 0 || !Number.isInteger(n)) {
    throw new Error('Input must be a non-negative integer');
  }
  
  // Basis-Fälle
  if (n <= 1) return n;
  
  // Memoization - bereits berechnete Werte wiederverwenden
  if (memo[n] !== undefined) return memo[n];
  
  // Rekursive Berechnung mit Caching
  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);
  return memo[n];
}

// Iterative Variante für sehr große Werte
function fibonacciIterative(n) {
  // Validierung
  if (typeof n !== 'number' || n < 0 || !Number.isInteger(n)) {
    throw new Error('Input must be a non-negative integer');
  }
  
  if (n <= 1) return n;
  
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    const temp = a + b;
    a = b;
    b = temp;
  }
  
  return b;
}
```

### Optimierte Tree Traversal:

```python
def count_nodes_safe(node, visited=None):
    """Sichere Version mit Zykluserkennung"""
    if visited is None:
        visited = set()
        
    if node is None:
        return 0
        
    # Zykluserkennung
    node_id = id(node)
    if node_id in visited:
        return 0
        
    visited.add(node_id)
    
    count = 1  # Aktueller Knoten
    count += count_nodes_safe(node.left, visited)
    count += count_nodes_safe(node.right, visited)
    
    return count

def depth_first_search_safe(node, target_value, visited=None, path=None):
    """Sichere DFS mit Zykluserkennung und korrekter Pfadverwaltung"""
    if node is None:
        return None
        
    if visited is None:
        visited = set()
    if path is None:
        path = []
        
    # Zykluserkennung
    node_id = id(node)
    if node_id in visited:
        return None
        
    visited.add(node_id)
    path.append(node.value)
    
    if node.value == target_value:
        return list(path)  # Kopie zurückgeben, nicht die Referenz
    
    # Linker Teilbaum
    if node.left:
        result = depth_first_search_safe(node.left, target_value, visited, path)
        if result:
            return result
            
    # Rechter Teilbaum
    if node.right:
        result = depth_first_search_safe(node.right, target_value, visited, path)
        if result:
            return result
    
    # Pfad bereinigen, wenn Ziel nicht gefunden wurde
    path.pop()
    return None
```

## Fazit

Diese Beispiele zeigen, wie die spezialisierten Debugging-Befehle der Claude Code CLI bei der Identifikation und Behebung von Fehlern in rekursiven Strukturen helfen können. Der systematische Ansatz deckt verschiedene Arten von Rekursionsfehlern auf und liefert optimierte Lösungen.
