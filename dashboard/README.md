# VLayer Dashboard

Web dashboard for monitoring HIPAA compliance across multiple projects.

## Features

- 📊 **Compliance Score Visualization** - Visual gauges and charts showing compliance scores
- 📈 **Score History** - Track compliance trends over time with historical data
- 🗂️ **Multi-Project Management** - Monitor multiple projects from one dashboard
- 🔍 **Detailed Findings** - View and filter compliance findings by severity
- 📋 **Recommendations** - Get actionable recommendations to improve compliance

## Getting Started

### Development

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

### Production

\`\`\`bash
npm run build
npm start
\`\`\`

### Deploy to Vercel

\`\`\`bash
vercel deploy
\`\`\`

Or connect your GitHub repository to Vercel for automatic deployments.

## Usage

### 1. Create a Project

Navigate to the dashboard and click "New Project". Provide:
- Project name
- Path to the project directory
- Optional description

### 2. Run Scans

Use the VLayer CLI to scan your project:

\`\`\`bash
vlayer scan /path/to/project --format json --output scan.json
\`\`\`

### 3. Upload Scan Results

Upload the scan results to your project via the API:

\`\`\`bash
curl -X POST http://localhost:3000/api/projects/{projectId}/scans \
  -H "Content-Type: application/json" \
  -d @scan.json
\`\`\`

## API Endpoints

- \`GET /api/projects\` - List all projects
- \`POST /api/projects\` - Create a new project
- \`GET /api/projects/:id\` - Get project details
- \`PATCH /api/projects/:id\` - Update project
- \`DELETE /api/projects/:id\` - Delete project
- \`POST /api/projects/:id/scans\` - Add scan to project

## Data Storage

By default, dashboard data is stored in \`.vlayer-data/dashboard.json\`.

You can customize the storage location by setting the \`VLAYER_DATA_DIR\` environment variable:

\`\`\`bash
export VLAYER_DATA_DIR=/path/to/data
\`\`\`

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **File-based Storage** - Simple JSON storage (can be replaced with database)
