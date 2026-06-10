# Manual Database Migration Guide

## Current Status
- ✅ Migration file created: `supabase/migrations/20260610160000_tournament_bracket_format.sql`
- ⚠️ CLI network issues prevented automatic push
- ✅ All application code ready for new fields
- ✅ TypeScript compilation verified

## Option 1: Apply via Supabase Dashboard (RECOMMENDED)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project: **kkyidhmsfcezpktdxdeb**
3. Go to **SQL Editor**
4. Create new query and paste the SQL below:

```sql
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
```

5. Click **Run** (or `Ctrl+Enter`)
6. Verify all commands execute successfully

## Option 2: Using Local Supabase (Development)

If you have Supabase running locally:

```bash
# Start local Supabase
supabase start

# Push migrations
supabase db push

# View status
supabase status
```

## Option 3: Via psql (Direct Database)

If you have psql installed:

```bash
# Get connection string from Supabase dashboard (Database → Connection string → URI)
psql "postgresql://postgres:[PASSWORD]@db.kkyidhmsfcezpktdxdeb.supabase.co:5432/postgres"

# Then paste the SQL commands from Option 1
```

## Verification After Migration

Run these queries to verify migration succeeded:

```sql
-- Check tournaments table
\d public.tournaments

-- Check matches table
\d public.matches

-- Verify new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'matches' 
AND column_name IN ('stage', 'group_id', 'match_date', 'time_slot_start', 'time_slot_end');
```

## Application Code Status

✅ **Ready to use new fields:**
- `src/lib/bracket.ts` - Generates matches with all new fields
- `src/routes/_authenticated/tournaments.$id.tsx` - Uses new bracket system
- `src/components/bracket-preview.tsx` - Displays stage/group info
- `src/lib/tournament-transparency.ts` - Queries new fields

## No Schema Changes Required For:
- Existing tournaments (all fields have defaults)
- Existing matches (migration uses `IF NOT EXISTS`)
- Existing tournament entries
- Existing players/profiles

## Troubleshooting

**If migration fails with "column already exists":**
- This is fine - migration uses `IF NOT EXISTS`
- Check dashboard to verify fields are present

**If you get permission errors:**
- Make sure you're using the service role key
- Or run as superuser (postgres)

**If indexes fail to create:**
- This is non-critical - data will still work
- Indexes just improve query performance

## Timeline
- ✅ Migration file: Created
- ⏳ Migration: Pending manual application
- ⏳ Testing: Ready after migration
- ⏳ Production: Deploy after testing
