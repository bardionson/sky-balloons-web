import { neon } from '@neondatabase/serverless'

// Provide a dummy connection string during Vercel's build phase if the env var isn't set yet.
// It will throw at runtime if still missing during an actual query.
const dbUrl = process.env.DATABASE_URL || 'postgres://dummy:dummy@localhost/dummy'

/**
 * Neon serverless SQL client.
 * Use as a tagged template: await sql`SELECT * FROM mints WHERE id = ${id}`
 * Results are typed as unknown[] — cast to your type at the call site.
 * Never import this in client components.
 */
export const sql = neon(dbUrl)
