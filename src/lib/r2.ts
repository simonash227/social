import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'
import fs from 'node:fs'
import path from 'node:path'

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not set (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)')
  }

  return new S3Client({
    region: 'auto',  // Required by SDK, ignored by R2
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // Required for @aws-sdk/client-s3 v3.729.0+ — R2 doesn't support new checksum headers
    requestChecksumCalculation: 'WHEN_REQUIRED',
  })
}

/**
 * Upload a file to Cloudflare R2.
 */
export async function uploadToR2(bucket: string, key: string, body: Buffer | string): Promise<void> {
  const client = getR2Client()
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
  }))
}

/**
 * List objects in an R2 bucket with an optional prefix.
 * Returns a sorted array of object keys.
 */
export async function listR2Objects(bucket: string, prefix?: string): Promise<string[]> {
  const client = getR2Client()
  const res = await client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  }))
  return (res.Contents ?? [])
    .map(obj => obj.Key!)
    .filter(Boolean)
    .sort()
}

/**
 * Delete an object from an R2 bucket.
 */
export async function deleteR2Object(bucket: string, key: string): Promise<void> {
  const client = getR2Client()
  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  }))
}

/**
 * Get the public URL for an R2 object in the media bucket.
 * Requires R2_MEDIA_PUBLIC_BASE env var (e.g. https://media.example.com).
 */
export function getR2PublicUrl(key: string): string {
  const base = process.env.R2_MEDIA_PUBLIC_BASE
  if (!base) throw new Error('R2_MEDIA_PUBLIC_BASE env var not set')
  return `${base.replace(/\/$/, '')}/${key}`
}

/**
 * Run the daily database backup:
 * - Copies SQLite DB file to R2 with a date-stamped key
 * - Keeps the last 7 backups, deletes older ones
 */
export async function runDbBackup(): Promise<void> {
  const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? './data'
  const DB_PATH = path.join(DATA_DIR, 'app.db')
  const R2_BUCKET = process.env.R2_BACKUP_BUCKET ?? 'social-backups'

  const dateStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const backupKey = `backups/app-${dateStr}.db`

  // Read the DB file and upload
  const dbContent = fs.readFileSync(DB_PATH)
  await uploadToR2(R2_BUCKET, backupKey, dbContent)
  console.log(`[r2] DB backup uploaded: ${backupKey}`)

  // List all backup keys and delete oldest if > 7
  const allKeys = await listR2Objects(R2_BUCKET, 'backups/')
  if (allKeys.length > 7) {
    const toDelete = allKeys.slice(0, allKeys.length - 7)
    for (const key of toDelete) {
      await deleteR2Object(R2_BUCKET, key)
      console.log(`[r2] Deleted old backup: ${key}`)
    }
  }
}
