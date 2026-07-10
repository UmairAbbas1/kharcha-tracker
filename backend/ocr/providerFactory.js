/**
 * providerFactory.js
 * Returns the active OCR provider instance based on the OCR_PROVIDER
 * environment variable.
 *
 * Supported values:
 *   "groq"  (default) — Groq Llama 4 Scout vision model
 *
 * Usage:
 *   import { getActiveProvider } from './ocr/providerFactory.js'
 *   const provider = getActiveProvider()
 *   const result   = await provider.scan(imageDataUri, categories)
 *
 * To add a new provider:
 *   1. Create backend/ocr/providers/YourProvider.js
 *   2. Import it here
 *   3. Add a case to the switch below
 *   4. Set OCR_PROVIDER=yourkey in .env.backend
 */

import { GroqProvider } from './providers/GroqProvider.js'

// Singleton — provider is created once at startup and reused
let _instance = null

export function getActiveProvider() {
  if (_instance) return _instance

  const providerKey = (process.env.OCR_PROVIDER || 'groq').toLowerCase().trim()

  switch (providerKey) {
    case 'groq':
      _instance = new GroqProvider()
      console.log('[providerFactory] OCR provider: GroqProvider (llama-4-scout)')
      break

    default:
      console.warn(`[providerFactory] Unknown OCR_PROVIDER="${providerKey}" — defaulting to GroqProvider`)
      _instance = new GroqProvider()
      break
  }

  return _instance
}
