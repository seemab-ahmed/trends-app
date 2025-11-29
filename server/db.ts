import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../shared/schema';
import dotenv from 'dotenv';

// Ensure env is loaded when run from scripts
dotenv.config({ path: '../.env' });

function getNormalizedDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  console.log('Raw DATABASE_URL exists:', !!raw);
  if (!raw) {
    console.error('DATABASE_URL environment variable is not set!');
    // Fallback for Railway deployment
    const fallback = 'postgresql://postgres:erXKZIzQTMZHWCHbbgLHnAzYDljXdrIe@hopper.proxy.rlwy.net:26012/railway';
    console.log('Using fallback DATABASE_URL for Railway');
    return fallback;
  }
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^\[(.+)\]$/, '$1');
    const password = decodeURIComponent(u.password);
    const normalized = `${u.protocol}//${u.username}:${encodeURIComponent(password)}@${host}:${u.port}${u.pathname}${u.search}`;
    console.log('Database connection to host:', host);
    return normalized;
  } catch (error) {
    console.error('Error parsing DATABASE_URL:', error);
    return raw; // fallback to provided string
  }
}

const connectionString = getNormalizedDatabaseUrl();
console.log('Creating database pool...');

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Required for Railway PostgreSQL
  },
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
});

// Test connection on startup
pool.on('connect', () => {
  console.log('Database pool connected successfully');
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

export const db = drizzle(pool, { schema });

export { schema };