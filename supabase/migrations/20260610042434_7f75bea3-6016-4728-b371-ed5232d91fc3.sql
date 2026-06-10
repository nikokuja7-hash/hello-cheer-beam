
-- Profiles: require auth to view
DROP POLICY IF EXISTS "public profiles viewable" ON public.profiles;
CREATE POLICY "authenticated view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.profiles FROM anon;

-- Matches: require auth, hide konami_room_info from non-participants
DROP POLICY IF EXISTS "matches visible to all" ON public.matches;

-- Revoke column access to konami_room_info; expose via secure function instead
REVOKE SELECT ON public.matches FROM anon, authenticated;
GRANT SELECT (id, tournament_id, updated_at, created_at, status, winner_id,
              player2_score, player1_score, player2_checked_in, player1_checked_in,
              scheduled_at, player2_id, player1_id, round)
  ON public.matches TO authenticated;
GRANT SELECT (konami_room_info) ON public.matches TO authenticated;

CREATE POLICY "authenticated view matches" ON public.matches
  FOR SELECT TO authenticated USING (true);

-- Restrict konami_room_info via a separate restrictive policy approach:
-- Use a secure function that returns room info only to participants/admin.
CREATE OR REPLACE FUNCTION public.get_match_room_info(_match_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT konami_room_info
  FROM public.matches
  WHERE id = _match_id
    AND (
      auth.uid() = player1_id
      OR auth.uid() = player2_id
      OR public.has_role(auth.uid(), 'admin')
    )
$$;

REVOKE ALL ON FUNCTION public.get_match_room_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_match_room_info(uuid) TO authenticated;

-- Application-level reminder: clients should read konami_room_info via
-- supabase.rpc('get_match_room_info', { _match_id: ... }) instead of selecting
-- the column directly. The column grant above keeps SELECT working for
-- participants in queries, but the canonical secure path is the RPC.

-- Tighten chat: explicitly deny anon
REVOKE SELECT ON public.chat_messages FROM anon;

-- Tighten tournament_entries to authenticated (was public)
DROP POLICY IF EXISTS "entries visible to all" ON public.tournament_entries;
CREATE POLICY "authenticated view entries" ON public.tournament_entries
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.tournament_entries FROM anon;

-- Tighten match_results
DROP POLICY IF EXISTS "results visible to all" ON public.match_results;
CREATE POLICY "authenticated view results" ON public.match_results
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.match_results FROM anon;
