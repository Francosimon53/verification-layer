import { NextResponse } from 'next/server';
import { getProjects, createProject } from '@/lib/storage';

export async function GET() {
  try {
    const projects = await getProjects();
    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error('Failed to load projects:', error);
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const project = await createProject({
      name: body.name.trim(),
      repoUrl: (body.repo_url || body.repoUrl || '').trim() || undefined,
      description: (body.description || '').trim() || undefined,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Supabase unique constraint / duplicate error
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A project with this name or repository already exists' },
        { status: 409 }
      );
    }

    // Supabase RLS / permission error
    if (error.code === '42501' || error.message?.includes('row-level security')) {
      console.error('RLS policy error:', error);
      return NextResponse.json(
        { error: 'Permission denied. Check RLS policies.' },
        { status: 403 }
      );
    }

    // Column mismatch / schema error
    if (error.code === '42703') {
      console.error('Column not found error:', error);
      return NextResponse.json(
        { error: 'Database schema mismatch: ' + error.message },
        { status: 500 }
      );
    }

    console.error('Failed to create project:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to create project' },
      { status: 500 }
    );
  }
}
