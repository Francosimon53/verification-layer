import type { Framework, Database, AuthProvider, DetectedStack } from './index.js';

export interface StackGuide {
  title: string;
  description: string;
  code: string;
  language: string;
}

export interface StackRecommendations {
  session: StackGuide[];
  database: StackGuide[];
  auth: StackGuide[];
  general: StackGuide[];
}

// =============================================================================
// SESSION MANAGEMENT GUIDES
// =============================================================================

const sessionGuides: Record<Framework, StackGuide[]> = {
  nextjs: [
    {
      title: 'Use Server Components for PHI',
      description: 'Keep PHI in server components to prevent client exposure. Never pass PHI as props to client components.',
      language: 'tsx',
      code: `// app/patients/[id]/page.tsx (Server Component)
import { getPatient } from '@/lib/db';

export default async function PatientPage({ params }: { params: { id: string } }) {
  const patient = await getPatient(params.id);

  // PHI stays on server, only send necessary display data
  return (
    <PatientView
      name={patient.name}
      // Don't pass: ssn, fullRecord, etc.
    />
  );
}`,
    },
    {
      title: 'Secure API Routes with Middleware',
      description: 'Protect all PHI-related API routes with authentication middleware.',
      language: 'typescript',
      code: `// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');

  if (request.nextUrl.pathname.startsWith('/api/patients')) {
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Log PHI access for audit trail
    console.log(\`[AUDIT] PHI access: \${request.nextUrl.pathname}\`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/patients/:path*', '/dashboard/:path*']
};`,
    },
  ],
  express: [
    {
      title: 'Use express-session with Redis',
      description: 'Store sessions in Redis for HIPAA-compliant session management with automatic expiration.',
      language: 'typescript',
      code: `import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,          // HTTPS only
    httpOnly: true,        // No JS access
    maxAge: 15 * 60 * 1000, // 15 min (HIPAA recommendation)
    sameSite: 'strict'
  }
}));`,
    },
    {
      title: 'PHI Access Logging Middleware',
      description: 'Log all PHI access for HIPAA audit requirements.',
      language: 'typescript',
      code: `import { Request, Response, NextFunction } from 'express';

const phiAuditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path.includes('/patient') || req.path.includes('/phi')) {
    const auditLog = {
      timestamp: new Date().toISOString(),
      userId: req.session?.userId,
      action: req.method,
      resource: req.path,
      ip: req.ip,
    };
    // Send to audit logging service
    auditLogger.log(auditLog);
  }
  next();
};

app.use('/api', phiAuditMiddleware);`,
    },
  ],
  react: [],
  vue: [],
  nuxt: [],
  angular: [],
  fastify: [],
  nestjs: [],
  koa: [],
  hono: [],
  unknown: [],
};

// =============================================================================
// DATABASE SECURITY GUIDES
// =============================================================================

