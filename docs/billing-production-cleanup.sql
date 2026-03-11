-- LIFE OS: production billing cleanup (dev/test subscription artifacts)
-- Run in Supabase SQL Editor against production DB.
-- IMPORTANT: Review preview queries before running cleanup block.

-- =========================================================
-- 1) AUDIT (read-only)
-- =========================================================

-- A1. Top-level distribution
select "plan", count(*) as users_count
from public."User"
group by 1
order by 1;

select "key", "status", count(*) as entitlement_count
from public."Entitlement"
group by 1, 2
order by 1, 2;

select "provider", "status", count(*) as order_count
from public."BillingOrder"
group by 1, 2
order by 1, 2;

select "provider", lower("status") as payment_status, count(*) as payment_count
from public."BillingPayment"
group by 1, 2
order by 1, 2;

select lower("statusRaw") as event_status, count(*) as event_count
from public."BillingPaymentEvent"
group by 1
order by 2 desc;

select
  count(*) filter (where coalesce("signature", '') = '') as events_missing_signature,
  count(*) filter (where coalesce("providerEventId", '') = '') as events_missing_provider_event_id
from public."BillingPaymentEvent";

-- A2. Build valid paid orders (webhook-confirmed provenance)
-- Criteria:
-- - provider is NOWPAYMENTS
-- - order status is PAID
-- - payment status is confirmed/finished
-- - at least one webhook event confirmed/finished with non-empty signature
with valid_confirmed_orders as (
  select distinct
    o."id" as "orderId",
    o."userId"
  from public."BillingOrder" o
  join public."BillingPayment" p on p."orderId" = o."id"
  join public."BillingPaymentEvent" e on e."orderId" = o."id"
  where o."provider" = 'NOWPAYMENTS'
    and p."provider" = 'NOWPAYMENTS'
    and o."status" = 'PAID'
    and lower(p."status") in ('confirmed', 'finished')
    and lower(e."statusRaw") in ('confirmed', 'finished')
    and coalesce(e."signature", '') <> ''
)
select count(*) as valid_confirmed_orders_count
from valid_confirmed_orders;

-- A3. Preview: users with PRO plan but no valid active entitlement
with valid_confirmed_orders as (
  select distinct
    o."id" as "orderId",
    o."userId"
  from public."BillingOrder" o
  join public."BillingPayment" p on p."orderId" = o."id"
  join public."BillingPaymentEvent" e on e."orderId" = o."id"
  where o."provider" = 'NOWPAYMENTS'
    and p."provider" = 'NOWPAYMENTS'
    and o."status" = 'PAID'
    and lower(p."status") in ('confirmed', 'finished')
    and lower(e."statusRaw") in ('confirmed', 'finished')
    and coalesce(e."signature", '') <> ''
)
select
  u."id",
  u."email",
  u."plan",
  u."updatedAt"
from public."User" u
where u."plan" = 'PRO'
  and not exists (
    select 1
    from public."Entitlement" en
    join valid_confirmed_orders v
      on v."orderId" = en."sourceOrderId"
     and v."userId" = en."userId"
    where en."userId" = u."id"
      and en."key" = 'OPERATOR_LICENSE'
      and en."status" = 'ACTIVE'
      and en."expiresAt" > now()
  )
order by u."updatedAt" desc;

-- A4. Preview: entitlements not backed by valid webhook-confirmed order
with valid_confirmed_orders as (
  select distinct
    o."id" as "orderId",
    o."userId"
  from public."BillingOrder" o
  join public."BillingPayment" p on p."orderId" = o."id"
  join public."BillingPaymentEvent" e on e."orderId" = o."id"
  where o."provider" = 'NOWPAYMENTS'
    and p."provider" = 'NOWPAYMENTS'
    and o."status" = 'PAID'
    and lower(p."status") in ('confirmed', 'finished')
    and lower(e."statusRaw") in ('confirmed', 'finished')
    and coalesce(e."signature", '') <> ''
)
select
  en."id",
  en."userId",
  en."status",
  en."startsAt",
  en."expiresAt",
  en."sourceOrderId"
