import { NextResponse } from 'next/server';
import { loadSampleData, clearSampleData, hasSampleData } from '@/lib/demo-data';

export async function GET() {
  const loaded = await hasSampleData();
  return NextResponse.json({ hasSampleData: loaded });
}

export async function POST() {
  const count = await loadSampleData();
  return NextResponse.json({ loaded: count });
}

export async function DELETE() {
  const count = await clearSampleData();
  return NextResponse.json({ removed: count });
}
