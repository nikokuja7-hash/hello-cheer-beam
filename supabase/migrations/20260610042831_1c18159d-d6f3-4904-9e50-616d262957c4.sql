
CREATE TABLE public.league_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division integer NOT NULL CHECK (division BETWEEN 1 AND 3),
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (division, week_start)
);
GRANT SELECT ON public.league_seasons TO authenticated;
GRANT ALL ON public.league_seasons TO service_role;
ALTER TABLE public.league_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view seasons" ON public.league_seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage seasons" ON public.league_seasons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.count_entries(_tid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.tournament_entries WHERE tournament_id = _tid
$$;
REVOKE ALL ON FUNCTION public.count_entries(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_entries(uuid) TO authenticated, anon;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payouts;