from public."Entitlement" en
left join valid_confirmed_orders v
  on v."orderId" = en."sourceOrderId"
 and v."userId" = en."userId"
where en."key" = 'OPERATOR_LICENSE'
  and (en."sourceOrderId" is null or v."orderId" is null)
order by en."updatedAt" desc;

-- =========================================================
-- 2) CLEANUP (write)
-- =========================================================
-- Uncomment and run only after reviewing previews above.

begin;

create temporary table _valid_confirmed_orders on commit drop as
select distinct
  o."id" as "orderId",
  o."userId"
from public."BillingOrder" o
join public."BillingPayment" p on p."orderId" = o."id"
join public."BillingPaymentEvent" e on e."orderId" = o."id"
where o."provider" = 'NOWPAYMENTS'
  and p."provider" = 'NOWPAYMENTS'
  and o."status" = 'PAID'
  and lower(p."status") in ('confirmed', 'finished')
  and lower(e."statusRaw") in ('confirmed', 'finished')
  and coalesce(e."signature", '') <> '';

-- C1. Remove entitlements that are not backed by valid webhook-confirmed order.
with deleted_entitlements as (
  delete from public."Entitlement" en
  where en."key" = 'OPERATOR_LICENSE'
    and (
      en."sourceOrderId" is null
      or not exists (
        select 1
        from _valid_confirmed_orders v
        where v."orderId" = en."sourceOrderId"
          and v."userId" = en."userId"
      )
    )
  returning en."id", en."userId"
)
select count(*) as deleted_entitlements_count
from deleted_entitlements;

-- C2. Reset PRO -> FREE for users without valid active entitlement.
with updated_users as (
  update public."User" u
  set
    "plan" = 'FREE',
    "updatedAt" = now()
  where u."plan" = 'PRO'
    and not exists (
      select 1
      from public."Entitlement" en
      join _valid_confirmed_orders v
        on v."orderId" = en."sourceOrderId"
       and v."userId" = en."userId"
      where en."userId" = u."id"
        and en."key" = 'OPERATOR_LICENSE'
        and en."status" = 'ACTIVE'
        and en."expiresAt" > now()
    )
  returning u."id", u."email"
)
select count(*) as users_reset_to_free_count
from updated_users;

-- C3. Remove clearly fake webhook events (impossible for verified NOWPayments IPN).
with deleted_events as (
  delete from public."BillingPaymentEvent" e
  where coalesce(e."signature", '') = ''
     or coalesce(e."providerEventId", '') = ''
  returning e."id"
)
select count(*) as deleted_fake_events_count
from deleted_events;

commit;

-- =========================================================
-- 3) FINAL VERIFICATION (must return 0)
-- =========================================================
with valid_confirmed_orders as (
  select distinct
    o."id" as "orderId",
    o."userId"
  from public."BillingOrder" o
  join public."BillingPayment" p on p."orderId" = o."id"
  join public."BillingPaymentEvent" e on e."orderId" = o."id"
  where o."provider" = 'NOWPAYMENTS'
    and p."provider" = 'NOWPAYMENTS'
    and o."status" = 'PAID'
    and lower(p."status") in ('confirmed', 'finished')
    and lower(e."statusRaw") in ('confirmed', 'finished')
    and coalesce(e."signature", '') <> ''
)
select count(*) as forced_pro_remaining
from public."User" u
where u."plan" = 'PRO'
  and not exists (
    select 1
    from public."Entitlement" en
    join valid_confirmed_orders v
      on v."orderId" = en."sourceOrderId"
     and v."userId" = en."userId"
    where en."userId" = u."id"
      and en."key" = 'OPERATOR_LICENSE'
      and en."status" = 'ACTIVE'
      and en."expiresAt" > now()
  );
