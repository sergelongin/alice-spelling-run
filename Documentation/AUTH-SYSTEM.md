# Authentication System

This document covers the authentication architecture, OAuth setup, and user management for Alice Spelling Run.

## Overview

Alice Spelling Run uses **Supabase Auth** with two authentication methods:
1. **Email/Password** - Traditional signup with email confirmation
2. **Google OAuth** - One-click sign-in via Google

## Architecture

### Database Schema

```
┌─────────────────┐         ┌─────────────────┐
│   auth.users    │         │    profiles     │
│  (Supabase)     │ 1:1     │                 │
├─────────────────┤────────►├─────────────────┤
│ id (UUID)       │         │ id (UUID) FK    │
│ email           │         │ email           │
│ raw_user_meta   │         │ display_name    │
└─────────────────┘         │ role            │
                            │ created_at      │
                            └────────┬────────┘
                                     │ 1:N
                            ┌────────▼────────┐
                            │    children     │
                            ├─────────────────┤
                            │ id (UUID)       │
                            │ parent_id FK    │
                            │ name            │
                            │ grade_level     │
                            │ is_active       │
                            │ created_at      │
                            └─────────────────┘
```

### User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `parent` | Default role for all users | Manage own profile, CRUD own children |
| `super_admin` | Administrative access | All parent permissions + manage audio pronunciations |

