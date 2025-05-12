/**
 * @file cpp_recursion_monitor.h
 * @brief Überwachung rekursiver Funktionen in C++
 * 
 * Dieses Header-File bietet eine einfache Möglichkeit zur Überwachung und Analyse
 * rekursiver Funktionen in C++. Es verwendet Makros und Callstack-Analyse, um
 * tiefe Rekursionen zu erkennen und zu behandeln.
 * 
 * Verwendung:
 * 1. Dieses Header einbinden: #include "cpp_recursion_monitor.h"
 * 2. CLAUDE_MONITOR_RECURSIVE() am Anfang rekursiver Funktionen einfügen
 * 3. Optional: CLAUDE_DECL_MEMOIZED() für memoisierte rekursive Funktionen verwenden
 */

#ifndef CLAUDE_CPP_RECURSION_MONITOR_H
#define CLAUDE_CPP_RECURSION_MONITOR_H

#include <unordered_map>
#include <string>
#include <functional>
#include <iostream>
#include <fstream>
#include <sstream>
#include <chrono>
#include <thread>
#include <atomic>
#include <vector>
#include <mutex>
#include <cstdlib>
#include <cstring>
#include <cstdio>
#include <csignal>

#if defined(_WIN32) || defined(_WIN64)
    #include <windows.h>
    #define CLAUDE_PLATFORM_WINDOWS
#elif defined(__unix__) || defined(__APPLE__)
    #include <unistd.h>
    #include <sys/types.h>
    #include <sys/wait.h>
    #define CLAUDE_PLATFORM_UNIX
#endif

namespace claude {
namespace recursion {

// Vorwärtsdeklaration
class RecursionMonitor;

// Globaler Zugriff auf den Monitor
RecursionMonitor& getMonitor();

/**
 * @brief Klasse zur Überwachung rekursiver Funktionen
 */
class RecursionMonitor {
public:
    struct FunctionStats {
        std::atomic<size_t> callCount{0};
        std::atomic<size_t> maxDepth{0};
        std::atomic<size_t> bailouts{0};
        std::chrono::duration<double> totalTime{0};
        std::string lastStackTrace;
    };

private:
    std::mutex statsMutex;
    std::unordered_map<std::string, FunctionStats> stats;
    std::unordered_map<std::thread::id, std::unordered_map<std::string, size_t>> threadDepths;
    std::unordered_map<std::string, std::unordered_map<std::string, std::string>> memoizationCache;
    
    size_t maxRecursionDepth = 1000;
    size_t maxCallCount = 10000;
    bool debuggingEnabled = true;
    std::string debugWorkflowPath;
    
public:
    RecursionMonitor() {
        // Konfiguration laden
        loadConfig();
        
        // Debug-Workflow-Script finden
        findDebugWorkflow();
        
        // Signal-Handler für Programmende
        std::atexit([]() {
            getMonitor().dumpStats();
        });
    }
    
    /**
     * @brief Lädt die Konfiguration aus der Claude-Konfigurationsdatei
     */
    void loadConfig() {
        // Standardwerte
        maxRecursionDepth = 1000;
        maxCallCount = 10000;
        
        // Pfad zur Konfigurationsdatei
        std::string homeDir;
        
#ifdef CLAUDE_PLATFORM_WINDOWS
        const char* userProfile = std::getenv("USERPROFILE");
        if (userProfile) {
            homeDir = userProfile;
        }
#else
        const char* home = std::getenv("HOME");
        if (home) {
            homeDir = home;
        }
#endif

        if (homeDir.empty()) {
            std::cerr << "WARNUNG: Home-Verzeichnis nicht gefunden, verwende Standardwerte" << std::endl;
            return;
        }
        
        std::string configPath = homeDir + "/.claude/config/debug_workflow_config.json";
        std::ifstream configFile(configPath);
        
        if (!configFile.is_open()) {
            std::cerr << "WARNUNG: Konfigurationsdatei nicht gefunden: " << configPath << std::endl;
            return;
        }
        
        // Einfaches JSON-Parsing (in echter Implementierung würde eine JSON-Bibliothek verwendet)
        std::string line;
        while (std::getline(configFile, line)) {
            // Sehr einfache Konfigurationsverarbeitung
            if (line.find("recursion_depth_warning") != std::string::npos) {
                size_t pos = line.find(':');
                if (pos != std::string::npos) {
                    std::string value = line.substr(pos + 1);
                    value.erase(0, value.find_first_not_of(" \t\r\n,"));
                    value.erase(value.find_last_not_of(" \t\r\n,") + 1);
                    try {
                        maxRecursionDepth = std::stoul(value);
                    } catch (...) {}
                }
            } else if (line.find("function_call_warning") != std::string::npos) {
                size_t pos = line.find(':');
                if (pos != std::string::npos) {
                    std::string value = line.substr(pos + 1);
                    value.erase(0, value.find_first_not_of(" \t\r\n,"));
                    value.erase(value.find_last_not_of(" \t\r\n,") + 1);
                    try {
                        maxCallCount = std::stoul(value);
                    } catch (...) {}
                }
            }
        }
        
        std::cout << "RecursionMonitor: Konfiguration geladen (maxRecursionDepth=" 
                 << maxRecursionDepth << ", maxCallCount=" << maxCallCount << ")" << std::endl;
    }
    
