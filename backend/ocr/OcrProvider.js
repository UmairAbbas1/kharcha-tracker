/**
 * OcrProvider.js
 * Interface definition for OCR providers.
 *
 * All providers must implement the scan() method with this signature.
 * Using JSDoc rather than a TypeScript interface so no transpilation is needed.
 *
 * To add a new provider:
 *   1. Create backend/ocr/providers/YourProvider.js
 *   2. Implement the scan() method below
 *   3. Register it in providerFactory.js
 */

/**
 * @interface OcrProvider
 */
export class OcrProvider {
  /**
   * Scan a receipt image and extract expense fields.
   *
   * @param   {string}   input       — base64 data URI ("data:image/jpeg;base64,...")
   * @param   {string[]} categories  — workspace category names for field mapping
   * @returns {Promise<{
   *   amount:   number|null,
   *   category: string|null,
   *   vendor:   string|null,
   *   date:     string|null,   // YYYY-MM-DD
   * }>}
   * @throws  {Error}  with .status property (400 validation, 422 parse fail, 503 not configured)
   */
  // eslint-disable-next-line no-unused-vars
  async scan(input, categories = []) {
    throw new Error('OcrProvider.scan() must be implemented by a subclass')
  }
}
