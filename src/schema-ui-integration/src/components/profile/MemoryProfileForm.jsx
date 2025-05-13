import React, { useState, useEffect } from 'react';
import { SchemaForm } from '../form';
import { useMemory } from './MemoryProvider';
import aboutSchema from '../../schemas/about-schema.json';

/**
 * MemoryProfileForm - Form for editing profiles with memory persistence
 * 
 * This component uses the memory system to store profile data 
 * even without backend integration.
 * 
 * @param {Object} props Component props
 * @param {string} props.userId User ID
 * @param {Function} props.onSave Callback when profile is saved
 * @param {Object} props.adapter Optional adapter for framework integration
 * @param {Object} props.className CSS class names for styling
 */
const MemoryProfileForm = ({
  userId = 'default',
  onSave,
  adapter,
  className = {}
}) => {
  const { 
    profile, 
    loading, 
    error: memoryError, 
    saveProfile 
  } = useMemory();
  
  const [formData, setFormData] = useState(profile || {});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [uiSchema, setUiSchema] = useState({});

  // Initialize form data when profile is loaded
  useEffect(() => {
    if (profile) {
      setFormData(profile);
    } else {
      // Create default profile data with userId
      setFormData({
        userId,
        personal: {
          name: '',
          skills: []
        },
        preferences: {
          uiTheme: 'dark'
        },
        agentSettings: {
          isActive: true
        }
      });
    }
    
    // Set up UI schema
    setUiSchema({
      personal: {
        classNames: {
          container: 'personal-section',
        }
      },
      preferences: {
        classNames: {
          container: 'preferences-section',
        }
      }
    });
  }, [profile, userId]);

  // Handle form data changes
  const handleChange = (data) => {
    setFormData(data);
    setSuccess(false);
  };
  
  // Handle form submission
  const handleSubmit = async (data) => {
    try {
      // Log with adapter if available
      if (adapter) {
        adapter.logger.info('Saving profile data to memory', { userId });
      }
      
      // Add/update userId
      const updatedData = {
        ...data,
        userId,
        lastUpdated: new Date().toISOString()
      };
      
      // Save to memory
      const success = await saveProfile(updatedData);
      
      if (success) {
        setSuccess(true);
        setError(null);
        
        // Call onSave callback if provided
        if (onSave) {
          onSave(updatedData);
        }
        
        // Hide success message after 3 seconds
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      } else {
        setError('Failed to save profile');
      }
    } catch (err) {
      const errorMessage = 'Error saving profile';
      setError(errorMessage);
      
      if (adapter) {
        adapter.logger.error(errorMessage, { error: err });
      } else {
        console.error(errorMessage, err);
      }
    }
  };

  // Get error message
  const errorMessage = error || memoryError;

  return (
    <div className={className.container || 'memory-profile-form'}>
      {errorMessage && (
        <div className={className.error || 'form-error'}>
          {errorMessage}
        </div>
      )}
      
      {success && (
        <div className={className.success || 'form-success'}>
          Profile saved successfully!
        </div>
      )}
      
      <SchemaForm
        schema={aboutSchema}
        uiSchema={uiSchema}
        formData={formData}
        onChange={handleChange}
        onSubmit={handleSubmit}
        id="memory-profile-form"
        className={{
          form: className.form || 'memory-profile-form',
          title: className.title || 'memory-profile-form-title',
          description: className.description || 'memory-profile-form-description',
          content: className.content || 'memory-profile-form-content',
          actions: className.actions || 'memory-profile-form-actions',
          submitButton: className.submitButton || 'memory-profile-submit-button',
        }}
      />
      
      {loading && (
        <div className={className.loadingOverlay || 'form-loading-overlay'}>
          <div className={className.loadingSpinner || 'loading-spinner'}></div>
          <p>Loading profile...</p>
        </div>
      )}
    </div>
  );
};

export default MemoryProfileForm;