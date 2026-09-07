import { createHash } from 'crypto';
import type { Finding } from '../types.js';
import {
  canonicalRuleId,
  generateFindingHash,
  normalizeFindingFile,
} from '../baseline.js';
import type {
  ComplianceGraph,
  ComplianceGraphEdge,
  ComplianceGraphNode,
  GitContext,
  PolicyDecision,
} from './types.js';

const CATEGORY_CONTROLS: Record<string, string> = {
  'phi-exposure': 'HIPAA Privacy + §164.312(a)(1)',
  encryption: '§164.312(a)(2)(iv) / §164.312(e)(2)(ii)',
  'audit-logging': '§164.312(b)',
  'access-control': '§164.312(a)(1) / §164.312(d)',
  'data-retention': '§164.316(b)(2)(i)',
};

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function addNode(nodes: Map<string, ComplianceGraphNode>, node: ComplianceGraphNode): void {
  if (!nodes.has(node.id)) nodes.set(node.id, node);
}

function addEdge(edges: ComplianceGraphEdge[], edge: ComplianceGraphEdge): void {
  if (!edges.some(existing =>
    existing.from === edge.from
    && existing.to === edge.to
    && existing.relation === edge.relation
  )) {
    edges.push(edge);
  }
}

export function controlForFinding(finding: Finding): string {
  return finding.hipaaReference?.trim() || CATEGORY_CONTROLS[finding.category] || 'HIPAA Security Rule';
}

/**
 * Materialize the core vlayer knowledge graph:
 * code -> finding -> control -> policy, with optional ownership and evidence.
 */
export function buildComplianceGraph(
  findings: Finding[],
  projectRoot: string,
  decision: PolicyDecision,
  git?: GitContext,
): ComplianceGraph {
  const nodes = new Map<string, ComplianceGraphNode>();
  const edges: ComplianceGraphEdge[] = [];
  const policyId = 'policy:delivery';
  const evidenceId = `evidence:${shortHash(`${decision.evaluatedAt}|${git?.headSha ?? 'local'}`)}`;

  addNode(nodes, {
    id: policyId,
    type: 'policy',
    label: decision.deployAllowed ? 'Deployment policy: PASS' : 'Deployment policy: FAIL',
    metadata: {
      deployAllowed: decision.deployAllowed,
      scope: decision.consideredScope,
      reasons: decision.reasons.length,
    },
  });

  addNode(nodes, {
    id: evidenceId,
    type: 'evidence',
    label: git?.headSha ? `Evidence for ${git.headSha.slice(0, 8)}` : 'Local scan evidence',
    metadata: {
      headSha: git?.headSha ?? null,
      baseSha: git?.baseSha ?? null,
    },
  });
  addEdge(edges, { from: evidenceId, to: policyId, relation: 'supports' });

  let ownerId: string | undefined;
  if (git?.author) {
    ownerId = `owner:${shortHash(git.author)}`;
    addNode(nodes, {
      id: ownerId,
      type: 'owner',
      label: git.author,
    });
  }

  for (const finding of findings) {
    const file = normalizeFindingFile(finding, projectRoot);
    const fingerprint = generateFindingHash(finding, projectRoot);
    const codeId = `code:${shortHash(file)}`;
    const findingId = `finding:${fingerprint}`;
    const control = controlForFinding(finding);
    const controlId = `control:${shortHash(control)}`;

    addNode(nodes, {
      id: codeId,
      type: 'code',
      label: file,
      metadata: { file },
    });
    addNode(nodes, {
      id: findingId,
      type: 'finding',
      label: finding.title,
      metadata: {
        fingerprint,
        ruleId: canonicalRuleId(finding.id),
        severity: finding.severity,
        category: finding.category,
        line: finding.line ?? null,
        acknowledged: finding.acknowledged === true,
        baseline: finding.isBaseline === true,
      },
    });
    addNode(nodes, {
      id: controlId,
      type: 'control',
      label: control,
    });

    addEdge(edges, { from: codeId, to: findingId, relation: 'contains' });
    addEdge(edges, { from: findingId, to: controlId, relation: 'violates' });
    addEdge(edges, { from: findingId, to: policyId, relation: 'governed-by' });
    addEdge(edges, { from: evidenceId, to: findingId, relation: 'supports' });
    if (ownerId) addEdge(edges, { from: findingId, to: ownerId, relation: 'owned-by' });
  }

  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    nodes: [...nodes.values()],
    edges,
  };
}

function mermaidLabel(value: string): string {
  return value.replace(/"/g, "'").replace(/\n/g, ' ');
}

/** Render a portable Mermaid view for reports and documentation. */
export function graphToMermaid(graph: ComplianceGraph): string {
  const lines = ['flowchart LR'];
  for (const node of graph.nodes) {
    const id = `n${shortHash(node.id)}`;
    lines.push(`  ${id}["${mermaidLabel(node.label)}"]`);
  }
  const ids = new Map(graph.nodes.map(node => [node.id, `n${shortHash(node.id)}`]));
  for (const edge of graph.edges) {
    const from = ids.get(edge.from);
    const to = ids.get(edge.to);
    if (from && to) lines.push(`  ${from} -->|${edge.relation}| ${to}`);
  }
  return lines.join('\n');
}
