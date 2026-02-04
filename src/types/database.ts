/**
 * Database types generated from Supabase schema
 * Run `supabase gen types typescript` to regenerate
 */

export type UserRole = 'super_admin' | 'parent';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          role: UserRole;
          created_at: string;
          pin_hash: string | null;
          pin_updated_at: string | null;
          pin_failed_attempts: number;
          pin_locked_until: string | null;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          role?: UserRole;
          created_at?: string;
          pin_hash?: string | null;
          pin_updated_at?: string | null;
          pin_failed_attempts?: number;
          pin_locked_until?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          role?: UserRole;
          created_at?: string;
          pin_hash?: string | null;
          pin_updated_at?: string | null;
          pin_failed_attempts?: number;
          pin_locked_until?: string | null;
        };
        Relationships: [];
      };
      children: {
        Row: {
          id: string;
          parent_id: string;
          name: string;
          grade_level: number;
          is_active: boolean;
          created_at: string;
          birth_month: number | null;
          birth_year: number | null;
          pending_grade_import: number | null;
        };
        Insert: {
          id?: string;
          parent_id: string;
          name: string;
          grade_level: number;
          is_active?: boolean;
          created_at?: string;
          birth_month?: number | null;
          birth_year?: number | null;
          pending_grade_import?: number | null;
        };
        Update: {
          id?: string;
          parent_id?: string;
          name?: string;
          grade_level?: number;
          is_active?: boolean;
          created_at?: string;
          birth_month?: number | null;
          birth_year?: number | null;
          pending_grade_import?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'children_parent_id_fkey';
            columns: ['parent_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      audio_pronunciations: {
        Row: {
          id: string;
          word: string;
          word_normalized: string;
          voice_id: string;
          emotion: string;
          speed: number;
          volume: number;
          storage_path: string;
          file_size_bytes: number | null;
          duration_ms: number | null;
          segment_type: 'word' | 'definition' | 'sentence';
          text_content: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          word: string;
          word_normalized: string;
          voice_id: string;
          emotion?: string;
          speed?: number;
          volume?: number;
          storage_path: string;
          file_size_bytes?: number | null;
          duration_ms?: number | null;
          segment_type?: 'word' | 'definition' | 'sentence';
          text_content?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          word?: string;
          word_normalized?: string;
          voice_id?: string;
          emotion?: string;
          speed?: number;
          volume?: number;
          storage_path?: string;
          file_size_bytes?: number | null;
          duration_ms?: number | null;
          segment_type?: 'word' | 'definition' | 'sentence';
          text_content?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      words: {
        Row: {
          id: string;
          word: string;
          word_normalized: string;
          definition: string;
          example: string | null;
          grade_level: number;
          is_active: boolean;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          word: string;
          word_normalized: string;
          definition: string;
          example?: string | null;
          grade_level: number;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          word?: string;
          word_normalized?: string;
          definition?: string;
          example?: string | null;
          grade_level?: number;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'words_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      child_word_progress: {
        Row: {
          id: string;
          child_id: string;
          word_text: string;
          mastery_level: number;
          correct_streak: number;
          times_used: number;
          times_correct: number;
          last_attempt_at: string | null;
          next_review_at: string;
          introduced_at: string | null;
          is_active: boolean;
          archived_at: string | null;
          updated_at: string;
          client_updated_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          word_text: string;
          mastery_level?: number;
          correct_streak?: number;
          times_used?: number;
          times_correct?: number;
          last_attempt_at?: string | null;
          next_review_at?: string;
          introduced_at?: string | null;
          is_active?: boolean;
          archived_at?: string | null;
          updated_at?: string;
          client_updated_at: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          word_text?: string;
          mastery_level?: number;
          correct_streak?: number;
          times_used?: number;
          times_correct?: number;
          last_attempt_at?: string | null;
          next_review_at?: string;
          introduced_at?: string | null;
          is_active?: boolean;
          archived_at?: string | null;
          updated_at?: string;
          client_updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'child_word_progress_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          }
        ];
      };
      child_statistics: {
        Row: {
          id: string;
          child_id: string;
          mode: string;
          total_games_played: number;
          total_wins: number;
          total_words_attempted: number;
          total_words_correct: number;
          streak_current: number;
          streak_best: number;
          trophy_counts: Record<string, number>;
          updated_at: string;
          client_updated_at: string;
          word_accuracy: Json | null;
          first_correct_dates: Json | null;
          personal_bests: Json | null;
          error_patterns: Json | null;
        };
        Insert: {
          id?: string;
          child_id: string;
          mode: string;
          total_games_played?: number;
          total_wins?: number;
          total_words_attempted?: number;
          total_words_correct?: number;
          streak_current?: number;
          streak_best?: number;
          trophy_counts?: Record<string, number>;
          updated_at?: string;
          client_updated_at: string;
          word_accuracy?: Json | null;
          first_correct_dates?: Json | null;
          personal_bests?: Json | null;
          error_patterns?: Json | null;
        };
        Update: {
          id?: string;
          child_id?: string;
          mode?: string;
          total_games_played?: number;
          total_wins?: number;
          total_words_attempted?: number;
          total_words_correct?: number;
          streak_current?: number;
          streak_best?: number;
          trophy_counts?: Record<string, number>;
          updated_at?: string;
          client_updated_at?: string;
          word_accuracy?: Json | null;
          first_correct_dates?: Json | null;
          personal_bests?: Json | null;
          error_patterns?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'child_statistics_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          }
        ];
      };
      child_game_sessions: {
        Row: {
          id: string;
          child_id: string;
          mode: string;
          played_at: string;
          duration_seconds: number | null;
          words_attempted: number;
          words_correct: number;
          won: boolean;
          trophy: string | null;
          client_session_id: string;
          created_at: string;
          completed_words: Json | null;
          wrong_attempts: Json | null;
        };
        Insert: {
          id?: string;
          child_id: string;
          mode: string;
          played_at: string;
          duration_seconds?: number | null;
          words_attempted: number;
          words_correct: number;
          won: boolean;
          trophy?: string | null;
          client_session_id: string;
          created_at?: string;
          completed_words?: Json | null;
          wrong_attempts?: Json | null;
        };
        Update: {
          id?: string;
          child_id?: string;
          mode?: string;
          played_at?: string;
          duration_seconds?: number | null;
          words_attempted?: number;
          words_correct?: number;
          won?: boolean;
          trophy?: string | null;
          client_session_id?: string;
          created_at?: string;
          completed_words?: Json | null;
          wrong_attempts?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'child_game_sessions_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          }
        ];
      };
      child_calibration: {
        Row: {
          id: string;
          child_id: string;
          completed_at: string;
          status: string;
          recommended_grade: number;
          confidence: string;
          total_time_ms: number | null;
          attempts_json: unknown;
          grade_scores_json: unknown;
          client_calibration_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          completed_at: string;
          status: string;
          recommended_grade: number;
          confidence: string;
          total_time_ms?: number | null;
          attempts_json?: unknown;
          grade_scores_json?: unknown;
          client_calibration_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          completed_at?: string;
          status?: string;
          recommended_grade?: number;
          confidence?: string;
          total_time_ms?: number | null;
          attempts_json?: unknown;
          grade_scores_json?: unknown;
          client_calibration_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'child_calibration_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          }
        ];
      };
      child_sync_metadata: {
        Row: {
          id: string;
          child_id: string;
          last_sync_at: string | null;
          last_word_progress_sync_at: string | null;
          last_statistics_sync_at: string | null;
          last_sessions_sync_at: string | null;
          last_calibration_sync_at: string | null;
          initial_migration_completed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          last_sync_at?: string | null;
          last_word_progress_sync_at?: string | null;
          last_statistics_sync_at?: string | null;
          last_sessions_sync_at?: string | null;
          last_calibration_sync_at?: string | null;
          initial_migration_completed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          last_sync_at?: string | null;
          last_word_progress_sync_at?: string | null;
          last_statistics_sync_at?: string | null;
          last_sessions_sync_at?: string | null;
          last_calibration_sync_at?: string | null;
          initial_migration_completed?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'child_sync_metadata_child_id_fkey';
            columns: ['child_id'];
            referencedRelation: 'children';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Type helpers
type PublicSchema = Database['public'];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Child = Database['public']['Tables']['children']['Row'];
export type AudioPronunciation = Database['public']['Tables']['audio_pronunciations']['Row'];
export type Word = Database['public']['Tables']['words']['Row'];
export type WordInsert = Database['public']['Tables']['words']['Insert'];
export type WordUpdate = Database['public']['Tables']['words']['Update'];
