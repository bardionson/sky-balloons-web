import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

/**
 * Neon serverless SQL client.
 * Use as a tagged template: await sql`SELECT * FROM mints WHERE id = ${id}`
 * Results are typed as unknown[] — cast to your type at the call site.
 * Never import this in client components.
 */
export const sql = neon(process.env.DATABASE_URL)
