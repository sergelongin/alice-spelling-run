/**
 * Migration script to copy local word definitions to Supabase
 *
 * Run with: npx tsx scripts/migrate-words-to-supabase.ts
 *
 * Prerequisites:
 * 1. Run database migration first: supabase db push -p "$VITE_SUPABASE_DBPASSWPRD"
 * 2. Make sure you're logged in as a super_admin user
 * 3. Environment variables must be set (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
 */

import { createClient } from '@supabase/supabase-js';

// Import grade word files
import { grade3Words } from '../src/data/gradeWords/grade3';
import { grade4Words } from '../src/data/gradeWords/grade4';
import { grade5Words } from '../src/data/gradeWords/grade5';
import { grade6Words } from '../src/data/gradeWords/grade6';

// Environment variables should be set before running this script
// Run with: source .env && npx tsx scripts/migrate-words-to-supabase.ts

interface WordDefinition {
  word: string;
  definition: string;
  example?: string;
}

interface WordInsert {
  word: string;
  word_normalized: string;
  definition: string;
  example: string | null;
  grade_level: number;
}

// Normalize word for consistent storage
function normalizeWord(word: string): string {
  return word.toLowerCase().trim().replace(/[^a-z]/g, '');
}

// Create Supabase client with service role key (bypasses RLS)
function getSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL;
  // Prefer service role key for admin operations, fall back to anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.\n' +
      'Get the service role key with: supabase projects api-keys --project-ref gibingvfmrmelpchlwzn'
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('WARNING: Using anon key - RLS policies will be enforced.');
    console.warn('For admin operations, set SUPABASE_SERVICE_ROLE_KEY environment variable.\n');
  }

  return createClient(url, key);
}

// Convert word definition to insert format
function toInsertFormat(word: WordDefinition, gradeLevel: number): WordInsert {
  return {
    word: word.word.trim(),
    word_normalized: normalizeWord(word.word),
    definition: word.definition.trim(),
    example: word.example?.trim() || null,
    grade_level: gradeLevel,
  };
}

async function migrateWords() {
  console.log('Starting word migration to Supabase...\n');

  const supabase = getSupabaseClient();

  // Prepare all words with grade levels
  const allWords: WordInsert[] = [
    ...grade3Words.map((w) => toInsertFormat(w, 3)),
    ...grade4Words.map((w) => toInsertFormat(w, 4)),
    ...grade5Words.map((w) => toInsertFormat(w, 5)),
    ...grade6Words.map((w) => toInsertFormat(w, 6)),
  ];

  console.log(`Total words to migrate: ${allWords.length}`);
  console.log(`  Grade 3: ${grade3Words.length}`);
  console.log(`  Grade 4: ${grade4Words.length}`);
  console.log(`  Grade 5: ${grade5Words.length}`);
  console.log(`  Grade 6: ${grade6Words.length}`);
  console.log('');

  // Check for duplicates in the source data
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const word of allWords) {
    if (seen.has(word.word_normalized)) {
      duplicates.push(word.word);
    } else {
      seen.add(word.word_normalized);
    }
  }

  if (duplicates.length > 0) {
    console.log(`Warning: Found ${duplicates.length} duplicate words in source data:`);
    console.log(`  ${duplicates.slice(0, 10).join(', ')}${duplicates.length > 10 ? '...' : ''}`);
    console.log('');
  }

  // Remove duplicates (keep first occurrence)
  const uniqueWords: WordInsert[] = [];
  const uniqueNormalized = new Set<string>();
  for (const word of allWords) {
    if (!uniqueNormalized.has(word.word_normalized)) {
      uniqueNormalized.add(word.word_normalized);
      uniqueWords.push(word);
    }
  }

  console.log(`Unique words to migrate: ${uniqueWords.length}\n`);

  // Batch insert in chunks to avoid hitting limits
  const BATCH_SIZE = 50;
  let inserted = 0;
  let errors = 0;
  let skipped = 0;

  for (let i = 0; i < uniqueWords.length; i += BATCH_SIZE) {
    const batch = uniqueWords.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('words')
      .upsert(batch, {
        onConflict: 'word_normalized',
        ignoreDuplicates: true,
      })
      .select();

    if (error) {
      console.error(`Error inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
      errors += batch.length;
    } else {
      inserted += data?.length || 0;
      skipped += batch.length - (data?.length || 0);
    }

    // Progress indicator
    const progress = Math.min(100, Math.round(((i + batch.length) / uniqueWords.length) * 100));
    process.stdout.write(`\rProgress: ${progress}%`);
  }

  console.log('\n\nMigration complete!');
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped (already exist): ${skipped}`);
  console.log(`  Errors: ${errors}`);

  // Verify by counting
  const { count } = await supabase
    .from('words')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  console.log(`\nTotal active words in database: ${count}`);
}

// Run migration
migrateWords()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nFatal error:', err);
    process.exit(1);
  });
