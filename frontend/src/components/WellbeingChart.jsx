import React, { useState, useMemo } from 'react';

// Emotion mapping configuration
const mapMoodToValues = (emotion, severity) => {
  const sevMultiplier = severity === 'high' ? 1.0 : severity === 'medium' || severity === 'moderate' ? 0.65 : 0.35;
  const emo = (emotion || '').toLowerCase();
  
  let calm = 0;
  let excited = 0;
  let stressed = 0;
  
  if (['calm', 'neutral', 'focused', 'relaxed', 'happy', 'doing well', 'green'].includes(emo)) {
    calm = sevMultiplier;
  } else if (['proud', 'excited', 'motivated', 'joyful', 'energetic', 'yellow'].includes(emo)) {
    excited = sevMultiplier;
  } else if (['stressed', 'anxious', 'overwhelmed', 'frustrated', 'sad', 'tired', 'needs your attention', 'high'].includes(emo)) {
    stressed = sevMultiplier;
  } else {
    calm = 0.2; // Slight baseline Calm
  }
  return { calm, excited, stressed };
};

export default function WellbeingChart({ moodLogs = [] }) {
  const [visibleLayers, setVisibleLayers] = useState({
    calm: true,
    excited: true,
    stressed: true
  });
  
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // 1. Generate 14 days of data chronologically
  const chartData = useMemo(() => {
    const data = [];
    const today = new Date();
    let prevValues = { calm: 0.3, excited: 0.2, stressed: 0.1 }; // baseline fallback

    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateKey = date.toDateString();
      const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullDateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

      // Find check-in for this specific day
      const checkIn = moodLogs.find(m => {
        const mDate = m.createdAt?.toDate?.() || new Date(m.createdAt || m.date);
        return mDate.toDateString() === dateKey;
      });

      let values;
      let hasData = false;
      let rawMood = null;

      if (checkIn && checkIn.emotion && checkIn.emotion !== 'unknown') {
        const severity = checkIn.severity || (checkIn.needsAttention ? 'high' : 'low');
        values = mapMoodToValues(checkIn.emotion, severity);
        hasData = true;
        rawMood = checkIn.emotion;
        prevValues = values; // store for carryover
      } else {
        // Carryover decay: 50% decay towards baseline
        values = {
          calm: Math.max(0.15, prevValues.calm * 0.5),
          excited: Math.max(0.1, prevValues.excited * 0.5),
          stressed: Math.max(0.0, prevValues.stressed * 0.5),
        };
      }

      data.push({
        dateLabel: formattedDate,
        fullDateStr,
        dayName,
        hasData,
        rawMood,
        ...values
      });
    }

    // 2. Apply 3-day moving average smoothing to make the area curves organic
    const smoothed = data.map((d, idx) => {
      if (idx === 0 || idx === data.length - 1) return d;
      const prev = data[idx - 1];
      const next = data[idx + 1];
      return {
        ...d,
        calm: (prev.calm + d.calm + next.calm) / 3,
        excited: (prev.excited + d.excited + next.excited) / 3,
        stressed: (prev.stressed + d.stressed + next.stressed) / 3,
      };
    });

    return smoothed;
  }, [moodLogs]);

  // Dimensions & Padding for SVG ViewBox (500 x 240)
  const width = 500;
  const height = 240;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Helper to translate data index & value (0 to 1) to SVG coordinates
  const getCoords = (index, value) => {
    const x = paddingLeft + (index / (chartData.length - 1)) * chartWidth;
    const y = height - paddingBottom - value * chartHeight;
    return { x, y };
  };

  // Generate paths for each category
  const generatePaths = (key) => {
    if (chartData.length === 0) return { line: '', area: '' };

    let linePath = '';
    let areaPath = '';

    chartData.forEach((d, idx) => {
      const { x, y } = getCoords(idx, d[key]);
      if (idx === 0) {
        linePath = `M ${x} ${y}`;
        areaPath = `M ${x} ${height - paddingBottom} L ${x} ${y}`;
      } else {
        linePath += ` L ${x} ${y}`;
        areaPath += ` L ${x} ${y}`;
      }
    });

    const lastX = paddingLeft + chartWidth;
    areaPath += ` L ${lastX} ${height - paddingBottom} Z`;

    return { line: linePath, area: areaPath };
  };

  const calmPaths = useMemo(() => generatePaths('calm'), [chartData]);
  const excitedPaths = useMemo(() => generatePaths('excited'), [chartData]);
  const stressedPaths = useMemo(() => generatePaths('stressed'), [chartData]);

  // Determine stress alert status (average stress index > 0.4 over latest 3 entries)
  const stressAlert = useMemo(() => {
    if (chartData.length < 3) return false;
    const latestThree = chartData.slice(-3);
    const avgStress = latestThree.reduce((sum, d) => sum + d.stressed, 0) / 3;
    return avgStress > 0.4;
  }, [chartData]);

  const toggleLayer = (key) => {
    setVisibleLayers(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xMouse = e.clientX - rect.left;
    // Calculate index relative to the interactive width
    const svgRatio = width / rect.width;
    const xInSvg = xMouse * svgRatio;
    
    const xPercentage = (xInSvg - paddingLeft) / chartWidth;
    let index = Math.round(xPercentage * (chartData.length - 1));
    index = Math.max(0, Math.min(chartData.length - 1, index));
    setHoveredIndex(index);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  // Tooltip details for the hovered day
  const hoveredDay = hoveredIndex !== null ? chartData[hoveredIndex] : null;
  const tooltipCoords = hoveredIndex !== null ? getCoords(hoveredIndex, Math.max(hoveredDay.calm, hoveredDay.excited, hoveredDay.stressed)) : null;

  return (
    <div style={styles.container}>
      <div style={styles.chartHeader}>
        <div style={styles.headerInfo}>
          <span style={styles.badge}>ASTRA Analytics</span>
          <span style={styles.privacyLock}>🔒 Pupil Privacy Secure</span>
        </div>
        <p style={styles.infoText}>
          Monitors aggregate stress indicators and emotional states without exposing personal diary text or chat transcripts.
        </p>
      </div>

      {/* Legend Toggles */}
      <div style={styles.legendContainer}>
        <button
          onClick={() => toggleLayer('calm')}
          style={{
            ...styles.legendBtn,
            backgroundColor: visibleLayers.calm ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
            border: visibleLayers.calm ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255,255,255,0.05)',
            color: visibleLayers.calm ? '#60a5fa' : '#64748b'
          }}
        >
          <span style={{ ...styles.legendIndicator, backgroundColor: '#3b82f6' }} />
          Calm / Focused
        </button>
        <button
          onClick={() => toggleLayer('excited')}
          style={{
            ...styles.legendBtn,
            backgroundColor: visibleLayers.excited ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255,255,255,0.02)',
            border: visibleLayers.excited ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid rgba(255,255,255,0.05)',
            color: visibleLayers.excited ? '#f59e0b' : '#64748b'
          }}
        >
          <span style={{ ...styles.legendIndicator, backgroundColor: '#eab308' }} />
          Excited / Motivated
        </button>
        <button
          onClick={() => toggleLayer('stressed')}
          style={{
            ...styles.legendBtn,
            backgroundColor: visibleLayers.stressed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.02)',
            border: visibleLayers.stressed ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255,255,255,0.05)',
            color: visibleLayers.stressed ? '#f87171' : '#64748b'
          }}
        >
          <span style={{ ...styles.legendIndicator, backgroundColor: '#ef4444' }} />
          Stress Trends
        </button>
      </div>

      {/* SVG Wellbeing Graph Container */}
      <div 
        style={styles.svgWrapper}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg viewBox={`0 0 ${width} ${height}`} style={styles.svg}>
          <defs>
            {/* Gradients */}
            <linearGradient id="calmGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="excitedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#eab308" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#eab308" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="stressedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
            </linearGradient>

            {/* Glow Filters */}
            <filter id="glowCalm" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#3b82f6" floodOpacity="0.65"/>
            </filter>
            <filter id="glowExcited" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#eab308" floodOpacity="0.65"/>
            </filter>
            <filter id="glowStressed" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ef4444" floodOpacity="0.65"/>
            </filter>
          </defs>

          {/* Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((val, idx) => {
            const y = height - paddingBottom - val * chartHeight;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + chartWidth}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.07)"
                  strokeDasharray="4,4"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  fill="rgba(255,255,255,0.4)"
                  fontSize="9px"
                  textAnchor="end"
                  fontFamily="sans-serif"
                >
                  {Math.round(val * 100)}%
                </text>
              </g>
            );
          })}

          {/* X Axis Labels */}
          {chartData.map((d, idx) => {
            const { x } = getCoords(idx, 0);
            // Draw every alternate day label to avoid crowding
            if (idx % 2 === 0 || idx === chartData.length - 1) {
              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={height - paddingBottom}
                    x2={x}
                    y2={height - paddingBottom + 5}
                    stroke="rgba(255, 255, 255, 0.15)"
                  />
                  <text
                    x={x}
                    y={height - paddingBottom + 18}
                    fill="rgba(255,255,255,0.5)"
                    fontSize="9px"
                    textAnchor="middle"
                    fontFamily="sans-serif"
                  >
                    {d.dateLabel}
                  </text>
                </g>
              );
            }
            return null;
          })}

          {/* Area & Line Plots */}
          {visibleLayers.calm && (
            <>
              <path d={calmPaths.area} fill="url(#calmGrad)" />
              <path d={calmPaths.line} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glowCalm)" />
            </>
          )}

          {visibleLayers.excited && (
            <>
              <path d={excitedPaths.area} fill="url(#excitedGrad)" />
              <path d={excitedPaths.line} fill="none" stroke="#eab308" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glowExcited)" />
            </>
          )}

          {visibleLayers.stressed && (
            <>
              <path d={stressedPaths.area} fill="url(#stressedGrad)" />
              <path d={stressedPaths.line} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glowStressed)" />
            </>
          )}

          {/* Vertical Guides on Hover */}
          {hoveredIndex !== null && (
            <line
              x1={getCoords(hoveredIndex, 0).x}
              y1={paddingTop}
              x2={getCoords(hoveredIndex, 0).x}
              y2={height - paddingBottom}
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          )}

          {/* Highlight Points on Hover */}
          {hoveredIndex !== null && (
            <>
              {visibleLayers.calm && (
                <circle
                  cx={getCoords(hoveredIndex, hoveredDay.calm).x}
                  cy={getCoords(hoveredIndex, hoveredDay.calm).y}
                  r="5"
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              )}
              {visibleLayers.excited && (
                <circle
                  cx={getCoords(hoveredIndex, hoveredDay.excited).x}
                  cy={getCoords(hoveredIndex, hoveredDay.excited).y}
                  r="5"
                  fill="#eab308"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              )}
              {visibleLayers.stressed && (
                <circle
                  cx={getCoords(hoveredIndex, hoveredDay.stressed).x}
                  cy={getCoords(hoveredIndex, hoveredDay.stressed).y}
                  r="5"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              )}
            </>
          )}
        </svg>

        {/* Custom Interactive Tooltip */}
        {hoveredDay && tooltipCoords && (
          <div
            style={{
              ...styles.tooltip,
              left: `${(tooltipCoords.x / width) * 100}%`,
              top: `${Math.max(10, (tooltipCoords.y / height) * 100 - 35)}%`,
              transform: hoveredIndex > 9 ? 'translate(-105%, -50%)' : 'translate(5%, -50%)'
            }}
          >
            <div style={styles.tooltipDate}>{hoveredDay.fullDateStr}</div>
            <div style={styles.tooltipMetrics}>
              {visibleLayers.calm && (
                <div style={styles.tooltipRow}>
                  <span style={{ ...styles.tooltipBullet, backgroundColor: '#3b82f6' }} />
                  <span>Calm: <strong>{Math.round(hoveredDay.calm * 100)}%</strong></span>
                </div>
              )}
              {visibleLayers.excited && (
                <div style={styles.tooltipRow}>
                  <span style={{ ...styles.tooltipBullet, backgroundColor: '#eab308' }} />
                  <span>Excited: <strong>{Math.round(hoveredDay.excited * 100)}%</strong></span>
                </div>
              )}
              {visibleLayers.stressed && (
                <div style={styles.tooltipRow}>
                  <span style={{ ...styles.tooltipBullet, backgroundColor: '#ef4444' }} />
                  <span>Stressed: <strong>{Math.round(hoveredDay.stressed * 100)}%</strong></span>
                </div>
              )}
            </div>
            {hoveredDay.hasData ? (
              <div style={styles.tooltipStatus}>
                Sentiment: <span style={styles.statusSpan}>{hoveredDay.rawMood}</span>
              </div>
            ) : (
              <div style={styles.tooltipNoData}>No active check-in (interpolated)</div>
            )}
          </div>
        )}
      </div>

      {/* Stress Alert Banner */}
      {stressAlert && (
        <div style={styles.alertCard}>
          <div style={styles.alertHeader}>
            <span style={styles.alertIcon}>⚠️</span>
            <strong style={styles.alertTitle}>Wellbeing Action Alert</strong>
          </div>
          <p style={styles.alertText}>
            ASTRA daily check-ins indicate a build-up of stress patterns over the last 3 days (likely linked to upcoming exams or deadlines). We recommend scheduling a gentle, encouraging chat with your child.
          </p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: 'rgba(30, 58, 95, 0.4)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '16px',
    padding: '16px',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
    backdropFilter: 'blur(12px)',
    width: '100%',
    boxSizing: 'border-box'
  },
  chartHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  headerInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px'
  },
  badge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#93c5fd',
    backgroundColor: 'rgba(147, 197, 253, 0.12)',
    padding: '2px 8px',
    borderRadius: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  privacyLock: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#34d399',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    padding: '2px 8px',
    borderRadius: '8px',
    border: '1px solid rgba(52, 211, 153, 0.15)'
  },
  infoText: {
    fontSize: '11px',
    color: '#94a3b8',
    margin: '4px 0 0 0',
    lineHeight: '1.4'
  },
  legendContainer: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '4px'
  },
  legendBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '600',
    borderRadius: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none'
  },
  legendIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block'
  },
  svgWrapper: {
    position: 'relative',
    width: '100%',
    overflow: 'visible',
    marginTop: '8px'
  },
  svg: {
    width: '100%',
    height: 'auto',
    overflow: 'visible'
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    padding: '8px 10px',
    zIndex: 50,
    boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
    pointerEvents: 'none',
    minWidth: '120px',
    transition: 'left 0.1s ease, top 0.1s ease'
  },
  tooltipDate: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#cbd5e1',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    paddingBottom: '4px',
    marginBottom: '4px'
  },
  tooltipMetrics: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  tooltipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '10px',
    color: '#94a3b8'
  },
  tooltipBullet: {
    width: '6px',
    height: '6px',
    borderRadius: '50%'
  },
  tooltipStatus: {
    fontSize: '9px',
    color: '#f8fafc',
    marginTop: '6px',
    paddingTop: '4px',
    borderTop: '1px dashed rgba(255,255,255,0.1)'
  },
  statusSpan: {
    fontWeight: '700',
    color: '#38bdf8',
    textTransform: 'capitalize'
  },
  tooltipNoData: {
    fontSize: '9px',
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: '4px'
  },
  alertCard: {
    marginTop: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: '12px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  alertHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#fca5a5',
    fontSize: '12px'
  },
  alertIcon: {
    fontSize: '14px'
  },
  alertTitle: {
    fontWeight: '700'
  },
  alertText: {
    fontSize: '11px',
    color: '#fca5a5',
    margin: 0,
    lineHeight: '1.4'
  }
};
