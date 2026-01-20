#!/usr/bin/env node
/**
 * Run SQL migration against Supabase using fetch
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = 'gibingvfmrmelpchlwzn';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
  console.error('Usage: node run-migration.mjs <service_role_key>');
  process.exit(1);
}

// Read migration file
const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '001_auth_and_audio.sql');
const fullSql = readFileSync(migrationPath, 'utf-8');

// Parse SQL into individual statements
function parseSQL(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';

  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip pure comment lines outside statements
    if (!current && trimmed.startsWith('--')) continue;

    // Check for dollar quoting (for function bodies)
    if (!inDollarQuote) {
      const dollarMatch = line.match(/\$(\w*)\$/);
      if (dollarMatch) {
        inDollarQuote = true;
        dollarTag = dollarMatch[0];
      }
    } else if (line.includes(dollarTag) && line.indexOf(dollarTag) !== line.lastIndexOf(dollarTag)) {
      // Found closing dollar quote
      inDollarQuote = false;
    } else if (line.includes(dollarTag)) {
      inDollarQuote = false;
    }

    current += line + '\n';

    // Statement ends with semicolon (but not inside dollar quote)
    if (!inDollarQuote && trimmed.endsWith(';')) {
      const stmt = current.trim();
      if (stmt && !stmt.match(/^--/)) {
        statements.push(stmt);
      }
      current = '';
    }
  }

  // Add any remaining statement
  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

async function executeSQL(sql) {
  // Use the pg_graphql or direct execution endpoint
  // Supabase doesn't expose direct SQL via REST, so we'll need to use the RPC approach

  // First, let's try creating a temporary function to execute SQL
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ sql_query: sql })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

async function runMigration() {
  console.log('Starting migration...');

  // The REST API doesn't support raw SQL execution
  // We need to use the Supabase dashboard or CLI

  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║  The Supabase REST API doesn't support direct SQL execution.       ║
║  Please run the migration manually:                                ║
║                                                                    ║
║  1. Go to: https://supabase.com/dashboard/project/${PROJECT_REF}/sql ║
║  2. Paste the contents of:                                         ║
║     supabase/migrations/001_auth_and_audio.sql                     ║
║  3. Click "Run"                                                    ║
║                                                                    ║
║  After running the migration and signing up with your account,     ║
║  run this SQL to make yourself super admin:                        ║
║                                                                    ║
║  UPDATE profiles SET role = 'super_admin'                          ║
║  WHERE email = 'serge.longin@gmail.com';                           ║
╚════════════════════════════════════════════════════════════════════╝
  `);
}

runMigration();
