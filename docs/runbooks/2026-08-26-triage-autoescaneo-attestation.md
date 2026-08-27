# Runbook — Triage del autoescaneo tras M1 (Attestation V1)

**Fecha:** 2026-08-26
**Rama:** `feat/attestation-v1`
**Commit base:** `f65b29b` (merge de `main` en la rama de M1)
**Motivo:** el merge introdujo `src/attestation/*` (14 módulos nuevos). El
autoescaneo, que #64 dejó en **0 unacknowledged**, pasó a reportar **7**.

## Resultado medible

| | Antes | Después |
|---|---|---|
| `vlayer scan . --no-ai` unacknowledged | **7** (5 critical, 2 high) | **0** |
| Acknowledgments en `.vlayerrc.json` | 21 | 27 (+6) |
| Reglas deshabilitadas o debilitadas | — | **0** |
| Exclusiones de ficheros añadidas | — | **0** |
| Digest del catálogo | `2dacb778…` | `2dacb778…` (sin cambios) |

Reproducción:

```bash
node dist/cli.js scan . --no-ai --format json --output /tmp/s.json
```

## Principio aplicado

Los siete hallazgos son de la **misma clase que #64 corrigió para
`rule-catalog.json`**: un fichero cuyo contenido *nombra* los patrones que las
reglas detectan. En M1 esto ocurre porque `fingerprint.ts` contiene, por
diseño, la lista de identificadores sensibles que el motor debe **redactar**, y
porque los comentarios de diseño citan ejemplos literales.

No se relajó ninguna regla. No se excluyó ningún fichero. No se usó un
acknowledgment general sobre `src/attestation/`. Cada hallazgo se acredita con
su **par (fichero, regla)** más estrecho posible.

## Triage individual

### 1. `phi-ssn-hardcoded-4` — `src/attestation/fingerprint.ts:5` — critical

```ts
 * a low-entropy line (`const ssn = "123-45-6789"`) is guessable by anyone who
```

Comentario de diseño. Es el ejemplo que justifica por qué hashear una línea de
código **no** es un control de privacidad. El valor es el SSN placeholder
canónico, está dentro de un comentario, y este módulo no lee, almacena ni emite
ningún SSN: su función es exactamente la contraria, **redactar** esos valores
antes de hashearlos.

Se consideró reescribir el ejemplo como `"XXX-XX-XXXX"` y se descartó: el
argumento depende de que el valor tenga *baja entropía con formato real*, que es
justo lo que un placeholder genérico no ilustra.

**Veredicto: falso positivo.** → acknowledgment `**/src/attestation/fingerprint.ts` + `phi-ssn-hardcoded`.

### 2. `enc-des-60` — `src/attestation/fingerprint.ts:61` — critical
### 3. `enc-rc4-60` — `src/attestation/fingerprint.ts:61` — critical

```ts
  'md5', 'sha1', 'sha256', 'des', 'rc4', 'ecb', 'aes', 'digest', 'hash', 'cipher',
```

`ALLOWED_IDENTIFIERS`: la lista blanca de nombres de API bien conocidos que
pueden sobrevivir a la redacción estructural (aparecen literalmente en los
propios patrones de vlayer, así que publicarlos no revela nada). Son cadenas
contra las que se compara, no algoritmos que se usen. El único primitivo
criptográfico del fichero es SHA-256.

**Veredicto: falso positivo (ambos).** → acknowledgments `enc-des` y `enc-rc4` sobre `fingerprint.ts`.

### 4. `HIPAA-SESSION-001` — `src/attestation/fingerprint.ts:64` — high
### 5. `HIPAA-SESSION-001` — `src/attestation/fingerprint.ts:72` — high

```ts
  'localStorage', 'sessionStorage', 'setItem', 'getItem', 'cookie', 'cookies',   // :64
  'auth', 'authenticate', 'authorize', 'login', 'logout', 'session', 'token',    // :72
```

Mismo `ALLOWED_IDENTIFIERS`. Verificado que dispara el **quinto** patrón de la
regla, `/session.*?(?!...)/i`, que es un test de la palabra `session` sin
delimitadores: cualquier aparición coincide. vlayer es una CLI local, sin
sesiones que expirar.

