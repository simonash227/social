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

interface PublishTextPostResponse {
  request_id?: string
  job_id?: string
  [key: string]: unknown
}

/**
 * Publish a text post to one or more platforms via Upload-Post.
 * Sends immediately (no scheduled_date) — the project owns scheduling.
 */
export async function publishTextPost(opts: {
  uploadPostUsername: string
  platforms: string[]
  content: string
}): Promise<PublishTextPostResponse> {
  return getBreaker('upload-post').call(async () => {
    const form = new FormData()
    form.append('user', opts.uploadPostUsername)
    for (const platform of opts.platforms) {
      form.append('platform[]', platform)
    }
    form.append('title', opts.content)

    const res = await fetch(`${BASE_URL}/upload_text`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    })
    if (!res.ok) throw new Error(`Upload-Post API error: ${res.status} ${res.statusText}`)
    return res.json() as Promise<PublishTextPostResponse>
  })
}
