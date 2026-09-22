-- Adds the lower-commitment "request the pilot intake" path to the AWS PHI
-- validation funnel: a new funnel event and a server-written intakes table.

-- (a) Allow the new funnel event.
alter table public.aws_validation_events
  drop constraint if exists aws_validation_events_event_name_check;

alter table public.aws_validation_events
  add constraint aws_validation_events_event_name_check check (
    event_name in (
      'landing_view',
      'start_clicked',
      'aws_yes',
      'phi_yes',
      'active_evidence_request',
      'report_preview',
      'pricing_view',
      'checkout_started',
      'intake_requested',
      'payment'
    )
  );

-- (b) Pilot intake requests. Contact details live here and only here; the
-- events table receives the non-identifying properties.
create table if not exists public.aws_validation_intakes (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  email text not null,
  company text not null,
  review_due text not null check (
    review_due in ('this_week', 'this_month', 'this_quarter', 'no_date')
  ),
  note text,
  answers jsonb not null default '{}'::jsonb,
  attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.aws_validation_intakes enable row level security;

-- Defense in depth: there are intentionally no anon/authenticated policies.
revoke all on table public.aws_validation_intakes from anon, authenticated;
revoke all on sequence public.aws_validation_intakes_id_seq from anon, authenticated;
grant select, insert on table public.aws_validation_intakes to service_role;
grant usage, select on sequence public.aws_validation_intakes_id_seq to service_role;

comment on table public.aws_validation_intakes is
  'Server-written contact details for AWS PHI pilot intake requests. Holds work email, company and scheduling context only; never PHI.';
