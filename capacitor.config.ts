import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Kept identical to android/app/build.gradle `applicationId` and to the
  // registered Firebase Android client. Changing this would invalidate
  // google-services.json and the installed app identity.
  appId: 'io.ionic.starter',
  appName: 'Achilles Super Admin',
  webDir: 'dist',
  plugins: {
    PushNotifications: { presentationOptions: ['sound', 'alert'] },
  },
};
export default config;