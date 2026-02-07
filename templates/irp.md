# Incident Response Plan (IRP)

**Organization:** [ORGANIZATION NAME]
**Effective Date:** [DATE]
**Version:** [VERSION NUMBER]
**Document Owner:** [SECURITY OFFICER NAME]
**Last Review Date:** [DATE]
**Next Review Date:** [DATE]

---

## 1. PURPOSE & SCOPE

This Incident Response Plan (IRP) establishes procedures for identifying, responding to, and managing security incidents involving electronic Protected Health Information (ePHI) in compliance with the HIPAA Security Rule (45 CFR §164.308(a)(6)).

**Scope:** This plan applies to all workforce members, business associates, and systems that create, receive, maintain, or transmit ePHI.

---

## 2. DEFINITIONS

**Security Incident:** The attempted or successful unauthorized access, use, disclosure, modification, or destruction of information or interference with system operations in an information system (45 CFR §164.304).

**Breach:** The acquisition, access, use, or disclosure of PHI in a manner not permitted under the Privacy Rule which compromises the security or privacy of the PHI (45 CFR §164.402).

**Reportable Breach:** A breach affecting 500 or more individuals, requiring notification to HHS and media outlets within 60 days.

---

## 3. INCIDENT RESPONSE TEAM (IRT)

### Team Composition

| Role | Name | Contact | Responsibilities |
|------|------|---------|------------------|
| **Incident Commander** | [NAME] | [PHONE/EMAIL] | Overall incident coordination, decision authority |
| **Security Lead** | [NAME] | [PHONE/EMAIL] | Technical investigation, containment, remediation |
| **Compliance Officer** | [NAME] | [PHONE/EMAIL] | HIPAA compliance, breach determination, notifications |
| **Legal Counsel** | [NAME] | [PHONE/EMAIL] | Legal guidance, regulatory consultation |
| **Communications Lead** | [NAME] | [PHONE/EMAIL] | Internal/external communications, media relations |
| **IT Director** | [NAME] | [PHONE/EMAIL] | System restoration, infrastructure support |
| **Privacy Officer** | [NAME] | [PHONE/EMAIL] | Privacy impact assessment, patient notifications |

### Escalation Contact

**24/7 Emergency Contact:** [PHONE NUMBER]
**Email Distribution List:** [EMAIL]
**Slack/Teams Channel:** [CHANNEL NAME]

---

## 4. INCIDENT SEVERITY CLASSIFICATION

### P0 - Critical (15-minute response time)
- Confirmed breach of ePHI affecting 500+ individuals
- Active ransomware/malware spreading across systems
- Complete system outage affecting patient care
- Data exfiltration in progress
- Unauthorized access to production PHI databases

### P1 - High (1-hour response time)
- Suspected breach affecting 50-499 individuals
- Malware infection on ePHI-containing systems
- Unauthorized access by terminated employee
- Compromised administrator credentials
- Denial of service affecting ePHI systems

### P2 - Medium (4-hour response time)
- Suspected breach affecting 10-49 individuals
- Phishing attack targeting workforce members
- Lost/stolen device containing encrypted ePHI
- Unauthorized data access attempt (blocked)
- Misconfigured security controls

### P3 - Low (24-hour response time)
- Suspected breach affecting fewer than 10 individuals
- Policy violations without confirmed PHI exposure
- Unsuccessful intrusion attempts
- Minor security control failures

---

## 5. INCIDENT RESPONSE PHASES

### Phase 1: Detection & Analysis (0-2 hours)

#### Immediate Actions (0-15 minutes)

1. ☐ Document incident discovery:
   - Date and time of detection: ________________
   - Reporter name and contact: ________________
   - Method of detection: ________________

2. ☐ Assign severity level (P0/P1/P2/P3): ________

3. ☐ Notify Incident Commander immediately if P0 or P1

4. ☐ Preserve evidence (do NOT power off systems)

5. ☐ Take initial screenshots/logs

#### Investigation Phase (15 minutes - 2 hours)

6. ☐ Assemble Incident Response Team

7. ☐ Establish incident war room (physical or virtual)

8. ☐ Collect preliminary information:
   - Affected systems: ________________
   - Number of potentially affected individuals: ________
   - Type of PHI involved: ________________
   - Attack vector (if known): ________________

9. ☐ Review relevant logs:
   - System access logs
   - Network traffic logs
   - Application logs
   - Authentication logs

10. ☐ Interview personnel involved

11. ☐ Assess scope and impact

12. ☐ Create incident ticket in tracking system

### Phase 2: Containment (2-6 hours)

#### Short-term Containment

1. ☐ Isolate affected systems (network segmentation)

2. ☐ Disable compromised user accounts

3. ☐ Block malicious IP addresses at firewall

4. ☐ Reset passwords for affected accounts

5. ☐ Enable additional monitoring on related systems

6. ☐ Implement temporary workarounds for business continuity

#### Long-term Containment

7. ☐ Apply emergency patches if vulnerability identified

8. ☐ Deploy additional security controls

