/**
 * GroqProvider.js
 * OcrProvider implementation using Groq Llama 4 Scout (vision model).
 *
 * Wraps the existing receiptScanner.js logic — behavior is identical.
 * Uses the shared extractExpenseData module for JSON field extraction.
 */

import { OcrProvider }        from '../OcrProvider.js'
import { scanReceipt }        from '../receiptScanner.js'

export class GroqProvider extends OcrProvider {
  /**
   * Scan a receipt image using Groq Llama 4 Scout.
   *
   * @param   {string}   input       — base64 data URI
   * @param   {string[]} categories  — workspace category names
   * @returns {Promise<{ amount, category, vendor, date }>}
   */
  async scan(input, categories = []) {
    return scanReceipt(input, categories)
  }
}
