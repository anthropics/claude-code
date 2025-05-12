import React, { createContext, useContext, useState, useEffect } from 'react';

// Create context
const ProfileContext = createContext(null);

/**
 * ProfileProvider - Context provider for about profile data
 * 
 * @param {Object} props Component props
 * @param {React.ReactNode} props.children Child components
 */
export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load profile data when component mounts
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        
        // In a real implementation, this would use the MCP client
        // to fetch the profile from Context7
        const response = await fetch('/api/profile');
        if (!response.ok) {
          throw new Error(`Failed to load profile: ${response.statusText}`);
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
  }, []);

  // Save profile data
  const saveProfile = async (profileData) => {
    try {
      setLoading(true);
      
      // In a real implementation, this would use the MCP client
      // to save the profile to Context7
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save profile: ${response.statusText}`);
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

export default ProfileContext;