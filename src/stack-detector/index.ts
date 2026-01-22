import { readFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';

export type Framework =
  | 'nextjs'
  | 'react'
  | 'vue'
  | 'nuxt'
  | 'angular'
  | 'express'
  | 'fastify'
  | 'nestjs'
  | 'koa'
  | 'hono'
  | 'unknown';

export type Database =
  | 'supabase'
  | 'firebase'
  | 'postgresql'
  | 'mysql'
  | 'mongodb'
  | 'prisma'
  | 'drizzle'
  | 'unknown';

export type AuthProvider =
  | 'nextauth'
  | 'supabase-auth'
  | 'firebase-auth'
  | 'auth0'
  | 'clerk'
  | 'lucia'
  | 'passport'
  | 'unknown';

export interface DetectedStack {
  framework: Framework;
  database: Database;
  auth: AuthProvider;
  dependencies: string[];
  confidence: {
    framework: number;
    database: number;
    auth: number;
  };
  details: {
    frameworkVersion?: string;
    databaseVersion?: string;
    authVersion?: string;
  };
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const FRAMEWORK_PATTERNS: Record<Framework, { packages: string[]; files?: string[] }> = {
  nextjs: {
    packages: ['next'],
    files: ['next.config.js', 'next.config.mjs', 'next.config.ts']
  },
  nuxt: {
    packages: ['nuxt'],
    files: ['nuxt.config.js', 'nuxt.config.ts']
  },
  react: {
    packages: ['react', 'react-dom']
  },
  vue: {
    packages: ['vue']
  },
  angular: {
    packages: ['@angular/core'],
    files: ['angular.json']
  },
  express: {
    packages: ['express']
  },
  fastify: {
    packages: ['fastify']
  },
  nestjs: {
    packages: ['@nestjs/core'],
    files: ['nest-cli.json']
  },
  koa: {
    packages: ['koa']
  },
  hono: {
    packages: ['hono']
  },
  unknown: { packages: [] },
};

const DATABASE_PATTERNS: Record<Database, { packages: string[]; envVars?: string[] }> = {
  supabase: {
    packages: ['@supabase/supabase-js', '@supabase/ssr', '@supabase/auth-helpers-nextjs'],
    envVars: ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY']
  },
  firebase: {
    packages: ['firebase', 'firebase-admin', '@firebase/firestore'],
    envVars: ['FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE']
  },
  postgresql: {
    packages: ['pg', 'postgres', '@vercel/postgres', 'node-postgres'],
    envVars: ['DATABASE_URL', 'POSTGRES_URL', 'PG_CONNECTION']
  },
  mysql: {
    packages: ['mysql', 'mysql2'],
    envVars: ['MYSQL_URL', 'MYSQL_HOST']
  },
  mongodb: {
    packages: ['mongodb', 'mongoose'],
    envVars: ['MONGODB_URI', 'MONGO_URL']
  },
  prisma: {
    packages: ['@prisma/client', 'prisma']
  },
  drizzle: {
    packages: ['drizzle-orm']
  },
  unknown: { packages: [] },
};

const AUTH_PATTERNS: Record<AuthProvider, { packages: string[]; files?: string[] }> = {
  nextauth: {
    packages: ['next-auth', '@auth/core'],
    files: ['auth.ts', 'auth.js', '[...nextauth].ts', '[...nextauth].js']
  },
  'supabase-auth': {
    packages: ['@supabase/auth-helpers-nextjs', '@supabase/auth-helpers-react', '@supabase/ssr']
  },
  'firebase-auth': {
    packages: ['firebase/auth', '@firebase/auth']
  },
  auth0: {
    packages: ['@auth0/nextjs-auth0', '@auth0/auth0-react', 'auth0']
  },
  clerk: {
    packages: ['@clerk/nextjs', '@clerk/clerk-react']
  },
  lucia: {
    packages: ['lucia', 'lucia-auth']
  },
  passport: {
    packages: ['passport', 'passport-local', 'passport-jwt']
  },
  unknown: { packages: [] },
};

async function readPackageJson(projectPath: string): Promise<PackageJson | null> {
  try {
    const content = await readFile(join(projectPath, 'package.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function fileExists(projectPath: string, fileName: string): Promise<boolean> {
  try {
    const files = await glob(`**/${fileName}`, {
      cwd: projectPath,
      ignore: ['node_modules/**'],
      nodir: true
    });
    return files.length > 0;
  } catch {
    return false;
  }
}

async function searchInFiles(projectPath: string, pattern: RegExp): Promise<boolean> {
  try {
    const files = await glob('**/*.{ts,tsx,js,jsx,env,env.local}', {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', '.next/**'],
      nodir: true
    });

    for (const file of files.slice(0, 50)) { // Limit to first 50 files
      try {
        const content = await readFile(join(projectPath, file), 'utf-8');
        if (pattern.test(content)) {
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function getAllDependencies(pkg: PackageJson): string[] {
  return [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
}

function hasDependency(deps: string[], packageName: string): boolean {
  return deps.some(d => d === packageName || d.startsWith(packageName + '/'));
}

function getVersion(pkg: PackageJson, packageName: string): string | undefined {
  return pkg.dependencies?.[packageName] || pkg.devDependencies?.[packageName];
}

async function detectFramework(
  projectPath: string,
  pkg: PackageJson,
  deps: string[]
): Promise<{ framework: Framework; confidence: number; version?: string }> {
  // Priority order matters - more specific frameworks first
  const frameworkOrder: Framework[] = [
    'nextjs', 'nuxt', 'nestjs', 'angular', 'fastify', 'hono', 'koa', 'express', 'vue', 'react'
  ];

  for (const fw of frameworkOrder) {
    const pattern = FRAMEWORK_PATTERNS[fw];
    const hasPackage = pattern.packages.some(p => hasDependency(deps, p));

    if (hasPackage) {
      let confidence = 0.7;

      // Check for config files to boost confidence
      if (pattern.files) {
        for (const file of pattern.files) {
          if (await fileExists(projectPath, file)) {
            confidence = 0.95;
            break;
          }
        }
      }

      return {
        framework: fw,
        confidence,
        version: getVersion(pkg, pattern.packages[0]),
      };
    }
  }

  return { framework: 'unknown', confidence: 0 };
}

async function detectDatabase(
  projectPath: string,
  pkg: PackageJson,
  deps: string[]
): Promise<{ database: Database; confidence: number; version?: string }> {
  // Priority: specific services > ORMs > generic drivers
  const dbOrder: Database[] = [
    'supabase', 'firebase', 'prisma', 'drizzle', 'mongodb', 'postgresql', 'mysql'
  ];

  for (const db of dbOrder) {
    const pattern = DATABASE_PATTERNS[db];
    const hasPackage = pattern.packages.some(p => hasDependency(deps, p));

    if (hasPackage) {
      let confidence = 0.8;

      // Check env vars in files to boost confidence
      if (pattern.envVars) {
        const envPattern = new RegExp(pattern.envVars.join('|'));
        if (await searchInFiles(projectPath, envPattern)) {
          confidence = 0.95;
        }
      }

      return {
        database: db,
        confidence,
        version: getVersion(pkg, pattern.packages[0]),
      };
    }
  }

  return { database: 'unknown', confidence: 0 };
}

async function detectAuth(
  projectPath: string,
  pkg: PackageJson,
  deps: string[]
): Promise<{ auth: AuthProvider; confidence: number; version?: string }> {
  const authOrder: AuthProvider[] = [
    'clerk', 'auth0', 'nextauth', 'supabase-auth', 'firebase-auth', 'lucia', 'passport'
  ];

  for (const auth of authOrder) {
    const pattern = AUTH_PATTERNS[auth];
    const hasPackage = pattern.packages.some(p => hasDependency(deps, p));

    if (hasPackage) {
      let confidence = 0.8;

      // Check for auth config files
      if (pattern.files) {
        for (const file of pattern.files) {
          if (await fileExists(projectPath, file)) {
            confidence = 0.95;
            break;
          }
        }
      }

      return {
        auth,
        confidence,
        version: getVersion(pkg, pattern.packages[0]),
      };
    }
  }

  // Check if Supabase is used - it includes auth by default
  if (deps.some(d => d.includes('supabase'))) {
    return { auth: 'supabase-auth', confidence: 0.6 };
  }

  // Check if Firebase is used - it includes auth
  if (deps.some(d => d.includes('firebase'))) {
    return { auth: 'firebase-auth', confidence: 0.6 };
  }

  return { auth: 'unknown', confidence: 0 };
}

export async function detectStack(projectPath: string): Promise<DetectedStack> {
  const pkg = await readPackageJson(projectPath);

  if (!pkg) {
    return {
      framework: 'unknown',
      database: 'unknown',
      auth: 'unknown',
      dependencies: [],
      confidence: { framework: 0, database: 0, auth: 0 },
      details: {},
    };
  }

  const deps = getAllDependencies(pkg);

  const [frameworkResult, databaseResult, authResult] = await Promise.all([
    detectFramework(projectPath, pkg, deps),
    detectDatabase(projectPath, pkg, deps),
    detectAuth(projectPath, pkg, deps),
  ]);

  return {
    framework: frameworkResult.framework,
    database: databaseResult.database,
    auth: authResult.auth,
    dependencies: deps,
    confidence: {
      framework: frameworkResult.confidence,
      database: databaseResult.confidence,
      auth: authResult.confidence,
    },
    details: {
      frameworkVersion: frameworkResult.version,
      databaseVersion: databaseResult.version,
      authVersion: authResult.version,
    },
  };
}

export function getStackDisplayName(stack: DetectedStack): {
  framework: string;
  database: string;
  auth: string;
} {
  const frameworkNames: Record<Framework, string> = {
    nextjs: 'Next.js',
    react: 'React',
    vue: 'Vue.js',
    nuxt: 'Nuxt',
    angular: 'Angular',
    express: 'Express.js',
    fastify: 'Fastify',
    nestjs: 'NestJS',
    koa: 'Koa',
    hono: 'Hono',
    unknown: 'Unknown',
  };

  const databaseNames: Record<Database, string> = {
    supabase: 'Supabase',
    firebase: 'Firebase/Firestore',
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    mongodb: 'MongoDB',
    prisma: 'Prisma ORM',
    drizzle: 'Drizzle ORM',
    unknown: 'Unknown',
  };

  const authNames: Record<AuthProvider, string> = {
    nextauth: 'NextAuth.js',
    'supabase-auth': 'Supabase Auth',
    'firebase-auth': 'Firebase Auth',
    auth0: 'Auth0',
    clerk: 'Clerk',
    lucia: 'Lucia',
    passport: 'Passport.js',
    unknown: 'Unknown',
  };

  return {
    framework: frameworkNames[stack.framework],
    database: databaseNames[stack.database],
    auth: authNames[stack.auth],
  };
}
