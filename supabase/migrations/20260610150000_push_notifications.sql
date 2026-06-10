-- Push subscription management
create table if not exists push_subscriptions (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_json jsonb not null,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  unique(user_id, subscription_json)
);

-- Notification history
create table if not exists notifications (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb default '{}',
  is_read boolean default false,
  link text,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table push_subscriptions enable row level security;
alter table notifications enable row level security;

-- RLS Policies for push_subscriptions
drop policy if exists "Users can manage own subscriptions" on push_subscriptions;
create policy "Users can manage own subscriptions" on push_subscriptions
  for all
  using (auth.uid() = user_id);

-- RLS Policies for notifications
drop policy if exists "Users can read own notifications" on notifications;
create policy "Users can read own notifications" on notifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on notifications;
create policy "Users can update own notifications" on notifications
  for update
  using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id, is_active);
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_read on notifications(user_id, is_read);
