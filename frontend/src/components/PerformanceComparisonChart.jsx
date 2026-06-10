import React, { useMemo } from 'react';

export default function PerformanceComparisonChart({ quizResults = [] }) {
  const comparisonData = useMemo(() => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(today.getDate() - 14);

    // Group scores by subject for the two periods
    const subjectsMap = {};

    // Standard school subjects list to ensure representation
    const defaultSubjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Geography'];
    defaultSubjects.forEach(sub => {
      subjectsMap[sub] = { thisWeek: [], lastWeek: [] };
    });

    quizResults.forEach(result => {
      if (result.malpractice) return; // ignore malpractice
      
      const subject = result.subject || 'Unknown';
      const score = result.score || 0;
      
      const timestamp = result.timestamp?.toDate?.() || new Date(result.timestamp || result.createdAt);
      if (isNaN(timestamp.getTime())) return;

      if (!subjectsMap[subject]) {
        subjectsMap[subject] = { thisWeek: [], lastWeek: [] };
      }

      if (timestamp >= sevenDaysAgo) {
        subjectsMap[subject].thisWeek.push(score);
      } else if (timestamp >= fourteenDaysAgo && timestamp < sevenDaysAgo) {
        subjectsMap[subject].lastWeek.push(score);
      }
    });

    // Compute averages
    const results = Object.entries(subjectsMap).map(([subject, data]) => {
      const thisWeekAvg = data.thisWeek.length > 0 
        ? Math.round(data.thisWeek.reduce((a, b) => a + b, 0) / data.thisWeek.length) 
        : null;
      
      const lastWeekAvg = data.lastWeek.length > 0 
        ? Math.round(data.lastWeek.reduce((a, b) => a + b, 0) / data.lastWeek.length) 
        : null;

      const difference = (thisWeekAvg !== null && lastWeekAvg !== null)
        ? thisWeekAvg - lastWeekAvg
        : null;

      return {
        subject,
        thisWeekAvg,
        lastWeekAvg,
        difference,
        hasData: thisWeekAvg !== null || lastWeekAvg !== null
      };
    });

    // Filter to show subjects that have data, or keep default set if all empty
    const filtered = results.filter(r => r.hasData);
    if (filtered.length === 0) {
      // Mock/Example data for empty state preview
      return [
        { subject: 'Mathematics', thisWeekAvg: 82, lastWeekAvg: 75, difference: 7, hasData: false, isExample: true },
        { subject: 'Physics', thisWeekAvg: 78, lastWeekAvg: 82, difference: -4, hasData: false, isExample: true },
        { subject: 'Chemistry', thisWeekAvg: 90, lastWeekAvg: 85, difference: 5, hasData: false, isExample: true },
        { subject: 'Biology', thisWeekAvg: 74, lastWeekAvg: 74, difference: 0, hasData: false, isExample: true }
      ];
    }

    return filtered;
  }, [quizResults]);

  // Check if it's using example data
  const isMockPreview = comparisonData[0]?.isExample;

  // Render SVG dimensions
  const height = 40 + comparisonData.length * 45;
  const width = 500;
  const labelWidth = 110;
  const chartWidth = width - labelWidth - 40;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <span style={styles.badge}>Academic Growth</span>
          <h4 style={styles.title}>📈 Week-Over-Week Comparison</h4>
        </div>
        {isMockPreview && (
          <span style={styles.previewTag}>💡 Example Graph (No recent quizzes)</span>
        )}
      </div>

      <p style={styles.subtitle}>
        Compares average quiz performance from the last 7 days against the previous week.
      </p>

      {/* Legend */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <span style={{ ...styles.legendDot, backgroundColor: 'rgba(59, 130, 246, 0.4)', border: '1px solid #3b82f6' }} />
          <span style={styles.legendText}>Previous Week</span>
        </div>
        <div style={styles.legendItem}>
          <span style={{ ...styles.legendDot, backgroundColor: 'rgba(52, 211, 153, 0.5)', border: '1px solid #34d399' }} />
          <span style={styles.legendText}>Current Week</span>
        </div>
      </div>

      {/* SVG Bar Chart */}
      <div style={styles.svgWrapper}>
        <svg viewBox={`0 0 ${width} ${height}`} style={styles.svg}>
          <defs>
            <linearGradient id="lastWeekGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.65" />
            </linearGradient>
            <linearGradient id="thisWeekGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#047857" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.75" />
            </linearGradient>
            
            <filter id="glowGreen" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#34d399" floodOpacity="0.3"/>
            </filter>
            <filter id="glowBlue" x="-5%" y="-5%" width="110%" height="110%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#3b82f6" floodOpacity="0.3"/>
            </filter>
          </defs>

          {/* Vertical Grid Lines */}
          {[0, 25, 50, 75, 100].map((val, idx) => {
            const x = labelWidth + (val / 100) * chartWidth;
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={10}
                  x2={x}
                  y2={height - 25}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="3,3"
                />
                <text
                  x={x}
                  y={height - 8}
                  fill="rgba(255,255,255,0.4)"
                  fontSize="9px"
                  textAnchor="middle"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Rows */}
          {comparisonData.map((d, index) => {
            const rowY = 15 + index * 45;
            
            // X positions for values
            const lastWeekX = d.lastWeekAvg !== null ? (d.lastWeekAvg / 100) * chartWidth : 0;
            const thisWeekX = d.thisWeekAvg !== null ? (d.thisWeekAvg / 100) * chartWidth : 0;

            return (
              <g key={d.subject}>
                {/* Subject Label */}
                <text
                  x={labelWidth - 10}
                  y={rowY + 16}
                  fill="#f1f5f9"
                  fontSize="11px"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {d.subject}
                </text>

                {/* Base background bar */}
                <rect
                  x={labelWidth}
                  y={rowY}
                  width={chartWidth}
                  height={24}
                  fill="rgba(255,255,255,0.02)"
                  rx="4"
                />

                {/* Last Week Bar (Blue) */}
                {d.lastWeekAvg !== null && (
                  <rect
                    x={labelWidth}
                    y={rowY + 4}
                    width={lastWeekX}
                    height={7}
                    fill="url(#lastWeekGrad)"
                    stroke="rgba(59, 130, 246, 0.4)"
                    strokeWidth="1"
                    rx="2.5"
                    filter="url(#glowBlue)"
                  />
                )}

                {/* This Week Bar (Green) */}
                {d.thisWeekAvg !== null && (
                  <rect
                    x={labelWidth}
                    y={rowY + 13}
                    width={thisWeekX}
                    height={7}
                    fill="url(#thisWeekGrad)"
                    stroke="rgba(52, 211, 153, 0.5)"
                    strokeWidth="1"
                    rx="2.5"
                    filter="url(#glowGreen)"
                  />
                )}

                {/* Improvement Badge/Diff text */}
                {d.difference !== null && (
                  <text
                    x={labelWidth + Math.max(lastWeekX, thisWeekX) + 8}
                    y={rowY + 16}
                    fill={d.difference > 0 ? '#34d399' : d.difference < 0 ? '#f87171' : '#94a3b8'}
                    fontSize="9px"
                    fontWeight="700"
                  >
                    {d.difference > 0 ? `+${d.difference}%` : d.difference < 0 ? `${d.difference}%` : '0%'}
                  </text>
                )}

                {/* Missing Data labels */}
                {d.lastWeekAvg === null && d.thisWeekAvg !== null && (
                  <text x={labelWidth + 10} y={rowY + 9} fill="rgba(255,255,255,0.3)" fontSize="8px">
                    No score last week
                  </text>
                )}
                {d.thisWeekAvg === null && d.lastWeekAvg !== null && (
                  <text x={labelWidth + 10} y={rowY + 20} fill="rgba(255,255,255,0.3)" fontSize="8px">
                    No score this week
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Actionable summary details */}
      <div style={styles.growthSummary}>
        {comparisonData.some(d => d.difference && d.difference > 0) ? (
          <div style={styles.insightBox}>
            <span style={{ fontSize: '16px' }}>🚀</span>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
              Your child showed performance improvements in{' '}
              <strong>
                {comparisonData
                  .filter(d => d.difference && d.difference > 0)
                  .map(d => d.subject)
                  .join(', ')}
              </strong>.
            </span>
          </div>
        ) : (
          !isMockPreview && (
            <div style={styles.insightBox}>
              <span style={{ fontSize: '16px' }}>✏️</span>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                Keep taking weekly quizzes. Consistently finishing quizzes compiles more performance comparison trends.
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: 'rgba(30, 58, 95, 0.4)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    padding: '16px',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
    backdropFilter: 'blur(12px)',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxSizing: 'border-box',
    width: '100%',
    marginBottom: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px'
  },
  badge: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#93c5fd',
    backgroundColor: 'rgba(147, 197, 253, 0.12)',
    padding: '2px 8px',
    borderRadius: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  title: {
    margin: '4px 0 0 0',
    fontSize: '15px',
    color: '#ffffff',
    fontWeight: '700'
  },
  previewTag: {
    fontSize: '9px',
    color: '#fbbf24',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: '3px 8px',
    borderRadius: '6px',
    fontWeight: '600'
  },
  subtitle: {
    fontSize: '11px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: '1.4'
  },
  legend: {
    display: 'flex',
    gap: '12px',
    marginTop: '2px'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  legendDot: {
    width: '10px',
    height: '6px',
    borderRadius: '2px',
    display: 'inline-block'
  },
  legendText: {
    fontSize: '10px',
    color: '#cbd5e1',
    fontWeight: '500'
  },
  svgWrapper: {
    position: 'relative',
    width: '100%',
    overflow: 'visible'
  },
  svg: {
    width: '100%',
    height: 'auto',
    overflow: 'visible'
  },
  growthSummary: {
    marginTop: '4px'
  },
  insightBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.05)'
  }
};
