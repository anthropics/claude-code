/**
 * Fehlerhafter rekursiver Fibonacci-Algorithmus mit mehreren Problemen:
 * - Keine ausreichende Abbruchbedingung
 * - Redundante Berechnungen
 * - Risiko eines Stack Overflow
 */
function fibonacci(n) {
  // Fehlerhafte Implementierung mit mehreren Bugs
  if (n <= 0) {
    return n; // BUG: Für n=0 sollte 0 zurückgegeben werden, aber für negative Werte sollte ein Fehler geworfen werden
  }
  
  // BUG: Fehlende Abbruchbedingung für n=1, führt zu unnötiger Rekursion
  
  // Redundante rekursive Berechnungen ohne Memoization
  return fibonacci(n - 1) + fibonacci(n - 2);
}

/**
 * Test-Funktionen
 */
function testFibonacci() {
  console.log("Fibonacci Tests:");
  
  try {
    // Dieser Test sollte funktionieren
    console.log(`fibonacci(5) = ${fibonacci(5)}`); // Erwartet: 5
    
    // Dieser Test könnte zu Stack Overflow führen
    console.log(`fibonacci(50) = ${fibonacci(50)}`); // Wird wahrscheinlich nie beendet
  } catch (error) {
    console.error("Error in testFibonacci:", error.message);
  }
}

// Führe Test aus
testFibonacci();
