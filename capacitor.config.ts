import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'online.niknote.app',
  appName: 'NikNote',
  webDir: 'dist',
  android: {
    // Notes are stored in localStorage/IndexedDB on this exact origin, so it must
    // never change or users lose their notes on update.
    allowMixedContent: false,
  },
  server: {
    // Self-contained build: the app ships its own bundle and works offline.
    androidScheme: 'https',
  },
};

export default config;
