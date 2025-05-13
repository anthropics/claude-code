/**
 * Farbschema-Integration
 * =====================
 * 
 * Lädt und integriert das konfigurierte Farbschema in die Dashboard-UI.
 */

(function() {
  // Benutzereinstellungen aus localStorage oder vom Server laden
  async function loadColorSchema() {
    try {
      // Zuerst aus localStorage versuchen (für schnelleres Laden)
      const storedSchema = localStorage.getItem('claude_color_schema');
      
      if (storedSchema) {
        applyColorSchema(JSON.parse(storedSchema));
      }
      
      // Dann vom Server laden (für aktualisierte Einstellungen)
      const response = await fetch('/api/user/color-schema');
      
      if (response.ok) {
        const schema = await response.json();
        
        // Im localStorage für schnelleren Zugriff cachen
        localStorage.setItem('claude_color_schema', JSON.stringify(schema));
        
        // Schema anwenden
        applyColorSchema(schema);
      }
    } catch (error) {
      console.warn('Konnte Farbschema nicht laden:', error);
      
      // Fallback: CSS-Variablen aus color-schema.css verwenden
      // Diese werden bereits im HTML eingebunden
    }
  }
  
  // Farbschema auf die UI anwenden
  function applyColorSchema(schema) {
    if (!schema || !schema.colors) return;
    
    // CSS-Variablen direkt setzen
    const colors = schema.colors;
    const root = document.documentElement;
    
    // Primärfarben
    root.style.setProperty('--primary-color', colors.primary);
    root.style.setProperty('--secondary-color', colors.secondary);
    root.style.setProperty('--accent-color', colors.accent);
    
    // Statusfarben
    root.style.setProperty('--success-color', colors.success);
    root.style.setProperty('--warning-color', colors.warning);
    root.style.setProperty('--danger-color', colors.danger);
    root.style.setProperty('--info-color', colors.info || '#2196f3');
    
    // Neutralfarben
    root.style.setProperty('--background-color', colors.background);
    root.style.setProperty('--surface-color', colors.surface);
    root.style.setProperty('--text-color', colors.text);
    root.style.setProperty('--text-secondary-color', colors.textSecondary);
    root.style.setProperty('--border-color', colors.border);
    root.style.setProperty('--shadow-color', colors.shadow);
    
    // Legacy-Kompatibilität
    root.style.setProperty('--light-gray', colors.border);
    root.style.setProperty('--medium-gray', colors.textSecondary);
    root.style.setProperty('--dark-gray', colors.text);
    
    // Dynamische Anpassungen für UI-Komponenten
    applyDynamicStyles(schema);
  }
  
  // Dynamische Stilanpassungen basierend auf dem Farbschema
  function applyDynamicStyles(schema) {
    const colors = schema.colors;
    const isDark = isColorDark(colors.background);
    
    // Navbar-Anpassung
    const navbar = document.querySelector('.navbar');
    if (navbar) {
      if (isDark) {
        navbar.classList.remove('navbar-light', 'bg-light');
        navbar.classList.add('navbar-dark', 'bg-primary');
      } else {
        // Bei hellem Thema, dunklere Primärfarbe für besseren Kontrast
        navbar.style.backgroundColor = colors.primary;
        navbar.classList.remove('navbar-light', 'bg-light');
        navbar.classList.add('navbar-dark');
      }
    }
    
    // Karten-Anpassung für besseren Kontrast
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
      if (isDark) {
        card.style.backgroundColor = colors.surface;
        card.style.borderColor = lightenColor(colors.border, 0.1);
      }
    });
    
    // Tabellen-Anpassung
    const tables = document.querySelectorAll('.table');
    tables.forEach(table => {
      if (isDark) {
        table.classList.add('table-dark');
      } else {
        table.classList.remove('table-dark');
      }
    });
    
    // Chart.js-Anpassung (wenn vorhanden)
    if (window.Chart) {
      Chart.defaults.color = colors.text;
      Chart.defaults.borderColor = colors.border;
    }
  }
  
  // Hilfsfunktion: Überprüft, ob eine Farbe dunkel ist
  function isColorDark(hexColor) {
    // Hex zu RGB konvertieren
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    
    // Helligkeit berechnen (YIQ-Formel)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    // YIQ < 128 gilt als dunkel
    return yiq < 128;
  }
  
  // Hilfsfunktion: Hellt eine Farbe auf
  function lightenColor(hexColor, factor) {
    // Hex zu RGB konvertieren
    let r = parseInt(hexColor.substr(1, 2), 16);
    let g = parseInt(hexColor.substr(3, 2), 16);
    let b = parseInt(hexColor.substr(5, 2), 16);
    
    // Farbe aufhellen
    r = Math.min(255, Math.round(r + (255 - r) * factor));
    g = Math.min(255, Math.round(g + (255 - g) * factor));
    b = Math.min(255, Math.round(b + (255 - b) * factor));
    
    // Zurück zu Hex
    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = b.toString(16).padStart(2, '0');
    
    return `#${rHex}${gHex}${bHex}`;
  }
  
  // Thema-Umschalter in Einstellungen
  function setupThemeSwitcher() {
    const settingsModal = document.getElementById('settingsModal');
    
    if (!settingsModal) return;
    
    // Prüfen, ob der Themenwechsler bereits existiert
    if (document.getElementById('themeSelector')) return;
    
    // Themenwechsler in Einstellungsmodal hinzufügen
    const modalBody = settingsModal.querySelector('.modal-body');
    
    if (modalBody) {
      const themeSection = document.createElement('div');
      themeSection.className = 'mb-3';
      themeSection.innerHTML = `
        <label for="themeSelector" class="form-label">Farbschema</label>
        <select id="themeSelector" class="form-select">
          <option value="light">Helles Theme</option>
          <option value="dark">Dunkles Theme</option>
          <option value="blue">Blaues Theme</option>
          <option value="green">Grünes Theme</option>
          <option value="purple">Violettes Theme</option>
          <option value="custom">Benutzerdefiniert</option>
        </select>
        <div class="mt-2">
          <button id="customizeThemeBtn" class="btn btn-sm btn-outline-primary">
            Farbschema anpassen...
          </button>
        </div>
      `;
      
      modalBody.prepend(themeSection);
      
      // Event-Listener für Themenauswahl
      const themeSelector = document.getElementById('themeSelector');
      if (themeSelector) {
        // Aktives Thema setzen
        const currentTheme = localStorage.getItem('claude_theme_preference') || 'light';
        themeSelector.value = currentTheme;
        
        themeSelector.addEventListener('change', function() {
          const theme = this.value;
          localStorage.setItem('claude_theme_preference', theme);
          
          // Server-API aufrufen, um Thema zu speichern
          fetch('/api/user/set-theme', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ theme })
          }).catch(err => console.warn('Fehler beim Speichern des Themas:', err));
          
          // Seite neu laden, um Thema anzuwenden
          setTimeout(() => location.reload(), 500);
        });
      }
      
      // Event-Listener für Theme-Anpassung
      const customizeBtn = document.getElementById('customizeThemeBtn');
      if (customizeBtn) {
        customizeBtn.addEventListener('click', function() {
          // Zur Farbschema-Anpassungsseite navigieren
          window.location.href = '/settings/color-schema';
        });
      }
    }
  }
  
  // Beim Laden der Seite
  document.addEventListener('DOMContentLoaded', function() {
    // Farbschema laden und anwenden
    loadColorSchema();
    
    // Themenwechsler in Einstellungen einrichten
    setupThemeSwitcher();
  });
  
})();