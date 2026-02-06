import { NextResponse } from 'next/server';
import { addScanToProject } from '@/lib/storage';
import type { ScanReport } from '@/types';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const scan: ScanReport = {
      ...body,
      id: crypto.randomUUID(),
      projectId: id,
      timestamp: new Date().toISOString(),
    };

    const project = await addScanToProject(id, scan);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ scan, project }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add scan' }, { status: 500 });
  }
}
