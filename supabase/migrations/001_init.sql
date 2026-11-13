create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text, avatar_url text,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  website_url text, github_repository_url text,
  analysis_type text not null check (analysis_type in ('website','github','full')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (website_url is not null or github_repository_url is not null)
);
create index on projects(user_id, created_at desc);

create table scans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','completed','partial','failed','cancelled')),
  current_stage text, progress int not null default 0 check (progress between 0 and 100),
  started_at timestamptz, completed_at timestamptz, error_message text,
  created_at timestamptz not null default now()
);
create index on scans(project_id, created_at desc);
create index on scans(user_id);

create table findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null, title text not null, description text,
  severity text not null check (severity in ('critical','high','medium','low','info')),
  confidence text not null check (confidence in ('high','medium','low')),
  evidence text, affected_resource text, suggested_fix text,
  status text not null default 'open' check (status in ('open','in_progress','saved','resolved')),
  created_at timestamptz not null default now()
);
create index on findings(scan_id);
create index on findings(user_id, status);

create table reports (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null unique references scans(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text, scores jsonb not null default '{}', report_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  finding_id uuid references findings(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, description text,
  priority text not null check (priority in ('critical','high','medium','low','future')),
  complexity text check (complexity in ('low','medium','high')),
  status text not null default 'open' check (status in ('open','in_progress','saved','completed')),
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, description text, type text not null,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index on notifications(user_id, created_at desc);

-- RLS: owner-only. The Worker also checks ownership server-side.
alter table profiles enable row level security;
alter table projects enable row level security;
alter table scans enable row level security;
alter table findings enable row level security;
alter table reports enable row level security;
alter table recommendations enable row level security;
alter table notifications enable row level security;

create policy "own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own projects" on projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own scans read" on scans for select using (user_id = auth.uid());
create policy "own findings read" on findings for select using (user_id = auth.uid());
create policy "own findings update" on findings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own reports read" on reports for select using (user_id = auth.uid());
create policy "own recs" on recommendations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notifications" on notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- scans/findings/reports inserts happen only via the Worker (service role bypasses RLS).

create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.email, new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