const databaseGuides: Record<Database, StackGuide[]> = {
  supabase: [
    {
      title: 'Enable Row Level Security (RLS)',
      description: 'Supabase RLS ensures users can only access their authorized data at the database level.',
      language: 'sql',
      code: `-- Enable RLS on patients table
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see patients they're assigned to
CREATE POLICY "Users can view assigned patients" ON patients
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM patient_assignments
      WHERE patient_id = patients.id
    )
  );

-- Policy: Only admins can insert patients
CREATE POLICY "Admins can insert patients" ON patients
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Audit logging via trigger
CREATE OR REPLACE FUNCTION log_phi_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, table_name, record_id, timestamp)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_audit
  AFTER INSERT OR UPDATE OR DELETE ON patients
  FOR EACH ROW EXECUTE FUNCTION log_phi_access();`,
    },
    {
      title: 'Use Supabase Server Client',
      description: 'Always use server-side Supabase client for PHI operations to prevent exposing service role key.',
      language: 'typescript',
      code: `// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

// Usage in Server Component
const supabase = await createClient();
const { data: patients } = await supabase
  .from('patients')
  .select('id, name, dob') // Only select needed columns
  .limit(50);`,
    },
  ],
  firebase: [
    {
      title: 'Firestore Security Rules',
      description: 'Configure Firestore rules to enforce HIPAA access controls.',
      language: 'javascript',
      code: `// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check user role
    function hasRole(role) {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }

    // Patients collection - strict access
    match /patients/{patientId} {
      // Only authenticated healthcare providers can read
      allow read: if request.auth != null
        && hasRole('healthcare_provider')
        && resource.data.assignedProviders.hasAny([request.auth.uid]);

      // Only admins can create/update
      allow write: if request.auth != null && hasRole('admin');

      // Never allow delete - use soft delete
      allow delete: if false;
    }

    // Audit log - append only
    match /audit_log/{logId} {
      allow create: if request.auth != null;
      allow read: if hasRole('compliance_officer');
      allow update, delete: if false;
    }
  }
}`,
    },
    {
      title: 'Firebase Admin SDK for PHI',
      description: 'Use Admin SDK server-side for PHI operations with proper audit logging.',
      language: 'typescript',
      code: `// lib/firebase-admin.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = getApps().length === 0
  ? initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_KEY!)) })
  : getApps()[0];

const db = getFirestore(app);

export async function getPatient(patientId: string, userId: string) {
  // Log access attempt
  await db.collection('audit_log').add({
    userId,
    action: 'READ',
    resource: \`patients/\${patientId}\`,
    timestamp: new Date(),
  });

  const doc = await db.collection('patients').doc(patientId).get();
  return doc.data();
}`,
    },
  ],
  postgresql: [
    {
      title: 'Parameterized Queries',
      description: 'Always use parameterized queries to prevent SQL injection.',
      language: 'typescript',
      code: `import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true } // Enforce TLS
});

// GOOD: Parameterized query
async function getPatient(patientId: string) {
  const result = await pool.query(
    'SELECT id, name, dob FROM patients WHERE id = $1',
    [patientId]
  );
  return result.rows[0];
}

// GOOD: With audit logging
async function getPatientWithAudit(patientId: string, userId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Log access
    await client.query(
      'INSERT INTO audit_log (user_id, action, resource, timestamp) VALUES ($1, $2, $3, NOW())',
      [userId, 'READ', \`patient:\${patientId}\`]
    );

    // Fetch data
    const result = await client.query(
      'SELECT id, name, dob FROM patients WHERE id = $1',
      [patientId]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}`,
    },
  ],
  mysql: [
    {
      title: 'Prepared Statements with mysql2',
      description: 'Use prepared statements to prevent SQL injection.',
      language: 'typescript',
      code: `import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

async function getPatient(patientId: string) {
  const [rows] = await pool.execute(
    'SELECT id, name, dob FROM patients WHERE id = ?',
    [patientId]
  );
  return rows[0];
}`,
    },
  ],
  mongodb: [
    {
      title: 'MongoDB Query Sanitization',
      description: 'Sanitize inputs and use projection to limit PHI exposure.',
      language: 'typescript',
      code: `import { MongoClient, ObjectId } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI!, {
  tls: true,
  tlsAllowInvalidCertificates: false
});

async function getPatient(patientId: string) {
  const db = client.db('healthcare');

  // Validate ObjectId format
  if (!ObjectId.isValid(patientId)) {
    throw new Error('Invalid patient ID');
  }

  // Use projection to limit returned fields
  return db.collection('patients').findOne(
    { _id: new ObjectId(patientId) },
    { projection: { ssn: 0, fullRecords: 0 } } // Exclude sensitive fields
  );
}`,
    },
  ],
  prisma: [
    {
      title: 'Prisma with Field-Level Selection',
      description: 'Use Prisma select to limit PHI exposure.',
      language: 'typescript',
      code: `import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'error'], // Enable query logging for audit
});

async function getPatient(patientId: string) {
  return prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      name: true,
      dob: true,
      // Explicitly exclude: ssn, medicalRecords, etc.
    }
  });
}

// With audit middleware
prisma.$use(async (params, next) => {
  if (params.model === 'Patient') {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        model: params.model,
        timestamp: new Date(),
      }
    });
  }
  return next(params);
});`,
    },
  ],
  drizzle: [
    {
      title: 'Drizzle ORM Secure Queries',
      description: 'Use Drizzle with explicit column selection.',
      language: 'typescript',
      code: `import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { patients } from './schema';

const db = drizzle(pool);

async function getPatient(patientId: string) {
  return db
    .select({
      id: patients.id,
      name: patients.name,
      dob: patients.dob,
      // Don't select: ssn, medicalHistory
    })
    .from(patients)
    .where(eq(patients.id, patientId));
}`,
    },
  ],
  unknown: [],
};