9. ☐ Rebuild compromised systems from clean backups

10. ☐ Enhance monitoring and detection capabilities

### Phase 3: Eradication (6-24 hours)

1. ☐ Identify and remove root cause:
   - Malware removal
   - Close vulnerability
   - Fix misconfiguration
   - Revoke unauthorized access

2. ☐ Verify all indicators of compromise (IOCs) removed

3. ☐ Update security controls to prevent recurrence

4. ☐ Scan all systems for similar vulnerabilities

5. ☐ Apply security patches across environment

### Phase 4: Recovery (24-72 hours)

1. ☐ Restore systems from verified clean backups

2. ☐ Verify system integrity before production use

3. ☐ Re-enable accounts with new credentials

4. ☐ Monitor restored systems for 72 hours minimum

5. ☐ Gradually restore normal operations

6. ☐ Document all recovery actions taken

### Phase 5: Post-Incident Activity (Within 7 days)

1. ☐ Conduct post-incident review meeting

2. ☐ Complete incident report (see Section 8)

3. ☐ Document lessons learned

4. ☐ Update policies/procedures based on findings

5. ☐ Implement additional preventive measures

6. ☐ Provide security awareness training on incident type

7. ☐ Update risk assessment with new threats

---

## 6. HIPAA BREACH NOTIFICATION REQUIREMENTS

### Breach Determination Process

Within **24-48 hours** of incident discovery, conduct breach risk assessment:

#### Risk Assessment Factors (45 CFR §164.402)

1. ☐ **Nature and extent of PHI involved**
   - Demographic information only? Low risk
   - SSN, financial, or medical records? High risk

2. ☐ **Unauthorized person who accessed PHI**
   - Internal workforce member? Lower risk
   - External malicious actor? Higher risk
   - Could the person re-identify individuals?

3. ☐ **Was PHI actually acquired or viewed?**
   - Evidence of data exfiltration?
   - Logs showing file access/download?

4. ☐ **Extent of risk mitigation**
   - PHI was encrypted? Not a breach
   - Device was password-protected?
   - Remote wipe successful?

**Breach Determination:** Yes ☐  No ☐

**If YES, proceed to notification requirements below.**

### Notification Timeline

```
Day 0: Breach Discovery
    ↓
Days 1-5: Breach Risk Assessment
    ↓
Within 60 Days: All Notifications Must Be Complete
    ├─ Individual Notifications (Day 10-15)
    ├─ HHS Notification (if 500+)
    ├─ Media Notification (if 500+)
    └─ Business Associate Notification
```

### Individual Notification (45 CFR §164.404)

**Timeline:** Without unreasonable delay, no later than **60 days** from discovery

**Method:**
- First-class mail (preferred)
- Email (if individual has agreed)
- Substitute notice (if insufficient contact information)

**Required Content:**
1. ☐ Brief description of what happened
2. ☐ Date of breach and date of discovery
3. ☐ Types of PHI involved
4. ☐ Steps individuals should take to protect themselves
5. ☐ What organization is doing in response
6. ☐ Contact procedures for questions

**Draft Notification Letter Location:** [FILE PATH/LINK]

### HHS Notification (45 CFR §164.408)

**For breaches affecting 500+ individuals:**
- Notify HHS via web portal: https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf
- Timeline: **Within 60 days** of discovery
- Contemporaneous with individual notification

**For breaches affecting fewer than 500 individuals:**
- Submit to HHS annually
- Deadline: Within **60 days** of calendar year end

**HHS Portal Credentials:** [SECURE LOCATION]

### Media Notification (45 CFR §164.406)

**For breaches affecting 500+ individuals in same state/jurisdiction:**
- Notify prominent media outlets
- Timeline: **Within 60 days** of discovery
- Contemporaneous with individual notification

**Media Contact List:** [FILE PATH/LINK]

### Business Associate Notification (45 CFR §164.410)

**If breach discovered by Business Associate:**
- BA must notify Covered Entity **without unreasonable delay**
- No later than **60 days** from discovery
- CE then responsible for individual notifications

---

## 7. EXTERNAL CONTACTS

### Regulatory Authorities

**HHS Office for Civil Rights (OCR)**
- Website: https://www.hhs.gov/ocr
- Phone: 1-800-368-1019
- Email: ocrmail@hhs.gov
- Breach Portal: https://ocrportal.hhs.gov

**State Attorney General** (for breaches affecting state residents)
- Name: [STATE AG NAME]
- Phone: [PHONE]
- Email: [EMAIL]

### Law Enforcement

**FBI Cyber Division**
- Phone: [LOCAL FBI OFFICE]
- IC3 Portal: https://www.ic3.gov

**Local Law Enforcement**
- Department: [NAME]
- Contact: [NAME/PHONE]

### Incident Response Support

**Cyber Insurance Provider**
- Company: [INSURANCE COMPANY]
- Policy Number: [NUMBER]
- 24/7 Hotline: [PHONE]
- Incident Reporting: [EMAIL/PORTAL]