    /**
     * @brief Sucht nach dem Debug-Workflow-Script
     */
    void findDebugWorkflow() {
        std::string homeDir;
        
#ifdef CLAUDE_PLATFORM_WINDOWS
        const char* userProfile = std::getenv("USERPROFILE");
        if (userProfile) {
            homeDir = userProfile;
        }
#else
        const char* home = std::getenv("HOME");
        if (home) {
            homeDir = home;
        }
#endif

        if (homeDir.empty()) {
            debuggingEnabled = false;
            return;
        }
        
        // Mögliche Pfade überprüfen
        std::vector<std::string> possiblePaths = {
            homeDir + "/.claude/tools/debug/debug_workflow_engine.js",
            homeDir + "/claude-code/scripts/debug_workflow_engine.js"
        };
        
        for (const auto& path : possiblePaths) {
            std::ifstream file(path);
            if (file.good()) {
                debugWorkflowPath = path;
                std::cout << "RecursionMonitor: Debug-Workflow gefunden: " << path << std::endl;
                return;
            }
        }
        
        std::cerr << "WARNUNG: Debug-Workflow nicht gefunden, Debugging deaktiviert" << std::endl;
        debuggingEnabled = false;
    }
    
    /**
     * @brief Wird beim Betreten einer rekursiven Funktion aufgerufen
     * 
     * @param functionName Name der Funktion
     * @param file Quelldateiname
     * @param line Zeilennummer
     * @return true, wenn die Funktion weiterlaufen sollte, false für Abbruch
     */
    bool enterFunction(const std::string& functionName, const char* file, int line) {
        auto threadId = std::this_thread::get_id();
        
        // Aufrufdaten aktualisieren
        {
            std::lock_guard<std::mutex> lock(statsMutex);
            
            // Stats für diese Funktion abrufen oder erstellen
            auto& functionStats = stats[functionName];
            functionStats.callCount++;
            
            // Aktuelle Rekursionstiefe für diesen Thread abrufen oder initialisieren
            auto& depths = threadDepths[threadId];
            auto it = depths.find(functionName);
            size_t currentDepth = (it != depths.end()) ? it->second : 0;
            currentDepth++;
            depths[functionName] = currentDepth;
            
            // Maximale Tiefe aktualisieren
            size_t oldMax = functionStats.maxDepth.load();
            while (currentDepth > oldMax && 
                  !functionStats.maxDepth.compare_exchange_weak(oldMax, currentDepth));
            
            // Prüfen auf zu tiefe Rekursion
            if (currentDepth > maxRecursionDepth) {
                // Stack-Trace erfassen für Diagnose
                if (currentDepth % 100 == 0 || currentDepth >= maxRecursionDepth * 2) {
                    functionStats.lastStackTrace = captureStackTrace();
                    
                    // Wenn die Rekursion sehr tief wird, Debugging-Workflow auslösen
                    if (currentDepth >= maxRecursionDepth * 2 && debuggingEnabled && !debugWorkflowPath.empty()) {
                        functionStats.bailouts++;
                        depths[functionName]--;  // Tiefe reduzieren vor dem Ausstieg
                        triggerDebugWorkflow(functionName, file, functionStats.lastStackTrace);
                        return false;  // Rekursion abbrechen
                    }
                }
                
                // Bei jeder 500. Überschreitung warnen
                if (currentDepth % 500 == 0) {
                    std::cerr << "WARNUNG: Tiefe Rekursion in " << functionName 
                             << " (Tiefe: " << currentDepth << ")" << std::endl;
                }
            }
        }
        
        return true;  // Rekursion fortsetzen
    }
    
