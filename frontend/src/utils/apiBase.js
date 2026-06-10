/**
 * API Base URL helper
 * Inside Capacitor (native APK), the app loads from https://localhost,
 * so relative /api/... calls fail. Detect native and use the full hosted URL.
 */
import { Capacitor } from '@capacitor/core';

const rawUrl = Capacitor.isNativePlatform()
  ? 'https://trisphere-4b121.web.app'
  : (import.meta.env.VITE_API_URL || '');

// Strip trailing slashes to prevent double slashes (e.g. //api) in fetch calls
export const API_BASE_URL = rawUrl.replace(/\/+$/, '');
