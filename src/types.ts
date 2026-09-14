// Entity types mirroring the Supabase schema (supabase/migrations/20260610000000_initial_schema.sql).
// Supabase JS returns timestamp columns as ISO 8601 strings, hence `string` not `Date`.

import { State, Rating } from "ts-fsrs";

export { State, Rating };

// Named FlashcardSet (not Set) to avoid shadowing the global ES2015 Set.
export interface FlashcardSet {
  id: string;
  user_id: string;
  name: string;
  share_token: string | null;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Flashcard {
  id: string;
  set_id: string;
  front: string;
  back: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: State;
  last_review: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionSummary {
  total: number;
  byGrade: { again: number; hard: number; good: number; easy: number };
}

export interface DailyStats {
  day: string;
  minutes: number;
}

export interface RecentSetStats {
  id: string;
  name: string;
  last_opened_at: string;
  total_flashcards: number;
  learned_count: number;
}

export interface LearningStats {
  dailyMinutes: DailyStats[];
  recentSets: RecentSetStats[];
}

export interface SharedSetInfo {
  set_id: string;
  owner_id: string;
  set_name: string;
  flashcard_count: number;
}

export interface DonatedSetTile {
  share_id: string;
  cloned_set_id: string;
  original_set_name: string;
  cloned_set_name: string;
  recipient_email: string;
  claimed_at: string;
  total_flashcards: number;
  learned_count: number;
  last_activity: string | null;
}

export interface Review {
  id: string;
  flashcard_id: string;
  user_id: string;
  grade: Rating;
  state: State;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  review: string;
  created_at: string;
}

export interface DictionaryEntry {
  definition: string;
  type: string | null;
  dictionaryRegion: "UK" | "US" | null;
  info: string | null;
  examples: string[];
}
