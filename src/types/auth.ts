import type { User, Session } from '@supabase/supabase-js';
import type { Profile, Child, UserRole } from './database';

export type { UserRole };

export interface UserProfile extends Profile {
  children?: ChildProfile[];
}

export interface ChildProfile extends Child {
  // Extended child profile can include computed fields
}

export type CacheStatus = 'none' | 'stale' | 'fresh';

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  children: ChildProfile[];
  activeChild: ChildProfile | null;
  isLoading: boolean;
  isValidating: boolean;  // Background validation in progress
  cacheStatus: CacheStatus;  // Current cache state
  error: string | null;
  hasSelectedProfileThisSession: boolean;  // Netflix-style: requires selection every session
}

export interface SignUpData {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AddChildData {
  name: string;
  gradeLevel: number;
}

export interface AuthContextValue extends AuthState {
  // Auth actions
  signUp: (data: SignUpData) => Promise<{ error: string | null }>;
  signIn: (data: SignInData) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;

  // Profile actions
  updateProfile: (data: Partial<Pick<Profile, 'display_name'>>) => Promise<{ error: string | null }>;

  // Child management
  addChild: (data: AddChildData) => Promise<{ child: ChildProfile | null; error: string | null }>;
  updateChild: (childId: string, data: Partial<Pick<Child, 'name' | 'grade_level'>>) => Promise<{ error: string | null }>;
  removeChild: (childId: string) => Promise<{ error: string | null }>;
  setActiveChild: (childId: string | null) => void;

  // Profile selection (Netflix-style)
  selectProfile: (childId: string) => void;  // Select and mark as selected this session
  clearProfileSelection: () => void;  // Reset selection (for "Switch Profile")

  // Role helpers
  isSuperAdmin: boolean;
  isParent: boolean;
  isParentOrSuperAdmin: boolean;  // True for both parents and super_admins
  hasChildren: boolean;
  needsChildSetup: boolean;
  needsProfileSelection: boolean;  // True if user needs to select a profile this session
}
