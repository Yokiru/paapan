create table if not exists public.feedback_submissions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    full_name text,
    email text,
    category text not null check (category in ('bug', 'suggestion', 'question')),
    message text not null,
    source_page text,
    user_agent text,
    status text not null default 'new' check (status in ('new', 'reviewed', 'resolved', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists feedback_submissions_created_at_idx
    on public.feedback_submissions (created_at desc);

create index if not exists feedback_submissions_status_idx
    on public.feedback_submissions (status);

create index if not exists feedback_submissions_user_id_idx
    on public.feedback_submissions (user_id);

create or replace function public.set_feedback_submissions_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists feedback_submissions_set_updated_at on public.feedback_submissions;

create trigger feedback_submissions_set_updated_at
before update on public.feedback_submissions
for each row
execute function public.set_feedback_submissions_updated_at();
