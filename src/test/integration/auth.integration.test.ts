/**
 * Auth Integration Tests
 *
 * These tests run against a real Supabase instance to verify:
 * - Signup trigger creates profile correctly
 * - RLS policies allow expected operations
 * - End-to-end auth flow works
 *
 * Prerequisites:
 * - Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 * - Set RUN_INTEGRATION_TESTS=true to enable these tests
 *
 * Run with: RUN_INTEGRATION_TESTS=true npm test -- auth.integration
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get directory path in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file for integration tests
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '../../../.env');
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch {
    // .env file doesn't exist or can't be read
  }
}
loadEnv();

// Skip all tests if integration tests are not enabled
const shouldRun = process.env.RUN_INTEGRATION_TESTS === 'true';

// Test configuration (VITE_SUPABASE_PUBLISHABLE_KEY is the anon key)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Generate unique test email to avoid conflicts
// Using example.com which is a reserved domain for testing (RFC 2606)
const generateTestEmail = () =>
  `integration-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

describe.skipIf(!shouldRun)('Auth Integration Tests', () => {
  let supabase: SupabaseClient;
  const createdUsers: string[] = [];

  beforeAll(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        'Integration tests require VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env'
      );
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });

  afterAll(async () => {
    // Clean up: Sign out any remaining session
    if (supabase) {
      await supabase.auth.signOut();
    }

    // Note: Test users should be cleaned up manually or via a cleanup script
    // since we can't delete users with the anon key
    if (createdUsers.length > 0) {
      console.log('Test users created (manual cleanup may be needed):', createdUsers);
    }
  });

  it('should not return 500 error on signup attempt', async () => {
    const testEmail = generateTestEmail();
    const testPassword = 'testpassword123!';

    // Attempt signup - may fail due to email validation settings
    // The key assertion is: NO 500 errors (which would indicate trigger/RLS failure)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          display_name: 'Integration Test User',
        },
      },
    });

    // The critical check: no 500 server errors
    // 400 errors (validation, email format, etc.) are acceptable
    if (signUpError) {
      expect(signUpError.status).not.toBe(500);
      console.log(`Signup rejected (expected if email validation enabled): ${signUpError.message}`);
    } else {
      // Signup succeeded
      expect(signUpData.user).toBeDefined();
      expect(signUpData.user?.email).toBe(testEmail);

      if (signUpData.user) {
        createdUsers.push(signUpData.user.id);
      }

      // Verify profile was created by the trigger (only if we have a session)
      if (signUpData.session) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', signUpData.user!.id)
          .single();

        expect(profileError).toBeNull();
        expect(profile).toBeDefined();
        expect(profile?.role).toBe('parent');
      }
    }
  });

  it('should handle duplicate signup without 500 error', async () => {
    const testEmail = generateTestEmail();
    const testPassword = 'testpassword123!';

    // First signup
    const { error: firstError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    // First signup may fail due to email validation - that's ok
    if (firstError) {
      expect(firstError.status).not.toBe(500);
      return; // Skip duplicate test if first signup was rejected
    }

    // Second signup with same email
    const { error: secondError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    // The key check: no 500 errors
    if (secondError) {
      expect(secondError.status).not.toBe(500);
    }
  });

  it('should sign in without 500 error after signup', async () => {
    const testEmail = generateTestEmail();
    const testPassword = 'testpassword123!';

    // Sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    // Signup may fail due to email validation - that's ok
    if (signUpError) {
      expect(signUpError.status).not.toBe(500);
      return; // Skip signin test if signup was rejected
    }

    if (signUpData.user) {
      createdUsers.push(signUpData.user.id);
    }

    // Sign out first
    await supabase.auth.signOut();

    // Sign in (only works if email confirmation is disabled)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    // The key check: no 500 errors
    if (signInError) {
      expect(signInError.status).not.toBe(500);
    }
  });

  it('should reject invalid credentials without 500 error', async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: 'nonexistent@test.local',
      password: 'wrongpassword',
    });

    expect(error).toBeDefined();
    expect(error?.status).not.toBe(500);
    expect(error?.message).toMatch(/invalid|credentials/i);
  });
});
