# Deploying VLayer Dashboard to Vercel

This guide explains how to deploy the VLayer web dashboard to Vercel.

## Method 1: Vercel Git Integration (Recommended)

### Step 1: Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository: `Francosimon53/verification-layer`

### Step 2: Configure Project

When configuring the project in Vercel:

- **Framework Preset**: Next.js
- **Root Directory**: `dashboard`
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

### Step 3: Environment Variables (Optional)

You can add environment variables in Vercel:

- `VLAYER_DATA_DIR`: Custom path for data storage (default: `.vlayer-data`)

### Step 4: Deploy

Click "Deploy" and Vercel will:
1. Install dependencies
2. Build the Next.js application
3. Deploy to a production URL

Your dashboard will be available at: `https://your-project.vercel.app`

## Method 2: Vercel CLI

If you have the Vercel CLI installed:

```bash
cd dashboard
vercel --prod
```

## Post-Deployment

### Testing the Dashboard

1. Visit your deployed URL
2. Create a new project
3. Run a scan locally:
   ```bash
   vlayer scan /path/to/project --format json --output scan.json
   ```
4. Upload scan results via API:
   ```bash
   curl -X POST https://your-project.vercel.app/api/projects/{projectId}/scans \
     -H "Content-Type: application/json" \
     -d @scan.json
   ```

### Integrating with CLI

You can extend the VLayer CLI to automatically upload scan results to the dashboard:

```bash
# In the main vlayer project
npm install # if not already done
node dist/cli.js scan . --format json --output scan.json

# Then upload to dashboard
curl -X POST https://your-dashboard.vercel.app/api/projects/{projectId}/scans \
  -H "Content-Type: application/json" \
  -d @scan.json
```

## Data Persistence

The dashboard uses file-based storage by default, which works for demo purposes but has limitations in serverless environments.

For production use, consider:

1. **Vercel KV** - Redis-compatible key-value store
2. **Vercel Postgres** - SQL database
3. **Supabase** - PostgreSQL with real-time features
4. **MongoDB Atlas** - Document database

To migrate to a database, replace the storage functions in `dashboard/lib/storage.ts`.

## Continuous Deployment

Once connected to Vercel via Git:

- Every push to `main` triggers a production deployment
- Pull requests get preview deployments
- Automatic rollbacks if deployment fails

## Monitoring

Monitor your dashboard at:
- **Vercel Dashboard**: View deployments, logs, and analytics
- **Runtime Logs**: Debug API requests and errors
- **Analytics**: Track page views and performance

## Troubleshooting

### Build Fails

Check build logs in Vercel dashboard. Common issues:
- Missing dependencies: Run `npm install` in `dashboard/`
- TypeScript errors: Run `npm run build` locally first

### Data Not Persisting

File-based storage doesn't persist across serverless function invocations. Migrate to a database for production use.

### API Errors

Check Vercel function logs for detailed error messages.