    /**
     * @brief Wird beim Verlassen einer rekursiven Funktion aufgerufen
     * 
     * @param functionName Name der Funktion
     * @param duration Ausführungsdauer
     */
    void exitFunction(const std::string& functionName, std::chrono::duration<double> duration) {
        auto threadId = std::this_thread::get_id();
        
        // Aufrufdaten aktualisieren
        {
            std::lock_guard<std::mutex> lock(statsMutex);
            
            // Rekursionstiefe verringern
            auto& depths = threadDepths[threadId];
            auto it = depths.find(functionName);
            if (it != depths.end() && it->second > 0) {
                it->second--;
                
                // Wenn keine Rekursion mehr, Eintrag entfernen
                if (it->second == 0) {
                    depths.erase(it);
                    
                    // Wenn dieser Thread keine aktiven Rekursionen mehr hat, Thread-Eintrag entfernen
                    if (depths.empty()) {
                        threadDepths.erase(threadId);
                    }
                }
            }
            
            // Zeitmessung aktualisieren
            stats[functionName].totalTime += duration;
        }
    }
    
    /**
     * @brief Speichert einen memoiserten Wert im Cache
     */
    template<typename Key, typename Value>
    void storeMemoizedValue(const std::string& functionName, const Key& key, const Value& value) {
        std::lock_guard<std::mutex> lock(statsMutex);
        memoizationCache[functionName][std::to_string(key)] = std::to_string(value);
    }
    
    /**
     * @brief Ruft einen memoiserten Wert aus dem Cache ab
     * 
     * @return true wenn ein Wert gefunden wurde, false sonst
     */
    template<typename Key, typename Value>
    bool getMemoizedValue(const std::string& functionName, const Key& key, Value& outValue) {
        std::lock_guard<std::mutex> lock(statsMutex);
        
        auto& cache = memoizationCache[functionName];
        auto it = cache.find(std::to_string(key));
        
        if (it != cache.end()) {
            std::istringstream(it->second) >> outValue;
            return true;
        }
        
        return false;
    }
    
    /**
     * @brief Erfasst den aktuellen Stack-Trace
     */
    std::string captureStackTrace() {
        // In echter Implementierung würde hier ein Stack-Trace erfasst
        // Dies ist nur ein Platzhalter
        return "Stack-Trace nicht verfügbar in dieser vereinfachten Implementierung";
    }
    
    /**
     * @brief Löst den Debug-Workflow für eine problematische Funktion aus
     */
    void triggerDebugWorkflow(const std::string& functionName, const char* sourceFile, 
                             const std::string& stackTrace) {
        if (!debuggingEnabled || debugWorkflowPath.empty()) return;
        
        std::cout << "Löse Debug-Workflow für " << functionName << " aus..." << std::endl;
        
        // Node.js-Befehl zusammenstellen
#ifdef CLAUDE_PLATFORM_WINDOWS
        std::string cmd = "node \"" + debugWorkflowPath + "\" trigger runtime_error --file \"" + 
                         sourceFile + "\" --error \"Deep recursion detected in " + functionName + "\"";
        
        // Prozess im Hintergrund starten
        STARTUPINFO si;
        PROCESS_INFORMATION pi;
        ZeroMemory(&si, sizeof(si));
        si.cb = sizeof(si);
        ZeroMemory(&pi, sizeof(pi));
        
        if (CreateProcess(NULL, const_cast<LPSTR>(cmd.c_str()), NULL, NULL, FALSE, 
                         CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
        }
#else
        // Debug-Workflow in separatem Prozess ausführen
        pid_t pid = fork();
        
        if (pid == 0) {
            // Kindprozess
            execlp("node", "node", debugWorkflowPath.c_str(), "trigger", "runtime_error", 
                  "--file", sourceFile, "--error", 
                  ("Deep recursion detected in " + functionName).c_str(), NULL);
            
            // Wenn exec fehlschlägt
            exit(1);
        }
#endif
    }
    
    /**
     * @brief Gibt Statistiken über überwachte rekursive Funktionen aus
     */
    void dumpStats() {
        std::lock_guard<std::mutex> lock(statsMutex);
        
        std::cout << "\n=== Rekursionsstatistiken ===" << std::endl;
        for (const auto& pair : stats) {
            const auto& functionName = pair.first;
            const auto& functionStats = pair.second;
            
            std::cout << functionName << ":" << std::endl
                     << "  Aufrufe: " << functionStats.callCount << std::endl
                     << "  Max. Tiefe: " << functionStats.maxDepth << std::endl
                     << "  Abbrüche: " << functionStats.bailouts << std::endl
                     << "  Gesamtzeit: " << functionStats.totalTime.count() << " s" << std::endl;
            
            if (!functionStats.lastStackTrace.empty()) {
                std::cout << "  Letzter Stack-Trace:" << std::endl 
                         << functionStats.lastStackTrace << std::endl;
            }
        }
    }
};

// Globale Singleton-Instanz
inline RecursionMonitor& getMonitor() {
    static RecursionMonitor instance;
    return instance;
}

/**
 * @brief Hilfsklasse für Zeitmessung und automatischen Exit-Aufruf
 */
class FunctionGuard {
private:
    std::string functionName;
    const char* file;
    int line;
    std::chrono::time_point<std::chrono::high_resolution_clock> startTime;
    bool active;
    
public:
    FunctionGuard(const std::string& name, const char* sourceFile, int sourceLine)
        : functionName(name), file(sourceFile), line(sourceLine),
          startTime(std::chrono::high_resolution_clock::now()), active(true) {
        
        // Beim Betreten prüfen, ob wir fortfahren sollen
        active = getMonitor().enterFunction(functionName, file, line);
    }
    
