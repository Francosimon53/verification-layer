import { NextResponse } from 'next/server';
import { getProjects, createProject } from '@/lib/storage';
import type { Project } from '@/types';

export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = await createProject({
      name: body.name,
      path: body.path,
      description: body.description,
      scans: [],
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
