# HIPAA Physical Safeguards Checklist

**Organization:** [ORGANIZATION NAME]
**Completed By:** [NAME & TITLE]
**Date:** [DATE]
**Review Period:** [PERIOD]

---

## Overview

This checklist addresses the Physical Safeguards requirements under HIPAA Security Rule 45 CFR §164.310. Physical safeguards are physical measures, policies, and procedures to protect electronic information systems and related buildings and equipment from natural and environmental hazards, and unauthorized intrusion.

**Instructions:** Check all boxes that apply to your organization's setup. Not all controls may be applicable depending on your operating model (fully remote vs. physical office).

---

## SECTION A - Equipment 100% Remoto/Cloud

**Applicable to:** All organizations, including fully remote teams

These controls apply to all workforce members working remotely or with cloud-based systems containing electronic Protected Health Information (ePHI).

### Device Security (§164.310(d)(1) - Device and Media Controls)

- ☐ **Laptops con encriptación de disco completo**
  - FileVault (macOS) enabled and enforced
  - BitLocker (Windows) enabled and enforced
  - Linux: LUKS or dm-crypt full disk encryption
  - Recovery keys backed up securely
  - Verification: _________________________

- ☐ **VPN requerida para acceso a sistemas con PHI**
  - Corporate VPN configured for all workforce members
  - VPN mandatory for accessing ePHI systems
  - Split tunneling disabled for ePHI access
  - VPN provider: _________________________

- ☐ **Política de no-PHI en dispositivos personales**
  - Written policy prohibiting ePHI on personal devices
  - Policy communicated to all workforce members
  - Alternative provided (company-issued devices or secure access methods)
  - Policy acknowledgment on file

- ☐ **Screen lock automático ≤5 minutos de inactividad**
  - Automatic screen lock configured: _____ minutes
  - Password/biometric required to unlock
  - Enforced via MDM or Group Policy
  - Verification method: _________________________

- ☐ **Antivirus/anti-malware actualizado en todos los dispositivos**
  - Antivirus solution: _________________________
  - Auto-update enabled
  - Real-time protection active
  - Regular scans scheduled
  - Last verification date: _________________________

- ☐ **Backups encriptados de dispositivos**
  - Backup solution: _________________________
  - Encryption method: _________________________
  - Backup frequency: _________________________
  - Backup tested within last 90 days: Yes ☐ No ☐

- ☐ **Conexión WiFi segura (WPA3 o WPA2 mínimo)**
  - Home WiFi policy requires WPA2 minimum
  - WPA3 recommended and documented
  - Default router passwords changed
  - Guest networks separated from work networks
  - Workforce educated on WiFi security

### Additional Remote Controls

- ☐ **Remote device management (MDM) implemented**
  - MDM solution: _________________________
  - Remote wipe capability enabled
  - Device compliance monitoring active

- ☐ **Lost/stolen device reporting procedure**
  - Documented procedure in place
  - 24/7 reporting contact: _________________________
  - Remote wipe process tested

---

## SECTION B - Oficina Física (adicional a Sección A)

**Applicable to:** Organizations with physical office locations where ePHI is accessed, stored, or processed

These controls are **in addition to** all Section A requirements. Physical offices require both remote security controls (Section A) and physical security controls (Section B).

### Facility Access Controls (§164.310(a)(1))

- ☐ **Control de acceso a la oficina (llave, badge, o biométrico)**
  - Access control system type: _________________________
  - Access restricted to authorized workforce members only
  - Access logs maintained and reviewed
  - Lost/stolen key/badge procedure documented
  - After-hours access requires authorization

- ☐ **Visitantes escoltados y registrados**
  - Visitor log maintained (name, date, time in/out, purpose)
  - All visitors escorted by authorized workforce member
  - Visitor badges issued and collected
  - Log retention: 6 years minimum
  - Log location: _________________________

### Workstation Security (§164.310(c))

- ☐ **Monitores posicionados para evitar shoulder surfing**
  - Workstations positioned away from windows/public view
  - Privacy screens installed where necessary
  - Hot-desking/shared workspace policy addresses ePHI security
  - Desk arrangement reviewed: _________________________

