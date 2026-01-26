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
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          role?: UserRole;
          created_at?: string;
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
        };
        Insert: {
          id?: string;
          parent_id: string;
          name: string;
          grade_level: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string;
          name?: string;
          grade_level?: number;
          is_active?: boolean;
          created_at?: string;
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