**Forensics Vendor**
- Company: [VENDOR NAME]
- Contact: [NAME/PHONE]
- Service Agreement: [REFERENCE]

**Legal Counsel**
- Firm: [LAW FIRM NAME]
- Attorney: [NAME]
- Phone: [PHONE]
- Email: [EMAIL]

---

## 8. INCIDENT DOCUMENTATION TEMPLATE

**Incident ID:** IRP-[YYYY]-[###]
**Classification:** P0 ☐  P1 ☐  P2 ☐  P3 ☐

### Incident Summary

**Discovery Date/Time:** ________________
**Reporter:** ________________
**Detection Method:** ________________
**Status:** Open ☐  Contained ☐  Resolved ☐  Closed ☐

### Affected Systems

**Systems Impacted:**
- ________________
- ________________

**Data Categories Affected:**
- ePHI ☐  PHI ☐  PII ☐  Other: ________

**Number of Individuals Affected:** ________

### Timeline

| Date/Time | Event | Action Taken | Responsible Party |
|-----------|-------|--------------|-------------------|
|           |       |              |                   |
|           |       |              |                   |
|           |       |              |                   |

### Root Cause Analysis

**Primary Cause:**
________________

**Contributing Factors:**
________________

**Vulnerabilities Exploited:**
________________

### Response Actions

**Containment Measures:**
________________

**Eradication Steps:**
________________

**Recovery Actions:**
________________

### Breach Determination

**Breach Risk Assessment Completed:** Yes ☐  No ☐
**Date:** ________________
**Conducted By:** ________________

**Determination:** Breach ☐  Not a Breach ☐
**Justification:**
________________

### Notifications Sent

**Individual Notifications:**
- Date Sent: ________________
- Method: Mail ☐  Email ☐  Substitute ☐
- Number Notified: ________

**HHS Notification:** Yes ☐  No ☐  Date: ________
**Media Notification:** Yes ☐  No ☐  Date: ________
**Business Associates:** Yes ☐  No ☐  Date: ________

### Lessons Learned

**What Worked Well:**
________________

**What Could Be Improved:**
________________

**Preventive Measures Implemented:**
________________

**Policy/Procedure Updates Required:**
________________

### Closure

**Incident Closed By:** ________________
**Date:** ________________
**Final Status:** Resolved ☐  Unresolved ☐

---

## 9. INCIDENT RESPONSE DRILLS & TESTING

### Testing Schedule

- **Quarterly:** Tabletop exercises (scenario-based discussion)
- **Bi-Annual:** Technical drills (simulated incident)
- **Annual:** Full-scale simulation (all teams, realistic scenario)

### Last Drill Information

**Date:** ________________
**Type:** Tabletop ☐  Technical ☐  Full-Scale ☐
**Scenario:** ________________
**Participants:** ________________
**Results Summary:** ________________
**Action Items:** ________________

### Next Scheduled Drill

**Date:** ________________
**Type:** ________________
**Scenario:** ________________

---

## 10. PLAN MAINTENANCE

### Review Schedule

This Incident Response Plan must be reviewed and updated:
- **Annually:** Scheduled review
- **After major incidents:** Within 30 days
- **After organizational changes:** Within 60 days
- **After regulation updates:** As needed

### Revision History

| Version | Date | Changes | Approved By |
|---------|------|---------|-------------|
| 1.0 | [DATE] | Initial creation | [NAME] |
|         |        |                  |             |
|         |        |                  |             |

---

## 11. APPENDICES

### Appendix A: Communication Templates
- Individual breach notification letter
- Media statement template
- Internal communication memo
- Business associate notification

**Location:** [FILE PATH/SECURE LOCATION]

### Appendix B: Contact Lists
- Complete IRT roster with alternates
- Business associate contacts
- Vendor escalation contacts
- Employee notification tree

**Location:** [FILE PATH/SECURE LOCATION]

### Appendix C: Technical Procedures
- Log collection procedures
- Forensic imaging procedures
- Malware analysis procedures
- System isolation procedures

**Location:** [FILE PATH/SECURE LOCATION]

### Appendix D: Forms & Checklists
- Incident intake form
- Breach risk assessment worksheet
- Post-incident review template
- Drill evaluation form

**Location:** [FILE PATH/SECURE LOCATION]

---

## AUTHORIZATION

This Incident Response Plan has been reviewed and approved by:

**Security Officer**
Signature: _________________________ Date: _________
Name: [NAME]
Title: [TITLE]

**Privacy Officer**
Signature: _________________________ Date: _________
Name: [NAME]
Title: [TITLE]

**Executive Leadership**
Signature: _________________________ Date: _________
Name: [NAME]
Title: [TITLE]

---

**Distribution:** This plan should be distributed to all Incident Response Team members and made available to all workforce members.

**Retention:** This document must be retained for a minimum of six (6) years from the date of its creation or the date when it last was in effect, whichever is later (45 CFR §164.316(b)(2)).

---

*Generated using vlayer - HIPAA Compliance Scanner*
*https://github.com/Francosimon53/verification-layer*
