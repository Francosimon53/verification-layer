# Runbook — Escáner vlayer a 0 hallazgos sin acknowledgear

**Fecha:** 2026-07-20
**Contexto:** El self-scan de vlayer reportaba 15 hallazgos sin acknowledgear. El triage
(aprobado antes de ejecutar) los clasificó todos como falsos positivos o informativos:
11 eran el escáner detectando sus propias definiciones de reglas (catálogo de reglas y
un comentario en `src/exclusions.ts`), 1 era un falso match sobre un hash de integridad
en `dashboard/pnpm-lock.yaml`, 1 era la heurística de autenticación multifactor
disparando sobre el registro interno de scanners en `src/scan.ts`, y 2 eran artefactos
informativos (inventario de assets y mapa de flujo PHI) contados como hallazgos.

> Nota de redacción: este runbook evita citar los títulos literales de las reglas de
> criptografía débil (tres algoritmos legacy y un modo de cifrado inseguro), porque el
> escáner también lee archivos Markdown y volvería a flaggear las citas.

## Resultado medible (definido al inicio)

1. `node dist/cli.js scan . --no-ai` reporta `unacknowledged: 0`.
2. PR fusionado a `main` vía auto-merge.

## Guion ejecutado

| # | Acción | Verificación esperada | Resultado |
|---|--------|----------------------|-----------|
| 1 | Aislar trabajo en worktree/rama nueva | `git branch --show-current` muestra la rama | ✅ rama `worktree-fix+scanner-self-scan-fp` |
| 2a | Agregar `**/rule-catalog.json` a `DEFAULT_VLAYER_OUTPUT_EXCLUDES` (`src/exclusions.ts`) | Los 10 hallazgos del catálogo desaparecen | ✅ total bajó 469 → 454 |
| 2b | Excluir lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `bun.lockb`) en `defaultExclude` (`src/scan.ts`) | El falso match del hash en el lockfile desaparece | ✅ incluido en la baja anterior |
| 3 | Extraer `HIPAA-ASSET-001` y `HIPAA-FLOW-001` como `informationalArtifacts` (metadata de `ScanResult`/`Report`/JSON) en vez de findings | El JSON los muestra en `informationalArtifacts` y no cuentan en stats | ✅ `artifacts: ['HIPAA-ASSET-001', 'HIPAA-FLOW-001']`, info count = 0 |
| 4 | Acknowledgear puntualmente en `.vlayerrc.json`: `enc-des*` en `src/exclusions.ts` (comentario que cita el título del hallazgo) y `HIPAA-MFA-001` en `src/scan.ts` (heurística sobre el registro de scanners; CLI sin endpoints ni login) | Ambos aparecen como acknowledged en el reporte | ✅ ambos con `acknowledged: true` |
| 5 | `npm run build`, `npm run typecheck`, `npm run test:run` y escaneo completo | Todo verde y `unacknowledged: 0` | ✅ build OK, typecheck OK, 600/600 tests, `unacknowledged: 0` |
| 6 | Guardar este runbook en `docs/runbooks/` | Archivo commiteado sin generar hallazgos nuevos | ✅ re-escaneo tras escribirlo: sigue en 0 |
| 7 | Commit, push, PR a `main` con auto-merge | PR con auto-merge habilitado y fusionado | ver PR enlazado en el commit |

## Detalle no obvio encontrado durante la verificación

Los patrones de `acknowledgedFindings` se evalúan con minimatch **sin** `dot: true`,
así que `**` no matchea segmentos de ruta que empiezan con punto. Un escaneo corrido
desde un checkout bajo `.claude/worktrees/` (o cualquier ruta con un directorio-punto)
reporta 0 acknowledged aunque la config sea correcta. La verificación final se corrió
desde una copia del árbol en una ruta sin directorios-punto, que replica el estado
post-merge. Si algún día se corre vlayer sobre repos dentro de rutas con
directorios-punto, considerar `dot: true` en `src/acknowledgments.ts` (cambio de
comportamiento — fuera del alcance de este guion).

## Reporte de verificación (obtenido vs esperado)

- Esperado: `unacknowledged: 0` → **Obtenido: `unacknowledged: 0`** (`stats`: total 454,
  acknowledged 450, critical/high/medium/low/info sin acknowledgear: 0/0/0/0/0).
- Esperado: artefactos informativos como metadata → **Obtenido:** `informationalArtifacts`
  con ambos IDs; ya no aparecen como findings.
- Esperado: suite verde → **Obtenido:** 26 archivos / 600 tests pasando, typecheck limpio.
- Esperado: PR fusionado → registrado en el PR enlazado desde la rama.
