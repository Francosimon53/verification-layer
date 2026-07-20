# Runbook — Fix: acknowledgments no aplicaban en rutas con directorios-punto

**Fecha:** 2026-07-20
**Contexto:** Documentado en el runbook `2026-07-20-escaner-cero-unacknowledged.md`:
`checkAcknowledgment` (`src/acknowledgments.ts`) evaluaba los patrones de
`acknowledgedFindings` con minimatch sin `dot: true`, así que `**` no atravesaba
segmentos de ruta que empiezan con punto. Un escaneo corrido desde un checkout bajo
`.claude/worktrees/<rama>/` (o cualquier ruta con un directorio oculto) reportaba
0 acknowledged — los ~450 acknowledgments de `.vlayerrc.json` quedaban silenciosamente
desactivados.

## Resultado medible (definido al inicio)

1. Tests nuevos de acknowledgments en verde, incluyendo rutas con `.claude/worktrees/`.
2. Suite completa verde.
3. PR fusionado a `main`.
4. Self-scan corrido *desde el worktree* (ruta punteada) reporta `unacknowledged: 0`.

## Guion ejecutado

| # | Acción | Verificación esperada | Resultado |
|---|--------|----------------------|-----------|
| 1 | Worktree/rama nueva desde `origin/main` | Base = squash del PR #64 | ✅ base `4abe282` |
| 2 | `{ dot: true }` en el minimatch de `checkAcknowledgment`, con comentario del porqué | Diff mínimo, un solo call site | ✅ 1 línea de código + comentario |
| 3 | `tests/acknowledgments.test.ts`: 3 casos de rutas con directorio-punto + 1 en `applyAcknowledgments`, y 7 casos del comportamiento existente (globs de directorio, filtro `id` con wildcard, category/severity, expiración, config vacía) | Rojo sin el fix, verde con él | ✅ sin fix: 4 fallan / 7 pasan; con fix: 11/11 |
| 4 | Build + typecheck + lint + suite completa | Todo verde | ✅ build OK, typecheck OK, lint 0 errores (24 warnings preexistentes), **611/611 tests** |
| 5 | Self-scan desde el propio worktree (ruta con `.claude/worktrees/`) | `unacknowledged: 0`, acknowledged ≈ 450 | ✅ `unacknowledged: 0`, `acknowledged: 450` (antes del fix: 0 acknowledged / 450 unacknowledged) |
| 6 | Guardar este runbook | Commiteado sin hallazgos nuevos | ✅ |
| 7 | Commit, push, PR a `main` con auto-merge | PR fusionado, CI verde | ver PR enlazado en el commit |

## Notas

- **Alcance del cambio de comportamiento:** con `dot: true`, un patrón `**/...` ahora
  también matchea findings dentro de directorios ocultos (p. ej. `.vlayer/`). En la
  práctica el file discovery ya excluye esos directorios, y es el comportamiento que
  un autor de `.vlayerrc.json` espera: los patrones describen el archivo, no la
  visibilidad de sus ancestros.
- **Flakiness preexistente (no relacionada):** `tests/custom-rules-semantic.test.ts`
  hace llamadas AI reales cuando `ANTHROPIC_API_KEY` está presente en el entorno local
  y a veces excede el timeout de 5s de vitest (falla 0–3 tests según latencia; en
  re-corridas aisladas pasa 6/6). En CI no hay key, el triage se desactiva y es
  determinista. Candidato a fix aparte: mockear el triage o subir el timeout del
  archivo.

## Reporte de verificación (obtenido vs esperado)

- Esperado: tests nuevos verdes con cobertura rojo→verde → **Obtenido:** 11/11; los 4
  casos de dot-path fallan sin el fix y pasan con él; los 7 de regresión pasan en ambos
  estados del código (el comportamiento existente no cambió).
- Esperado: suite completa verde → **Obtenido:** 27 archivos / 611 tests pasando.
- Esperado: `unacknowledged: 0` escaneando desde ruta punteada → **Obtenido:** 0, con
  los 450 acknowledgments aplicando — ya no hace falta la copia en ruta limpia que
  requirió el runbook anterior.
- Esperado: PR fusionado → registrado en el PR enlazado desde la rama.
