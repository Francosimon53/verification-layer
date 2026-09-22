-- Anonymous funnel events for the AWS-first willingness-to-pay experiment.
-- Browser clients never access this table directly. All writes go through
-- server-side routes using the service role, and no PHI or AWS credentials
-- are collected.
create table if not exists public.aws_validation_events (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  session_id uuid not null,
  event_name text not null check (
    event_name in (
      'landing_view',
      'start_clicked',
      'aws_yes',
      'phi_yes',
      'active_evidence_request',
      'report_preview',
      'pricing_view',
      'checkout_started',
      'payment'
    )
  ),
  source text not null default 'browser' check (
    source in ('browser', 'server', 'stripe')
  ),
  path text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint aws_validation_events_session_event_key
    unique (session_id, event_name)
);

alter table public.aws_validation_events enable row level security;

-- Defense in depth: there are intentionally no anon/authenticated policies.
revoke all on table public.aws_validation_events from anon, authenticated;
revoke all on sequence public.aws_validation_events_id_seq from anon, authenticated;
grant select, insert on table public.aws_validation_events to service_role;
grant usage, select on sequence public.aws_validation_events_id_seq to service_role;

comment on table public.aws_validation_events is
  'Server-written, non-PHI behavioral events for the AWS PHI evidence validation funnel.';
