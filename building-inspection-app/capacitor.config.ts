import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fi.kuntotarkastus.ai',
  appName: 'KuntotarkastusAI',
  webDir: 'frontend/dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#2563eb',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      launchShowDuration: 1500,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#2563eb',
    },
    Camera: {
      presentationStyle: 'fullscreen',
    },
  },
};

export default config;
