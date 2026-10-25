import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c3b001c91ebc4b888264e21284718120',
  appName: 'NikNote',
  webDir: 'dist',
  // Ship the bundled build inside the APK (same logo, icons & AI as the
  // website). No remote server URL: the app boots offline-first and only the
  // AI calls leave the device (they go to the NikNote cloud gateway).
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;
