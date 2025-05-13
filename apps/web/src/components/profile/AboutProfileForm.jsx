import React, { useState, useEffect } from 'react';
import { SchemaForm } from "./form";
import ProfileClient from './ProfileClient';

// Import from core framework
import { I18n } from "./../core/i18n/i18n";
const logger = require('../../core/logging/logger').createLogger('about-profile-form');
const errorHandler = require('../../core/error/error_handler');
const configManager = require('../../core/config/config_manager');
const { CONFIG_TYPES } = configManager;

/**
 * AboutProfileForm - Form for editing an about profile
 * 
 * @param {Object} props Component props
 * @param {Object} props.initialData Initial profile data
 * @param {Function} props.onSave Function called when form is saved
 * @param {boolean} props.loading Whether the form is in a loading state
 */
const AboutProfileForm = ({ initialData = {}, onSave, loading = false }) => {
  const [schema, setSchema] = useState(null);
  const [uiSchema, setUiSchema] = useState({});
  const [formData, setFormData] = useState(initialData);
  const [error, setError] = useState(null);
  const [i18n] = useState(new I18n());

  // Load the schema when the component mounts
  useEffect(() => {
    const loadSchema = async () => {
      try {
        logger.debug('Loading profile schema');
        
        // Use ProfileClient to load schema from Context7
        const schemaData = await ProfileClient.getProfileSchema();
        setSchema(schemaData);
        logger.info('Schema loaded successfully');
        
        // Apply color schema from configuration
        const colorSchemaConfig = configManager.getConfig(CONFIG_TYPES.COLOR_SCHEMA);
        const activeTheme = colorSchemaConfig.userPreferences.activeTheme;
        const themeColors = colorSchemaConfig.themes[activeTheme].colors;
        
        // Set up UI schema with customizations
        setUiSchema({
          // UI schema customizations based on theme
          person: {
            classNames: {
              container: 'person-section',
            },
            firstName: {
              classNames: {
                input: 'primary-input',
              },
            },
            lastName: {
              classNames: {
                input: 'primary-input',
              },
            },
          },
          preferences: {
            colorScheme: {
              classNames: {
                container: 'color-scheme-field',
              },
            },
            uiTheme: {
              // Use the active theme from configuration
              defaultValue: activeTheme
            }
          },
        });
        
        // Apply theme colors to initial form data if not already set
        if (initialData && initialData.preferences && !initialData.preferences.colorScheme) {
          setFormData({
            ...initialData,
            preferences: {
              ...initialData.preferences,
              colorScheme: themeColors
            }
          });
        }
      } catch (err) {
        const errorMessage = i18n.translate('errors.schemaLoadFailed');
        logger.error(errorMessage, { error: err });
        errorHandler.handleError('SCHEMA_LOAD_ERROR', err);
        setError(errorMessage);
      }
    };
    
    loadSchema();
  }, []);

  // Handle form data changes
  const handleChange = (newData) => {
    logger.debug('Form data changed');
    setFormData(newData);
  };
  
  // Handle form submission
  const handleSubmit = async (data) => {
    try {
      logger.debug('Form submitted');
      
      // Validate form data
      const validationResult = await ProfileClient.validateProfile(data);
      
      if (!validationResult.valid) {
        logger.warn('Validation failed', { errors: validationResult.errors });
        setError(i18n.translate('errors.validationFailed'));
        return;
      }
      
      if (onSave) {
        onSave(data);
      }
    } catch (err) {
      const errorMessage = i18n.translate('errors.submitFailed');
      logger.error(errorMessage, { error: err });
      errorHandler.handleError('FORM_SUBMIT_ERROR', err);
      setError(errorMessage);
    }
  };
  
  // Handle validation errors
  const handleError = (errors) => {
    logger.error('Validation errors', { errors });
    // Display errors to the user
    setError(i18n.translate('errors.validationFailed'));
  };

  if (error) {
    return (
      <div className="error-container" style={{
        color: configManager.getConfig(CONFIG_TYPES.COLOR_SCHEMA).themes.dark.colors.danger
      }}>
        <p className="error-message">{error}</p>
        <button 
          className="retry-button"
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: configManager.getConfig(CONFIG_TYPES.COLOR_SCHEMA).themes.dark.colors.primary,
            color: configManager.getConfig(CONFIG_TYPES.COLOR_SCHEMA).themes.dark.colors.text
          }}
        >
          {i18n.translate('actions.retry')}
        </button>
      </div>
    );
  }

  if (!schema) {
    return <div className="loading">{i18n.translate('status.loading')}</div>;
  }

  return (
    <div className="about-profile-form">
      <h1>{i18n.translate('profile.editTitle')}</h1>
      
      <SchemaForm
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onError={handleError}
        id="about-profile-form"
        className={{
          form: 'about-profile-form',
          title: 'about-profile-form-title',
          description: 'about-profile-form-description',
          content: 'about-profile-form-content',
          actions: 'about-profile-form-actions',
          submitButton: 'about-profile-submit-button',
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

export default AboutProfileForm;