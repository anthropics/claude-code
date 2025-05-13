#!/usr/bin/env node

/**
 * MCP Frontend Integration Script
 * 
 * This script integrates frontend components with MCP tools and cleans up
 * redundant implementations.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const WORKSPACE_DIR = process.cwd();
const SRC_COMPONENTS_DIR = path.join(WORKSPACE_DIR, 'src/components');
const SCHEMA_UI_DIR = path.join(WORKSPACE_DIR, 'schema-ui-integration/src/components');
const BACKUP_DIR = path.join(WORKSPACE_DIR, 'backup/frontend_components_' + new Date().toISOString().replace(/:/g, '-'));
const HOOKS_DIR = path.join(WORKSPACE_DIR, 'src/hooks/mcp');

// Create backup directory
console.log(`Creating backup directory: ${BACKUP_DIR}`);
fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Create hooks directory if it doesn't exist
if (!fs.existsSync(HOOKS_DIR)) {
  fs.mkdirSync(HOOKS_DIR, { recursive: true });
}

// Function to recursively copy a directory
function copyDirectory(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const files = fs.readdirSync(source);
  
  for (const file of files) {
    const currentPath = path.join(source, file);
    const targetPath = path.join(destination, file);
    
    if (fs.lstatSync(currentPath).isDirectory()) {
      copyDirectory(currentPath, targetPath);
    } else {
      fs.copyFileSync(currentPath, targetPath);
    }
  }
}

// Backup components before modification
console.log('Backing up components...');
copyDirectory(SRC_COMPONENTS_DIR, path.join(BACKUP_DIR, 'src_components'));
copyDirectory(SCHEMA_UI_DIR, path.join(BACKUP_DIR, 'schema_ui_components'));

// Create enhanced version of ProfileContext with MCP integration
console.log('Creating enhanced ProfileContext with MCP integration...');

const enhancedProfileContextPath = path.join(SRC_COMPONENTS_DIR, 'profile/ProfileContext.enhanced.jsx');
const enhancedProfileContextContent = `import React, { createContext, useContext, useState, useEffect } from 'react';
import { useMcpContext7 } from "./../hooks/mcp";

// Create context
const ProfileContext = createContext(null);

/**
 * ProfileProvider - Context provider for about profile data with MCP integration
 * 
 * @param {Object} props Component props
 * @param {React.ReactNode} props.children Child components
 */
