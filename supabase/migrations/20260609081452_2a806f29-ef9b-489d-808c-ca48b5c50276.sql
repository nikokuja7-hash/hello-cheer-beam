
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'player');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'player',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  phone TEXT,
  photo_url TEXT,
  country TEXT DEFAULT 'KE',
  konami_id TEXT,
  efootball_name TEXT,
  efootball_screenshot_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  division INT DEFAULT 3,
  warning_strikes INT DEFAULT 0,
  career_earnings INT DEFAULT 0,
  notifications_enabled BOOLEAN DEFAULT false,
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public profiles viewable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "admins manage profiles" ON public.profiles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + assign player role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'player_' || substr(NEW.id::text, 1, 8)),
    NEW.phone
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Tournament status enums
CREATE TYPE public.tournament_status AS ENUM ('open', 'filling', 'active', 'completed', 'settled', 'cancelled');
CREATE TYPE public.tournament_kind AS ENUM ('quick_cash', 'cup', 'friendly', 'league');
CREATE TYPE public.match_status AS ENUM ('scheduled', 'checked_in', 'active', 'submitted', 'verified', 'disputed', 'closed', 'forfeit');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE public.payout_status AS ENUM ('pending', 'sent', 'failed');

-- Tournaments (covers Quick Cash + Cups + Friendlies)
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  kind tournament_kind NOT NULL DEFAULT 'cup',
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entry_fee_kes INT NOT NULL DEFAULT 0,
  max_players INT NOT NULL DEFAULT 16,
  min_players INT NOT NULL DEFAULT 4,
  prize_split JSONB DEFAULT '{"1": 50, "2": 30, "3": 20}'::jsonb,
  is_public BOOLEAN DEFAULT true,
  invite_code TEXT,
  status tournament_status NOT NULL DEFAULT 'open',
  registration_closes_at TIMESTAMPTZ,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  match_window_hours INT DEFAULT 24,
  format TEXT DEFAULT 'single_elim',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.tournaments TO authenticated;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournaments public visible" ON public.tournaments FOR SELECT USING (is_public = true OR creator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "verified players create tournaments" ON public.tournaments FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "creators update own tournament" ON public.tournaments FOR UPDATE USING (auth.uid() = creator_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage tournaments" ON public.tournaments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_tournaments_updated BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Tournament entries
CREATE TABLE public.tournament_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paid BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  eliminated_at TIMESTAMPTZ,
  final_position INT,
  UNIQUE (tournament_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_entries TO authenticated;
GRANT ALL ON public.tournament_entries TO service_role;
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entries visible to all" ON public.tournament_entries FOR SELECT USING (true);
CREATE POLICY "players join tournaments" ON public.tournament_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins manage entries" ON public.tournament_entries FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round INT DEFAULT 1,
  player1_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  player1_checked_in BOOLEAN DEFAULT false,
  player2_checked_in BOOLEAN DEFAULT false,
  player1_score INT,
  player2_score INT,
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status match_status NOT NULL DEFAULT 'scheduled',
  konami_room_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches visible to all" ON public.matches FOR SELECT USING (true);
CREATE POLICY "participants update match" ON public.matches FOR UPDATE USING (auth.uid() = player1_id OR auth.uid() = player2_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage matches" ON public.matches FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_matches_updated BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Match results (screenshot uploads + AI analysis)
CREATE TABLE public.match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  screenshot_url TEXT NOT NULL,
  ai_extracted JSONB,
  ai_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.match_results TO authenticated;
GRANT ALL ON public.match_results TO service_role;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "results visible to all" ON public.match_results FOR SELECT USING (true);
CREATE POLICY "players submit own results" ON public.match_results FOR INSERT WITH CHECK (auth.uid() = submitted_by);

-- Payments (entry fees in)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  amount_kes INT NOT NULL,
  phone TEXT NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  external_ref TEXT,
  mpesa_receipt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users create own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Payouts (admin queue)
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  amount_kes INT NOT NULL,
  phone TEXT NOT NULL,
  position INT,
  status payout_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  marked_paid_at TIMESTAMPTZ,
  marked_paid_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own payouts" ON public.payouts FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage payouts" ON public.payouts FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat visible to all auth users" ON public.chat_messages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "users send chat" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own notifs" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users mark own notifs" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Seed: weekly Quick Cash placeholder
INSERT INTO public.tournaments (name, slug, kind, entry_fee_kes, max_players, min_players, is_public, status, registration_closes_at, starts_at, ends_at)
VALUES ('Quick Cash — Week 1', 'quickcash-w1', 'quick_cash', 200, 30, 10, true, 'open',
  (date_trunc('week', now()) + interval '4 days 23 hours 59 minutes'),
  (date_trunc('week', now()) + interval '5 days'),
  (date_trunc('week', now()) + interval '6 days 18 hours'));
