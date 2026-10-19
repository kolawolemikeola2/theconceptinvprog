-- The Concept Investment Program: Supabase schema
-- Run this entire file in Supabase Dashboard > SQL Editor.
-- Monthly ROI is fixed at 2.5%; investment term is fixed at 24 months.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'investor' check (role in ('investor','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  account_name text not null,
  account_number text not null,
  currency text not null default 'USD' check (currency = 'USD'),
  payment_instructions text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.investment_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  duration_months integer not null default 24 check (duration_months = 24),
  monthly_roi_rate numeric(5,4) not null default 0.025 check (monthly_roi_rate = 0.025),
  transaction_reference text,
  receipt_path text not null,
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected')),
  admin_notes text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null unique references public.investment_applications(id),
  principal numeric(14,2) not null check (principal > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  duration_months integer not null default 24 check (duration_months = 24),
  monthly_roi_rate numeric(5,4) not null default 0.025 check (monthly_roi_rate = 0.025),
  start_date date not null,
  maturity_date date not null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.roi_payments (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_month integer not null check (period_month between 1 and 24),
  due_date date not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (investment_id, period_month)
);

create index if not exists investment_applications_user_idx on public.investment_applications(user_id, created_at desc);
create index if not exists investment_applications_status_idx on public.investment_applications(status, created_at);
create index if not exists investments_user_idx on public.investments(user_id, created_at desc);
create index if not exists roi_payments_user_idx on public.roi_payments(user_id, due_date);

alter table public.profiles enable row level security;
alter table public.payment_accounts enable row level security;
alter table public.investment_applications enable row level security;
alter table public.investments enable row level security;
alter table public.roi_payments enable row level security;

-- Profiles: a user can read their own profile; admins can read all profiles.
drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid() and role = 'investor');
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Payment account: authenticated users can read enabled instructions; admins manage accounts.
drop policy if exists payment_accounts_read_active_or_admin on public.payment_accounts;
create policy payment_accounts_read_active_or_admin on public.payment_accounts for select to authenticated
using (is_active = true or public.is_admin());
drop policy if exists payment_accounts_admin_insert on public.payment_accounts;
create policy payment_accounts_admin_insert on public.payment_accounts for insert to authenticated
with check (public.is_admin());
drop policy if exists payment_accounts_admin_update on public.payment_accounts;
create policy payment_accounts_admin_update on public.payment_accounts for update to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists payment_accounts_admin_delete on public.payment_accounts;
create policy payment_accounts_admin_delete on public.payment_accounts for delete to authenticated
using (public.is_admin());
grant select, insert, update, delete on public.payment_accounts to authenticated;

-- Applications: investors can create and read only their own pending submissions; admin review is RPC-based.
drop policy if exists applications_read_owner_or_admin on public.investment_applications;
create policy applications_read_owner_or_admin on public.investment_applications for select to authenticated
using (user_id = auth.uid() or public.is_admin());
drop policy if exists applications_insert_owner_pending on public.investment_applications;
create policy applications_insert_owner_pending on public.investment_applications for insert to authenticated
with check (user_id = auth.uid() and status = 'pending_review' and reviewed_by is null and reviewed_at is null and monthly_roi_rate = 0.025 and duration_months = 24 and receipt_path like (auth.uid()::text || '/%'));
grant select, insert on public.investment_applications to authenticated;

-- Investments and ROI are read-only for investors; approval function creates the records.
drop policy if exists investments_read_owner_or_admin on public.investments;
create policy investments_read_owner_or_admin on public.investments for select to authenticated
using (user_id = auth.uid() or public.is_admin());
grant select on public.investments to authenticated;
drop policy if exists roi_read_owner_or_admin on public.roi_payments;
create policy roi_read_owner_or_admin on public.roi_payments for select to authenticated
using (user_id = auth.uid() or public.is_admin());
grant select on public.roi_payments to authenticated;

-- Optional app notifications and reinvestment requests. These do not transfer funds.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'general',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notifications_read_owner_or_admin on public.notifications;
create policy notifications_read_owner_or_admin on public.notifications for select to authenticated
using (user_id = auth.uid() or public.is_admin());
drop policy if exists notifications_update_owner on public.notifications;
create policy notifications_update_owner on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_insert_admin on public.notifications;
create policy notifications_insert_admin on public.notifications for insert to authenticated
with check (public.is_admin());
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert on public.notifications to authenticated;

create table if not exists public.reinvestment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  roi_payment_id uuid not null references public.roi_payments(id),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected','completed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);
alter table public.reinvestment_requests enable row level security;
drop policy if exists reinvestment_read_owner_or_admin on public.reinvestment_requests;
create policy reinvestment_read_owner_or_admin on public.reinvestment_requests for select to authenticated
using (user_id = auth.uid() or public.is_admin());
drop policy if exists reinvestment_insert_owner on public.reinvestment_requests;
create policy reinvestment_insert_owner on public.reinvestment_requests for insert to authenticated
with check (user_id = auth.uid() and status = 'pending_review' and reviewed_by is null and reviewed_at is null);
grant select, insert on public.reinvestment_requests to authenticated;

-- Review an application atomically. Only admins can call this RPC successfully.
create or replace function public.review_investment_application(
  p_application_id uuid,
  p_decision text,
  p_admin_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.investment_applications%rowtype;
  v_investment_id uuid;
  v_start_date date := current_date;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an administrator can review investment applications';
  end if;
  if p_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select * into v_app
  from public.investment_applications
  where id = p_application_id
  for update;

  if not found then raise exception 'Application not found'; end if;
  if v_app.status <> 'pending_review' then raise exception 'This application has already been reviewed'; end if;

  update public.investment_applications
  set status = p_decision,
      admin_notes = p_admin_notes,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_application_id;

  if p_decision = 'approved' then
    insert into public.investments (
      user_id, application_id, principal, currency, duration_months,
      monthly_roi_rate, start_date, maturity_date, status
    ) values (
      v_app.user_id, v_app.id, v_app.amount, 'USD', 24,
      0.025, v_start_date, (v_start_date + interval '24 months')::date, 'active'
    ) returning id into v_investment_id;

    insert into public.roi_payments (
      investment_id, user_id, period_month, due_date, amount, currency, status
    )
    select v_investment_id, v_app.user_id, month_no,
           (v_start_date + make_interval(months => month_no))::date,
           round(v_app.amount * 0.025, 2), 'USD', 'pending'
    from generate_series(1, 24) as months(month_no);
    insert into public.notifications (user_id, title, body, type)
    values (v_app.user_id, 'Investment approved', 'Your investment application was approved. Your 24-month investment and monthly ROI schedule are now active.', 'investment_approved');
  else
    insert into public.notifications (user_id, title, body, type)
    values (v_app.user_id, 'Investment application update', coalesce(p_admin_notes, 'Your investment application was not approved. Contact support if you need clarification.'), 'investment_rejected');
  end if;

  return v_app.id;
end;
$$;
revoke all on function public.review_investment_application(uuid, text, text) from public, anon;
grant execute on function public.review_investment_application(uuid, text, text) to authenticated;

-- Private receipt bucket. Receipt object names must begin with the authenticated user's UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists receipt_upload_own_folder on storage.objects;
create policy receipt_upload_own_folder on storage.objects for insert to authenticated
with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists receipt_read_owner_or_admin on storage.objects;
create policy receipt_read_owner_or_admin on storage.objects for select to authenticated
using (bucket_id = 'payment-receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists receipt_delete_owner_or_admin on storage.objects;
create policy receipt_delete_owner_or_admin on storage.objects for delete to authenticated
using (bucket_id = 'payment-receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- IMPORTANT: after creating your first account, promote the intended admin from SQL Editor only:
-- update public.profiles p set role = 'admin'
-- from auth.users u where p.id = u.id and u.email = 'YOUR_ADMIN_EMAIL';
-- Add real, verified payment details from an authenticated admin account or Supabase SQL Editor.
