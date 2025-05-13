import React, { createContext, useContext, useState, useEffect } from 'react';
import memory from '../../utils/memory';

// Create memory context
const MemoryContext = createContext(null);

/**
 * MemoryProvider - Context provider for persistent memory across sessions
 * 
 * Provides a React context for accessing and manipulating persistent
 * memory data across sessions, even when offline or without backend.
 * 
 * @param {Object} props Component props
 * @param {React.ReactNode} props.children Child components
 * @param {string} props.userId User ID for memory isolation
 * @param {Object} props.adapter Optional adapter for framework integration
 */
export const MemoryProvider = ({ children, userId = 'default', adapter }) => {
  const [profileData, setProfileData] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionId] = useState(memory.getSessionId());
  
  // Log adapter info if provided
  useEffect(() => {
    if (adapter) {
      adapter.logger.debug('Memory system initialized with adapter', { type: adapter.type });
    } else {
      console.debug('Memory system initialized in standalone mode');
    }
  }, [adapter]);

  // Load memory data on component mount
  useEffect(() => {
    if (!userId) return;
    
    try {
      setLoading(true);
      
      // Load profile data
      const loadedProfile = memory.loadProfile(userId);
      setProfileData(loadedProfile);
      
      // Load preferences
      const loadedPreferences = memory.loadPreferences(userId);
      setPreferences(loadedPreferences);
      
      // Load history
      const loadedHistory = memory.getHistory(userId);
      setHistory(loadedHistory);
      
      if (adapter) {
        adapter.logger.info('Memory loaded for user', { userId });
      } else {
        console.info('Memory loaded for user', userId);
      }
    } catch (err) {
      const errorMessage = 'Failed to load memory data';
      setError(errorMessage);
      
      if (adapter) {
        adapter.logger.error(errorMessage, { userId, error: err });
        adapter.errorHandler.handle('MEMORY_LOAD_ERROR', err);
      } else {
        console.error(errorMessage, { userId, error: err });
      }
    } finally {
      setLoading(false);
    }
  }, [userId, adapter]);

  // Save profile data
  const saveProfile = async (data) => {
    try {
      if (adapter) {
        adapter.logger.debug('Saving profile to memory', { userId });
      }
      
      const success = memory.saveProfile(userId, data);
      
      if (success) {
        setProfileData(data);
        
        // Add to history
        memory.addToHistory(userId, 'profile_update', {
          timestamp: new Date().toISOString(),
          sessionId
        });
        
        // Refresh history
        setHistory(memory.getHistory(userId));
        
        return true;
      }
      
      return false;
    } catch (err) {
      const errorMessage = 'Failed to save profile data';
      
      if (adapter) {
        adapter.logger.error(errorMessage, { userId, error: err });
        adapter.errorHandler.handle('MEMORY_SAVE_ERROR', err);
      } else {
        console.error(errorMessage, { userId, error: err });
      }
      
      return false;
    }
  };

  // Save preferences
  const savePreferences = async (data) => {
    try {
      if (adapter) {
        adapter.logger.debug('Saving preferences to memory', { userId });
      }
      
      const success = memory.savePreferences(userId, data);
      
      if (success) {
        setPreferences(data);
        
        // Add to history
        memory.addToHistory(userId, 'preferences_update', {
          timestamp: new Date().toISOString(),
          sessionId
        });
        
        // Refresh history
        setHistory(memory.getHistory(userId));
        
        return true;
      }
      
      return false;
    } catch (err) {
      const errorMessage = 'Failed to save preferences';
      
      if (adapter) {
        adapter.logger.error(errorMessage, { userId, error: err });
        adapter.errorHandler.handle('MEMORY_SAVE_ERROR', err);
      } else {
        console.error(errorMessage, { userId, error: err });
      }
      
      return false;
    }
  };

  // Save color schema
  const saveColorSchema = async (themeName, themeData) => {
    try {
      if (adapter) {
        adapter.logger.debug('Saving color schema to memory', { userId, themeName });
      }
      
      const success = memory.saveColorSchema(themeName, themeData);
      
      if (success) {
        // Add to history
        memory.addToHistory(userId, 'theme_update', {
          themeName,
          timestamp: new Date().toISOString(),
          sessionId
        });
        
        // Refresh history
        setHistory(memory.getHistory(userId));
        
        return true;
      }
      
      return false;
    } catch (err) {
      const errorMessage = 'Failed to save color schema';
      
      if (adapter) {
        adapter.logger.error(errorMessage, { userId, themeName, error: err });
        adapter.errorHandler.handle('MEMORY_SAVE_ERROR', err);
      } else {
        console.error(errorMessage, { userId, themeName, error: err });
      }
      
      return false;
    }
  };

  // Clear user data
  const clearUserData = async () => {
    try {
      if (adapter) {
        adapter.logger.info('Clearing user data from memory', { userId });
      }
      
      const success = memory.clearUserData(userId);
      
      if (success) {
        setProfileData(null);
        setPreferences(null);
        setHistory([]);
        return true;
      }
      
      return false;
    } catch (err) {
      const errorMessage = 'Failed to clear user data';
      
      if (adapter) {
        adapter.logger.error(errorMessage, { userId, error: err });
        adapter.errorHandler.handle('MEMORY_CLEAR_ERROR', err);
      } else {
        console.error(errorMessage, { userId, error: err });
      }
      
      return false;
    }
  };

  const contextValue = {
    profile: profileData,
    preferences,
    history,
    sessionId,
    loading,
    error,
    saveProfile,
    savePreferences,
    saveColorSchema,
    clearUserData,
    
    // Direct memory access functions for advanced usage
    memory: {
      loadProfile: (id) => memory.loadProfile(id || userId),
      loadPreferences: (id) => memory.loadPreferences(id || userId),
      loadColorSchema: (themeName) => memory.loadColorSchema(themeName),
      getAllColorSchemas: () => memory.getAllColorSchemas(),
      getHistory: (id, type) => memory.getHistory(id || userId, type),
      addToHistory: (type, data) => memory.addToHistory(userId, type, data),
      clearAll: () => memory.clearAll()
    }
  };

  return (
    <MemoryContext.Provider value={contextValue}>
      {children}
    </MemoryContext.Provider>
  );
};

// Custom hook for using the memory context
export const useMemory = () => {
  const context = useContext(MemoryContext);
  if (context === null) {
    throw new Error('useMemory must be used within a MemoryProvider');
  }
  return context;
};

export default MemoryContext;