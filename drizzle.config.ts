import { defineConfig } from 'drizzle-kit'
import path from 'node:path'

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? './data'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(DATA_DIR, 'app.db'),
  },
})
