/**
 * Sanitizes user-provided or feed-sourced text input.
 * - Strips HTML tags
 * - Removes invisible Unicode characters
 * - Normalizes whitespace
 */
export function sanitizeText(input: string): string {
  return input
    // Strip HTML tags
    .replace(/<[^>]*>/g, '')
    // Strip invisible Unicode (zero-width spaces, BOM, soft hyphens, line/paragraph separators)
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2028\u2029]/g, '')
    // Normalize spaces and tabs to single space
    .replace(/[ \t]+/g, ' ')
    // Normalize excessive newlines to max 2
    .replace(/\n{3,}/g, '\n\n')
    // Trim leading/trailing whitespace
    .trim()
}
