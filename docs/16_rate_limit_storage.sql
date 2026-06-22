-- Persistent API rate limiting for Paapan.
-- Run this in Supabase SQL editor before relying on production rate limits.

create table if not exists public.rate_limits (
    identifier text primary key,
    count integer not null default 0,
    reset_at timestamptz not null,
    updated_at timestamptz not null default now()
);

create index if not exists rate_limits_reset_at_idx
    on public.rate_limits (reset_at);

alter table public.rate_limits enable row level security;

-- No public RLS policies are required. Server routes call this with the service role.

create or replace function public.check_rate_limit(
    p_identifier text,
    p_max_requests integer,
    p_window_seconds integer
)
returns table (
    allowed boolean,
    remaining integer,
    reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_now timestamptz := now();
    v_window interval := make_interval(secs => greatest(p_window_seconds, 1));
    v_record public.rate_limits%rowtype;
    v_next_count integer;
begin
    if p_identifier is null or length(trim(p_identifier)) = 0 then
        raise exception 'rate limit identifier is required';
    end if;

    if p_max_requests < 1 then
        raise exception 'max requests must be at least 1';
    end if;

    insert into public.rate_limits (identifier, count, reset_at, updated_at)
    values (left(p_identifier, 512), 0, v_now + v_window, v_now)
    on conflict (identifier) do nothing;

    select *
    into v_record
    from public.rate_limits
    where identifier = left(p_identifier, 512)
    for update;

    if v_record.reset_at <= v_now then
        update public.rate_limits
        set count = 1,
            reset_at = v_now + v_window,
            updated_at = v_now
        where identifier = left(p_identifier, 512)
        returning * into v_record;

        allowed := true;
        remaining := greatest(p_max_requests - 1, 0);
        reset_at := v_record.reset_at;
        return next;
        return;
    end if;

    if v_record.count >= p_max_requests then
        allowed := false;
        remaining := 0;
        reset_at := v_record.reset_at;
        return next;
        return;
    end if;

    v_next_count := v_record.count + 1;

    update public.rate_limits
    set count = v_next_count,
        updated_at = v_now
    where identifier = left(p_identifier, 512)
    returning * into v_record;

    allowed := true;
    remaining := greatest(p_max_requests - v_next_count, 0);
    reset_at := v_record.reset_at;
    return next;
end;
$$;

grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- Optional maintenance cleanup. Safe to run manually or from a scheduled job.
delete from public.rate_limits
where reset_at < now() - interval '1 day';
