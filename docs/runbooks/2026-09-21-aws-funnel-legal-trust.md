# 2026-09-21 — Funnel AWS PHI: legal, footer, atribución y bloque de confianza

Rama: `experiment/aws-phi-validation`. Alcance: `dashboard/`. No se tocó el flujo de
calificación, el contenido del report preview, la ruta de checkout de Stripe ni el webhook.

## Resultado medible

- `/legal/terms` y `/legal/privacy` no redirigen a `/login` sin sesión.
- Ninguna ruta `/aws*` monta el `<Footer />` global; `/aws` lleva su propio footer mínimo.
- Cada evento del funnel (incluido `landing_view`) incluye `utm_source`, `utm_medium`,
  `utm_campaign` y `referrer_host` cuando existen, capturados una vez por sesión.
- ESLint (archivos tocados), `tsc --noEmit`, `next build` y `vitest run` (raíz) en verde.

## Guion ejecutado

1. `dashboard/proxy.ts`: añadir `!pathname.startsWith('/legal')` a `isProtectedRoute`.
   Verificación: `grep -n "startsWith('/legal')" proxy.ts` → línea 46. ✅
2. `components/LayoutWrapper.tsx`: `/aws` y `/aws/*` devuelven `children` sin sidebar ni
   footer. `app/aws/layout.tsx`: footer mínimo (© 2026 FPI Enterprises, Inc. · VLayer,
   mailto support@vlayer.app, /legal/terms, /legal/privacy, frase "developer tool").
   `components/Footer.tsx`: "VLayer Inc." → "FPI Enterprises, Inc.".
   Verificación: grep en `app/aws` no encuentra `Footer`; grep de cada cadena en layout. ✅
3. `lib/aws-validation-client.ts`: `getAwsValidationAttribution()` lee UTM de la URL y el
   hostname de `document.referrer` (se ignora si es el propio host), guarda en
   `sessionStorage['vlayer.aws-validation.attribution']` y se mezcla en `properties` de
   todos los eventos. Valores recortados a 200 caracteres.
   Verificación: suite temporal de vitest con 3 casos (landing_view con UTM + referrer host,
   reutilización en `pricing_view`, sin claves cuando no hay UTM ni referrer externo). 3/3. ✅
4. Hero de `app/aws/page.tsx`: H1 y subtítulo nuevos. Verificación: `grep -F`. ✅
5. `app/aws/early-access/page.tsx`: H1 nuevo + sección "How the pilot works" (4 ítems
   literales) encima de la tarjeta de checkout. `AwsCheckoutCard.tsx`: estado de éxito dice
   "within 1 business day". Disclaimer y línea de Terms intactos. Verificación: `grep`. ✅
6. `npx eslint <archivos tocados>` sin errores; `npx tsc --noEmit` sin errores;
   `npx next build` genera `.next/BUILD_ID` con `/legal/*` y `/aws/*`;
   `npx vitest run` en raíz: 37 archivos, 649 tests. ✅
7. Commit `fix(aws): public legal pages, scoped footer, attribution, trust block` y push.

## Observaciones fuera de alcance (no tocadas)

- `dashboard/package-lock.json` está desincronizado con `package.json` (`verification-layer`
  0.21.0 vs ^0.23.1); `npm ci` falla. Se instaló con `--no-package-lock` y se fijó
  `stripe@20.3.1` (la del lock) porque 20.4.1 rompe `lib/stripe.ts` (apiVersion).
- `app/legal/terms/page.tsx` menciona "VLayer Inc." 3 veces en el texto legal.
- ESLint global del dashboard tiene 102 errores preexistentes en archivos no tocados.