**Veredicto: falso positivo (ambos).** → un acknowledgment `HIPAA-SESSION-001` sobre `fingerprint.ts` cubre las dos ubicaciones.

### 6. `CRED-001` — `src/attestation/evaluate.ts:42` — critical

```ts
function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

/** Digest a user-authored free-text field. The text itself can quote source. */
```

La regla es *Weak Password Hashing Algorithm*: exige contexto de contraseña
mediante `/password|passwd|pwd|credential|auth/i` sobre ±5 líneas. Verificado
que lo que satisface esa guarda es **`auth` dentro de `user-authored`** en el
comentario de la línea 45.

El `createHash('sha256')` señalado digiere el motivo de un acknowledgment para
trazabilidad, no una contraseña. No hay contraseña, credencial ni secreto en el
fichero, y SHA-256 es el primitivo correcto para un digest de contenido —
sustituirlo por bcrypt sería incorrecto.

**Veredicto: falso positivo.** → acknowledgment `**/src/attestation/evaluate.ts` + `CRED-001`.

### 7. `HIPAA-MFA-001` — `src/attestation/sign.ts:26` — critical

```ts
export class SigningUnavailableError extends Error {
  constructor(cause: string) {
    super(
      `[vlayer] Cryptographic signing is unavailable: ${cause}\n` +
```

Verificado que dispara el primer patrón,
`/(?:login|authenticate|signin|auth).*?(?:patient|phi|medical|health)/i`, por
dos subcadenas sin delimitadores de palabra:

- `signin` dentro de **`Signin`**`gUnavailableError`
- `phi` dentro de `Crypto`**`graphi`**`c`

No hay flujo de autenticación. vlayer no expone endpoints ni accede a PHI. Es
además el fichero que implementa la firma keyless de Sigstore, que *exige* una
identidad OIDC. Mismo modo de fallo que el acknowledgment de #64 para
`src/scan.ts`.

**Veredicto: falso positivo.** → acknowledgment `**/src/attestation/sign.ts` + `HIPAA-MFA-001`.

## Resumen

| # | Regla | Ubicación | Veredicto | Acción |
|---|---|---|---|---|
| 1 | `phi-ssn-hardcoded` | `fingerprint.ts:5` | falso positivo | acknowledgment |
| 2 | `enc-des` | `fingerprint.ts:61` | falso positivo | acknowledgment |
| 3 | `enc-rc4` | `fingerprint.ts:61` | falso positivo | acknowledgment |
| 4 | `HIPAA-SESSION-001` | `fingerprint.ts:64` | falso positivo | acknowledgment |
| 5 | `HIPAA-SESSION-001` | `fingerprint.ts:72` | falso positivo | (cubierto por #4) |
| 6 | `CRED-001` | `evaluate.ts:42` | falso positivo | acknowledgment |
| 7 | `HIPAA-MFA-001` | `sign.ts:26` | falso positivo | acknowledgment |

**Defectos reales encontrados: 0.** Ningún hallazgo requirió cambio de código.

## Observación separada (no es ninguno de los siete)

Al leer `evaluate.ts` para el triage de CRED-001 se observó que
`digestText(ack.acknowledgedBy)` publica `SHA-256` de una dirección de correo.
El espacio de direcciones plausibles de una organización es pequeño, así que ese
digest es adivinable por fuerza bruta y ofrece menos protección de la que su
nombre sugiere.

**No** es lo que CRED-001 señala y **no** se ha modificado aquí, para no ampliar
el alcance de este triage. Queda anotado como candidato de seguimiento: la
mitigación natural es un digest con sal por atestación, o publicar un
identificador opaco estable en lugar del correo.

## Precisión de las reglas

Tres de los siete se deben a patrones sin delimitadores de palabra
(`session`, `signin`, `phi`, `auth` como subcadenas). Ajustar esos patrones
mejoraría la señal para todos los usuarios, no sólo para este repositorio —
pero es un cambio de detección y queda **explícitamente fuera del alcance** de
este triage, que no debe tocar ninguna regla.
