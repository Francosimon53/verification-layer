-- AWS PHI validation funnel (read-only).
-- Usage: psql "$DATABASE_URL" -f dashboard/supabase/queries/aws_funnel.sql
--
-- LAUNCH TIMESTAMP: rows created before this instant are ignored.
-- Change the value below (psql variable) before running.
\set launch_ts '''2026-09-22T00:00:00Z'''

-- Query 1: one row per event_name in funnel order.
--   sessions                    distinct sessions that emitted the event
--   qualified_sessions          sessions where properties usesAws and processesPhi are both true
--   customer_requested_sessions sessions where properties customerRequested is true
-- Internal verification traffic (utm_source = 'claude_verify') is excluded.
with funnel(step, event_name) as (
  values
    (1,  'landing_view'),
    (2,  'start_clicked'),
    (3,  'aws_yes'),
    (4,  'phi_yes'),
    (5,  'active_evidence_request'),
    (6,  'report_preview'),
    (7,  'pricing_view'),
    (8,  'checkout_started'),
    (9,  'intake_requested'),
    (10, 'payment')
),
events as (
  select
    session_id,
    event_name,
    (properties ->> 'usesAws')::boolean          as uses_aws,
    (properties ->> 'processesPhi')::boolean     as processes_phi,
    (properties ->> 'customerRequested')::boolean as customer_requested
  from public.aws_validation_events
  where created_at >= :launch_ts::timestamptz
    and coalesce(properties ->> 'utm_source', '') <> 'claude_verify'
)
select
  f.step,
  f.event_name,
  count(distinct e.session_id) as sessions,
  count(distinct e.session_id) filter (where e.uses_aws and e.processes_phi) as qualified_sessions,
  count(distinct e.session_id) filter (where e.customer_requested) as customer_requested_sessions
from funnel f
left join events e on e.event_name = f.event_name
group by f.step, f.event_name
order by f.step;

-- Query 2: intake requests joined to their session's evidence reason and
-- utm_source (taken from that session's funnel events), newest first.
select
  i.id,
  i.created_at,
  i.company,
  i.email,
  i.review_due,
  i.note,
  coalesce(
    i.answers ->> 'evidenceReason',
    (
      select e.properties ->> 'evidenceReason'
      from public.aws_validation_events e
      where e.session_id = i.session_id
        and e.properties ? 'evidenceReason'
      order by e.created_at desc
      limit 1
    )
  ) as evidence_reason,
  coalesce(
    i.attribution ->> 'utm_source',
    (
      select e.properties ->> 'utm_source'
      from public.aws_validation_events e
      where e.session_id = i.session_id
        and e.properties ? 'utm_source'
      order by e.created_at asc
      limit 1
    )
  ) as utm_source,
  i.session_id
from public.aws_validation_intakes i
where i.created_at >= :launch_ts::timestamptz
  and coalesce(i.attribution ->> 'utm_source', '') <> 'claude_verify'
order by i.created_at desc;
