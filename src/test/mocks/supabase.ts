import { vi } from 'vitest';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import type { UserProfile, ChildProfile } from '@/types/auth';

// Mock user factory
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    ...overrides,
  } as User;
}

// Mock session factory
export function createMockSession(user: User): Session {
  return {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'mock-refresh-token',
    user,
  };
}

// Mock profile factory
export function createMockProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    display_name: 'Test User',
    role: 'parent',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Mock child factory
export function createMockChild(overrides: Partial<ChildProfile> = {}): ChildProfile {
  return {
    id: 'test-child-id',
    parent_id: 'test-user-id',
    name: 'Test Child',
    grade_level: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Auth state change callback type
type AuthStateChangeCallback = (event: AuthChangeEvent, session: Session | null) => void;

// Supabase auth error type (matches actual Supabase error shape)
export interface SupabaseAuthError {
  message: string;
  status?: number;
  code?: string;
}

// Factory for creating common Supabase errors
export const SupabaseErrors = {
  // Server-side 500 error (e.g., trigger failure, RLS violation)
  databaseError: (message = 'Database error saving new user'): SupabaseAuthError => ({
    message,
    status: 500,
  }),
  // User already exists
  userExists: (): SupabaseAuthError => ({
    message: 'User already registered',
    status: 400,
  }),
  // Invalid credentials
  invalidCredentials: (): SupabaseAuthError => ({
    message: 'Invalid login credentials',
    status: 400,
  }),
  // Email not confirmed
  emailNotConfirmed: (): SupabaseAuthError => ({
    message: 'Email not confirmed',
    status: 400,
  }),
  // Rate limited
  rateLimited: (): SupabaseAuthError => ({
    message: 'Too many requests',
    status: 429,
  }),
};

// Supabase mock builder
export function createSupabaseMock() {
  let authStateCallback: AuthStateChangeCallback | null = null;
  let mockSession: Session | null = null;
  let mockProfiles: UserProfile[] = [];
  let mockChildren: ChildProfile[] = [];
  let signUpError: SupabaseAuthError | null = null;
  let signInError: SupabaseAuthError | null = null;

  const mockSupabase = {
    auth: {
      getSession: vi.fn().mockImplementation(async () => ({
        data: { session: mockSession },
        error: null,
      })),
      signUp: vi.fn().mockImplementation(async ({ email, password, options }: {
        email: string;
        password: string;
        options?: { data?: { display_name?: string } };
      }) => {
        if (signUpError) {
          return { data: { user: null, session: null }, error: signUpError };
        }

        // Simulate email validation
        if (!email || !email.includes('@')) {
          return {
            data: { user: null, session: null },
            error: { message: 'Invalid email' },
          };
        }

        // Simulate password validation
        if (!password || password.length < 6) {
          return {
            data: { user: null, session: null },
            error: { message: 'Password should be at least 6 characters' },
          };
        }

        const user = createMockUser({
          email,
          user_metadata: { display_name: options?.data?.display_name },
        });
        const session = createMockSession(user);
        mockSession = session;

        // Simulate the profile trigger creating a profile
        const profile = createMockProfile({
          id: user.id,
          email: user.email!,
          display_name: options?.data?.display_name || null,
        });
        mockProfiles.push(profile);

        // Trigger auth state change (only if callback still exists)
        const callback = authStateCallback;
        if (callback) {
          setTimeout(() => {
            try {
              callback('SIGNED_IN', session);
            } catch {
              // Callback may have been cleared
            }
          }, 0);
        }

        return { data: { user, session }, error: null };
      }),
      signInWithPassword: vi.fn().mockImplementation(async ({ email, password }: {
        email: string;
        password: string;
      }) => {
        if (signInError) {
          return { data: { user: null, session: null }, error: signInError };
        }

        if (!email || !password) {
          return {
            data: { user: null, session: null },
            error: { message: 'Invalid login credentials' },
          };
        }

        // Simulate wrong password
        if (password === 'wrongpassword') {
          return {
            data: { user: null, session: null },
            error: { message: 'Invalid login credentials' },
          };
        }

        const user = createMockUser({ email });
        const session = createMockSession(user);
        mockSession = session;

        const callback = authStateCallback;
        if (callback) {
          setTimeout(() => {
            try {
              callback('SIGNED_IN', session);
            } catch {
              // Callback may have been cleared
            }
          }, 0);
        }

        return { data: { user, session }, error: null };
      }),
      signOut: vi.fn().mockImplementation(async () => {
        mockSession = null;
        const callback = authStateCallback;
        if (callback) {
          setTimeout(() => {
            try {
              callback('SIGNED_OUT', null);
            } catch {
              // Callback may have been cleared
            }
          }, 0);
        }
        return { error: null };
      }),
      onAuthStateChange: vi.fn().mockImplementation((callback: AuthStateChangeCallback) => {
        authStateCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(() => {
                authStateCallback = null;
              }),
            },
          },
        };
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      const createQueryBuilder = () => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(async () => {
          if (table === 'profiles') {
            const profile = mockProfiles[0] || null;
            return { data: profile, error: profile ? null : { message: 'Profile not found' } };
          }
          return { data: null, error: null };
        }),
        then: vi.fn(),
      });

      const builder = {
        select: vi.fn().mockImplementation(() => {
          const innerBuilder = {
            eq: vi.fn().mockImplementation(() => ({
              single: vi.fn().mockImplementation(async () => {
                if (table === 'profiles') {
                  const profile = mockProfiles[0] || null;
                  return { data: profile, error: profile ? null : { message: 'Not found' } };
                }
                return { data: null, error: null };
              }),
              order: vi.fn().mockImplementation(() => ({
                then: vi.fn(),
                data: mockChildren,
                error: null,
              })),
              then: vi.fn().mockImplementation((resolve) => {
                if (table === 'children') {
                  resolve({ data: mockChildren, error: null });
                }
                return Promise.resolve({ data: mockChildren, error: null });
              }),
            })),
            order: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
          };
          return innerBuilder;
        }),
        insert: vi.fn().mockImplementation((data: Record<string, unknown>) => ({
          select: vi.fn().mockImplementation(() => ({
            single: vi.fn().mockImplementation(async () => {
              if (table === 'children') {
                const newChild = createMockChild({
                  id: `child-${Date.now()}`,
                  parent_id: data.parent_id as string,
                  name: data.name as string,
                  grade_level: data.grade_level as number,
                });
                mockChildren.push(newChild);
                return { data: newChild, error: null };
              }
              return { data: null, error: null };
            }),
          })),
        })),
        update: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockImplementation(async () => {
            return { data: null, error: null };
          }),
        })),
        delete: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockImplementation(async () => {
            return { data: null, error: null };
          }),
        })),
      };

      return builder;
    }),

    // Test helpers
    _helpers: {
      setMockSession: (session: Session | null) => {
        mockSession = session;
      },
      setMockProfiles: (profiles: UserProfile[]) => {
        mockProfiles = profiles;
      },
      setMockChildren: (children: ChildProfile[]) => {
        mockChildren = children;
      },
      setSignUpError: (error: SupabaseAuthError | null) => {
        signUpError = error;
      },
      setSignInError: (error: SupabaseAuthError | null) => {
        signInError = error;
      },
      triggerAuthChange: (event: AuthChangeEvent, session: Session | null) => {
        if (authStateCallback) {
          authStateCallback(event, session);
        }
      },
      reset: () => {
        mockSession = null;
        mockProfiles = [];
        mockChildren = [];
        signUpError = null;
        signInError = null;
        authStateCallback = null;
      },
    },
  };

  return mockSupabase;
}

// Type for the mock
export type MockSupabase = ReturnType<typeof createSupabaseMock>;