- ☐ **Política de escritorio limpio (clean desk policy)**
  - Written clean desk policy in place
  - No ePHI left visible when unattended
  - Documents secured at end of day
  - Policy communicated and enforced
  - Random compliance checks conducted

### Device and Media Controls (§164.310(d)(1))

- ☐ **Documentos físicos con PHI bajo llave**
  - Locked file cabinets for ePHI documents
  - Keys restricted to authorized personnel
  - File cabinet locations: _________________________
  - Access log maintained

- ☐ **Destrucción segura de documentos (shredder cross-cut)**
  - Cross-cut shredder available (DIN P-4 or higher)
  - Shredder location: _________________________
  - Secure disposal bins for ePHI documents
  - Shredding log maintained
  - Certificate of destruction obtained (if using service)

### Additional Physical Controls

- ☐ **Cámaras de seguridad en áreas con acceso a PHI**
  - Camera coverage of: _________________________
  - Recording retention period: _____ days
  - Footage access restricted to: _________________________
  - Camera system tested and maintained

- ☐ **Server/network equipment physically secured**
  - Server room/closet locked
  - Key access restricted to: _________________________
  - Environmental controls (temperature, humidity, fire suppression)
  - Equipment maintenance logs maintained

- ☐ **Alarm system installed and monitored**
  - Alarm type: _________________________
  - Monitoring service: _________________________
  - After-hours intrusion alerts configured

---

## Contingency Operations (§164.310(a)(2))

Applicable to all organizations:

- ☐ **Disaster recovery plan documented**
  - Plan addresses facility access during emergency
  - Alternative work site identified (if applicable)
  - Plan tested within last 12 months

- ☐ **Emergency power (if applicable)**
  - UPS for critical systems
  - Generator backup (if applicable)
  - Last test date: _________________________

---

## Device Disposal and Media Re-use (§164.310(d)(2))

- ☐ **Secure device disposal procedure**
  - Hard drives physically destroyed or wiped (DoD 5220.22-M or NIST 800-88)
  - Certificate of destruction obtained
  - Disposal log maintained
  - Last disposal date: _________________________

- ☐ **Media sanitization before re-use**
  - Procedure documented
  - Verification process in place
  - Re-use log maintained

---

## Accountability (§164.310(d)(1))

- ☐ **Hardware inventory maintained**
  - All devices containing ePHI tracked
  - Inventory updated quarterly
  - Last update: _________________________

- ☐ **Device check-in/check-out log**
  - Portable devices tracked
  - Checkout authorization required
  - Return inspection process

---

## Annual Review & Attestation

### Findings Summary

**Compliant Items:** _____ / _____
**Items Requiring Remediation:** _____
**Target Remediation Date:** _________________________

### Remediation Plan

| Item | Priority | Responsible Party | Target Date | Status |
|------|----------|-------------------|-------------|--------|
|      |          |                   |             |        |
|      |          |                   |             |        |
|      |          |                   |             |        |

### Attestation

I certify that this checklist accurately reflects the physical safeguards in place for our organization as of the date above. I understand that physical safeguards must be maintained continuously and reviewed at least annually per HIPAA requirements.

**Signature:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Name:** [NAME]

**Title:** [TITLE]

**Date:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## References

- **45 CFR §164.310(a)(1)** - Facility Access Controls
- **45 CFR §164.310(a)(2)(i)** - Contingency Operations
- **45 CFR §164.310(b)** - Workstation Use
- **45 CFR §164.310(c)** - Workstation Security
- **45 CFR §164.310(d)(1)** - Device and Media Controls
- **45 CFR §164.310(d)(2)** - Data Backup and Storage

**Retention:** This checklist must be retained for a minimum of six (6) years from the date of its creation or the date when it last was in effect, whichever is later (45 CFR §164.316(b)(2)).

---

*Generated using vlayer - HIPAA Compliance Scanner*
*https://github.com/Francosimon53/verification-layer*
