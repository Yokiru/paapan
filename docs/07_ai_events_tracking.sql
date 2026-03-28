create table if not exists public.ai_events (
    id uuid primary key default gen_random_uuid(),
    request_id text not null,
    event text not null,
    route text not null,
    status integer,
    code text,
    duration_ms integer,
    user_id uuid,
    subscription_tier text,
    action_type text,
    requested_model_id text,
    resolved_model_id text,
    requested_ai_mode text,
    requested_ai_provider text,
    using_custom_key boolean default false,
    web_search_enabled boolean default false,
    image_count integer,
    url_count integer,
    cost integer,
    question_length integer,
    context_length integer,
    error text,
    reason text,
    created_at timestamptz not null default now()
);

create index if not exists ai_events_created_at_idx
    on public.ai_events (created_at desc);

create index if not exists ai_events_route_created_at_idx
    on public.ai_events (route, created_at desc);

create index if not exists ai_events_user_created_at_idx
    on public.ai_events (user_id, created_at desc);

create index if not exists ai_events_mode_created_at_idx
    on public.ai_events (requested_ai_mode, created_at desc);

alter table public.ai_events enable row level security;

drop policy if exists "ai_events_admin_service_only" on public.ai_events;
create policy "ai_events_admin_service_only"
on public.ai_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
