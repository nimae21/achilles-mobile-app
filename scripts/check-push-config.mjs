import { readFileSync } from 'node:fs'
import { loadEnv } from 'vite'

const env = loadEnv('production', process.cwd(), 'VITE_')
if ((process.env.VITE_PUSH_ENABLED ?? env.VITE_PUSH_ENABLED) === 'true') {
  try {
    const config = JSON.parse(readFileSync('android/app/google-services.json', 'utf8'))
    const gradle = readFileSync('android/app/build.gradle', 'utf8')
    const packageName = gradle.match(/applicationId\s+"([^"]+)"/)?.[1]
    if (config.type === 'service_account') throw new Error('Use the Android client google-services.json, never the server service-account key.')
    if (!config.project_info?.project_id || !config.client?.some(client => client.client_info?.android_client_info?.package_name === packageName)) {
      throw new Error('The Firebase Android client does not match this app package.')
    }
    console.log('Firebase Android client configuration checked.')
  } catch (error) {
    console.error('Android push setup is incomplete:', error.message)
    console.error('See FIREBASE_SETUP.md before building with VITE_PUSH_ENABLED=true.')
    process.exitCode = 1
  }
} else {
  console.log('Push is disabled for this build. Orders remain available.')
}
