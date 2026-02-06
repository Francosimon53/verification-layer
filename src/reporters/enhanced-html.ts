import type { ComplianceScore } from '../types.js';

/**
 * Generate compliance score gauge HTML
 */
export function generateComplianceScoreGauge(score: ComplianceScore): string {
  const { score: value, grade, status } = score;

  // Determine color
  let color = '#dc2626'; // red
  if (value >= 80) color = '#059669'; // green
  else if (value >= 60) color = '#ca8a04'; // yellow

  // Calculate gauge angle (0-180 degrees)
  const angle = (value / 100) * 180;

  return `
    <div class="compliance-score-section">
      <div class="score-container">
        <div class="score-gauge">
          <svg viewBox="0 0 200 120" class="gauge-svg">
            <!-- Background arc -->
            <path d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="#e5e7eb"
                  stroke-width="20"
                  stroke-linecap="round"/>

            <!-- Score arc -->
            <path d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="${color}"
                  stroke-width="20"
                  stroke-linecap="round"
                  stroke-dasharray="${(angle / 180) * 251.2} 251.2"
                  class="score-arc"/>

            <!-- Center circle -->
            <circle cx="100" cy="100" r="60" fill="white" stroke="#f3f4f6" stroke-width="2"/>

            <!-- Score text -->
            <text x="100" y="90" text-anchor="middle" class="score-value">${value}</text>
            <text x="100" y="110" text-anchor="middle" class="score-max">/100</text>
          </svg>
          <div class="score-grade">${grade}</div>
          <div class="score-status">${status.toUpperCase()}</div>
        </div>

        <div class="score-breakdown">
          <h3>Findings Breakdown</h3>
          <div class="breakdown-grid">
            <div class="breakdown-item">
              <div class="breakdown-label">Critical</div>
              <div class="breakdown-value critical">${score.breakdown.critical}</div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-label">High</div>
              <div class="breakdown-value high">${score.breakdown.high}</div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-label">Medium</div>
              <div class="breakdown-value medium">${score.breakdown.medium}</div>
            </div>
            <div class="breakdown-item">
              <div class="breakdown-label">Low</div>
              <div class="breakdown-value low">${score.breakdown.low}</div>
            </div>
          </div>

          ${score.breakdown.acknowledged > 0 ? `
            <div class="acknowledged-notice">
              <svg class="info-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
              </svg>
              <span>${score.breakdown.acknowledged} finding(s) acknowledged (25% penalty reduction)</span>
            </div>
          ` : ''}
        </div>
      </div>

      ${score.recommendations.length > 0 ? `
        <div class="recommendations-box">
          <h3>💡 Recommendations</h3>
          <ul>
            ${score.recommendations.map(rec => `<li>${escapeHtml(rec)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Generate executive summary HTML
 */
export function generateExecutiveSummary(score: ComplianceScore, scannedFiles: number, scanDuration: number): string {
  return `
    <div class="executive-summary">
      <h2>📊 Executive Summary</h2>
      <div class="summary-grid">
        <div class="summary-metric">
          <div class="metric-icon">🎯</div>
          <div class="metric-content">
            <div class="metric-label">Compliance Score</div>
            <div class="metric-value">${score.score}/100</div>
            <div class="metric-subtext">Grade ${score.grade} - ${score.status}</div>
          </div>
        </div>

        <div class="summary-metric">
          <div class="metric-icon">⚠️</div>
          <div class="metric-content">
            <div class="metric-label">Total Issues</div>
            <div class="metric-value">${score.breakdown.total}</div>
            <div class="metric-subtext">${score.breakdown.critical} critical, ${score.breakdown.high} high</div>
          </div>
        </div>

        <div class="summary-metric">
          <div class="metric-icon">📁</div>
          <div class="metric-content">
            <div class="metric-label">Files Scanned</div>
            <div class="metric-value">${scannedFiles}</div>
            <div class="metric-subtext">in ${scanDuration}ms</div>
          </div>
        </div>

        <div class="summary-metric">
          <div class="metric-icon">📉</div>
          <div class="metric-content">
            <div class="metric-label">Penalty Points</div>
            <div class="metric-value">-${score.penalties.total}</div>
            <div class="metric-subtext">from ${score.breakdown.total} findings</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate enhanced CSS for compliance score and new features
 */
export function generateEnhancedCSS(): string {
  return `
    /* Compliance Score Section */
    .compliance-score-section {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      margin: 2rem 0;
    }

    .score-container {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 2rem;
      align-items: center;
    }

    .score-gauge {
      text-align: center;
      position: relative;
    }

    .gauge-svg {
      width: 200px;
      height: 120px;
      margin: 0 auto;
      display: block;
    }

    .score-arc {
      transition: stroke-dasharray 1s ease-out;
    }

    .score-value {
      font-size: 2.5rem;
      font-weight: bold;
      fill: #1f2937;
    }

    .score-max {
      font-size: 1rem;
      fill: #6b7280;
    }

    .score-grade {
      font-size: 2rem;
      font-weight: bold;
      color: #1f2937;
      margin-top: 0.5rem;
    }

    .score-status {
      font-size: 0.9rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .score-breakdown h3 {
      font-size: 1.25rem;
      color: #374151;
      margin-bottom: 1rem;
    }

    .breakdown-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .breakdown-item {
      background: #f9fafb;
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
    }

    .breakdown-label {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 0.5rem;
    }

    .breakdown-value {
      font-size: 1.75rem;
      font-weight: bold;
    }

    .breakdown-value.critical { color: #dc2626; }
    .breakdown-value.high { color: #ea580c; }
    .breakdown-value.medium { color: #ca8a04; }
    .breakdown-value.low { color: #2563eb; }

    .acknowledged-notice {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem;
      background: #eff6ff;
      border-radius: 6px;
      color: #1e40af;
      font-size: 0.875rem;
    }

    .info-icon {
      width: 1.25rem;
      height: 1.25rem;
      flex-shrink: 0;
    }

    .recommendations-box {
      margin-top: 2rem;
      padding: 1.5rem;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-radius: 8px;
      border-left: 4px solid #f59e0b;
    }

    .recommendations-box h3 {
      font-size: 1.1rem;
      color: #92400e;
      margin-bottom: 1rem;
    }

    .recommendations-box ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .recommendations-box li {
      padding: 0.5rem 0;
      color: #78350f;
      display: flex;
      gap: 0.5rem;
    }

    .recommendations-box li::before {
      content: "•";
      color: #f59e0b;
      font-weight: bold;
    }

    /* Executive Summary */
    .executive-summary {
      background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
      padding: 2rem;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      margin: 2rem 0;
    }

    .executive-summary h2 {
      color: #374151;
      margin-bottom: 1.5rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
    }

    .summary-metric {
      background: white;
      padding: 1.5rem;
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      display: flex;
      gap: 1rem;
      align-items: center;
      border: 1px solid #e5e7eb;
    }

    .metric-icon {
      font-size: 2rem;
      flex-shrink: 0;
    }

    .metric-content {
      flex: 1;
    }

    .metric-label {
      font-size: 0.75rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.25rem;
    }

    .metric-value {
      font-size: 1.75rem;
      font-weight: bold;
      color: #1f2937;
    }

    .metric-subtext {
      font-size: 0.8rem;
      color: #9ca3af;
      margin-top: 0.25rem;
    }

    /* Trend Chart Placeholder */
    .trend-placeholder {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      margin: 2rem 0;
      text-align: center;
      border: 2px dashed #e5e7eb;
    }

    .trend-placeholder h3 {
      color: #6b7280;
      font-weight: normal;
      margin-bottom: 0.5rem;
    }

    .trend-placeholder p {
      color: #9ca3af;
      font-size: 0.875rem;
    }

    /* Print-friendly styles */
    @media print {
      body {
        background: white;
        padding: 0;
      }

      .container {
        max-width: 100%;
      }

      .compliance-score-section,
      .executive-summary,
      .finding {
        page-break-inside: avoid;
        box-shadow: none;
        border: 1px solid #e5e7eb;
      }

      .gauge-svg {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .guide-toggle summary {
        background: #f3f4f6 !important;
        color: #1f2937 !important;
      }
    }

    @media (max-width: 768px) {
      .score-container {
        grid-template-columns: 1fr;
      }

      .breakdown-grid {
        grid-template-columns: 1fr;
      }

      .summary-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