// =============================================================================
// AUTH GUIDES
// =============================================================================

const authGuides: Record<AuthProvider, StackGuide[]> = {
  nextauth: [
    {
      title: 'NextAuth.js Session Configuration',
      description: 'Configure NextAuth with secure session settings for HIPAA compliance.',
      language: 'typescript',
      code: `// auth.ts
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    strategy: 'jwt',
    maxAge: 15 * 60, // 15 minutes (HIPAA recommendation)
  },
  callbacks: {
    async session({ session, token }) {
      // Add user role to session
      session.user.role = token.role;
      session.user.id = token.sub;
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
  },
  events: {
    async signIn({ user }) {
      // Audit log
      await logAuditEvent('SIGN_IN', user.id);
    },
    async signOut({ token }) {
      await logAuditEvent('SIGN_OUT', token.sub);
    },
  },
});`,
    },
  ],
  'supabase-auth': [
    {
      title: 'Supabase Auth with Session Refresh',
      description: 'Configure Supabase Auth with automatic session refresh and timeout.',
      language: 'typescript',
      code: `// lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: true,
              sameSite: 'lax',
              maxAge: 60 * 15, // 15 min session
            });
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect PHI routes
  if (request.nextUrl.pathname.startsWith('/patients') && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}`,
    },
  ],
  'firebase-auth': [
    {
      title: 'Firebase Auth Session Management',
      description: 'Implement secure session cookies with Firebase Auth.',
      language: 'typescript',
      code: `// app/api/session/route.ts
import { auth } from 'firebase-admin';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const { idToken } = await request.json();

  // Verify and create session cookie (15 min)
  const expiresIn = 15 * 60 * 1000;
  const sessionCookie = await auth().createSessionCookie(idToken, { expiresIn });

  const cookieStore = await cookies();
  cookieStore.set('session', sessionCookie, {
    maxAge: expiresIn / 1000,
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });

  return Response.json({ status: 'success' });
}

// Verify session in middleware
export async function verifySession(sessionCookie: string) {
  try {
    const decoded = await auth().verifySessionCookie(sessionCookie, true);
    return decoded;
  } catch {
    return null;
  }
}`,
    },
  ],
  auth0: [
    {
      title: 'Auth0 Session Configuration',
      description: 'Configure Auth0 with HIPAA-compliant session settings.',
      language: 'typescript',
      code: `// lib/auth0.ts
import { initAuth0 } from '@auth0/nextjs-auth0';

export default initAuth0({
  session: {
    rollingDuration: 15 * 60,  // 15 min inactivity timeout
    absoluteDuration: 8 * 60 * 60, // 8 hour max
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    },
  },
  authorizationParams: {
    scope: 'openid profile email',
    audience: process.env.AUTH0_AUDIENCE,
  },
});

// Protect API route
import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';

export const GET = withApiAuthRequired(async (req) => {
  const session = await getSession();
  // Log PHI access
  await auditLog('PHI_ACCESS', session?.user.sub);
  // ... handle request
});`,
    },
  ],
  clerk: [
    {
      title: 'Clerk Auth Protection',
      description: 'Use Clerk middleware for route protection.',
      language: 'typescript',
      code: `// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/patients(.*)',
  '/dashboard(.*)',
  '/api/phi(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

// In component
import { auth } from '@clerk/nextjs/server';

export default async function PatientsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // Fetch with audit
  const patients = await getPatients(userId);
  return <PatientList patients={patients} />;
}`,
    },
  ],
  lucia: [],
  passport: [
    {
      title: 'Passport.js with Session Store',
      description: 'Configure Passport with secure session management.',
      language: 'typescript',
      code: `import passport from 'passport';
import session from 'express-session';
import RedisStore from 'connect-redis';

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 15 * 60 * 1000, // 15 min
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Protect PHI routes
const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Log PHI access
  auditLogger.log({ userId: req.user.id, action: 'PHI_ACCESS', path: req.path });
  next();
};

app.use('/api/patients', requireAuth);`,
    },
  ],
  unknown: [],
};

