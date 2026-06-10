-- Add tournament bracket format support
ALTER TABLE public.tournaments 
ADD COLUMN IF NOT EXISTS bracket_format TEXT DEFAULT 'A',
ADD COLUMN IF NOT EXISTS total_matches INT DEFAULT 0;

-- Add stage and group support to matches table
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'group' CHECK (stage IN ('knockout', 'group', 'semifinal', 'final', 'third_place')),
ADD COLUMN IF NOT EXISTS group_id TEXT,
ADD COLUMN IF NOT EXISTS match_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS time_slot_start TEXT,
ADD COLUMN IF NOT EXISTS time_slot_end TEXT;

-- Create index for faster match lookups by tournament and stage
CREATE INDEX IF NOT EXISTS idx_matches_tournament_stage ON public.matches(tournament_id, stage);
CREATE INDEX IF NOT EXISTS idx_matches_group ON public.matches(group_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON public.matches(match_date);

-- Update RLS policies to include new fields
GRANT SELECT (id, tournament_id, updated_at, created_at, status, winner_id,
              player2_score, player1_score, player2_checked_in, player1_checked_in,
              scheduled_at, player2_id, player1_id, round, stage, group_id, match_date, 
              time_slot_start, time_slot_end)
  ON public.matches TO authenticated;
