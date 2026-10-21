import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'online.niknote.app',
  appName: 'NikNote',
  webDir: 'dist',
  server: {
    // Ship the same production build the web app serves.
    url: 'https://niknote.online',
    cleartext: false,
  },
};

export default config;
