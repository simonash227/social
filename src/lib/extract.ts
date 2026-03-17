import { YoutubeTranscript } from 'youtube-transcript'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
// pdf-parse ESM types lack a default export; use dynamic require to avoid TS errors
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

const YOUTUBE_REGEX = /(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
const MAX_HTML_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * Extract readable text content from a URL.
 * Supports YouTube (transcript) and arbitrary articles (Readability).
 * Never throws — always returns an error string in the result object on failure.
 */
export async function extractFromUrl(
  url: string
): Promise<{ text: string; title?: string; error?: string }> {
  // 1. YouTube detection
  if (YOUTUBE_REGEX.test(url)) {
    try {
      const segments = await YoutubeTranscript.fetchTranscript(url)
      const text = segments.map((s) => s.text).join(' ')
      return { text }
    } catch {
      return {
        text: '',
        error: 'YouTube transcript unavailable — video may have disabled captions',
      }
    }
  }

  // 2. Article extraction via Readability
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SocialContentBot/1.0; +https://github.com/social)',
      },
    })

    let html = await res.text()

    // Guard: truncate oversized HTML to prevent jsdom memory spikes
    if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
      html = html.slice(0, MAX_HTML_BYTES)
    }

    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    return {
      text: article?.textContent?.trim() ?? '',
      title: article?.title ?? undefined,
    }
  } catch {
    return { text: '', error: 'Could not extract article content' }
  }
}

/**
 * Extract plain text from a PDF buffer.
 * Never throws — always returns an error string in the result object on failure.
 */
export async function extractPdf(
  buffer: Buffer
): Promise<{ text: string; error?: string }> {
  try {
    const data = await pdfParse(buffer)
    return { text: data.text.trim() }
  } catch {
    return { text: '', error: 'Could not extract PDF content' }
  }
}
