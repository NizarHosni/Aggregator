// This file is kept for backward compatibility but is no longer used
// All functionality has been moved to src/lib/api.ts

export type Profile = {
  id: string;
  email: string;
  created_at: string;
};

export type SearchHistory = {
  id: string;
  user_id: string;
  query: string;
  specialty: string | null;
  location: string | null;
  results_count: number;
  created_at: string;
};
