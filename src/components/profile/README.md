# About Profile Components

This directory contains components for working with user profiles based on the About Schema.

## Overview

These components provide a complete solution for viewing, editing, and managing user profiles that conform to the About Schema. The components integrate with the Model Context Protocol (MCP) and Context7 to load and save profile data.

## Components

- `ProfilePage`: Main page component for viewing and editing profiles
- `AboutProfileForm`: Form component specifically for About profile schema
- `ProfileContext`: React Context for profile data management
- `ProfileClient`: Client utility for interacting with MCP and Context7

## Usage

### Basic Integration

```jsx
import { ProfileProvider, ProfilePage } from './components/profile';

function App() {
  return (
    <ProfileProvider>
      <ProfilePage />
    </ProfileProvider>
  );
}
```

### Accessing Profile Data

```jsx
import { useProfile } from './components/profile';

function MyComponent() {
  const { profile, loading, error, saveProfile } = useProfile();
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h1>Welcome, {profile.person.firstName}</h1>
      <button onClick={() => saveProfile({...profile, lastUpdated: new Date()})}>
        Update Profile
      </button>
    </div>
  );
}
```

### Direct API Usage

```js
import { ProfileClient } from './components/profile';

// Load a profile
async function loadUserProfile(userId) {
  try {
    const profile = await ProfileClient.loadProfile(userId);
    return profile;
  } catch (error) {
    console.error('Failed to load profile:', error);
  }
}

// Save a profile
async function saveUserProfile(userId, profileData) {
  try {
    await ProfileClient.saveProfile(userId, profileData);
    console.log('Profile saved successfully');
  } catch (error) {
    console.error('Failed to save profile:', error);
  }
}
```

## Schema Integration

The profile components are designed to work with the standardized About Schema located at `/workspace/core/schemas/profile/about-schema.json`. This schema defines the structure of user profiles including personal information, preferences, goals, and more.

## MCP and Context7 Integration

These components interact with the Model Context Protocol (MCP) and Context7 through the ProfileClient utility. This allows for seamless loading and saving of profile data through the established MCP infrastructure.