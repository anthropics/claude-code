import React, { useState } from 'react';
import AboutProfileForm from './AboutProfileForm';
import { useProfile } from './ProfileContext';

/**
 * ProfilePage - Main page for viewing and editing profile information
 */
const ProfilePage = () => {
  const { profile, loading, error, saveProfile } = useProfile();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Handle form save
  const handleSave = async (data) => {
    setSaveSuccess(false);
    setSaveError(null);
    
    const success = await saveProfile(data);
    if (success) {
      setSaveSuccess(true);
      // Reset success message after a delay
      setTimeout(() => setSaveSuccess(false), 5000);
    } else {
      setSaveError('Failed to save profile. Please try again.');
    }
  };

  if (error) {
    return (
      <div className="profile-error">
        <h2>Error Loading Profile</h2>
        <p>{error}</p>
        <button 
          className="retry-button"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <h1>Your Profile</h1>
        <p>Manage your personal information and preferences</p>
      </header>
      
      {saveSuccess && (
        <div className="save-success">
          Profile saved successfully!
        </div>
      )}
      
      {saveError && (
        <div className="save-error">
          {saveError}
        </div>
      )}
      
      {loading && !profile ? (
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading your profile...</p>
        </div>
      ) : (
        <AboutProfileForm
          initialData={profile}
          onSave={handleSave}
          loading={loading}
        />
      )}
    </div>
  );
};

export default ProfilePage;