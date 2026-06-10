-- League System Tables
-- Seasons, groups, standings, and entries for division-based league play

-- League seasons
CREATE TABLE public.league_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division INT NOT NULL DEFAULT 3,
  season_number INT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  registration_closes_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (division, season_number)
);
GRANT SELECT, INSERT, UPDATE ON public.league_seasons TO authenticated;
GRANT ALL ON public.league_seasons TO service_role;
ALTER TABLE public.league_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasons visible to all" ON public.league_seasons FOR SELECT USING (true);
CREATE POLICY "admins manage seasons" ON public.league_seasons FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- League groups (6 players per group for round robin)
CREATE TABLE public.league_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  group_number INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, group_number)
);
GRANT SELECT, INSERT ON public.league_groups TO authenticated;
GRANT ALL ON public.league_groups TO service_role;
ALTER TABLE public.league_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups visible to all" ON public.league_groups FOR SELECT USING (true);
CREATE POLICY "admins manage groups" ON public.league_groups FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- League standings (per group per season)
CREATE TABLE public.league_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.league_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  played INT DEFAULT 0,
  won INT DEFAULT 0,
  drawn INT DEFAULT 0,
  lost INT DEFAULT 0,
  goals_for INT DEFAULT 0,
  goals_against INT DEFAULT 0,
  points INT DEFAULT 0,
  position INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.league_standings TO authenticated;
GRANT ALL ON public.league_standings TO service_role;
ALTER TABLE public.league_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "standings visible to all" ON public.league_standings FOR SELECT USING (true);
CREATE POLICY "players update own standings" ON public.league_standings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admins manage standings" ON public.league_standings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_standings_updated BEFORE UPDATE ON public.league_standings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- League entries (player registration for a season)
CREATE TABLE public.league_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.league_groups(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  final_position INT,
  promoted_to INT,
  relegated_to INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.league_entries TO authenticated;
GRANT ALL ON public.league_entries TO service_role;
ALTER TABLE public.league_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entries visible to all" ON public.league_entries FOR SELECT USING (true);
CREATE POLICY "players view own entries" ON public.league_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins manage entries" ON public.league_entries FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Player availability preferences (for match scheduling)
CREATE TABLE public.player_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday_morning BOOLEAN DEFAULT false,
  weekday_afternoon BOOLEAN DEFAULT false,
  weekday_evening BOOLEAN DEFAULT false,
  weekend_morning BOOLEAN DEFAULT false,
  weekend_afternoon BOOLEAN DEFAULT false,
  weekend_evening BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.player_availability TO authenticated;
GRANT ALL ON public.player_availability TO service_role;
ALTER TABLE public.player_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players view own availability" ON public.player_availability FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "players update own availability" ON public.player_availability FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admins manage availability" ON public.player_availability FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_availability_updated BEFORE UPDATE ON public.player_availability
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Add match time slot assignment fields to matches table
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_date DATE;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS time_slot_start TIME;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS time_slot_end TIME;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.league_groups(id) ON DELETE SET NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES public.league_seasons(id) ON DELETE SET NULL;

-- Reschedule requests (for match reschedule negotiation)
CREATE TABLE public.reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_time_slot TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  responded_by UUID REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '6 hours')
);
GRANT SELECT, INSERT, UPDATE ON public.reschedule_requests TO authenticated;
GRANT ALL ON public.reschedule_requests TO service_role;
ALTER TABLE public.reschedule_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requests visible to involved players" ON public.reschedule_requests FOR SELECT USING (
  auth.uid() = requested_by OR 
  (SELECT player1_id FROM matches WHERE id = match_id LIMIT 1) = auth.uid() OR
  (SELECT player2_id FROM matches WHERE id = match_id LIMIT 1) = auth.uid()
);
CREATE POLICY "players create requests" ON public.reschedule_requests FOR INSERT WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "players respond to requests" ON public.reschedule_requests FOR UPDATE USING (
  (SELECT player1_id FROM matches WHERE id = match_id LIMIT 1) = auth.uid() OR
  (SELECT player2_id FROM matches WHERE id = match_id LIMIT 1) = auth.uid()
);
