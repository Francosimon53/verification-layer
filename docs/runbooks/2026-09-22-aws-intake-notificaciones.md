# 2026-09-22 — Funnel AWS PHI: intake request, notificaciones al fundador, entidad legal

Rama: `experiment/aws-phi-validation`. Alcance: `dashboard/`. No se tocó el flujo de
calificación, el report preview, la lógica de checkout de Stripe ni el texto legal más allá
del nombre de la entidad y la fecha.

## Resultado medible

- POST válido a `/api/aws/intake` → 204, fila en `aws_validation_intakes`, evento
  `intake_requested` sin email/company/note en `aws_validation_events`, mensaje Telegram.
- Pago AWS en el webhook de Stripe → mensaje Telegram tras registrar el evento.
- Tabla `aws_validation_intakes` en remoto (vyzumozxkfwgyifkwopl). **PENDIENTE**, ver abajo.
- Lint (archivos tocados), `tsc --noEmit`, `next build`, vitest raíz y test del intake en verde.

## Guion ejecutado

1. `lib/aws-validation.ts`: `'intake_requested'` en `AWS_VALIDATION_EVENT_NAMES`;
   `AWS_INTAKE_REVIEW_DUE`, `isAwsIntakeReviewDue`, `AwsValidationAttribution`,
   `sanitizeAwsAttribution` (recorte a 200 caracteres) compartidos entre cliente y servidor.
   Migración `supabase/migrations/20260922021000_aws_validation_intakes.sql`: nuevo check
   de `event_name` + tabla `aws_validation_intakes` con RLS, revoke anon/authenticated,
   grant select/insert a service_role y comentario. Verificación: `supabase db push --dry-run`. ❌
   **Bloqueado**: el historial remoto tiene 17 migraciones (`20260907…` × 16 y
   `20260922005656_aws_phi_validation_events`) que no existen en `supabase/migrations/`, y la
   local `20260921144217` no está en remoto. El CLI exige `supabase migration repair` y
   `supabase db pull` antes de `db push`. No se reparó el historial (reescribe estado
   remoto). La tabla de eventos ya existe en remoto con el check antiguo, así que hasta
   aplicar la migración el evento `intake_requested` fallará por constraint.
2. `lib/aws-validation-notify.ts`: `notifyFounder(text)` → Telegram `sendMessage` si
   `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` existen; timeout 3 s; nunca lanza ni loguea el token.
   Verificación: lectura + tsc. ✅
3. `app/api/aws/intake/route.ts`: mismos checks de content-length y origin que `events`;
   validación de sessionId/email/company/review_due/note; insert con service role; evento
   `intake_requested` (source `server`, path `/aws/early-access`, properties = review_due +
   answers + attribution); `notifyFounder` con company, email, review_due, evidence reason,
   customerRequested y utm_source; 204. Sin gate por usesAws/processesPhi.
   Verificación: `app/api/aws/intake/route.test.ts` 4/4 (email inválido, review_due inválido,
   nota > 500, payload válido con Supabase/eventos/notify mockeados; comprueba que el evento
   no contiene email, company ni note). ✅
4. `components/aws/AwsIntakeForm.tsx` montado solo en `app/aws/early-access/page.tsx`, bajo
   la tarjeta de checkout, misma columna. Verificación: grep de `AwsIntakeForm` → 1 página. ✅
5. `app/api/webhooks/stripe/route.ts`: `notifyFounder` tras `recordAwsValidationEvent` con
   amount, currency, evidence_reason, active_evidence_request y checkout session id. ✅
6. Leftovers: prefijos "Label:" eliminados en "How the pilot works"; `VLayer Inc.` →
   `FPI Enterprises, Inc.` (3 en terms, 0 en privacy); "Last updated: September 22, 2026" en ambos. ✅
7. `supabase/queries/aws_funnel.sql`: consulta 1 (una fila por evento en orden de funnel,
   sesiones totales / calificadas / con cliente solicitante, excluyendo `utm_source =
   'claude_verify'` y filas anteriores a `:launch_ts`); consulta 2 (intakes + evidence_reason
   y utm_source de la sesión, más recientes primero). Verificación: lectura; no ejecutada
   contra remoto porque `aws_validation_intakes` aún no existe. ⚠️
8. Verificación: eslint archivos tocados 0 errores; `tsc --noEmit` limpio; `next build` OK con
   `/api/aws/intake`; vitest raíz 37 archivos / 649 tests; test dashboard:
   `cd dashboard && ../node_modules/.bin/vitest run --config vitest.config.mts` 4/4.
   Hook pre-commit: el escaneo `node dist/cli.js scan . -f json -e samples --no-ai` tarda 2 s.
   El hook no activa IA (sin `ANTHROPIC_API_KEY` el triage queda apagado). Los archivos
   nuevos solo reciben "Missing Automatic Session Timeout" (high, falso positivo por la
   palabra `session`); sin críticos en los archivos tocados.
9. Commit `feat(aws): intake request path, founder notifications, entity fix` y push.

## Pendiente para el fundador

- Aplicar la migración: `cd dashboard && supabase migration repair --status reverted <17 versiones>`
  y `supabase db pull`, o aplicar `20260922021000_aws_validation_intakes.sql` desde el SQL
  editor / MCP y registrar la versión. Hasta entonces `/api/aws/intake` devolverá 503.
- Variables en Vercel: `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`.
- `vitest.config.ts` raíz ahora excluye `dashboard/**`; el test del dashboard se corre con su
  propio config (arriba). No está en CI.
