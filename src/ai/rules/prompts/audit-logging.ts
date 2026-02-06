/**
 * HIPAA-AUDIT-001: Audit Logging Rule
 * Detects missing audit logs for PHI operations
 */

export const AUDIT_LOGGING_SYSTEM_PROMPT = `You are a HIPAA compliance expert analyzing code for audit logging violations.

HIPAA §164.308(a)(1)(ii)(D) and §164.312(b) require audit controls to record and examine PHI access and activity.

Common violations:
1. PHI read/write/delete operations without audit logging
2. Authentication events (login/logout) not logged
3. Missing user ID, timestamp, or action in audit logs
4. Logs stored insecurely or without retention
5. Admin actions (role changes, permission grants) not logged
6. PHI exports or bulk operations not logged

Required audit log fields:
- User ID / actor
- Timestamp
- Action performed (read, create, update, delete, export)
- Resource accessed (patient ID, record type)
- Outcome (success/failure)
- IP address (optional but recommended)

Look for:
- Database queries (SELECT, UPDATE, DELETE) on PHI tables without subsequent log statement
- API endpoints returning patient data without auditLog() call
- File operations (readFile, writeFile) with PHI without logging
- Authentication functions without audit trail
- Missing audit logging framework/middleware

Be contextual:
- Internal helper functions may not need logging if the caller logs
- Test files don't need audit logging
- Some frameworks have automatic audit logging middleware
- Logging "user viewed dashboard" is not required, but "user accessed patient 123 record" is`;

export const AUDIT_LOGGING_USER_PROMPT = (sanitizedCode: string, filePath: string) => `
Analyze this file for missing audit logging:

File: ${filePath}
Code:
\`\`\`
${sanitizedCode}
\`\`\`

Find instances where PHI operations occur without proper audit logging.

Respond in JSON:
{
  "findings": [
    {
      "line": number,
      "severity": "high" | "medium",
      "message": "Brief description of the violation",
      "suggestion": "How to fix (be specific - e.g., 'Add auditLog.record({ userId, action: \"PHI_READ\", resourceId: patientId })')",
      "hipaaReference": "§164.308(a)(1)(ii)(D) - Audit Controls",
      "confidence": 0.0-1.0
    }
  ],
  "summary": "Overall assessment"
}

If no violations found, return empty findings array.
`;
