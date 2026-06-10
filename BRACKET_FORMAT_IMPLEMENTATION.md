# Tournament Format Implementation - FINAL

## Overview
Replaced entire bracket generation system with new Format A/B structure. Maximum 2 matches per player per day, all tournaments complete in 3 days.

## New Architecture

### Core Files
1. **src/lib/bracket.ts** (NEW)
   - `determineTournamentFormat()`: Returns "A" or "B" based on player count
   - `calculateGroupConfiguration()`: Calculates optimal group breakdown
   - `generateTournamentBracket()`: Main entry point, returns full bracket structure
   - `generateKnockoutRound1()`: Format B knockout scheduling
   - `generateGroupStageMatches()`: Round-robin group scheduling
   - `generateRoundRobinMatchday()`: Cyclic algorithm for matchdays
   - `calculatePerformanceScore()`: Draw resolution scoring
   - `formatStageName()`: UI labels for stages

2. **src/components/tournament-transparency.tsx** (NEW)
   - Displays current stage, day number, match counts
   - Shows what happens next (prize at stake, advancement info)
   - Time remaining estimates

3. **src/lib/tournament-transparency.ts** (NEW)
   - `getTournamentTransparencyData()`: Fetches real data from database
   - Calculates current stage, pending/completed matches
   - Generates user-friendly descriptions

### Tournament Formats

#### Format A (30-35 players)
- Straight to Group Stage
- No knockout round
- 5 groups, 6-7 players per group
- Timeline:
  - Friday Evening: Group Stage Match Day 1
  - Saturday Morning: Group Stage Match Day 2
  - Saturday Evening: Group Stage Match Day 3
  - Sunday Morning: Group Stage Match Day 4 (finals, top 2 advance)
  - Sunday Evening: Semifinals + Final + 3rd Place Playoff

#### Format B (36+ players)
- Knockout Round 1 to reduce field
- Then Group Stage
- 5 groups post-knockout
- Timeline:
  - Friday Evening: Knockout Round 1 (all players paired, losers eliminated)
  - Saturday Morning: Group Stage Match Day 1
  - Saturday Evening: Group Stage Match Day 2
  - Sunday Morning: Group Stage Match Day 3 (finals, top 2 advance)
  - Sunday Evening: Semifinals + Final + 3rd Place Playoff

### Match Constraint Rules
1. **Maximum 2 matches per player per day** - Enforced via time slot distribution
2. **3-day tournament window** - Friday through Sunday
3. **Time slots**: 8am, 10am, 12pm, 2pm, 4pm, 6pm, 8pm, 10pm
4. **Stages**: knockout → group → semifinal → final → third_place
5. **Draw handling in knockout**: Performance score determines winner automatically

### Database Changes
New migration: `20260610160000_tournament_bracket_format.sql`

Added fields to `tournaments` table:
- `bracket_format` (TEXT): "A" or "B"
- `total_matches` (INT): Count of all matches generated

Added fields to `matches` table:
- `stage` (TEXT): knockout | group | semifinal | final | third_place
- `group_id` (TEXT): Group identifier (e.g., "group-1")
- `match_date` (TIMESTAMPTZ): Date/time of match
- `time_slot_start` (TEXT): Start time HH:MM
- `time_slot_end` (TEXT): End time HH:MM

### Bracket Generation Flow
1. Creator clicks "Generate Bracket" when min players reached
2. System calls `generateTournamentBracket(playerIds, tournamentId, startDate)`
3. New bracket object contains all groups, knockout matches, group matches
4. All matches inserted into database with stage, group_id, date/time info
5. `bracket_generated_at` timestamp set on tournament
6. Tournament detail page loads transparency component

### UI Components

#### TournamentTransparency
Displays to all joined players:
- Current stage name (KNOCKOUT STAGE, GROUP STAGE, SEMIFINALS, FINAL)
- Day number (Day 1 of 3, etc.)
- Match progress (3 completed, 2 pending)
- What happens next (e.g., "Top 2 advance to Semifinals")
- Time remaining before stage ends

#### BracketPreview (Updated)
- Shows all matches with stage labels
- Groups matches by date
- Displays group information for group stage matches
- Shows match status, scores, time slots
- Expandable list for 3+ matches

### Accessibility & Transparency
Every screen shows:
- ✓ Stage name
- ✓ Day number
- ✓ Time remaining
- ✓ Match count (pending vs completed)
- ✓ What happens next
- ✓ Prize at stake (via existing tournament info)

### Testing Checklist
- [ ] Generate bracket with 30 players (Format A)
- [ ] Generate bracket with 31 players (Format A with 7-player group)
- [ ] Generate bracket with 35 players (Format A all 7s)
- [ ] Generate bracket with 36 players (Format B)
- [ ] Verify all matches have stage, group_id, match_date, time_slot fields
- [ ] Verify no player has more than 2 matches on same day
- [ ] Verify knockout round 1 produces ~16-18 matches
- [ ] Verify group stage has ~70-90 matches total
- [ ] Verify bracket preview displays stage labels correctly
- [ ] Verify transparency component shows real data
- [ ] Test on various screen sizes (6" Android phone)
- [ ] Verify all matches complete within 3-day window
- [ ] Verify time slots don't overlap for same player

### Migration Path
1. Old bracket.ts backed up to bracket.ts.old (removed from repo later)
2. New bracket.ts now official implementation
3. Next tournament generation uses new system
4. Existing tournaments unaffected (no schema changes to past data)

### Next Steps
1. Run migration: `supabase db push`
2. Test bracket generation with different player counts
3. Validate transparency component displays correctly
4. Deploy to production
5. Monitor first tournament bracket generation

## Files Modified
- src/lib/bracket.ts (REPLACED - new implementation)
- src/routes/_authenticated/tournaments.$id.tsx (updated to use new bracket system + transparency)
- src/components/bracket-preview.tsx (updated to show stage + group info)
- supabase/migrations/20260610160000_tournament_bracket_format.sql (NEW)
- src/components/tournament-transparency.tsx (NEW)
- src/lib/tournament-transparency.ts (NEW)