    ~FunctionGuard() {
        if (active) {
            auto endTime = std::chrono::high_resolution_clock::now();
            auto duration = std::chrono::duration_cast<std::chrono::duration<double>>(
                endTime - startTime);
            
            getMonitor().exitFunction(functionName, duration);
        }
    }
    
    bool shouldContinue() const {
        return active;
    }
};

} // namespace recursion
} // namespace claude

// Makros für einfache Verwendung

/**
 * @brief Überwacht eine rekursive Funktion
 * 
 * Fügen Sie dieses Makro am Anfang einer rekursiven Funktion ein:
 * 
 * int fibonacci(int n) {
 *     CLAUDE_MONITOR_RECURSIVE();
 *     if (n <= 1) return n;
 *     return fibonacci(n-1) + fibonacci(n-2);
 * }
 */
#define CLAUDE_MONITOR_RECURSIVE() \
    static const char* __claude_file = __FILE__; \
    static const std::string __claude_func = std::string(__FUNCTION__) + ":" + std::to_string(__LINE__); \
    claude::recursion::FunctionGuard __claude_guard(__claude_func, __claude_file, __LINE__); \
    if (!__claude_guard.shouldContinue()) return 0

/**
 * @brief Deklariert eine memoisierende rekursive Funktion
 * 
 * Verwenden Sie dieses Makro für rekursive Funktionen mit Memoization:
 * 
 * CLAUDE_DECL_MEMOIZED(int, fibonacci, int n) {
 *     // Prüfen, ob bereits berechnet
 *     int result;
 *     if (CLAUDE_MEMOIZED_GET(n, result)) return result;
 *     
 *     // Berechnung durchführen
 *     if (n <= 1) return n;
 *     result = fibonacci(n-1) + fibonacci(n-2);
 *     
 *     // Ergebnis im Cache speichern
 *     CLAUDE_MEMOIZED_STORE(n, result);
 *     return result;
 * }
 */
#define CLAUDE_DECL_MEMOIZED(RetType, FuncName, ...) \
    RetType FuncName(__VA_ARGS__) { \
        static const char* __claude_file = __FILE__; \
        static const std::string __claude_func = #FuncName ":" + std::to_string(__LINE__); \
        claude::recursion::FunctionGuard __claude_guard(__claude_func, __claude_file, __LINE__); \
        if (!__claude_guard.shouldContinue()) return RetType(); \

/**
 * @brief Ruft einen memoiserten Wert aus dem Cache ab
 */
#define CLAUDE_MEMOIZED_GET(Key, OutValue) \
    claude::recursion::getMonitor().getMemoizedValue(__claude_func, Key, OutValue)

/**
 * @brief Speichert einen Wert im Memoization-Cache
 */
#define CLAUDE_MEMOIZED_STORE(Key, Value) \
    claude::recursion::getMonitor().storeMemoizedValue(__claude_func, Key, Value)

/**
 * @brief Schließt einen CLAUDE_DECL_MEMOIZED-Block ab
 */
#define CLAUDE_MEMOIZED_END }

#endif // CLAUDE_CPP_RECURSION_MONITOR_H
