begin;

create or replace function public.deduct_credits(
  p_user_id uuid,
  p_cost integer,
  p_credit_type text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_available integer := 0;
  v_tier text := 'free';
  v_today date := (now() at time zone 'Asia/Makassar')::date;
  v_month_start date := date_trunc('month', now() at time zone 'Asia/Makassar')::date;
  v_expected_daily integer := 0;
  v_expected_monthly integer := 0;
begin
  if p_user_id is null or p_cost is null or p_cost <= 0 then
    return false;
  end if;

  if p_credit_type not in ('daily_free', 'monthly', 'bonus') then
    return false;
  end if;

  if auth.uid() is not null and auth.uid() <> p_user_id then
    return false;
  end if;

  select coalesce(tier, 'free')
    into v_tier
  from public.subscriptions
  where user_id = p_user_id
  limit 1;

  v_expected_daily := case
    when v_tier = 'free' then 5
    else 0
  end;

  v_expected_monthly := case
    when v_tier = 'plus' then 300
    when v_tier = 'pro' then 1500
    else 0
  end;

  insert into public.credit_balances (
    user_id,
    monthly_credits,
    monthly_credits_used,
    bonus_credits,
    bonus_credits_used,
    daily_free_credits,
    daily_free_used,
    last_daily_reset,
    last_monthly_reset,
    updated_at
  )
  values (
    p_user_id,
    v_expected_monthly,
    0,
    case when v_tier = 'free' then 25 else 0 end,
    0,
    v_expected_daily,
    0,
    case when v_expected_daily > 0 then v_today else null end,
    case when v_expected_monthly > 0 then v_month_start else null end,
    now()
  )
  on conflict (user_id) do nothing;

  perform 1
  from public.credit_balances
  where user_id = p_user_id
  for update;

  update public.credit_balances
  set
    daily_free_credits = case
      when v_expected_daily = 0 then 0
      when last_daily_reset is distinct from v_today then v_expected_daily
      else daily_free_credits
    end,
    daily_free_used = case
      when v_expected_daily = 0 then 0
      when last_daily_reset is distinct from v_today then 0
      else daily_free_used
    end,
    last_daily_reset = case
      when v_expected_daily = 0 then null
      else v_today
    end,
    monthly_credits = case
      when v_expected_monthly = 0 then 0
      when last_monthly_reset is distinct from v_month_start then v_expected_monthly
      else monthly_credits
    end,
    monthly_credits_used = case
      when v_expected_monthly = 0 then 0
      when last_monthly_reset is distinct from v_month_start then 0
      else monthly_credits_used
    end,
    last_monthly_reset = case
      when v_expected_monthly = 0 then null
      else v_month_start
    end,
    updated_at = now()
  where user_id = p_user_id;

  if p_credit_type = 'daily_free' then
    select (daily_free_credits - daily_free_used)
      into v_available
    from public.credit_balances
    where user_id = p_user_id;

    if v_available < p_cost then
      return false;
    end if;

    update public.credit_balances
    set
      daily_free_used = daily_free_used + p_cost,
      updated_at = now()
    where user_id = p_user_id;

  elsif p_credit_type = 'monthly' then
    select (monthly_credits - monthly_credits_used)
      into v_available
    from public.credit_balances
    where user_id = p_user_id;

    if v_available < p_cost then
      return false;
    end if;

    update public.credit_balances
    set
      monthly_credits_used = monthly_credits_used + p_cost,
      updated_at = now()
    where user_id = p_user_id;

  elsif p_credit_type = 'bonus' then
    select (bonus_credits - bonus_credits_used)
      into v_available
    from public.credit_balances
    where user_id = p_user_id;

    if v_available < p_cost then
      return false;
    end if;

    update public.credit_balances
    set
      bonus_credits_used = bonus_credits_used + p_cost,
      updated_at = now()
    where user_id = p_user_id;
  end if;

  return true;
end;
$function$;

update public.credit_balances cb
set
  daily_free_credits = case
    when coalesce(s.tier, 'free') = 'free' then 5
    else 0
  end,
  daily_free_used = case
    when coalesce(s.tier, 'free') = 'free'
      and cb.last_daily_reset is distinct from (now() at time zone 'Asia/Makassar')::date
      then 0
    when coalesce(s.tier, 'free') = 'free'
      then cb.daily_free_used
    else 0
  end,
  last_daily_reset = case
    when coalesce(s.tier, 'free') = 'free' then (now() at time zone 'Asia/Makassar')::date
    else null
  end,
  monthly_credits = case
    when s.tier = 'plus' then 300
    when s.tier = 'pro' then 1500
    else 0
  end,
  monthly_credits_used = case
    when s.tier in ('plus', 'pro')
      and cb.last_monthly_reset is distinct from date_trunc('month', now() at time zone 'Asia/Makassar')::date
      then 0
    when s.tier in ('plus', 'pro')
      then cb.monthly_credits_used
    else 0
  end,
  last_monthly_reset = case
    when s.tier in ('plus', 'pro') then date_trunc('month', now() at time zone 'Asia/Makassar')::date
    else null
  end,
  updated_at = now()
from public.subscriptions s
where s.user_id = cb.user_id;

commit;
