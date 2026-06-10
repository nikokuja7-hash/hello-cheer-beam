-- Tournament chat enhancements
alter table if exists chat_messages add column if not exists is_pinned boolean default false;

-- Create index for faster pinned message queries
create index if not exists idx_chat_messages_tournament_pinned on chat_messages(tournament_id, is_pinned, created_at desc);

-- Ensure proper RLS for chat_messages
alter table chat_messages enable row level security;

drop policy if exists "Users can read tournament chat" on chat_messages;
create policy "Users can read tournament chat" on chat_messages
  for select
  using (
    exists(
      select 1 from tournament_entries
      where tournament_entries.tournament_id = chat_messages.tournament_id
      and tournament_entries.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert chat messages" on chat_messages;
create policy "Users can insert chat messages" on chat_messages
  for insert
  with check (
    auth.uid() = user_id
    and exists(
      select 1 from tournament_entries
      where tournament_entries.tournament_id = chat_messages.tournament_id
      and tournament_entries.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own messages" on chat_messages;
create policy "Users can delete own messages" on chat_messages
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Creators can pin messages" on chat_messages;
create policy "Creators can pin messages" on chat_messages
  for update
  using (
    exists(
      select 1 from tournaments
      where tournaments.id = chat_messages.tournament_id
      and tournaments.created_by = auth.uid()
    )
  )
  with check (true);
