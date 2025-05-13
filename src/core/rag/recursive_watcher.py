#!/usr/bin/env python3
"""
Rekursionsüberwachung durch Patching von Imports
================================================

Dieses Modul patcht den Python-Import-Mechanismus, um rekursive Funktionen 
automatisch zu überwachen und bei Problemen den entsprechenden Debugging-Workflow 
auszulösen.

Verwendung:
  Importieren Sie dieses Modul in Ihrem Code:
  ```python
  import recursive_watcher
  ```
  
  Oder fügen Sie es als Preload-Modul hinzu:
  ```bash
  python -m recursive_watcher mein_script.py
  ```
"""

import os
import sys
import inspect
import functools
import importlib.abc
import importlib.util
import json
import traceback
import threading
import time
import signal
import atexit
import subprocess
from pathlib import Path

# Konfiguration laden
script_dir = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(script_dir, '..', 'config', 'debug_workflow_config.json')

try:
    with open(config_path, 'r') as f:
        config = json.load(f)
    # Schwellenwerte für Debugging
    recursion_depth_warning = int(config.get("debugging_thresholds", {}).get("recursion_depth_warning", 1000))
    function_call_warning = int(config.get("debugging_thresholds", {}).get("function_call_warning", 10000))
except Exception as e:
    print(f"Warnung: Konnte Konfiguration nicht laden: {e}")
    recursion_depth_warning = 1000
    function_call_warning = 10000

# Globaler Zustand
monitored_functions = {}
call_counts = {}
recursion_depths = {}
active_triggers = set()

# Klasse zum Patchen des Import-Mechanismus
class RecursionWatcherFinder(importlib.abc.MetaPathFinder):
    def __init__(self):
        self.original_finders = sys.meta_path.copy()
    
    def find_spec(self, fullname, path, target=None):
        """Findet Module und fügt Instrumentierung hinzu"""
        # Original finder verwenden, um das Modul zu finden
        for finder in self.original_finders:
            if finder is self:
                continue
            
            spec = finder.find_spec(fullname, path, target)
            if spec is not None:
                # Loader patchen, um Code zu instrumentieren
                if spec.loader and hasattr(spec.loader, 'exec_module'):
                    original_exec_module = spec.loader.exec_module
                    
                    @functools.wraps(original_exec_module)
                    def patched_exec_module(module):
                        # Original-Methode ausführen
                        original_exec_module(module)
                        
                        # Code-Objekte in diesem Modul instrumentieren
                        try:
                            instrument_module(module)
                        except Exception as e:
                            print(f"Fehler beim Instrumentieren von {module.__name__}: {e}")
                    
                    spec.loader.exec_module = patched_exec_module
                
                return spec
        
        return None

def instrument_module(module):
    """Instrumentiert alle rekursiven Funktionen in einem Modul"""
    for name, obj in module.__dict__.items():
        # Nur Funktionen instrumentieren
        if inspect.isfunction(obj) and not hasattr(obj, '_recursion_monitored'):
            # Überprüfen, ob die Funktion potenziell rekursiv ist
            try:
                source = inspect.getsource(obj)
                # Einfache Heuristik: Suche nach Selbstaufruf im Quelltext
                if obj.__name__ in source and '(' in source and ')' in source:
                    # Diese Funktion könnte rekursiv sein
                    instrument_function(obj, module.__name__, name)
            except (IOError, TypeError):
                pass  # Quelltextzugriff fehlgeschlagen, ignorieren

