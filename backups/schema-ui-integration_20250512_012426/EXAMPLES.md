# Claude Schema UI Examples

This document provides practical examples for using the Claude Schema UI components in various scenarios.

## Basic Form Example

```jsx
import React, { useState } from 'react';
import { SchemaForm, standaloneAdapter } from 'claude-schema-ui';

// Simple user schema
const userSchema = {
  title: "User Profile",
  type: "object",
  required: ["name", "email"],
  properties: {
    name: {
      type: "string",
      title: "Full Name"
    },
    email: {
      type: "string",
      title: "Email Address",
      format: "email"
    },
    age: {
      type: "number",
      title: "Age",
      minimum: 18
    },
    role: {
      type: "string",
      title: "Role",
      enum: ["user", "admin", "editor"],
      default: "user"
    }
  }
};

function UserProfileForm() {
  const [formData, setFormData] = useState({});
  const [submitted, setSubmitted] = useState(false);
  
  const handleChange = (data) => {
    setFormData(data);
  };
  
  const handleSubmit = (data) => {
    console.log('Form submitted:', data);
    setSubmitted(true);
    // In a real app, you would send this data to an API
  };
  
  return (
    <div className="form-container">
      <h1>User Profile</h1>
      
      {submitted ? (
        <div className="success-message">
          <h2>Profile Updated</h2>
          <p>Thank you for updating your profile, {formData.name}!</p>
          <button onClick={() => setSubmitted(false)}>Edit Again</button>
        </div>
      ) : (
        <SchemaForm
          adapter={standaloneAdapter}
          schema={userSchema}
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

export default UserProfileForm;
```

## Color Schema Editor Example

```jsx
import React from 'react';
import { ColorSchemaForm, createFrameworkAdapter } from 'claude-schema-ui';

// Sample adapter for the Claude Framework
const frameworkAdapter = createFrameworkAdapter({
  // Simplified mock implementation
  config: {
    get: (type) => {
      // Mock color schema configuration
      if (type === 'COLOR_SCHEMA') {
        return {
          themes: {
            light: {
              name: "Light Theme",
              colors: {
                primary: "#3f51b5",
                secondary: "#7986cb",
                accent: "#ff4081",
                success: "#4caf50",
                warning: "#ff9800",
                danger: "#f44336",
                info: "#2196f3",
                background: "#f8f9fa",
                surface: "#ffffff",
                text: "#212121",
                textSecondary: "#757575",
                border: "#e0e0e0"
              },
              accessibility: {
                wcag2AA: true,
                wcag2AAA: false,
                contrastRatio: 4.5
              }
            },
            dark: {
              name: "Dark Theme",
              colors: {
                primary: "#bb86fc",
                secondary: "#03dac6",
                accent: "#cf6679",
                success: "#4caf50",
                warning: "#ff9800",
                danger: "#cf6679",
                info: "#2196f3",
                background: "#121212",
                surface: "#1e1e1e",
                text: "#ffffff",
                textSecondary: "#b0b0b0",
                border: "#333333"
              },
              accessibility: {
                wcag2AA: true,
                wcag2AAA: false,
                contrastRatio: 4.5
              }
            }
          },
          userPreferences: {
            activeTheme: "dark"
          }
        };
      }
      return {};
    }
  },
  logger: {
    info: console.info,
    error: console.error,
    warn: console.warn,
    debug: console.debug
  }
});

function ThemeEditorPage() {
  const handleSave = (themeName, themeData) => {
    console.log(`Saved theme "${themeName}":`, themeData);
    // In a real app, you would update the theme in your system
  };
  
  return (
    <div className="theme-editor-container">
      <h1>Theme Editor</h1>
      
      <ColorSchemaForm
        adapter={frameworkAdapter}
        initialTheme="dark"
        onSave={handleSave}
      />
    </div>
  );
}

export default ThemeEditorPage;
```

## About Profile Form with Context7

