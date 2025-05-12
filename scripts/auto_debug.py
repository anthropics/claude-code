#!/usr/bin/env python3
"""
Auto-Debug für rekursive Python-Algorithmen
===========================================

Dieses Skript führt Python-Dateien aus und überwacht auf rekursionsbedingte
Fehler. Bei Erkennung eines solchen Fehlers wird automatisch der passende
Debugging-Workflow ausgelöst.

Verwendung:
  python auto_debug.py [datei] [argumente...]
"""

import os
import sys
import json
import signal
import subprocess
import traceback
import tempfile
from pathlib import Path

# Konfiguration laden
script_dir = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(script_dir, '..', 'core', 'config', 'debug_workflow_config.json')

try:
    with open(config_path, 'r') as f:
        config = json.load(f)
except Exception as e:
    print(f"Warnung: Konnte Konfiguration nicht laden: {e}")
    config = {
        "auto_triggers": {
            "error_patterns": {
                "RecursionError: maximum recursion depth exceeded": "stack_overflow",
                "MemoryError": "performance"
            }
        }
    }

def run_with_error_detection(file_path, args=None):
    """Führt eine Python-Datei aus und überwacht auf Fehler"""
    if args is None:
        args = []
    
    file_path = os.path.abspath(file_path)
    
    if not os.path.exists(file_path):
        print(f"Fehler: Datei nicht gefunden: {file_path}")
        return 1
    
    print(f"Führe aus: {file_path} {' '.join(args)}")
    
    # Temporäre Datei für Fehlerausgabe
    error_file = tempfile.NamedTemporaryFile(delete=False, mode='w+')
    error_filename = error_file.name
    error_file.close()
    
    # Python-Skript für Fehlererfassung
    wrapper_code = f"""
import sys
import traceback

# Original sys.excepthook speichern
original_excepthook = sys.excepthook

# Angepasster excepthook für detaillierte Fehlererfassung
def custom_excepthook(exc_type, exc_value, exc_traceback):
    with open("{error_filename}", "w") as f:
        f.write(f"EXCEPTION_TYPE: {{exc_type.__name__}}\\n")
        f.write(f"EXCEPTION_VALUE: {{exc_value}}\\n")
        f.write("TRACEBACK:\\n")
        
        # Detaillierteren Traceback erfassen
        for frame in traceback.extract_tb(exc_traceback):
            f.write(f"  File {{frame.filename}}, line {{frame.lineno}}, in {{frame.name}}\\n")
            if frame.line:
                f.write(f"    {{frame.line}}\\n")
    
    # Original excepthook aufrufen
    original_excepthook(exc_type, exc_value, exc_traceback)

# Excepthook ersetzen
sys.excepthook = custom_excepthook

# Originaldatei ausführen
try:
    with open("{file_path}", "r") as f:
        code = compile(f.read(), "{file_path}", "exec")
        # Eigenes globals-Dictionary erstellen
        globals_dict = {{}}
        globals_dict.update(__builtins__.__dict__)
        globals_dict["__file__"] = "{file_path}"
        globals_dict["__name__"] = "__main__"
        
        # Original-Argumente setzen
        sys.argv = ["{file_path}"] + {args}
        
        # Code ausführen
        exec(code, globals_dict)
except SystemExit as e:
    sys.exit(e.code)
"""
    
    # Temporäre Wrapper-Datei erstellen
    wrapper_file = tempfile.NamedTemporaryFile(delete=False, suffix='.py', mode='w+')
    wrapper_file.write(wrapper_code)
    wrapper_file.flush()
    wrapper_filename = wrapper_file.name
    wrapper_file.close()
    
    try:
        # Wrapper ausführen
        result = subprocess.run(
            [sys.executable, wrapper_filename],
            capture_output=True,
            text=True
        )
        
        # Ausgabe anzeigen
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        
        # Prüfen auf Fehler
        if result.returncode != 0:
            print("\nFehler erkannt, analysiere...")
            
            # Fehlerinformationen laden
            error_info = {}
            try:
                with open(error_filename, 'r') as f:
                    error_text = f.read()
                    
                for line in error_text.splitlines():
                    if line.startswith("EXCEPTION_TYPE:"):
                        error_info["type"] = line.split(":", 1)[1].strip()
                    elif line.startswith("EXCEPTION_VALUE:"):
                        error_info["value"] = line.split(":", 1)[1].strip()
            except Exception as e:
                print(f"Fehler beim Lesen der Fehlerinformationen: {e}")
            
            # Workflow basierend auf Fehlertyp auswählen
            workflow_to_trigger = "standard"
            error_pattern = None
            
            error_patterns = config["auto_triggers"]["error_patterns"]
            
            # Fehlertyp prüfen
            for pattern, workflow in error_patterns.items():
                # In error_info oder stderr suchen
                if ("type" in error_info and pattern in error_info["type"]) or \
                   ("value" in error_info and pattern in error_info["value"]) or \
                   (result.stderr and pattern in result.stderr):
                    workflow_to_trigger = workflow
                    error_pattern = pattern
                    break
            
            if error_pattern:
                print(f"Fehlertyp erkannt: {error_pattern}")
                print(f"Löse Workflow '{workflow_to_trigger}' aus")
                
                # Debug-Workflow auslösen
                workflow_engine = os.path.join(script_dir, 'debug_workflow_engine.js')
                
                subprocess.run([
                    "node",
                    workflow_engine,
                    "trigger",
                    "runtime_error",
                    "--file", file_path,
                    "--error", error_pattern
                ])
            else:
                print("Kein bekanntes Fehlermuster erkannt")
        
        return result.returncode
    finally:
        # Temporäre Dateien aufräumen
        try:
            os.unlink(wrapper_filename)
            os.unlink(error_filename)
        except:
            pass

def main():
    """Hauptfunktion"""
    if len(sys.argv) < 2:
        print("Fehler: Keine Datei angegeben")
        print("Verwendung: python auto_debug.py [datei] [argumente...]")
        return 1
    
    file_path = sys.argv[1]
    args = sys.argv[2:]
    
    return run_with_error_detection(file_path, args)

if __name__ == "__main__":
    sys.exit(main())
