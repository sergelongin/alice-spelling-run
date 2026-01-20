import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
}

// Extend Window interface for HMR persistence
declare global {
  interface Window {
    __supabase?: SupabaseClient<Database>;
  }
}

// Persist client across HMR in development
function getSupabaseClient(): SupabaseClient<Database> {
  // In development, reuse existing client to prevent AbortError during HMR
  if (import.meta.env.DEV && window.__supabase) {
    return window.__supabase;
  }

  const client = createClient<Database>(
    supabaseUrl || '',
    supabaseAnonKey || '',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,   // Explicit: process OAuth tokens from URL hash
        storageKey: 'alice-spelling-run-auth',
        // Bypass navigator locks to prevent AbortError with React StrictMode
        // This no-op lock just executes the function directly without locking
        lock: (_name, _acquireTimeout, fn) => fn(),
      },
    }
  );

  // Store on window for HMR persistence in development
  if (import.meta.env.DEV) {
    window.__supabase = client;
  }

  return client;
}

export const supabase = getSupabaseClient();

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}
