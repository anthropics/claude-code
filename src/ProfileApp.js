import React from 'react';
import { ProfileProvider, ProfilePage } from './components/profile';

/**
 * Profile App component for Claude Neural Framework
 */
function ProfileApp() {
  return (
    <div className="profile-app">
      <ProfileProvider>
        <ProfilePage />
      </ProfileProvider>
    </div>
  );
}

export default ProfileApp;