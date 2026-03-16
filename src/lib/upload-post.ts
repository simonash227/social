import { getBreaker } from './circuit-breaker'

const BASE_URL = 'https://api.upload-post.com/api'

export interface UploadPostProfile {
  username: string
  connected_platforms: string[]
  status: string
  created_at: string
}

interface UploadPostAccountInfo {
  username: string
  plan: string
  [key: string]: unknown
}

function getApiKey(): string {
  const apiKey = process.env.UPLOAD_POST_API_KEY
  if (!apiKey) throw new Error('UPLOAD_POST_API_KEY not set')
  return apiKey
}

function authHeaders() {
  return { Authorization: `Apikey ${getApiKey()}` }
}

/**
 * List all Upload-Post profiles connected to the account.
 */
export async function listProfiles(): Promise<UploadPostProfile[]> {
  return getBreaker('upload-post').call(async () => {
    const res = await fetch(`${BASE_URL}/uploadposts/users`, {
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error(`Upload-Post API error: ${res.status} ${res.statusText}`)
    const data = await res.json()
    return (data.profiles ?? []) as UploadPostProfile[]
  })
}

/**
 * Verify the API key and retrieve account info.
 */
export async function verifyApiKey(): Promise<UploadPostAccountInfo> {
  return getBreaker('upload-post').call(async () => {
    const res = await fetch(`${BASE_URL}/uploadposts/me`, {
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error(`Upload-Post API error: ${res.status} ${res.statusText}`)
    return res.json() as Promise<UploadPostAccountInfo>
  })
}