### Auth Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                     Email/Password Flow                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Sign Up Form → Supabase signUp() → Email Confirmation Sent      │
│                                                                   │
│  User clicks email link → Email confirmed → Can now sign in      │
│                                                                   │
│  Sign In Form → Supabase signInWithPassword() → Session created  │
│                           │                                       │
│                           ▼                                       │
│              Database trigger fires (handle_new_user)             │
│                           │                                       │
│                           ▼                                       │
│              Profile row created in profiles table                │
│                           │                                       │
│                           ▼                                       │
│              AuthContext loads profile + children                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     Google OAuth Flow                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  "Continue with Google" button                                    │
│            │                                                      │
│            ▼                                                      │
│  supabase.auth.signInWithOAuth({ provider: 'google' })           │
│            │                                                      │
│            ▼                                                      │
│  Redirect to Google consent screen                               │
│            │                                                      │
│            ▼                                                      │
│  User authorizes → Google redirects to Supabase callback         │
│  (https://<project>.supabase.co/auth/v1/callback)                │
│            │                                                      │
│            ▼                                                      │
│  Supabase creates/updates auth.users row                         │
│            │                                                      │
│            ▼                                                      │
│  Database trigger creates profile (if new user)                  │
│            │                                                      │
│            ▼                                                      │
│  Redirect back to app (window.location.origin)                   │
│            │                                                      │
│            ▼                                                      │
│  AuthContext detects session, loads profile + children           │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Google OAuth Setup

### 1. Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**

Configure the following:

| Field | Development | Production |
|-------|-------------|------------|
| **Authorized JavaScript Origins** | `http://localhost:5173` | `https://yourdomain.com` |
| **Authorized Redirect URIs** | `https://gibingvfmrmelpchlwzn.supabase.co/auth/v1/callback` | Same |

6. Copy the **Client ID** and **Client Secret**

### 2. Supabase Dashboard Configuration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project → **Authentication** → **Providers**
3. Enable **Google**
4. Paste the **Client ID** and **Client Secret** from Google Cloud Console
5. Save

### 3. Environment Variables

No additional environment variables needed for OAuth - it's configured in Supabase Dashboard.

## Key Files

| File | Purpose |
|------|---------|
| `src/context/AuthContext.tsx` | Auth state management, provider wrapper |
| `src/lib/supabase.ts` | Supabase client initialization (includes navigator lock bypass for React StrictMode) |
| `src/lib/authCache.ts` | Auth cache utilities with TTL |
| `src/types/auth.ts` | TypeScript types for auth |
| `src/types/database.ts` | Database table types |
| `src/components/auth/LoginForm.tsx` | Login form with Google OAuth button |
| `src/components/auth/SignupForm.tsx` | Signup form |
| `src/components/auth/ProtectedRoute.tsx` | Route guard for authenticated routes |
| `supabase/migrations/001_auth_and_audio.sql` | Database schema |

## Auth Caching (Stale-While-Revalidate)

The auth system uses an optimistic caching pattern to provide instant page loads while validating in the background.

### How It Works

```
TRADITIONAL FLOW (Blocking - 300-1100ms):
Page Load → getSession() → fetchProfile() → fetchChildren() → Render
            [WAIT]         [WAIT]            [WAIT]

OPTIMISTIC FLOW (<50ms):
Page Load → Read Cache → Render Immediately
                ↓
         Background: getSession() + fetchProfile() + fetchChildren() [PARALLEL]
                ↓
         Update if changed / Clear if invalid
```

### Cache TTLs

| Data | TTL | Key |
|------|-----|-----|
| Session | 5 minutes | `alice-auth-session-cache` |
| Profile | 30 minutes | `alice-auth-profile-cache` |
| Children | 15 minutes | `alice-auth-children-cache` |

Sessions are also validated against JWT expiry (with 60s safety margin).

### Cache Status

The `cacheStatus` field indicates the current state:

| Status | Meaning |
|--------|---------|
| `'none'` | No cached data available |
| `'stale'` | Using cached data, validation pending or failed |
| `'fresh'` | Data recently validated with server |

### Loading vs Validating

- **`isLoading: true`** - No cached data, waiting for initial auth check (shows spinner)
- **`isValidating: true`** - Have cached data, validating in background (app renders immediately)

### Cache Invalidation

| Event | Action |
|-------|--------|
| Sign out | Clear ALL caches immediately |
| Sign in | Write new session/profile/children |
| Token refresh | Update session cache |
| Profile update | Update profile cache |
| Child add/update/remove | Update children cache |
| Network error | Keep stale cache, mark `cacheStatus: 'stale'` |

### Sign Out Reliability

Sign out is guaranteed reliable:
1. Clears all caches synchronously (localStorage)
2. Updates React state immediately
3. Tells Supabase (fire-and-forget, doesn't block)

This ensures the user is logged out locally even if the network request fails.

## Using Auth in Components

### Access Auth State

```tsx
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const {
    user,           // Supabase User object
    session,        // Supabase Session
    profile,        // profiles table row
    children,       // Array of child profiles
    activeChild,    // Currently selected child
    isLoading,      // True when no cached data and doing initial auth check
    isValidating,   // True when validating cached data in background
    cacheStatus,    // 'none' | 'stale' | 'fresh'
    error,          // Auth error message

    // Role helpers
    isSuperAdmin,   // boolean
    isParent,       // boolean
    hasChildren,    // boolean
    needsChildSetup // boolean - user is parent but has no children
  } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!user) return <LoginPrompt />;

  return <div>Welcome, {profile?.display_name}</div>;
}
```

### Auth Actions

```tsx
const { signIn, signOut, signUp, addChild, setActiveChild } = useAuth();

// Sign in with email/password
await signIn({ email: 'user@example.com', password: 'secret' });

// Sign out
await signOut();

// Add a child profile
await addChild({ name: 'Alice', gradeLevel: 4 });

// Switch active child
setActiveChild(childId);
```

### Google OAuth

```tsx
import { supabase } from '@/lib/supabase';

const handleGoogleSignIn = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
  if (error) console.error(error);
  // Page will redirect to Google
};
```

## Row-Level Security (RLS)

All tables have RLS enabled with the following policies:

### profiles

| Policy | Action | Rule |
|--------|--------|------|
| Users can read own profile | SELECT | `auth.uid() = id` |
| Users can update own profile | UPDATE | `auth.uid() = id` |
| Super admins can read all | SELECT | Checks role = 'super_admin' |
| Service role can insert | INSERT | For signup trigger |

### children

| Policy | Action | Rule |
|--------|--------|------|
| Parents can read own children | SELECT | `auth.uid() = parent_id` |
| Parents can insert children | INSERT | `auth.uid() = parent_id` |
| Parents can update own children | UPDATE | `auth.uid() = parent_id` |
| Parents can delete own children | DELETE | `auth.uid() = parent_id` |

## Auto-Profile Creation

A database trigger automatically creates a profile when a user signs up:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'display_name',
    'parent'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

This works for both email/password and OAuth signups.

## Creating a Super Admin

After signing up with your admin account, run this SQL in Supabase Dashboard:

```sql
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'your-admin-email@example.com';
```

## Testing Auth Locally

1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:5173`
3. Test email signup (confirmation email will be sent)
4. Test Google OAuth (requires Google Cloud Console setup)

## Common Issues

### "Email not confirmed" Error
- User needs to click the confirmation link in their email
- Check spam folder
- Use "Resend confirmation email" button

### OAuth Redirect Fails
- Verify redirect URI in Google Cloud Console matches exactly: `https://gibingvfmrmelpchlwzn.supabase.co/auth/v1/callback`
- Ensure localhost is in Authorized JavaScript Origins for local development

### Profile Not Created After OAuth
- Check that the `handle_new_user` trigger exists
- Verify RLS policies allow INSERT for service_role
- Check Supabase logs for trigger errors

### Session Not Persisting
- Auth cache stores session in localStorage (`alice-auth-session-cache`)
- Check browser console for errors
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set
- Clear all auth cache keys if state seems corrupted:
  ```js
  localStorage.removeItem('alice-auth-session-cache');
  localStorage.removeItem('alice-auth-profile-cache');
  localStorage.removeItem('alice-auth-children-cache');
  localStorage.removeItem('alice-spelling-run-active-child');
  localStorage.removeItem('alice-spelling-run-auth');
  ```

### OAuth Callback Shows Infinite Loading Spinner

**Symptom:** After Google OAuth redirects back with `http://localhost:5173/#access_token=...`, the loading spinner shows forever, the hash fragment never clears, and the user is never authenticated.

**Root Cause:** Navigator Lock AbortError with React StrictMode

Supabase uses the [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) to prevent race conditions when multiple tabs refresh tokens. In development, React StrictMode double-mounts components, causing unmount/remount cycles that abort the lock acquisition mid-way.

Console evidence:
```
[Auth] Validation error: AbortError: signal is aborted without reason
Uncaught (in promise) AbortError: signal is aborted without reason
    at navigatorLock @ @supabase_supabase-js.js
```

**The Fix:** Our Supabase client (`src/lib/supabase.ts`) bypasses navigator locks with a no-op lock function:

```typescript
const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'alice-spelling-run-auth',
    // Bypass navigator locks to prevent AbortError with React StrictMode
    lock: (_name, _acquireTimeout, fn) => fn(),
  },
});
```

**Trade-off:** Disabling locks means no cross-tab token refresh coordination. If many tabs are open, they might occasionally all refresh tokens simultaneously. This is acceptable for most apps.

**Additional Protection:** `ProtectedRoute` waits for both user AND profile before rendering:

```typescript
// Prevents race condition where session exists but profile/children aren't loaded yet
if (isLoading || (user && isValidating) || (user && !profile)) {
  return <LoadingSpinner />;
}
```

This ensures role-based redirects (like `needsChildSetup`) have accurate data.

### OAuth Works But User Redirected to Wrong Page

**Symptom:** OAuth succeeds but user is immediately redirected to login or wrong route.

**Cause:** ProtectedRoute made redirect decisions before profile/children were fetched.

**Fix:** ProtectedRoute now waits for `profile` to exist before evaluating route guards:
```typescript
if (isLoading || (user && isValidating) || (user && !profile)) {
  return <LoadingSpinner />;
}
```

Without this, `needsChildSetup` would be `false` (no profile = can't determine if parent), causing incorrect redirects.

### "Who's Playing?" Screen Appears Unexpectedly

**Symptom:** The profile selection screen ("Who's playing?") appears when:
- Opening browser DevTools (F12)
- Switching viewport sizes
- Tab suspension/restoration
- Any action that triggers Supabase session re-validation

**Root Cause:** The `SIGNED_IN` event fires not just for new logins, but also for:
- Session re-validation (opening DevTools can trigger this)
- Token refresh that Supabase interprets as sign-in
- Initial page load with existing session

The original implementation treated ALL `SIGNED_IN` events as new logins and reset `hasSelectedProfileThisSession` to `false`.

**The Fix:** In `AuthContext.tsx`, the `SIGNED_IN` handler now checks if the user already had an active child stored in localStorage before deciding to reset profile selection:

```typescript
// Inside SIGNED_IN handler
const hadActiveChild = localStorage.getItem(ACTIVE_CHILD_KEY) !== null;
const shouldResetProfileSelection = !hadActiveChild;

if (shouldResetProfileSelection) {
  setProfileSelectedThisSession(false);
}

setState({
  // ...
  hasSelectedProfileThisSession: hadActiveChild, // Preserve if session refresh
});
```

**Key Insight:** If `localStorage` has an active child ID, the user previously selected a profile—this is just a session refresh, not a genuine new login. Only reset profile selection when there's no stored active child.

**Expected Behavior After Fix:**
| Action | Should Show "Who's Playing?" |
|--------|------------------------------|
| Open DevTools | No |
| Resize viewport | No |
| Tab restoration | No |
| Click "Switch Profile" | Yes (explicit action clears localStorage) |
| Sign out then sign back in | Yes (genuine new session) |
