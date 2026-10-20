-- The Concept Investment Program management upgrade
-- Run after schema.sql in Supabase SQL Editor.
alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active','suspended')),
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;

alter table public.roi_payments
  add column if not exists payout_reference text,
  add column if not exists payout_notes text,
  add column if not exists reinvested_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id);
alter table public.roi_payments drop constraint if exists roi_payments_status_check;
alter table public.roi_payments add constraint roi_payments_status_check
  check (status in ('pending','paid','reinvested','cancelled'));

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  device_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_read_owner_or_admin on public.push_tokens;
create policy push_tokens_read_owner_or_admin on public.push_tokens for select to authenticated
using (user_id = auth.uid() or public.is_admin());
drop policy if exists push_tokens_insert_owner on public.push_tokens;
create policy push_tokens_insert_owner on public.push_tokens for insert to authenticated
with check (user_id = auth.uid());
drop policy if exists push_tokens_update_owner on public.push_tokens;
create policy push_tokens_update_owner on public.push_tokens for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.push_tokens to authenticated;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id),
  action text not null,
  target_user_id uuid references auth.users(id),
  entity_type text,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
drop policy if exists audit_read_admin on public.admin_audit_log;
create policy audit_read_admin on public.admin_audit_log for select to authenticated
using (public.is_admin());
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;

-- Record ROI payout only once, only when due. This records the admin confirmation;
-- it does not move money or initiate a bank transfer.
create or replace function public.admin_record_roi_payout(
  p_roi_id uuid, p_reference text default null, p_notes text default null
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_roi public.roi_payments%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required'; end if;
  select * into v_roi from public.roi_payments where id=p_roi_id for update;
  if not found then raise exception 'ROI record not found'; end if;
  if v_roi.status <> 'pending' then raise exception 'This ROI is not pending'; end if;
  if v_roi.due_date > current_date then raise exception 'This ROI is not due yet'; end if;
  update public.roi_payments set status='paid', paid_at=now(),
    payout_reference=nullif(trim(p_reference),''), payout_notes=nullif(trim(p_notes),''),
    reviewed_by=auth.uid() where id=p_roi_id;
  insert into public.notifications(user_id,title,body,type)
  values(v_roi.user_id,'ROI payment updated',
    'Your ROI for period '||v_roi.period_month||' has been recorded as paid.',
    'roi_paid');
  insert into public.admin_audit_log(admin_id,target_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),v_roi.user_id,'roi_payout_recorded','roi_payment',p_roi_id,
    jsonb_build_object('amount',v_roi.amount,'reference',p_reference));
  return p_roi_id;
end; $$;
revoke all on function public.admin_record_roi_payout(uuid,text,text) from public, anon;
grant execute on function public.admin_record_roi_payout(uuid,text,text) to authenticated;

create or replace function public.admin_record_roi_reinvestment(
  p_roi_id uuid, p_notes text default null
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_roi public.roi_payments%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required'; end if;
  select * into v_roi from public.roi_payments where id=p_roi_id for update;
  if not found then raise exception 'ROI record not found'; end if;
  if v_roi.status <> 'pending' then raise exception 'This ROI is not pending'; end if;
  if v_roi.due_date > current_date then raise exception 'This ROI is not due yet'; end if;
  if not exists (select 1 from public.reinvestment_requests rr
    where rr.roi_payment_id=p_roi_id and rr.status='approved' and rr.amount=v_roi.amount) then
    raise exception 'An approved full-ROI reinvestment request from the investor is required';
  end if;
  if nullif(trim(p_notes),'') is null then raise exception 'Record the investor consent details before reinvestment'; end if;
  update public.reinvestment_requests set status='completed', reviewed_by=auth.uid(), reviewed_at=now()
    where roi_payment_id=p_roi_id and status='approved';
  update public.roi_payments set status='reinvested', reinvested_at=now(),
    payout_notes=nullif(trim(p_notes),''), reviewed_by=auth.uid() where id=p_roi_id;
  insert into public.notifications(user_id,title,body,type)
  values(v_roi.user_id,'ROI reinvestment recorded',
    'Your ROI for period '||v_roi.period_month||' has been recorded as reinvested.',
    'roi_reinvested');
  insert into public.admin_audit_log(admin_id,target_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),v_roi.user_id,'roi_reinvested','roi_payment',p_roi_id,
    jsonb_build_object('amount',v_roi.amount,'notes',p_notes));
  return p_roi_id;
end; $$;
revoke all on function public.admin_record_roi_reinvestment(uuid,text) from public, anon;
grant execute on function public.admin_record_roi_reinvestment(uuid,text) to authenticated;

create or replace function public.admin_review_reinvestment_request(
  p_request_id uuid, p_decision text, p_admin_notes text default null
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_request public.reinvestment_requests%rowtype; v_roi public.roi_payments%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into v_request from public.reinvestment_requests where id=p_request_id for update;
  if not found then raise exception 'Reinvestment request not found'; end if;
  if v_request.status <> 'pending_review' then raise exception 'This request has already been reviewed'; end if;
  select * into v_roi from public.roi_payments where id=v_request.roi_payment_id for update;
  if not found or v_roi.status <> 'pending' then raise exception 'ROI is no longer available for reinvestment'; end if;
  if v_roi.due_date > current_date then raise exception 'This ROI is not due yet'; end if;
  if v_request.amount <> v_roi.amount then raise exception 'Only full-ROI reinvestment is supported for this payment'; end if;
  update public.reinvestment_requests set status=p_decision, admin_notes=nullif(trim(p_admin_notes),''),
    reviewed_by=auth.uid(), reviewed_at=now() where id=p_request_id;
  if p_decision='approved' then
    update public.roi_payments set status='reinvested', reinvested_at=now(),
      payout_notes=coalesce(nullif(trim(p_admin_notes),''),'Investor requested full ROI reinvestment'),
      reviewed_by=auth.uid() where id=v_roi.id;
    update public.reinvestment_requests set status='completed' where id=p_request_id;
  end if;
  insert into public.notifications(user_id,title,body,type)
  values(v_request.user_id,
    case when p_decision='approved' then 'ROI reinvestment approved' else 'ROI reinvestment declined' end,
    case when p_decision='approved' then 'Your request to reinvest this ROI has been approved and recorded.'
         else coalesce(nullif(trim(p_admin_notes),''),'Your reinvestment request was declined. Contact support if you need clarification.') end,
    case when p_decision='approved' then 'roi_reinvested' else 'reinvestment_rejected' end);
  insert into public.admin_audit_log(admin_id,target_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),v_request.user_id,'reinvestment_request_'||p_decision,'reinvestment_request',p_request_id,
    jsonb_build_object('roi_payment_id',v_roi.id,'amount',v_request.amount,'notes',p_admin_notes));
  return p_request_id;
end; $$;
revoke all on function public.admin_review_reinvestment_request(uuid,text,text) from public, anon;
grant execute on function public.admin_review_reinvestment_request(uuid,text,text) to authenticated;

-- Existing admin RPC review_application remains the source of truth for activation.
-- Important: use the Edge Function in supabase/functions/admin-management for Auth bans
-- and notifications. Never put the Supabase service-role key in the mobile app.

drop policy if exists audit_insert_admin on public.admin_audit_log;
create policy audit_insert_admin on public.admin_audit_log for insert to authenticated
with check (public.is_admin() and admin_id = auth.uid());
grant insert on public.admin_audit_log to authenticated;
