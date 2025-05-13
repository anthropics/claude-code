package com.claude.recursion;

import java.lang.instrument.ClassFileTransformer;
import java.lang.instrument.Instrumentation;
import java.lang.instrument.IllegalClassFormatException;
import java.io.File;
import java.io.FileWriter;
import java.lang.reflect.Method;
import java.security.ProtectionDomain;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;

import org.json.JSONObject;
import org.json.JSONArray;

import javassist.ClassPool;
import javassist.CtClass;
import javassist.CtMethod;
import javassist.CtBehavior;
import javassist.NotFoundException;

/**
 * Java-Agent zur Überwachung rekursiver Methoden
 * 
 * Führen Sie die Anwendung mit folgendem JVM-Argument aus:
 * -javaagent:path/to/recursion-agent.jar
 */
public class RecursionAgent {
    private static final Logger logger = Logger.getLogger(RecursionAgent.class.getName());
    private static final Map<String, RecursionStats> recursionStats = new ConcurrentHashMap<>();
    private static final Map<Long, CallStackInfo> threadCallStacks = new ConcurrentHashMap<>();
    private static final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    
    // Konfiguration
    private static int maxRecursionDepth = 1000;
    private static int maxCallCount = 10000;
    private static String configPath = System.getProperty("user.home") + "/.claude/config/debug_workflow_config.json";
    private static String notificationCommand = null;
    