```jsx
import React, { useState, useEffect } from 'react';
import { AboutProfileForm, createFrameworkAdapter } from 'claude-schema-ui';

// Sample Context7 adapter
const context7Adapter = createFrameworkAdapter({
  mcp: {
    invoke: async (service, method, params) => {
      console.log(`Invoking ${service}.${method}`, params);
      
      // Mock implementation for Context7
      if (service === 'context7') {
        if (method === 'getProfileContext') {
          // Return mock profile data
          return {
            profile: {
              userId: "user-123",
              personal: {
                name: "John Doe",
                skills: ["JavaScript", "React", "Node.js"]
              },
              preferences: {
                uiTheme: "dark",
                language: "en"
              },
              agentSettings: {
                isActive: true
              }
            }
          };
        }
        
        if (method === 'updateProfileContext') {
          // Mock successful update
          return { success: true };
        }
      }
      
      return null;
    }
  },
  logger: {
    info: console.info,
    error: console.error,
    warn: console.warn,
    debug: console.debug
  }
});

function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Load profile on component mount
  useEffect(() => {
    async function loadProfile() {
      try {
        // In a real app, this would use the Context7 API
        const result = await context7Adapter.mcp.invoke('context7', 'getProfileContext', {
          profileId: 'user-123'
        });
        
        if (result && result.profile) {
          setProfile(result.profile);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadProfile();
  }, []);
  
  const handleSave = async (updatedProfile) => {
    setLoading(true);
    
    try {
      // In a real app, this would save to the Context7 API
      await context7Adapter.mcp.invoke('context7', 'updateProfileContext', {
        profileId: 'user-123',
        profile: updatedProfile
      });
      
      setProfile(updatedProfile);
      setSaveSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading && !profile) {
    return <div>Loading profile...</div>;
  }
  
  return (
    <div className="profile-page-container">
      <h1>Edit Your Profile</h1>
      
      {saveSuccess && (
        <div className="success-message">
          Profile saved successfully!
        </div>
      )}
      
      <AboutProfileForm
        adapter={context7Adapter}
        initialData={profile}
        onSave={handleSave}
        loading={loading}
      />
    </div>
  );
}

export default ProfilePage;
```

## Integrating with Claude Desktop

```jsx
import React from 'react';
import { render } from 'react-dom';
import { SchemaForm, createFrameworkAdapter } from 'claude-schema-ui';
import { claudeDesktop } from '@claude/desktop';

// Create adapter for Claude Desktop
const desktopAdapter = createFrameworkAdapter({
  mcp: claudeDesktop.mcp,
  logger: claudeDesktop.logger,
  config: claudeDesktop.config,
  i18n: claudeDesktop.i18n
});

// Get schema from Claude Desktop API
const schema = claudeDesktop.getSchema('user_profile');

function App() {
  const handleSubmit = (data) => {
    // Save profile data using Claude Desktop API
    claudeDesktop.saveProfile(data);
  };
  
  return (
    <div className="claude-desktop-app">
      <h1>Claude Desktop Profile</h1>
      
      <SchemaForm
        adapter={desktopAdapter}
        schema={schema}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

// Render the app in Claude Desktop container
render(<App />, document.getElementById('claude-desktop-root'));
```

## Using with Next.js and API Routes

```jsx
// pages/profile.js
import React, { useState, useEffect } from 'react';
import { AboutProfileForm, standaloneAdapter } from 'claude-schema-ui';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadProfile() {
      const response = await fetch('/api/profile');
      const data = await response.json();
      setProfile(data);
      setLoading(false);
    }
    
    loadProfile();
  }, []);
  
  const handleSave = async (updatedProfile) => {
    setLoading(true);
    
    await fetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedProfile)
    });
    
    setProfile(updatedProfile);
    setLoading(false);
  };
  
  if (loading && !profile) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="container">
      <h1>User Profile</h1>
      
      <AboutProfileForm
        adapter={standaloneAdapter}
        initialData={profile}
        onSave={handleSave}
        loading={loading}
      />
    </div>
  );
}

// pages/api/profile.js
import { getSession } from 'next-auth/react';

// Mock database
let userProfiles = {
  'user-123': {
    userId: 'user-123',
    personal: {
      name: 'Jane Smith',
      skills: ['React', 'Next.js']
    },
    preferences: {
      uiTheme: 'dark'
    },
    agentSettings: {
      isActive: true
    }
  }
};

export default async function handler(req, res) {
  const session = await getSession({ req });
  
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const userId = session.user.id;
  
  if (req.method === 'GET') {
    // Return user profile
    const profile = userProfiles[userId] || {
      userId,
      personal: {
        name: '',
        skills: []
      },
      preferences: {
        uiTheme: 'system'
      },
      agentSettings: {
        isActive: false
      }
    };
    
    return res.status(200).json(profile);
  }
  
  if (req.method === 'POST') {
    // Update user profile
    const updatedProfile = req.body;
    userProfiles[userId] = updatedProfile;
    
    return res.status(200).json({ success: true });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
```