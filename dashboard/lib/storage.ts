import { promises as fs } from 'fs';
import path from 'path';
import type { DashboardData, Project, ScanReport } from '@/types';

const DATA_DIR = process.env.VLAYER_DATA_DIR || path.join(process.cwd(), '.vlayer-data');
const DATA_FILE = path.join(DATA_DIR, 'dashboard.json');

export async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

export async function loadData(): Promise<DashboardData> {
  try {
    await ensureDataDir();
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // Return default data if file doesn't exist
    return {
      projects: [],
      version: '1.0.0',
    };
  }
}

export async function saveData(data: DashboardData): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getProjects(): Promise<Project[]> {
  const data = await loadData();
  return data.projects;
}

export async function getProject(id: string): Promise<Project | null> {
  const data = await loadData();
  return data.projects.find((p) => p.id === id) || null;
}

export async function createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
  const data = await loadData();
  const newProject: Project = {
    ...project,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scans: [],
  };
  data.projects.push(newProject);
  await saveData(data);
  return newProject;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
  const data = await loadData();
  const index = data.projects.findIndex((p) => p.id === id);
  if (index === -1) return null;

  data.projects[index] = {
    ...data.projects[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await saveData(data);
  return data.projects[index];
}

export async function deleteProject(id: string): Promise<boolean> {
  const data = await loadData();
  const index = data.projects.findIndex((p) => p.id === id);
  if (index === -1) return false;

  data.projects.splice(index, 1);
  await saveData(data);
  return true;
}

export async function addScanToProject(projectId: string, scan: ScanReport): Promise<Project | null> {
  const data = await loadData();
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return null;

  project.scans.unshift(scan); // Add to beginning
  project.lastScanAt = scan.timestamp;
  project.updatedAt = new Date().toISOString();

  // Keep only last 50 scans
  if (project.scans.length > 50) {
    project.scans = project.scans.slice(0, 50);
  }

  await saveData(data);
  return project;
}

export async function getScan(projectId: string, scanId: string): Promise<ScanReport | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  return project.scans.find((s) => s.id === scanId) || null;
}