// =============================================================================
// GENERAL HIPAA GUIDES
// =============================================================================

const generalGuides: StackGuide[] = [
  {
    title: 'Environment Variables for Secrets',
    description: 'Never hardcode credentials. Use environment variables with proper validation.',
    language: 'typescript',
    code: `// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  API_KEY: z.string().min(20),
});

export const env = envSchema.parse(process.env);

// Usage
import { env } from '@/lib/env';
const db = new Pool({ connectionString: env.DATABASE_URL });`,
  },
  {
    title: 'Structured Audit Logging',
    description: 'Implement comprehensive audit logging for HIPAA compliance.',
    language: 'typescript',
    code: `// lib/audit.ts
interface AuditEvent {
  timestamp: string;
  userId: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  resource: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  details?: Record<string, unknown>;
}

export async function logAudit(event: Omit<AuditEvent, 'timestamp'>) {
  const auditEvent: AuditEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  // Store in append-only audit table
  await db.query(
    'INSERT INTO audit_log (data) VALUES ($1)',
    [JSON.stringify(auditEvent)]
  );

  // Also send to external SIEM if configured
  if (process.env.SIEM_ENDPOINT) {
    await fetch(process.env.SIEM_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(auditEvent),
    });
  }
}`,
  },
];

// =============================================================================
// MAIN EXPORT
// =============================================================================

export function getStackSpecificGuides(stack: DetectedStack): StackRecommendations {
  return {
    session: sessionGuides[stack.framework] || [],
    database: databaseGuides[stack.database] || [],
    auth: authGuides[stack.auth] || [],
    general: generalGuides,
  };
}

export function getStackSummary(stack: DetectedStack): string[] {
  const recommendations: string[] = [];

  // Framework-specific
  if (stack.framework === 'nextjs') {
    recommendations.push('Use Server Components for PHI data to prevent client exposure');
    recommendations.push('Implement middleware.ts for route protection');
  } else if (stack.framework === 'express') {
    recommendations.push('Use express-session with Redis for HIPAA-compliant sessions');
    recommendations.push('Implement PHI access logging middleware');
  }

  // Database-specific
  if (stack.database === 'supabase') {
    recommendations.push('Enable Row Level Security (RLS) on all tables containing PHI');
    recommendations.push('Use Supabase server client for PHI operations');
    recommendations.push('Configure database triggers for audit logging');
  } else if (stack.database === 'firebase') {
    recommendations.push('Configure Firestore Security Rules for PHI access control');
    recommendations.push('Use Firebase Admin SDK server-side for PHI operations');
  } else if (stack.database === 'postgresql' || stack.database === 'mysql') {
    recommendations.push('Always use parameterized queries to prevent SQL injection');
    recommendations.push('Enable TLS for database connections');
  }

  // Auth-specific
  if (stack.auth === 'supabase-auth') {
    recommendations.push('Configure 15-minute session timeout for HIPAA compliance');
    recommendations.push('Use Supabase Auth middleware for route protection');
  } else if (stack.auth === 'nextauth') {
    recommendations.push('Set JWT maxAge to 15 minutes for HIPAA compliance');
    recommendations.push('Implement signIn/signOut audit events');
  }

  // General
  recommendations.push('Never log PHI to console in production');
  recommendations.push('Use environment variables for all credentials');
  recommendations.push('Implement structured audit logging for all PHI access');

  return recommendations;
}
