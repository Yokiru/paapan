alter table public.workspaces
add column if not exists share_visibility text not null default 'private';

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'workspaces_share_visibility_check'
    ) then
        alter table public.workspaces
        add constraint workspaces_share_visibility_check
        check (share_visibility in ('private', 'link_view'));
    end if;
end $$;

alter table public.workspaces
add column if not exists share_token_nonce text;

alter table public.workspaces
add column if not exists allow_public_duplicate boolean not null default true;

alter table public.workspaces
add column if not exists shared_at timestamptz;

alter table public.workspaces
add column if not exists share_updated_at timestamptz;

create unique index if not exists workspaces_share_token_nonce_unique_idx
on public.workspaces (share_token_nonce)
where share_token_nonce is not null;