def instrument_function(func, module_name, func_name):
    """Instrumentiert eine einzelne Funktion zur Überwachung der Rekursionstiefe"""
    full_name = f"{module_name}.{func_name}"
    monitored_functions[full_name] = func
    call_counts[full_name] = 0
    recursion_depths[full_name] = []
    
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        # Thread-ID verwenden, um unabhängige Aufrufe zu unterscheiden
        thread_id = threading.get_ident()
        call_key = (full_name, thread_id)
        
        # Aufrufzähler erhöhen
        call_counts[full_name] += 1
        
        # Aktuelle Tiefe verfolgen
        if call_key in recursion_depths:
            recursion_depths[call_key].append(recursion_depths[call_key][-1] + 1)
        else:
            recursion_depths[call_key] = [1]
        
        current_depth = recursion_depths[call_key][-1]
        
        # Prüfen auf tiefe Rekursion
        if current_depth >= recursion_depth_warning and full_name not in active_triggers:
            active_triggers.add(full_name)
            print(f"\nWARNUNG: Tiefe Rekursion erkannt in {full_name} (Tiefe: {current_depth})")
            
            # Stacktrace für Analyse ausgeben
            stack = ''.join(traceback.format_stack())
            print("Aktueller Stack:")
            print(stack)
            
            # Timer starten, der den Debugging-Workflow auslösen wird, wenn wir nicht zurückkehren
            timer = threading.Timer(5.0, trigger_debug_workflow, args=(full_name, current_depth, stack))
            timer.daemon = True
            timer.start()
        
        try:
            # Originale Funktion aufrufen
            return func(*args, **kwargs)
        except RecursionError as e:
            if full_name not in active_triggers:
                active_triggers.add(full_name)
                # RecursionError abfangen und Debugging-Workflow auslösen
                trigger_debug_workflow(full_name, current_depth, traceback.format_exc())
            raise
        finally:
            # Aufruftiefe wieder reduzieren
            if call_key in recursion_depths and recursion_depths[call_key]:
                recursion_depths[call_key].pop()
                if not recursion_depths[call_key]:
                    del recursion_depths[call_key]
            
            # Trigger ggf. entfernen
            if full_name in active_triggers and current_depth <= recursion_depth_warning // 2:
                active_triggers.remove(full_name)
    
    wrapper._recursion_monitored = True
    
    # Originale Funktion ersetzen
    if hasattr(func, '__module__') and func.__module__ in sys.modules:
        module = sys.modules[func.__module__]
        if hasattr(module, func.__name__):
            setattr(module, func.__name__, wrapper)
    
    return wrapper

def trigger_debug_workflow(func_name, depth, stack_trace):
    """Löst den Debugging-Workflow aus"""
    print(f"\nTriggere Debugging-Workflow für {func_name} (Tiefe: {depth})")
    
    # Quellcode-Datei finden
    source_file = None
    if func_name in monitored_functions:
        func = monitored_functions[func_name]
        try:
            source_file = inspect.getfile(func)
        except (TypeError, OSError):
            pass
    
    if not source_file:
        print("Konnte Quelldatei nicht bestimmen")
        return
    
    # Debug-Workflow auslösen
    workflow_engine = os.path.join(script_dir, '..', '..', 'scripts', 'debug_workflow_engine.js')
    
    try:
        subprocess.run([
            "node",
            workflow_engine,
            "trigger",
            "runtime_error",
            "--file", source_file,
            "--error", "RecursionError: maximum recursion depth exceeded"
        ])
    except Exception as e:
        print(f"Fehler beim Auslösen des Debug-Workflows: {e}")

def print_monitoring_stats():
    """Gibt Statistiken über überwachte Funktionen aus"""
    print("\nStatistiken der Rekursionsüberwachung:")
    for name, count in sorted(call_counts.items(), key=lambda x: x[1], reverse=True):
        if count > 0:
            print(f"{name}: {count} Aufrufe")

def install():
    """Installiert den Rekursionsüberwachungs-Mechanismus"""
    # Finder einfügen
    finder = RecursionWatcherFinder()
    sys.meta_path.insert(0, finder)
    
    # Exit-Handler registrieren
    atexit.register(print_monitoring_stats)
    
    return finder

# Hauptfunktionalität
def main():
    """Hauptfunktion für den direkten Modulaufruf"""
    if len(sys.argv) < 2:
        print("Fehler: Keine Datei angegeben")
        print("Verwendung: python -m recursive_watcher [datei] [argumente...]")
        return 1
    
    script_path = sys.argv[1]
    script_args = sys.argv[2:]
    
    # Rekursionsüberwachung installieren
    install()
    
    # Skript ausführen
    sys.argv = [script_path] + script_args
    with open(script_path, 'rb') as f:
        code = compile(f.read(), script_path, 'exec')
        exec(code, {'__name__': '__main__', '__file__': script_path})
    
    return 0

# Automatische Installation beim Import
finder = install()

if __name__ == "__main__":
    sys.exit(main())
