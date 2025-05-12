import React, { useState, useEffect } from 'react';
import { SchemaForm } from './index';

// Import from core framework
const colorSchemaManager = require('../../core/mcp/color_schema_manager');
const configManager = require('../../core/config/config_manager');
const { CONFIG_TYPES } = configManager;
const logger = require('../../core/logging/logger').createLogger('color-schema-form');
const { I18n } = require('../../core/i18n/i18n');

/**
 * ColorSchemaForm - Specialized form for editing color schemas
 * 
 * This component integrates directly with the color_schema_manager.js to 
 * provide a schema-driven form for editing color schemas.
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
    boxShadow: `0 2px 4px rgba(0, 0, 0, 0.1)`,
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
      </div>
      
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

export default ColorSchemaForm;