    /**
     * Premain-Methode, die vom JVM aufgerufen wird
     */
    public static void premain(String agentArgs, Instrumentation inst) {
        logger.info("Claude Recursion Agent gestartet");
        
        // Konfiguration laden
        loadConfiguration();
        
        // Scheduler für periodische Statistik-Ausgabe und Überwachung
        scheduler.scheduleAtFixedRate(RecursionAgent::checkRecursionLimits, 5, 5, TimeUnit.SECONDS);
        
        // Shutdown Hook registrieren
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            logger.info("Beende Recursion Agent...");
            dumpStatistics();
            scheduler.shutdown();
        }));
        
        // Transformer für die Bytecode-Instrumentierung registrieren
        inst.addTransformer(new RecursionTransformer());
    }
    
    /**
     * Lädt die Konfiguration aus der Claude Debug-Config-Datei
     */
    private static void loadConfiguration() {
        File configFile = new File(configPath);
        if (configFile.exists()) {
            try {
                // Simple JSON parsing (in der echten Implementierung mit org.json)
                String content = readFile(configFile);
                JSONObject config = new JSONObject(content);
                
                if (config.has("debugging_thresholds")) {
                    JSONObject thresholds = config.getJSONObject("debugging_thresholds");
                    if (thresholds.has("recursion_depth_warning")) {
                        maxRecursionDepth = thresholds.getInt("recursion_depth_warning");
                    }
                    if (thresholds.has("function_call_warning")) {
                        maxCallCount = thresholds.getInt("function_call_warning");
                    }
                }
                
                if (config.has("notification_settings")) {
                    JSONObject notifications = config.getJSONObject("notification_settings");
                    // Extrahiere Webhook/Notification-Einstellungen
                }
                
                logger.info("Konfiguration geladen: maxRecursionDepth=" + maxRecursionDepth + 
                           ", maxCallCount=" + maxCallCount);
            } catch (Exception e) {
                logger.log(Level.WARNING, "Fehler beim Laden der Konfiguration", e);
            }
        } else {
            logger.warning("Konfigurationsdatei nicht gefunden: " + configPath);
        }
    }
    
    /**
     * Liest eine Datei als String
     */
    private static String readFile(File file) throws Exception {
        // Implementierung für das Lesen einer Datei
        return "{}"; // Platzhalter für die tatsächliche Implementierung
    }
    
    /**
     * Überprüft, ob Rekursionsgrenzen überschritten wurden
     */
    private static void checkRecursionLimits() {
        for (Map.Entry<String, RecursionStats> entry : recursionStats.entrySet()) {
            RecursionStats stats = entry.getValue();
            if (stats.maxDepth.get() > maxRecursionDepth || stats.callCount.get() > maxCallCount) {
                String method = entry.getKey();
                logger.warning("Rekursionswarnung: " + method + 
                             " (Tiefe: " + stats.maxDepth.get() + ", Aufrufe: " + stats.callCount.get() + ")");
                
                // Potenzielles Problem erkannt, Debugging-Workflow auslösen
                triggerDebugWorkflow(method, stats);
            }
        }
    }
    
    /**
     * Löst den Debug-Workflow für eine problematische Methode aus
     */
    private static void triggerDebugWorkflow(String method, RecursionStats stats) {
        try {
            // Metadaten für den Debug-Workflow sammeln
            String className = method.substring(0, method.lastIndexOf('.'));
            String methodName = method.substring(method.lastIndexOf('.') + 1);
            String sourceFile = findSourceFile(className);
            
            if (sourceFile == null) {
                logger.warning("Quelldatei für " + className + " nicht gefunden");
                return;
            }
            
            // Debug-Workflow per Prozess auslösen
            String workflowCmd = System.getProperty("user.home") + 
                                "/.claude/tools/debug/debug_workflow_engine.js";
            
            if (!new File(workflowCmd).exists()) {
                // Alternative Pfade prüfen
                workflowCmd = "node";
                String[] args = {
                    System.getProperty("user.home") + "/claude-code/scripts/debug_workflow_engine.js",
                    "trigger",
                    "runtime_error",
                    "--file", sourceFile,
                    "--error", "Deep recursion detected: " + stats.maxDepth.get() + " calls"
                };
                
                ProcessBuilder pb = new ProcessBuilder(workflowCmd);
                for (String arg : args) {
                    pb.command().add(arg);
                }
                
                pb.redirectErrorStream(true);
                pb.start();
                
                logger.info("Debug-Workflow für " + method + " ausgelöst");
            }
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Fehler beim Auslösen des Debug-Workflows", e);
        }
    }
    
    /**
     * Versucht, die Quelldatei für eine Klasse zu finden
     */
    private static String findSourceFile(String className) {
        try {
            Class<?> clazz = Class.forName(className);
            String simpleName = clazz.getSimpleName();
            String packagePath = className.replace('.', '/');
            
            // Typische Sourcepfade prüfen
            String[] sourcePaths = {
                "src/main/java/" + packagePath + ".java",
                "src/" + packagePath + ".java",
                "app/src/main/java/" + packagePath + ".java"
            };
            
            for (String path : sourcePaths) {
                if (new File(path).exists()) {
                    return path;
                }
            }
        } catch (Exception e) {
            logger.log(Level.WARNING, "Fehler beim Suchen der Quelldatei für " + className, e);
        }
        
        return null;
    }
    
    /**
     * Gibt Statistiken über überwachte rekursive Methoden aus
     */
    private static void dumpStatistics() {
        logger.info("=== Rekursionsstatistiken ===");
        for (Map.Entry<String, RecursionStats> entry : recursionStats.entrySet()) {
            RecursionStats stats = entry.getValue();
            logger.info(entry.getKey() + ": " +
                       "Max Tiefe: " + stats.maxDepth.get() + ", " +
                       "Aufrufe: " + stats.callCount.get());
        }
    }

    // Speichert Informationen über den Call-Stack für einen Thread
    private static class CallStackInfo {
        final Map<String, Integer> currentDepth = new ConcurrentHashMap<>();
        final Set<String> activeRecursions = ConcurrentHashMap.newKeySet();
    }
    
    // Speichert Statistiken für eine rekursive Methode
    private static class RecursionStats {
        final AtomicInteger maxDepth = new AtomicInteger(0);
        final AtomicInteger callCount = new AtomicInteger(0);
    }
    
    /**
     * Transformer zur Instrumentierung von Klassendateien
     */
    private static class RecursionTransformer implements ClassFileTransformer {
        
        private final ClassPool classPool = ClassPool.getDefault();
        
        @Override
        public byte[] transform(ClassLoader loader, String className, Class<?> classBeingRedefined,
                               ProtectionDomain protectionDomain, byte[] classfileBuffer) 
                               throws IllegalClassFormatException {
            
            // Systembibliotheken und Agent-Klassen überspringen
            if (className == null || 
                className.startsWith("java/") || 
                className.startsWith("sun/") ||
                className.startsWith("com/claude/recursion/")) {
                return null;
            }
            
            // Konvertiere internen Namen in Klassenname
            String dotClassName = className.replace('/', '.');
            
            try {
                // Klassenobjekt abrufen
                CtClass ctClass = classPool.get(dotClassName);
                
                // Abstrakte Klassen und Interfaces überspringen
                if (ctClass.isInterface() || ctClass.isAbstract()) {
                    return null;
                }
                
                boolean modified = false;
                
                // Alle Methoden durchgehen und instrumentieren
                for (CtMethod method : ctClass.getDeclaredMethods()) {
                    // Native und abstrakte Methoden überspringen
                    if (method.isEmpty()) continue;
                    
                    try {
                        // Prüfen, ob die Methode potenziell rekursiv ist
                        // (vereinfachte Heuristik, in Realität würde eine AST-Analyse durchgeführt)
                        String body = method.getMethodInfo().getCodeAttribute().toString();
                        if (body.contains(method.getName() + "(")) {
                            instrumentMethod(method);
                            modified = true;
                        }
                    } catch (Exception e) {
                        logger.log(Level.WARNING, "Fehler bei der Analyse von " + 
                                  dotClassName + "." + method.getName(), e);
                    }
                }
                
                // Nur transformierte Klassen zurückgeben
                if (modified) {
                    return ctClass.toBytecode();
                }
            } catch (NotFoundException e) {
                // Klasse nicht gefunden, ignorieren
            } catch (Exception e) {
                logger.log(Level.WARNING, "Fehler bei der Transformation von " + dotClassName, e);
            }
            
            return null;
        }
        
        /**
         * Instrumentiert eine Methode mit Rekursionsüberwachung
         */
        private void instrumentMethod(CtMethod method) throws Exception {
            // Methodenname für Tracking
            String fullMethodName = method.getDeclaringClass().getName() + "." + method.getName();
            
            // Code vor der Methode einfügen
            method.insertBefore(
                "{ " +
                "    com.claude.recursion.RecursionAgent.enterMethod(\"" + fullMethodName + "\"); " +
                "}"
            );
            
            // Code nach der Methode einfügen
            method.insertAfter(
                "{ " +
                "    com.claude.recursion.RecursionAgent.exitMethod(\"" + fullMethodName + "\"); " +
                "}"
            );
            
            logger.fine("Instrumentiert: " + fullMethodName);
        }
    }
    
    /**
     * Wird beim Betreten einer überwachten Methode aufgerufen
     */
    public static void enterMethod(String methodName) {
        long threadId = Thread.currentThread().getId();
        
        // Thread-spezifische Call-Stack-Info abrufen oder erstellen
        CallStackInfo callStackInfo = threadCallStacks.computeIfAbsent(
            threadId, k -> new CallStackInfo());
        
        // Aufrufstatistik für diese Methode abrufen oder erstellen
        RecursionStats stats = recursionStats.computeIfAbsent(
            methodName, k -> new RecursionStats());
        
        // Aufrufzähler erhöhen
        stats.callCount.incrementAndGet();
        
        // Aktuelle Rekursionstiefe für diese Methode abrufen oder auf 0 setzen
        int currentDepth = callStackInfo.currentDepth.getOrDefault(methodName, 0);
        int newDepth = currentDepth + 1;
        
        // Rekursionstiefe aktualisieren
        callStackInfo.currentDepth.put(methodName, newDepth);
        
        // Wenn wir eine rekursive Methode betreten, merken wir sie uns
        if (newDepth > 1) {
            callStackInfo.activeRecursions.add(methodName);
            
            // Maximale Rekursionstiefe aktualisieren
            stats.maxDepth.updateAndGet(current -> Math.max(current, newDepth));
            
            // Bei Überschreiten der Warnschwelle loggen und eventuell Workflow auslösen
            if (newDepth >= maxRecursionDepth && newDepth % 100 == 0) {
                logger.warning("Tiefe Rekursion in " + methodName + ": " + newDepth + " Ebenen");
                
                // Bei sehr tiefer Rekursion Debug-Workflow auslösen
                if (newDepth >= maxRecursionDepth * 2) {
                    triggerDebugWorkflow(methodName, stats);
                }
            }
        }
    }
    
    /**
     * Wird beim Verlassen einer überwachten Methode aufgerufen
     */
    public static void exitMethod(String methodName) {
        long threadId = Thread.currentThread().getId();
        
        // Thread-spezifische Call-Stack-Info abrufen
        CallStackInfo callStackInfo = threadCallStacks.get(threadId);
        if (callStackInfo == null) return;
        
        // Aktuelle Rekursionstiefe für diese Methode abrufen
        Integer currentDepth = callStackInfo.currentDepth.get(methodName);
        if (currentDepth == null) return;
        
        // Rekursionstiefe verringern
        int newDepth = currentDepth - 1;
        if (newDepth > 0) {
            callStackInfo.currentDepth.put(methodName, newDepth);
        } else {
            // Wenn wir die äußerste Aufrufebene verlassen haben, Einträge entfernen
            callStackInfo.currentDepth.remove(methodName);
            callStackInfo.activeRecursions.remove(methodName);
            
            // Wenn keine Rekursionen mehr aktiv sind, Thread-Info aufräumen
            if (callStackInfo.activeRecursions.isEmpty()) {
                threadCallStacks.remove(threadId);
            }
        }
    }
}