export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use the Context7 MCP hook
  const context7 = useMcpContext7();

  // Load profile data when component mounts
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        
        // Try to load profile from Context7 MCP
        if (context7.isAvailable) {
          const profileData = await context7.getDocument('profile');
          setProfile(profileData);
          setError(null);
          return;
        }
        
        // Fallback to API if MCP is unavailable
        const response = await fetch('/api/profile');
        if (!response.ok) {
          throw new Error(\`Failed to load profile: \${response.statusText}\`);
        }
        
        const profileData = await response.json();
        setProfile(profileData);
        setError(null);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };
    
    loadProfile();
  }, [context7.isAvailable]);

  // Save profile data
  const saveProfile = async (profileData) => {
    try {
      setLoading(true);
      
      // Try to save profile to Context7 MCP
      if (context7.isAvailable) {
        const result = await context7.saveDocument('profile', profileData);
        if (result.success) {
          setProfile(profileData);
          setError(null);
          return true;
        }
      }
      
      // Fallback to API if MCP is unavailable
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });
      
      if (!response.ok) {
        throw new Error(\`Failed to save profile: \${response.statusText}\`);
      }
      
      // Update local state with the latest data
      setProfile(profileData);
      setError(null);
      
      return true;
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to save profile data');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const contextValue = {
    profile,
    loading,
    error,
    saveProfile,
    // Expose Context7 features if available
    context7Features: context7.isAvailable ? {
      getDocumentHistory: context7.getDocumentHistory,
      resolveDocumentReference: context7.resolveReference
    } : null
  };

  return (
    <ProfileContext.Provider value={contextValue}>
      {children}
    </ProfileContext.Provider>
  );
};

// Custom hook for using the profile context
export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === null) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

export default ProfileContext;`;

fs.writeFileSync(enhancedProfileContextPath, enhancedProfileContextContent);

// Create Context7 MCP hook
console.log('Creating Context7 MCP hook...');

const context7HookPath = path.join(HOOKS_DIR, 'useContext7.js');
const context7HookContent = `import { useState, useEffect } from 'react';

/**
 * Custom hook for using the Context7 MCP tool
 * Provides document context, retrieval, and storage capabilities
 */
export function useMcpContext7() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if the Context7 MCP is available
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const response = await fetch('/api/mcp/context7/status');
        setIsAvailable(response.ok);
      } catch (err) {
        setIsAvailable(false);
        setError('Context7 MCP is not available');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAvailability();
  }, []);

  // Get document from Context7
  const getDocument = async (documentId, options = {}) => {
    if (!isAvailable) {
      throw new Error('Context7 MCP is not available');
    }
    
    try {
      const response = await fetch(\`/api/mcp/context7/documents/\${documentId}\`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(\`Failed to get document: \${response.statusText}\`);
      }
      
      return await response.json();
    } catch (err) {
      setError(\`Error getting document: \${err.message}\`);
      throw err;
    }
  };

  // Save document to Context7
  const saveDocument = async (documentId, data) => {
    if (!isAvailable) {
      throw new Error('Context7 MCP is not available');
    }
    
    try {
      const response = await fetch(\`/api/mcp/context7/documents/\${documentId}\`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(\`Failed to save document: \${response.statusText}\`);
      }
      
      return { success: true };
    } catch (err) {
      setError(\`Error saving document: \${err.message}\`);
      return { success: false, error: err.message };
    }
  };

  // Get document history
  const getDocumentHistory = async (documentId) => {
    if (!isAvailable) {
      throw new Error('Context7 MCP is not available');
    }
    
    try {
      const response = await fetch(\`/api/mcp/context7/documents/\${documentId}/history\`);
      
      if (!response.ok) {
        throw new Error(\`Failed to get document history: \${response.statusText}\`);
      }
      
      return await response.json();
    } catch (err) {
      setError(\`Error getting document history: \${err.message}\`);
      throw err;
    }
  };

  // Resolve a reference within a Context7 document
  const resolveReference = async (reference) => {
    if (!isAvailable) {
      throw new Error('Context7 MCP is not available');
    }
    
    try {
      const response = await fetch(\`/api/mcp/context7/resolve-reference\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reference })
      });
      
      if (!response.ok) {
        throw new Error(\`Failed to resolve reference: \${response.statusText}\`);
      }
      
      return await response.json();
    } catch (err) {
      setError(\`Error resolving reference: \${err.message}\`);
      throw err;
    }
  };

  return {
    isAvailable,
    isLoading,
    error,
    getDocument,
    saveDocument,
    getDocumentHistory,
    resolveReference
  };
}`;

fs.writeFileSync(context7HookPath, context7HookContent);

// Update hooks index file
console.log('Updating hooks index file...');

const hooksIndexPath = path.join(HOOKS_DIR, 'index.js');
let hooksIndexContent = '';

if (fs.existsSync(hooksIndexPath)) {
  hooksIndexContent = fs.readFileSync(hooksIndexPath, 'utf8');
  
  // Add export for the Context7 hook if it doesn't exist
  if (!hooksIndexContent.includes('useContext7')) {
    hooksIndexContent += `\nexport { useMcpContext7 } from './useContext7';\n`;
  }
} else {
  hooksIndexContent = `/**
 * MCP Hooks Library
 * 
 * This library provides React hooks for interacting with MCP tools directly
 * from frontend components.
 */

export { useMcpSequentialThinking } from './useSequentialThinking';
export { useMcpBraveSearch } from './useBraveSearch';
export { useMcpImageGeneration } from './useImageGeneration';
export { useMcp21stDevMagic } from './use21stDevMagic';
export { useMcpRealTimeUpdates } from './useRealTimeUpdates';
export { useMcpContext7 } from './useContext7';
`;
}

fs.writeFileSync(hooksIndexPath, hooksIndexContent);

// Create enhanced ColorSchemaForm with MCP integration
console.log('Creating enhanced ColorSchemaForm with MCP integration...');

const enhancedColorSchemaFormPath = path.join(SRC_COMPONENTS_DIR, 'form/ColorSchemaForm.enhanced.jsx');
const enhancedColorSchemaFormContent = `import React, { useState, useEffect } from 'react';
import { SchemaForm } from './index';

// Import from core framework
const colorSchemaManager = require('../../core/mcp/color_schema_manager');
const configManager = require('../../core/config/config_manager');
const { CONFIG_TYPES } = configManager;
const logger = require('../../core/logging/logger').createLogger('color-schema-form');
const { I18n } = require('../../core/i18n/i18n');

// Import MCP hooks
import { useMcp21stDevMagic } from "./../hooks/mcp";

/**
 * ColorSchemaForm - Specialized form for editing color schemas with MCP integration
 * 
 * This component integrates directly with the color_schema_manager.js to 
 * provide a schema-driven form for editing color schemas, and uses the
 * 21st-dev-magic MCP tool for theme generation suggestions.
 * 
 * @param {Object} props Component props
 * @param {Object} props.initialTheme Initial theme to edit
 * @param {Function} props.onSave Function called when a color schema is saved
 * @param {boolean} props.loading Whether the form is in a loading state
 */
const ColorSchemaForm = ({ initialTheme = 'dark', onSave, loading = false }) => {
  const [schema, setSchema] = useState(null);
  const [uiSchema, setUiSchema] = useState({});
  const [formData, setFormData] = useState(null);
  const [availableThemes, setAvailableThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(initialTheme);
  const [error, setError] = useState(null);
  const [i18n] = useState(new I18n());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionPrompt, setSuggestionPrompt] = useState('');
  
  // Use the 21st-dev-magic MCP hook for theme suggestions
  const { 
    component: suggestionComponent, 
    isLoading: isSuggestionLoading, 
    error: suggestionError, 
    generateComponent: generateSuggestion 
  } = useMcp21stDevMagic();

  // Create schema for the color schema form
  useEffect(() => {
    try {
      // Get color schema config
      const colorSchemaConfig = configManager.getConfig(CONFIG_TYPES.COLOR_SCHEMA);
      const themes = Object.keys(colorSchemaConfig.themes);
      setAvailableThemes(themes);
      
      // Get current theme
      const initialThemeData = colorSchemaConfig.themes[initialTheme] || colorSchemaConfig.themes.dark;
      
      // Create a schema for the color schema form
      const colorSchemaSchema = {
        title: i18n.translate('colorSchema.title'),
        description: i18n.translate('colorSchema.description'),
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: i18n.translate('colorSchema.name'),
            default: initialThemeData.name || initialTheme
          },
          colors: {
            type: 'object',
            title: i18n.translate('colorSchema.colors'),
            required: [
              'primary', 'secondary', 'accent', 'success', 'warning', 
              'danger', 'info', 'background', 'surface', 'text', 
              'textSecondary', 'border'
            ],
            properties: {
              primary: {
                type: 'string',
                title: i18n.translate('colorSchema.primary'),
                format: 'color',
                default: initialThemeData.colors.primary
              },
              secondary: {
                type: 'string',
                title: i18n.translate('colorSchema.secondary'),
                format: 'color',
                default: initialThemeData.colors.secondary
              },
              accent: {
                type: 'string',
                title: i18n.translate('colorSchema.accent'),
                format: 'color',
                default: initialThemeData.colors.accent
              },
              success: {
                type: 'string',
                title: i18n.translate('colorSchema.success'),
                format: 'color',
                default: initialThemeData.colors.success
              },
              warning: {
                type: 'string',
                title: i18n.translate('colorSchema.warning'),
                format: 'color',
                default: initialThemeData.colors.warning
              },
              danger: {
                type: 'string',
                title: i18n.translate('colorSchema.danger'),
                format: 'color',
                default: initialThemeData.colors.danger
              },
              info: {
                type: 'string',
                title: i18n.translate('colorSchema.info'),
                format: 'color',
                default: initialThemeData.colors.info
              },
              background: {
                type: 'string',
                title: i18n.translate('colorSchema.background'),
                format: 'color',
                default: initialThemeData.colors.background
              },
              surface: {
                type: 'string',
                title: i18n.translate('colorSchema.surface'),
                format: 'color',
                default: initialThemeData.colors.surface
              },
              text: {
                type: 'string',
                title: i18n.translate('colorSchema.text'),
                format: 'color',
                default: initialThemeData.colors.text
              },
              textSecondary: {
                type: 'string',
                title: i18n.translate('colorSchema.textSecondary'),
                format: 'color',
                default: initialThemeData.colors.textSecondary
              },
              border: {
                type: 'string',
                title: i18n.translate('colorSchema.border'),
                format: 'color',
                default: initialThemeData.colors.border
              }
            }
          },
          accessibility: {
            type: 'object',
            title: i18n.translate('colorSchema.accessibility'),
            properties: {
              wcag2AA: {
                type: 'boolean',
                title: i18n.translate('colorSchema.wcag2AA'),
                default: initialThemeData.accessibility?.wcag2AA || false
              },
              wcag2AAA: {
                type: 'boolean',
                title: i18n.translate('colorSchema.wcag2AAA'),
                default: initialThemeData.accessibility?.wcag2AAA || false
              },
              contrastRatio: {
                type: 'number',
                title: i18n.translate('colorSchema.contrastRatio'),
                minimum: 1,
                maximum: 21,
                default: initialThemeData.accessibility?.contrastRatio || 4.5
              }
            }
          }
        }
      };
      
      setSchema(colorSchemaSchema);
      
      // Create UI schema
      setUiSchema({
        colors: {
          classNames: {
            container: 'colors-section',
          },
        },
        accessibility: {
          classNames: {
            container: 'accessibility-section',
          },
        }
      });
      
      // Set initial form data
      setFormData({
        name: initialThemeData.name || initialTheme,
        colors: initialThemeData.colors,
        accessibility: initialThemeData.accessibility || {
          wcag2AA: true,
          wcag2AAA: false,
          contrastRatio: 4.5
        }
      });
      
    } catch (err) {
      logger.error('Error initializing color schema form', { error: err });
      setError(i18n.translate('errors.schemaInitFailed'));
    }
  }, [initialTheme]);

  // Handle theme selection change
  const handleThemeChange = (e) => {
    const themeName = e.target.value;
    setSelectedTheme(themeName);
    
    // Update form data with selected theme
    try {
      const colorSchemaConfig = configManager.getConfig(CONFIG_TYPES.COLOR_SCHEMA);
      const themeData = colorSchemaConfig.themes[themeName];
      
      if (themeData) {
        setFormData({
          name: themeData.name || themeName,
          colors: themeData.colors,
          accessibility: themeData.accessibility || {
            wcag2AA: true,
            wcag2AAA: false,
            contrastRatio: 4.5
          }
        });
      }
    } catch (err) {
      logger.error('Error loading theme', { theme: themeName, error: err });
      setError(i18n.translate('errors.themeLoadFailed'));
    }
  };

  // Handle form data changes
  const handleChange = (newData) => {
    setFormData(newData);
  };
  
  // Handle form submission
  const handleSubmit = async (data) => {
    try {
      logger.debug('Saving color schema', { theme: selectedTheme });
      
      // Format the theme data for color_schema_manager
      const themeData = {
        name: data.name,
        colors: data.colors,
        accessibility: data.accessibility
      };
      
      // Use color schema manager to save the theme
      const success = await colorSchemaManager.saveTheme(selectedTheme, themeData);
      
      if (success) {
        logger.info('Color schema saved successfully', { theme: selectedTheme });
        
        // Apply the theme if it's the active theme
        const colorSchemaConfig = configManager.getConfig(CONFIG_TYPES.COLOR_SCHEMA);
        if (colorSchemaConfig.userPreferences.activeTheme === selectedTheme) {
          await colorSchemaManager.applyTheme(selectedTheme);
        }
        
        if (onSave) {
          onSave(selectedTheme, themeData);
        }
      } else {
        setError(i18n.translate('errors.themeSaveFailed'));
      }
    } catch (err) {
      logger.error('Error saving color schema', { theme: selectedTheme, error: err });
      setError(i18n.translate('errors.themeSaveFailed'));
    }
  };

  // Toggle theme suggestion interface
  const toggleSuggestions = () => {
    setShowSuggestions(!showSuggestions);
  };

  // Handle suggestion prompt change
  const handleSuggestionPromptChange = (e) => {
    setSuggestionPrompt(e.target.value);
  };

  // Generate theme suggestion using 21st-dev-magic
  const handleGenerateSuggestion = async () => {
    if (!suggestionPrompt) return;
    
    try {
      // Call the MCP hook to generate a theme suggestion
      await generateSuggestion(\`Generate a color schema JSON with the following colors: primary, secondary, accent, success, warning, danger, info, background, surface, text, textSecondary, border. Theme description: \${suggestionPrompt}\`);
    } catch (err) {
      logger.error('Error generating theme suggestion', { error: err });
      setError('Failed to generate theme suggestion');
    }
  };

  // Apply a suggested theme
  const applySuggestion = (suggestionData) => {
    try {
      // Parse the suggested theme data
      const colors = JSON.parse(suggestionData);
      
      // Update the form data with the suggested colors
      setFormData({
        ...formData,
        colors: colors
      });
      
      // Close the suggestions panel
      setShowSuggestions(false);
    } catch (err) {
      logger.error('Error applying theme suggestion', { error: err });
      setError('Failed to apply theme suggestion');
    }
  };

  // Error and loading states
  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button 
          className="retry-button"
          onClick={() => window.location.reload()}
        >
          {i18n.translate('actions.retry')}
        </button>
      </div>
    );
  }

  if (!schema || !formData) {
    return <div className="loading">{i18n.translate('status.loading')}</div>;
  }

  // Preview component style based on current color schema
  const previewStyle = {
    backgroundColor: formData.colors.background,
    color: formData.colors.text,
    padding: '20px',
    marginBottom: '20px',
    borderRadius: '4px',
    boxShadow: \`0 2px 4px rgba(0, 0, 0, 0.1)\`,
  };

  const buttonStyle = {
    backgroundColor: formData.colors.primary,
    color: formData.colors.text,
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '8px',
  };

  const accentStyle = {
    backgroundColor: formData.colors.accent,
    color: formData.colors.text,
    padding: '8px',
    borderRadius: '4px',
    display: 'inline-block',
    marginRight: '8px',
  };

  return (
    <div className="color-schema-form">
      <h1>{i18n.translate('colorSchema.editTitle')}</h1>
      
      <div className="theme-selector">
        <label htmlFor="theme-select">{i18n.translate('colorSchema.selectTheme')}</label>
        <select 
          id="theme-select" 
          value={selectedTheme} 
          onChange={handleThemeChange}
          className="theme-select"
        >
          {availableThemes.map(theme => (
            <option key={theme} value={theme}>
              {configManager.getConfig(CONFIG_TYPES.COLOR_SCHEMA).themes[theme].name || theme}
            </option>
          ))}
        </select>
        
        <button 
          onClick={toggleSuggestions} 
          className="suggestion-button"
          style={{ 
            marginLeft: '10px',
            backgroundColor: formData.colors.primary,
            color: 'white'
          }}
        >
          {showSuggestions ? 'Hide Suggestions' : 'Get Theme Suggestions'}
        </button>
      </div>
      
      {/* Theme Suggestions Panel */}
      {showSuggestions && (
        <div className="theme-suggestions-panel">
          <h3>Generate Theme Suggestions</h3>
          <p>Describe the theme you want to generate:</p>
          
          <div className="suggestion-input">
            <input 
              type="text"
              value={suggestionPrompt}
              onChange={handleSuggestionPromptChange}
              placeholder="e.g., Modern dark theme with blue accents"
              className="suggestion-prompt-input"
            />
            
            <button 
              onClick={handleGenerateSuggestion}
              disabled={isSuggestionLoading || !suggestionPrompt}
              className="generate-suggestion-button"
              style={{ 
                backgroundColor: formData.colors.accent,
                color: 'white'
              }}
            >
              {isSuggestionLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>
          
          {suggestionError && (
            <div className="suggestion-error">
              {suggestionError}
            </div>
          )}
          
          {suggestionComponent && (
            <div className="suggestion-result">
              <h4>Suggestion Result:</h4>
              <pre>{JSON.stringify(suggestionComponent, null, 2)}</pre>
              
              <button 
                onClick={() => applySuggestion(suggestionComponent.code)}
                className="apply-suggestion-button"
                style={{ 
                  backgroundColor: formData.colors.success,
                  color: 'white'
                }}
              >
                Apply This Theme
              </button>
            </div>
          )}
        </div>
      )}
      
      <h2>{i18n.translate('colorSchema.preview')}</h2>
      <div style={previewStyle} className="theme-preview">
        <h3 style={{ color: formData.colors.text }}>{i18n.translate('colorSchema.previewTitle')}</h3>
        <p style={{ color: formData.colors.textSecondary }}>{i18n.translate('colorSchema.previewDescription')}</p>
        
        <div className="theme-preview-buttons">
          <button style={buttonStyle}>{i18n.translate('actions.primary')}</button>
          <button style={{ ...buttonStyle, backgroundColor: formData.colors.secondary }}>{i18n.translate('actions.secondary')}</button>
          <button style={{ ...buttonStyle, backgroundColor: formData.colors.danger }}>{i18n.translate('actions.danger')}</button>
        </div>
        
        <div className="theme-preview-elements" style={{ marginTop: '16px' }}>
          <span style={accentStyle}>{i18n.translate('colorSchema.accent')}</span>
          <span style={{ ...accentStyle, backgroundColor: formData.colors.success }}>{i18n.translate('colorSchema.success')}</span>
          <span style={{ ...accentStyle, backgroundColor: formData.colors.warning }}>{i18n.translate('colorSchema.warning')}</span>
          <span style={{ ...accentStyle, backgroundColor: formData.colors.info }}>{i18n.translate('colorSchema.info')}</span>
        </div>
      </div>
      
      <SchemaForm
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        onChange={handleChange}
        onSubmit={handleSubmit}
        id="color-schema-form"
        className={{
          form: 'color-schema-form',
          title: 'color-schema-form-title',
          description: 'color-schema-form-description',
          content: 'color-schema-form-content',
          actions: 'color-schema-form-actions',
          submitButton: 'color-schema-submit-button',
        }}
      />
      
      {loading && (
        <div className="form-loading-overlay">
          <div className="loading-spinner"></div>
          <p>{i18n.translate('status.saving')}</p>
        </div>
      )}
    </div>
  );
};

export default ColorSchemaForm;`;

fs.writeFileSync(enhancedColorSchemaFormPath, enhancedColorSchemaFormContent);

// Create usage document
console.log('Creating usage document...');

const usageDocPath = path.join(WORKSPACE_DIR, 'docs/guides/mcp_frontend_components.md');
const usageDocContent = `# MCP Frontend Components Guide

This guide demonstrates how to use the enhanced frontend components that integrate with MCP tools.

## Overview

The Claude Neural Framework frontend components have been enhanced to directly integrate with MCP tools, providing a seamless experience for users and developers. These enhanced components use the MCP hooks library to connect with MCP services.

## ProfileContext with Context7 Integration

The enhanced ProfileContext component uses the Context7 MCP tool to store and retrieve profile data, with a fallback to the traditional API approach when the MCP tool is unavailable.

### Usage

```jsx
import { ProfileProvider, useProfile } from "./components/profile/ProfileContext.enhanced";

function App() {
  return (
    <ProfileProvider>
      <ProfilePage />
    </ProfileProvider>
  );
}

function ProfilePage() {
  const { profile, loading, error, saveProfile } = useProfile();
  
  // Use the profile data
  if (loading) return <div>Loading profile...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h1>Welcome, {profile.personal.name}</h1>
      {/* Rest of component */}
    </div>
  );
}
```

### Advanced Features

The enhanced ProfileContext also provides access to advanced Context7 features if available:

```jsx
function AdvancedProfilePage() {
  const { profile, context7Features } = useProfile();
  
  async function viewHistoryHandler() {
    if (context7Features) {
      const history = await context7Features.getDocumentHistory('profile');
      console.log('Profile history:', history);
    }
  }
  
  // Rest of component
}
```

## ColorSchemaForm with 21st-dev-magic Integration

The enhanced ColorSchemaForm component uses the 21st-dev-magic MCP tool to generate theme suggestions based on user input.

### Usage

```jsx
import ColorSchemaForm from "./components/form/ColorSchemaForm.enhanced";

function ThemeSettingsPage() {
  const handleSave = (themeName, themeData) => {
    console.log('Theme saved:', themeName, themeData);
  };
  
  return (
    <div>
      <h1>Theme Settings</h1>
      <ColorSchemaForm 
        initialTheme="dark" 
        onSave={handleSave} 
      />
    </div>
  );
}
```

### Using Theme Suggestions

The ColorSchemaForm now includes a "Get Theme Suggestions" button that opens a panel where users can enter a description of the theme they want. The 21st-dev-magic MCP tool will generate a theme based on this description, which can then be applied to the form.

## MCP Hooks Library

The MCP hooks library provides React hooks for interacting with MCP tools directly from frontend components.

### Available Hooks

- \`useMcpSequentialThinking\`: For sequential thought generation
- \`useMcpBraveSearch\`: For web search
- \`useMcpImageGeneration\`: For image generation
- \`useMcp21stDevMagic\`: For UI component generation
- \`useMcpRealTimeUpdates\`: For real-time updates via WebSockets
- \`useMcpContext7\`: For document context, retrieval, and storage

### Example: Using Sequential Thinking

```jsx
import { useMcpSequentialThinking } from "./hooks/mcp";

function ThinkingComponent() {
  const { thinking, isLoading, error, generateThoughts } = useMcpSequentialThinking();
  
  const handleThink = async () => {
    await generateThoughts("Initial thought about solving this problem", { totalThoughts: 5 });
  };
  
  return (
    <div>
      <button onClick={handleThink} disabled={isLoading}>
        {isLoading ? 'Thinking...' : 'Think'}
      </button>
      
      {error && <div className="error">{error}</div>}
      
      {thinking && (
        <div className="thinking-result">
          <h3>Thought {thinking.thoughtNumber}/{thinking.totalThoughts}</h3>
          <p>{thinking.thought}</p>
        </div>
      )}
    </div>
  );
}
```

### Example: Using Image Generation

```jsx
import { useMcpImageGeneration } from "./hooks/mcp";

function ImageGenerationComponent() {
  const { images, isLoading, error, generateImages } = useMcpImageGeneration();
  const [prompt, setPrompt] = useState('');
  
  const handleGenerate = async () => {
    await generateImages(prompt, { numberOfImages: 2 });
  };
  
  return (
    <div>
      <input 
        type="text" 
        value={prompt} 
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter image description"
      />
      
      <button onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? 'Generating...' : 'Generate Images'}
      </button>
      
      {error && <div className="error">{error}</div>}
      
      <div className="image-gallery">
        {images.map((image, index) => (
          <img key={index} src={image.url} alt={\`Generated image \${index}\`} />
        ))}
      </div>
    </div>
  );
}
```

## Required Backend Integration

To support these enhanced components, your backend needs to implement the following API endpoints:

- \`/api/mcp/context7/status\`: Check if Context7 MCP is available
- \`/api/mcp/context7/documents/:id\`: Get/save documents from Context7
- \`/api/mcp/context7/documents/:id/history\`: Get document history
- \`/api/mcp/context7/resolve-reference\`: Resolve document references
- \`/api/mcp/sequential-thinking\`: Sequential thinking endpoint
- \`/api/mcp/brave-search\`: Search endpoint
- \`/api/mcp/imagen\`: Image generation endpoint
- \`/api/mcp/21st-dev-magic\`: UI component generation endpoint

Additionally, a WebSocket endpoint at \`ws://localhost:3000/mcp-updates\` is required for real-time updates.

## Migration Guide

If you're using the old components, you can migrate to the enhanced versions as follows:

1. Replace imports from \`../components/profile/ProfileContext\` with \`../components/profile/ProfileContext.enhanced\`
2. Replace imports from \`../components/form/ColorSchemaForm\` with \`../components/form/ColorSchemaForm.enhanced\`
3. Update backend API endpoints to support the MCP integration

For a complete migration, you can run the integration script:

\`\`\`
node scripts/cleanup/integrate_frontend_mcp.js
\`\`\`

This script will:
1. Backup existing components
2. Create enhanced versions of components with MCP integration
3. Add the required MCP hooks
4. Create documentation

After running the script, you can test the enhanced components and, if satisfied, replace the original files with the enhanced versions.`;

fs.writeFileSync(usageDocPath, usageDocContent);

console.log('Creating MCP hook for 21st-dev-magic...');

const magicHookPath = path.join(HOOKS_DIR, 'use21stDevMagic.js');
const magicHookContent = `import { useState, useCallback } from 'react';

/**
 * Custom hook for using the 21st Dev Magic MCP tool
 * Provides UI component generation capabilities
 */
export function useMcp21stDevMagic() {
  const [component, setComponent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const generateComponent = useCallback(async (prompt, options = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/mcp/21st-dev-magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          ...options
        })
      });
      
      if (!response.ok) {
        throw new Error(\`Error: \${response.status}\`);
      }
      
      const result = await response.json();
      setComponent(result);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  return {
    component,
    isLoading,
    error,
    generateComponent
  };
}`;

fs.writeFileSync(magicHookPath, magicHookContent);

// Create a script to continue the migration by replacing the original files
console.log('Creating migration continuation script...');

const migrationScriptPath = path.join(WORKSPACE_DIR, 'scripts/cleanup/apply_mcp_integration.js');
const migrationScriptContent = `#!/usr/bin/env node

/**
 * Apply MCP Integration
 * 
 * This script completes the migration by replacing the original files with
 * the enhanced versions that integrate with MCP tools.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const WORKSPACE_DIR = process.cwd();
const SRC_COMPONENTS_DIR = path.join(WORKSPACE_DIR, 'src/components');

console.log('Applying MCP integration changes...');

// Replace ProfileContext.jsx with the enhanced version
const profileContextPath = path.join(SRC_COMPONENTS_DIR, 'profile/ProfileContext.jsx');
const enhancedProfileContextPath = path.join(SRC_COMPONENTS_DIR, 'profile/ProfileContext.enhanced.jsx');

if (fs.existsSync(enhancedProfileContextPath)) {
  fs.copyFileSync(enhancedProfileContextPath, profileContextPath);
  console.log('Replaced ProfileContext.jsx with enhanced version');
} else {
  console.log('Enhanced ProfileContext not found, skipping replacement');
}

// Replace ColorSchemaForm.jsx with the enhanced version
const colorSchemaFormPath = path.join(SRC_COMPONENTS_DIR, 'form/ColorSchemaForm.jsx');
const enhancedColorSchemaFormPath = path.join(SRC_COMPONENTS_DIR, 'form/ColorSchemaForm.enhanced.jsx');

if (fs.existsSync(enhancedColorSchemaFormPath)) {
  fs.copyFileSync(enhancedColorSchemaFormPath, colorSchemaFormPath);
  console.log('Replaced ColorSchemaForm.jsx with enhanced version');
} else {
  console.log('Enhanced ColorSchemaForm not found, skipping replacement');
}

console.log('MCP integration changes applied successfully');
console.log('To revert the changes, restore the files from the backup directory');`;

fs.writeFileSync(migrationScriptPath, migrationScriptContent);
fs.chmodSync(migrationScriptPath, '755');

console.log('Frontend MCP integration completed successfully!');
console.log(`
Next steps:
1. Review the enhanced components in:
   - ${enhancedProfileContextPath}
   - ${enhancedColorSchemaFormPath}
2. Review the MCP hooks in:
   - ${context7HookPath}
   - ${magicHookPath}
3. Test the integration
4. When satisfied, run the migration script to apply the changes:
   node ${migrationScriptPath}
5. Check the documentation at:
   ${usageDocPath}
`);`;

fs.writeFileSync(context7HookPath, context7HookContent);
fs.chmodSync(path.join(WORKSPACE_DIR, 'scripts/cleanup/integrate_frontend_mcp.js'), '755');

console.log('Frontend MCP integration script created successfully!');
console.log('Run the script with: node scripts/cleanup/integrate_frontend_mcp.js');