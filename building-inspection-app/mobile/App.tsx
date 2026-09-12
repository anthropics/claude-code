import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ReportScreen } from './src/screens/ReportScreen';
import { isLoggedIn } from './src/services/authService';

type Screen = { name: 'login' } | { name: 'dashboard' } | { name: 'report'; id: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'login' });
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        setScreen({ name: 'dashboard' });
      }
      setChecking(false);
    })();
  }, []);

  if (checking) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {screen.name === 'login' && (
        <LoginScreen onLoginSuccess={() => setScreen({ name: 'dashboard' })} />
      )}
      {screen.name === 'dashboard' && (
        <DashboardScreen
          onOpenReport={(id) => setScreen({ name: 'report', id })}
          onLogout={() => setScreen({ name: 'login' })}
        />
      )}
      {screen.name === 'report' && (
        <ReportScreen
          reportId={screen.id}
          onGoBack={() => setScreen({ name: 'dashboard' })}
        />
      )}
    </SafeAreaProvider>
  );
}
