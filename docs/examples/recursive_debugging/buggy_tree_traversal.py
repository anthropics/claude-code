"""
Fehlerhafte Baumtraversierungsfunktion mit mehreren Problemen:
- Unzureichende Überprüfung von Nullwerten
- Keine Zykluserkennung
- Tiefenbegrenzung fehlt
- Ineffiziente Rekursion
"""

class TreeNode:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None
        self.parent = None  # Kann zu zyklischen Referenzen führen

def build_sample_tree():
    """Erstellt einen Beispielbaum mit potenziellen Problemen"""
    root = TreeNode(1)
    root.left = TreeNode(2)
    root.right = TreeNode(3)
    root.left.left = TreeNode(4)
    root.left.right = TreeNode(5)
    root.right.left = TreeNode(6)
    root.right.right = TreeNode(7)
    
    # Eltern-Referenzen hinzufügen (kann zu Zyklen führen)
    root.left.parent = root
    root.right.parent = root
    root.left.left.parent = root.left
    root.left.right.parent = root.left
    root.right.left.parent = root.right
    root.right.right.parent = root.right
    
    # BUG: Zyklusbildung - ein Knoten verweist auf einen anderen Zweig
    # Dies führt zu einer unendlichen Rekursion ohne Zyklus-Erkennung
    root.left.left.left = root.right
    
    return root

def count_nodes_recursive(node):
    """
    Fehlerhafte rekursive Funktion zum Zählen von Knoten
    Enthält mehrere Bugs für das Debugging
    """
    # BUG: Fehlende Null-Überprüfung
    # Sollte prüfen: if node is None: return 0
    
    count = 1  # Aktueller Knoten
    
    # BUG: Keine Zyklus-Erkennung, kann zu endloser Rekursion führen
    
    # Rekursives Zählen der Kinder
    if node.left:
        count += count_nodes_recursive(node.left)
    if node.right:
        count += count_nodes_recursive(node.right)
        
    # BUG: Keine Überprüfung oder Verfolgung von besuchten Knoten
    
    return count

def depth_first_search(node, target_value, path=None):
    """
    Fehlerhafte rekursive Tiefensuche ohne Zyklus-Erkennung
    """
    if path is None:
        path = []  # BUG: Mutable Default-Argument (sollte innerhalb der Funktion initialisiert werden)
    
    # BUG: Fehlende Null-Überprüfung
    
    path.append(node.value)  # BUG: Modifiziert den übergebenen Pfad
    
    if node.value == target_value:
        return path
    
    # BUG: Keine Zyklus-Erkennung, kann zu endloser Rekursion führen
    
    if node.left:
        result = depth_first_search(node.left, target_value, path)
        if result:
            return result
            
    if node.right:
        result = depth_first_search(node.right, target_value, path)
        if result:
            return result
    
    # BUG: Pfad nicht bereinigt, wenn Ziel nicht gefunden wird
    # Sollte path.pop() aufrufen, bevor None zurückgegeben wird
    return None

def test_tree_traversal():
    """Testfunktion für Baumtraversierung"""
    tree = build_sample_tree()
    
    try:
        print("Anzahl der Knoten (rekursiv):", count_nodes_recursive(tree))
    except RecursionError as e:
        print(f"RecursionError: {e}")
    except Exception as e:
        print(f"Error: {e}")
    
    try:
        result = depth_first_search(tree, 7)
        print("Pfad zum Wert 7:", result)
    except RecursionError as e:
        print(f"RecursionError: {e}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_tree_traversal()
