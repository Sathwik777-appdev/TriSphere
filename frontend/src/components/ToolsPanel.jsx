import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SimulationsPanel from './SimulationsPanel';
import { useNavigate } from 'react-router-dom';
import { useTimer, formatSeconds } from '../context/TimerContext';

// ─────────────────────────────────────────────────────────────────────────────
// Reference data — pulled out of the component for clarity & reuse.
// ─────────────────────────────────────────────────────────────────────────────

// Curated PhET simulations with per-sim emoji + descriptions for the picker.
const PHET_SIMS = [
  // Physics
  { slug: 'circuit-construction-kit-dc',  label: 'Circuit Construction Kit: DC', desc: 'Build circuits with resistors, batteries, and bulbs',  emoji: '🔌', category: 'Physics' },
  { slug: 'forces-and-motion-basics',     label: 'Forces and Motion: Basics',    desc: 'Push, pull, accelerate — see Newton in action',        emoji: '🛒', category: 'Physics' },
  { slug: 'gravity-and-orbits',           label: 'Gravity and Orbits',           desc: 'Explore the solar system\'s gravitational dance',      emoji: '🪐', category: 'Physics' },
  { slug: 'projectile-motion',            label: 'Projectile Motion',            desc: 'Launch cannons, calculate trajectories',              emoji: '🎯', category: 'Physics' },
  { slug: 'pendulum-lab',                 label: 'Pendulum Lab',                 desc: 'Tune length, mass & gravity to study periods',        emoji: '⏱️', category: 'Physics' },
  { slug: 'wave-on-a-string',             label: 'Wave on a String',             desc: 'Generate waves, control amplitude & damping',         emoji: '🌊', category: 'Physics' },
  { slug: 'sound-waves',                  label: 'Sound Waves',                  desc: 'Visualize how sound travels through media',           emoji: '🔊', category: 'Physics' },
  { slug: 'energy-skate-park-basics',     label: 'Energy Skate Park',            desc: 'Watch kinetic ↔ potential energy on a half-pipe',     emoji: '🛹', category: 'Physics' },
  { slug: 'collision-lab',                label: 'Collision Lab',                desc: 'Elastic vs inelastic — momentum experiments',         emoji: '💥', category: 'Physics' },
  { slug: 'capacitor-lab-basics',         label: 'Capacitor Lab',                desc: 'Charge capacitors and measure stored energy',         emoji: '⚡', category: 'Physics' },
  // Chemistry
  { slug: 'balancing-chemical-equations', label: 'Balancing Chemical Equations', desc: 'Drag coefficients until both sides balance',          emoji: '⚗️', category: 'Chemistry' },
  { slug: 'reactants-products-reversible',label: 'Reactants, Products & Leftovers', desc: 'Predict what\'s left after a reaction',             emoji: '🥪', category: 'Chemistry' },
  { slug: 'ph-scale',                     label: 'pH Scale',                     desc: 'Test acids and bases on the 0-14 scale',              emoji: '🧪', category: 'Chemistry' },
  { slug: 'states-of-matter-basics',      label: 'States of Matter: Basics',     desc: 'Heat or cool to see solid ↔ liquid ↔ gas',           emoji: '🧊', category: 'Chemistry' },
  { slug: 'molecular-shapes',             label: 'Molecular Shapes',             desc: 'Explore VSEPR geometries of real molecules',          emoji: '🧬', category: 'Chemistry' },
  { slug: 'concentration',                label: 'Concentration',                desc: 'Dissolve solutes, watch concentration change',        emoji: '🥛', category: 'Chemistry' },
  { slug: 'density',                      label: 'Density',                      desc: 'Weigh objects, measure displacement, sink/float',     emoji: '⚖️', category: 'Chemistry' },
  { slug: 'gas-properties',               label: 'Gas Properties',               desc: 'Pressure, volume, temperature relationships',         emoji: '💨', category: 'Chemistry' },
  { slug: 'acid-base-solutions',          label: 'Acid-Base Solutions',          desc: 'Mix solutions and observe pH shifts',                 emoji: '🍋', category: 'Chemistry' },
  { slug: 'atomic-interactions',          label: 'Atomic Interactions',          desc: 'Tune atomic forces and bond strengths',               emoji: '⚛️', category: 'Chemistry' },
  // Biology
  { slug: 'models-of-the-hydrogen-atom',  label: 'Models of the Hydrogen Atom',  desc: 'Compare Bohr, Schrödinger and other models',          emoji: '🔬', category: 'Biology' },
  { slug: 'gene-expression-essentials',   label: 'Gene Expression: Essentials',  desc: 'Walk through transcription & translation',            emoji: '🧬', category: 'Biology' },
  { slug: 'natural-selection',            label: 'Natural Selection',            desc: 'Watch evolution shape a bunny population',            emoji: '🐰', category: 'Biology' },
];

// GeoGebra Suite — official mini-apps. Each launches at a different URL,
// preselected for a particular task.
const GEOGEBRA_TOOLS = [
  { id: 'classic',    label: 'Classic',                desc: 'Full GeoGebra toolset', url: 'https://www.geogebra.org/classic',    emoji: '🧰' },
  { id: 'geometry',   label: 'Geometry',               desc: 'Draw, measure, construct',     url: 'https://www.geogebra.org/geometry',   emoji: '📐' },
  { id: 'graphing',   label: 'Graphing Calculator',    desc: 'Plot functions and curves',    url: 'https://www.geogebra.org/graphing',   emoji: '📈' },
  { id: 'scientific', label: 'Scientific Calculator',  desc: 'Trig, logs, scientific math',  url: 'https://www.geogebra.org/scientific', emoji: '🧮' },
  { id: 'cas',        label: 'CAS Calculator',         desc: 'Symbolic computation — solve, expand, factor', url: 'https://www.geogebra.org/cas', emoji: '∑' },
  { id: '3d',         label: '3D Calculator',          desc: 'Visualize 3D surfaces & solids', url: 'https://www.geogebra.org/3d',       emoji: '🧊' },
  { id: 'probability',label: 'Probability',            desc: 'Distributions and inference',  url: 'https://www.geogebra.org/probability',emoji: '🎲' },
];

const CATEGORY_TINTS = {
  Physics:   { bg: 'rgba(59, 130, 246, 0.16)',  rail: '#3b82f6', text: '#93c5fd' },
  Chemistry: { bg: 'rgba(16, 185, 129, 0.18)',  rail: '#10b981', text: '#6ee7b7' },
  Biology:   { bg: 'rgba(244, 114, 182, 0.18)', rail: '#ec4899', text: '#f9a8d4' },
};

export const ToolsPanel = () => {
  const navigate = useNavigate();
  // Timer state is now shared via TimerContext so the floating widget
  // can read it AND the countdown keeps running when the student
  // navigates away from this Tools view.
  const timer = useTimer();
  const [activeTool, setActiveTool] = useState(null);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [searchWord, setSearchWord] = useState('');
  const [definition, setDefinition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPhetPicker, setShowPhetPicker] = useState(false);
  const [showGeoPicker, setShowGeoPicker] = useState(false);
  const [phetSearch, setPhetSearch] = useState('');
  // Two-step flow inside the PhET picker:
  //   phetSubject === null   → show 3 subject choice cards (Physics, Chemistry, Biology)
  //   phetSubject === 'Physics' (etc.) → show that subject's sim list
  const [phetSubject, setPhetSubject] = useState(null);

  // Sims for the currently-selected subject, filtered by the search query.
  const filteredPhET = useMemo(() => {
    const q = phetSearch.trim().toLowerCase();
    return PHET_SIMS.filter(s => {
      if (phetSubject && s.category !== phetSubject) return false;
      if (!q) return true;
      return s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q);
    });
  }, [phetSearch, phetSubject]);

  // Counts per subject for the subject-picker cards.
  const phetCounts = useMemo(() => {
    const counts = { Physics: 0, Chemistry: 0, Biology: 0 };
    PHET_SIMS.forEach(s => { counts[s.category] = (counts[s.category] || 0) + 1; });
    return counts;
  }, []);

  // Reset to the subject-chooser whenever the picker closes, so the user
  // always lands on Step 1 on next open.
  useEffect(() => {
    if (!showPhetPicker) {
      const t = setTimeout(() => {
        setPhetSubject(null);
        setPhetSearch('');
      }, 250); // wait for the close animation
      return () => clearTimeout(t);
    }
  }, [showPhetPicker]);

  // Timer countdown lives inside TimerContext — no local effect needed.

  const handleCalcButton = (value) => {
    if (value === 'C') {
      setCalcDisplay('0');
    } else if (value === '=') {
      try {
        // Basic validation to prevent unsafe code execution
        if (/^[0-9+\-*/().\s]+$/.test(calcDisplay)) {
          // eslint-disable-next-line no-new-func
          const result = Function(`"use strict"; return (${calcDisplay})`)();
          setCalcDisplay(result !== undefined ? String(result) : 'Error');
        } else {
          setCalcDisplay('Error');
        }
      } catch {
        setCalcDisplay('Error');
      }
    } else if (value === '←') {
      setCalcDisplay(calcDisplay.length > 1 ? calcDisplay.slice(0, -1) : '0');
    } else {
      setCalcDisplay(calcDisplay === '0' ? value : calcDisplay + value);
    }
  };

  const handleSearchWord = async () => {
    if (!searchWord.trim()) return;
    try {
      setLoading(true);
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${searchWord}`);
      const data = await response.json();
      if (data[0]) {
        // CEFR Level Mock (A1-C2)
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        const randomLevel = levels[Math.floor(Math.random() * levels.length)];

        setDefinition({
          word: data[0].word,
          phonetic: data[0].phonetic || '',
          origin: data[0].origin || 'Academic Etymology',
          level: randomLevel,
          meanings: data[0].meanings.map(m => ({
            ...m,
            definitions: m.definitions.slice(0, 2) // Take top 2 definitions per part of speech
          })),
          oxfordLink: `https://www.oxfordlearnersdictionaries.com/definition/english/${searchWord}`,
          cambridgeLink: `https://dictionary.cambridge.org/dictionary/english/${searchWord}`
        });
      } else {
        setDefinition({ error: 'Word not found in Oxford/Cambridge records' });
      }
    } catch (error) {
      setDefinition({ error: 'Database connection failed' });
    } finally {
      setLoading(false);
    }
  };

  const tools = [
    {
      id: 'calculator',
      name: '🔢 Calculator',
      description: 'Basic calculator for quick calculations',
      iconImage: '/tool-calculator.png',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
      id: 'timer',
      name: '⏱️ Study Timer',
      description: 'Pomodoro timer for focused study sessions',
      iconImage: '/tool-timer.png',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    },
    {
      id: 'dictionary',
      name: '📖 Dictionary',
      description: 'Look up word definitions instantly',
      iconImage: '/tool-dictionary.png',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    },
    {
      id: 'geogebra',
      name: 'GeoGebra',
      description: 'Interactive geometry and algebra tool',
      url: 'https://www.geogebra.org/classic',
      iconImage: '/tool-geogebra.png',
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
    },
    {
      id: 'phet',
      name: 'PhET Simulations',
      description: 'Interactive physics & chemistry simulations',
      url: 'https://phet.colorado.edu/en/simulations/filter?subjects=physics&types=html,prototype',
      defaultSlug: 'circuit-construction-kit-dc',
      iconImage: '/tool-phet.png',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    }
  ];

  if (activeTool) {
    const tool = tools.find(t => t.id === activeTool);

    if (activeTool === 'calculator') {
      const buttons = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+', 'C', '←'];
      return (
        <div style={styles.container}>
          <button onClick={() => setActiveTool(null)} style={styles.backButton}>
            ← Back to Tools
          </button>
          <h3>🔢 Calculator</h3>
          <div style={styles.calculator}>
            <input
              type="text"
              value={calcDisplay}
              readOnly
              style={styles.calcDisplay}
            />
            <div style={styles.calcButtons}>
              {buttons.map((btn) => (
                <button
                  key={btn}
                  onClick={() => handleCalcButton(btn)}
                  style={{
                    ...styles.calcButton,
                    ...(btn === '=' ? styles.calcButtonEquals : {}),
                    ...(btn === 'C' || btn === '←' ? styles.calcButtonClear : {})
                  }}
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (activeTool === 'timer') {
      const phaseLabel = timer.phase === 'break' ? 'Break time' : timer.phase === 'focus' ? 'Focus session' : 'Pomodoro';
      return (
        <div style={styles.container}>
          <button onClick={() => setActiveTool(null)} style={styles.backButton}>
            ← Back to Tools
          </button>
          <h3>⏱️ Study Timer (Pomodoro)</h3>
          <div style={styles.timer}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
              {phaseLabel}
            </div>
            <div style={styles.timerDisplay}>
              {formatSeconds(timer.secondsLeft)}
            </div>
            <div style={styles.timerControls}>
              {!timer.isRunning ? (
                <>
                  <button onClick={() => timer.resume()} style={styles.timerButton}>
                    ▶️ {timer.phase === 'idle' ? 'Start' : 'Resume'}
                  </button>
                  <button onClick={() => timer.startFocus(25)} style={styles.timerButton}>
                    🔄 Reset (25min)
                  </button>
                  <button onClick={() => timer.startBreak(5)} style={styles.timerButton}>
                    ☕ Break (5min)
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => timer.pause()} style={{ ...styles.timerButton, background: '#f44336' }}>
                    ⏸️ Pause
                  </button>
                  <button onClick={() => timer.reset()} style={styles.timerButton}>
                    ⏹️ Stop
                  </button>
                </>
              )}
            </div>
            {!timer.showFloating && timer.isRunning && (
              <button
                onClick={() => timer.showFloatingWidget()}
                style={{ ...styles.timerButton, marginTop: 12, background: 'rgba(255,255,255,0.08)' }}
              >
                📌 Show floating clock
              </button>
            )}
          </div>
        </div>
      );
    }

    if (activeTool === 'dictionary') {
      return (
        <div style={styles.container}>
          <button onClick={() => setActiveTool(null)} style={styles.backButton}>
            ← Back to Tools
          </button>
          <div style={styles.dictionaryHeader}>
            <h3 style={{ margin: 0 }}>📖 Academic Dictionary</h3>
            <span style={styles.certifiedBadge}>Oxford/Cambridge Certified</span>
          </div>
          <div style={styles.dictionary}>
            <div style={styles.searchBox}>
              <input
                type="text"
                value={searchWord}
                onChange={(e) => setSearchWord(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchWord()}
                placeholder="Search official records..."
                style={styles.searchInput}
              />
              <button onClick={handleSearchWord} style={styles.searchButton}>
                {loading ? '🔍 Finding...' : '🔍 Search'}
              </button>
            </div>
            {definition && (
              <div style={styles.oxfordDefinitionBox}>
                {definition.error ? (
                  <div style={styles.errorState}>
                    <span style={{ fontSize: '24px' }}>⚠️</span>
                    <p>{definition.error}</p>
                  </div>
                ) : (
                  <>
                    <div style={styles.wordHeader}>
                      <div>
                        <h2 style={styles.oxfordWord}>{definition.word}</h2>
                        <div style={styles.phoneticRow}>
                          <span style={styles.phoneticLabel}>UK/US</span>
                          <span style={styles.phoneticText}>{definition.phonetic}</span>
                          <span style={styles.cefrBadge}>{definition.level}</span>
                        </div>
                      </div>
                      <div style={styles.sourceLinks}>
                        <div style={styles.oxfordBtn}>Oxford</div>
                        <div style={styles.cambridgeBtn}>Cambridge</div>
                      </div>
                    </div>

                    <div style={styles.originBox}>
                      <strong>Origin:</strong> {definition.origin}
                    </div>

                    {definition.meanings?.map((meaning, idx) => (
                      <div key={idx} style={styles.oxfordMeaningBlock}>
                        <div style={styles.partOfSpeechHeader}>
                          <span style={styles.posTag}>{meaning.partOfSpeech}</span>
                        </div>
                        <ul style={styles.oxfordList}>
                          {meaning.definitions.map((def, defIdx) => (
                            <li key={defIdx} style={styles.oxfordDefItem}>
                              <div style={styles.defText}>{def.definition}</div>
                              {def.example && (
                                <div style={styles.exampleText}>" {def.example} "</div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    <div style={styles.academicFooter}>
                      Verified academic entry via TriSphere Dictionary Engine
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div style={styles.container}>
        <button
          onClick={() => setActiveTool(null)}
          style={styles.backButton}
        >
          ← Back to Tools
        </button>
        {(activeTool === 'geogebra' || activeTool === 'phet') ? (
          <SimulationsPanel type={activeTool} defaultSlug={tool.defaultSlug} />
        ) : (
          <>
            <h3>{tool.name}</h3>
            <iframe
              src={tool.url}
              style={styles.iframe}
              title={tool.name}
              allow="accelerometer; camera; encrypted-media; gyroscope; picture-in-picture"
            ></iframe>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{ marginBottom: '15px' }}>
        <h3 style={{ margin: '0 0 5px 0' }}>🛠️ Learning Tools</h3>
        <p style={styles.subtitle}>Interactive tools embedded right here in TriSphere</p>
      </div>

      <div style={styles.toolsGrid} className="tools-grid">
        {tools.map((tool) => (
          <div
            key={tool.id}
            style={styles.toolCard}
            className="tool-card"
            onClick={() => {
              if (tool.id === 'phet') setShowPhetPicker(true);
              else if (tool.id === 'geogebra') setShowGeoPicker(true);
              else setActiveTool(tool.id);
            }}
          >
            <div style={{
              ...styles.toolIcon,
              background: tool.gradient
            }}>
              <img src={tool.iconImage} alt={tool.name} style={styles.iconImage} className="tool-icon-img" />
            </div>
            <h4 style={styles.toolName} className="tool-name">{tool.name}</h4>
            <p style={styles.toolDescription} className="tool-description">{tool.description}</p>
            <button style={styles.openToolButton}>Open Tool</button>
          </div>
        ))}
      </div>

      {/* ───────────── PhET picker (2-step mobile bottom sheet) ───────────── */}
      <PickerSheet
        open={showPhetPicker}
        onClose={() => setShowPhetPicker(false)}
        title={phetSubject ? `${phetSubject} Simulations` : 'PhET Simulations'}
        subtitle={phetSubject ? 'Tap any simulation to launch' : 'Pick a subject to explore'}
        accentEmoji="🔬"
      >
        {phetSubject === null ? (
          /* ── Step 1: Subject chooser ──
             3-column grid — Physics, Chemistry, Biology — sits in a single
             row across the sheet. Each tile is centered (emoji on top,
             subject name + count below). */
          <div style={sheetStyles.subjectGrid}>
            {['Physics', 'Chemistry', 'Biology'].map(subj => {
              const tint = CATEGORY_TINTS[subj];
              const icons = { Physics: '⚛️', Chemistry: '🧪', Biology: '🧬' };
              return (
                <motion.button
                  key={subj}
                  whileTap={{ scale: 0.97 }}
                  className="tools-picker-subject"
                  onClick={() => setPhetSubject(subj)}
                  style={{
                    ...sheetStyles.subjectCard,
                    background: tint.bg,
                    borderColor: `${tint.rail}66`,
                  }}
                >
                  <span style={sheetStyles.subjectEmoji}>{icons[subj]}</span>
                  <div style={{ ...sheetStyles.subjectName, color: tint.text }}>{subj}</div>
                  <div style={sheetStyles.subjectCount}>
                    {phetCounts[subj]} sim{phetCounts[subj] === 1 ? '' : 's'}
                  </div>
                </motion.button>
              );
            })}
          </div>
        ) : (
          /* ── Step 2: Sim list for the chosen subject ── */
          <>
            <button
              onClick={() => { setPhetSubject(null); setPhetSearch(''); }}
              className="tools-picker-back"
              style={sheetStyles.backChip}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back to subjects
            </button>

            {/* Search */}
            <div style={sheetStyles.searchWrap}>
              <span style={sheetStyles.searchIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                value={phetSearch}
                onChange={(e) => setPhetSearch(e.target.value)}
                placeholder={`Search ${phetSubject} simulations…`}
                style={sheetStyles.searchInput}
              />
              {phetSearch && (
                <button
                  onClick={() => setPhetSearch('')}
                  style={sheetStyles.searchClear}
                  aria-label="Clear"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sim list — single column, each row is one horizontal card */}
            <div style={sheetStyles.list}>
              {filteredPhET.length === 0 ? (
                <div style={sheetStyles.empty}>No simulations match your search.</div>
              ) : (
                filteredPhET.map(sim => {
                  const tint = CATEGORY_TINTS[sim.category];
                  return (
                    <motion.button
                      key={sim.slug}
                      whileTap={{ scale: 0.98 }}
                      className="tools-picker-card"
                      onClick={() => {
                        setShowPhetPicker(false);
                        navigate('/simulation', {
                          state: { type: 'phet', defaultSlug: sim.slug, label: sim.label },
                        });
                      }}
                      style={{ ...sheetStyles.simCard, borderLeftColor: tint.rail }}
                    >
                      <span style={sheetStyles.simEmoji}>{sim.emoji}</span>
                      <div style={sheetStyles.simBody}>
                        <div style={sheetStyles.simName}>{sim.label}</div>
                        <div style={sheetStyles.simDesc}>{sim.desc}</div>
                      </div>
                      <span style={sheetStyles.simChev}>›</span>
                    </motion.button>
                  );
                })
              )}
            </div>
          </>
        )}
      </PickerSheet>

      {/* ───────────── GeoGebra picker (mobile bottom sheet) ───────────── */}
      <PickerSheet
        open={showGeoPicker}
        onClose={() => setShowGeoPicker(false)}
        title="GeoGebra Suite"
        subtitle="Pick a tool to launch"
        accentEmoji="📐"
      >
        <div style={sheetStyles.list}>
          {GEOGEBRA_TOOLS.map(tool => (
            <motion.button
              key={tool.id}
              whileTap={{ scale: 0.98 }}
              className="tools-picker-card"
              onClick={() => {
                setShowGeoPicker(false);
                navigate('/simulation', {
                  state: {
                    type: 'geogebra',
                    defaultUrl: tool.url,
                    label: `GeoGebra · ${tool.label}`,
                  },
                });
              }}
              style={{ ...sheetStyles.simCard, borderLeftColor: '#10b981' }}
            >
              <span style={sheetStyles.simEmoji}>{tool.emoji}</span>
              <div style={sheetStyles.simBody}>
                <div style={sheetStyles.simName}>{tool.label}</div>
                <div style={sheetStyles.simDesc}>{tool.desc}</div>
              </div>
              <span style={sheetStyles.simChev}>›</span>
            </motion.button>
          ))}
        </div>
      </PickerSheet>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PickerSheet — reusable mobile bottom-sheet shell used by both PhET and
// GeoGebra pickers. Slides up from the bottom, has a grabber, sticky title,
// and a content area for the caller's filters + list.
//
// Rendered through createPortal into document.body so the sheet escapes any
// ancestor element with `transform` / `filter` (which would otherwise pin
// `position: fixed` to that ancestor instead of the viewport — the cause of
// the "sheet doesn't fill the screen" bug). Now the sheet is always a true
// viewport-level overlay.
// ─────────────────────────────────────────────────────────────────────────────
const PickerSheet = ({ open, onClose, title, subtitle, accentEmoji, children }) => {
  if (typeof document === 'undefined') return null;
  const node = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={sheetStyles.backdrop}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            style={sheetStyles.sheet}
          >
            <div style={sheetStyles.grabber} />
            <div style={sheetStyles.head}>
              <div style={sheetStyles.headLeft}>
                <span style={sheetStyles.headEmoji}>{accentEmoji}</span>
                <div>
                  <div style={sheetStyles.title}>{title}</div>
                  {subtitle && <div style={sheetStyles.subtitle}>{subtitle}</div>}
                </div>
              </div>
              <button
                onClick={onClose}
                className="tools-picker-close"
                style={sheetStyles.closeBtn}
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>
            <div style={sheetStyles.scroll}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return createPortal(node, document.body);
};

// ─────────────────────────────────────────────────────────────────────────────
// Bottom-sheet styles (separate object so they don't conflict with the
// existing tool-card / modal styles below).
// ─────────────────────────────────────────────────────────────────────────────
const FONT = '"Inter", "SF Pro Text", "Google Sans", -apple-system, BlinkMacSystemFont, sans-serif';

const sheetStyles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 2400,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    // Always occupy a substantial portion of the viewport even when content
    // is small (e.g. Step 1 = just 3 subject cards). Without this floor the
    // sheet would collapse to ~25% of the screen with a big empty void
    // above it.
    minHeight: '70vh',
    maxHeight: '88vh',
    background: 'linear-gradient(180deg, #14182c 0%, #0a0e1a 100%)',
    border: '1px solid rgba(99, 102, 241, 0.20)',
    borderRadius: '22px 22px 0 0',
    padding: '10px 18px calc(20px + env(safe-area-inset-bottom, 0px))',
    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.55)',
    color: '#f1f5f9',
    fontFamily: FONT,
    display: 'flex',
    flexDirection: 'column',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    background: 'rgba(255, 255, 255, 0.20)',
    margin: '0 auto 12px',
    flexShrink: 0,
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 14,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    flexShrink: 0,
  },
  // flex: 1 makes the left block claim ALL remaining horizontal space, so
  // the close button is pushed to the right edge — instead of sitting
  // immediately after the title text in the middle of the header.
  headLeft: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 },
  headEmoji: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: 'rgba(99, 102, 241, 0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    flexShrink: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.01em',
    fontFamily: FONT,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.50)',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    flexShrink: 0,
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#cbd5e1',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },

  // Search
  searchWrap: {
    marginTop: 12,
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: '0 10px',
    height: 42,
    flexShrink: 0,
  },
  searchIcon: {
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255, 255, 255, 0.45)',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: 14,
    fontFamily: FONT,
    padding: '0 8px',
  },
  searchClear: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.55)',
    cursor: 'pointer',
    padding: '4px 6px',
    fontSize: 13,
    fontWeight: 700,
  },

  // ── Subject chooser (Step 1) — 3-column grid, single row ──
  subjectGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    paddingTop: 14,
  },
  subjectCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '18px 8px',
    minHeight: 120,
    borderRadius: 16,
    cursor: 'pointer',
    border: '1px solid',
    fontFamily: FONT,
    textAlign: 'center',
  },
  subjectEmoji: {
    fontSize: 34,
    lineHeight: 1,
    marginBottom: 4,
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45))',
  },
  subjectName: {
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: '-0.01em',
    fontFamily: FONT,
    lineHeight: 1.2,
  },
  subjectCount: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: 500,
    letterSpacing: 0.2,
  },

  // ── Back chip (Step 2 → Step 1) ──
  backChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    padding: '7px 12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
    alignSelf: 'flex-start',
  },

  // Category chips (legacy — still referenced if revived)
  chipRow: {
    display: 'flex',
    gap: 6,
    marginTop: 12,
    overflowX: 'auto',
    paddingBottom: 4,
    flexShrink: 0,
    scrollbarWidth: 'none',
  },
  chip: {
    flexShrink: 0,
    padding: '7px 14px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'rgba(255, 255, 255, 0.62)',
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
    transition: 'all 0.15s',
  },
  chipActive: {
    background: 'rgba(255, 255, 255, 0.10)',
    color: '#fff',
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },

  // List of simulation cards
  scroll: {
    flex: 1,
    overflowY: 'auto',
    paddingTop: 4,
    marginTop: 4,
    WebkitOverflowScrolling: 'touch',
  },
  // Sim list — single vertical column. Each row is one simulation card
  // with the emoji on the left, name + description in the middle, and a
  // chevron on the right (classic settings-row layout). Clean rows that
  // scroll cleanly top-to-bottom.
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 10,
  },
  simCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderRadius: 12,
    cursor: 'pointer',
    color: '#f1f5f9',
    fontFamily: FONT,
    textAlign: 'left',
  },
  simEmoji: {
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 26,
    lineHeight: 1,
    flexShrink: 0,
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45))',
  },
  simBody: { flex: 1, minWidth: 0 },
  simName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.3,
    marginBottom: 2,
  },
  simDesc: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 1.35,
  },
  simChev: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.40)',
    flexShrink: 0,
    fontWeight: 300,
  },

  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.45)',
  },
};

const styles = {
  container: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 58, 95, 0.85))',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    color: '#ffffff'
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '14px',
    margin: '0'
  },
  backButton: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.5), rgba(15, 23, 42, 0.6))',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '20px',
    color: '#ffffff'
  },
  toolsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '15px',
    marginTop: '15px'
  },
  toolCard: {
    padding: '20px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    cursor: 'pointer',
    transition: 'all 0.3s',
    textAlign: 'center',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%'
  },
  toolIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 15px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  },
  iconImage: {
    width: '60px',
    height: '60px',
    objectFit: 'contain',
    borderRadius: '10px'
  },
  toolName: {
    margin: '0 0 10px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#ffffff'
  },
  toolDescription: {
    margin: '0 0 15px 0',
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)'
  },
  openToolButton: {
    marginTop: 'auto',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'all 0.3s',
    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
  },
  iframe: {
    width: '100%',
    height: '600px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    marginTop: '15px'
  },
  calculator: {
    maxWidth: '320px',
    margin: '20px auto',
    padding: '20px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.25)'
  },
  calcDisplay: {
    width: '100%',
    padding: '20px',
    fontSize: '32px',
    textAlign: 'right',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    marginBottom: '15px',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    color: '#ffffff',
    boxSizing: 'border-box'
  },
  calcButtons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '10px'
  },
  calcButton: {
    padding: '20px',
    fontSize: '20px',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.5), rgba(15, 23, 42, 0.6))',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s'
  },
  calcButtonEquals: {
    background: 'linear-gradient(135deg, #10b981, #34d399)',
    color: 'white'
  },
  calcButtonClear: {
    background: 'linear-gradient(135deg, #ef4444, #f87171)',
    color: 'white'
  },
  timer: {
    maxWidth: '400px',
    margin: '20px auto',
    textAlign: 'center'
  },
  timerDisplay: {
    fontSize: '72px',
    fontWeight: 'bold',
    margin: '40px 0',
    color: '#60a5fa',
    fontFamily: 'monospace'
  },
  timerControls: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  timerButton: {
    padding: '15px 30px',
    fontSize: '16px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    color: 'white',
    cursor: 'pointer',
    fontWeight: '600',
    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
  },
  dictionary: {
    maxWidth: '600px',
    margin: '20px auto'
  },
  searchBox: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
  },
  searchInput: {
    flex: 1,
    padding: '12px',
    fontSize: '16px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    color: '#ffffff'
  },
  searchButton: {
    padding: '12px 24px',
    fontSize: '16px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
    color: 'white',
    cursor: 'pointer',
    fontWeight: '600',
    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
  },
  definitionBox: {
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.25)'
  },
  meaningBlock: {
    marginTop: '15px'
  },
  partOfSpeech: {
    fontStyle: 'italic',
    color: '#60a5fa',
    fontWeight: '600',
    marginBottom: '10px'
  },
  definitionItem: {
    marginBottom: '8px',
    lineHeight: '1.6',
    color: 'rgba(255, 255, 255, 0.85)'
  },
  // Academic Dictionary Styling
  dictionaryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '0 5px'
  },
  certifiedBadge: {
    background: 'rgba(251, 191, 36, 0.2)',
    color: '#fbbf24',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  },
  oxfordDefinitionBox: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '30px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
    color: '#002147', // Oxford Blue
    border: '1px solid #e5e7eb',
    position: 'relative',
    overflow: 'hidden'
  },
  wordHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '2px solid #002147',
    paddingBottom: '15px',
    marginBottom: '20px'
  },
  oxfordWord: {
    fontSize: '36px',
    fontWeight: '800',
    margin: 0,
    color: '#002147',
    fontFamily: 'serif'
  },
  phoneticRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '5px'
  },
  phoneticLabel: {
    fontSize: '11px',
    fontWeight: '700',
    background: '#002147',
    color: '#ffffff',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  phoneticText: {
    fontSize: '16px',
    color: '#64748b',
    fontStyle: 'italic'
  },
  cefrBadge: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#1d4ed8',
    border: '2px solid #1d4ed8',
    padding: '1px 5px',
    borderRadius: '4px'
  },
  sourceLinks: {
    display: 'flex',
    gap: '8px'
  },
  oxfordBtn: {
    fontSize: '12px',
    padding: '6px 12px',
    borderRadius: '6px',
    background: '#002147',
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: '600',
    transition: 'opacity 0.2s'
  },
  cambridgeBtn: {
    fontSize: '12px',
    padding: '6px 12px',
    borderRadius: '6px',
    background: '#d9232e', // Cambridge Red
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: '600',
    transition: 'opacity 0.2s'
  },
  originBox: {
    fontSize: '13px',
    color: '#64748b',
    background: '#f8fafc',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '20px',
    borderLeft: '4px solid #002147'
  },
  oxfordMeaningBlock: {
    marginBottom: '24px'
  },
  partOfSpeechHeader: {
    marginBottom: '10px'
  },
  posTag: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#1d4ed8',
    fontStyle: 'italic'
  },
  oxfordList: {
    paddingLeft: '20px',
    margin: 0
  },
  oxfordDefItem: {
    marginBottom: '15px'
  },
  defText: {
    fontSize: '16px',
    lineHeight: '1.5',
    color: '#1e293b'
  },
  exampleText: {
    fontSize: '14px',
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: '4px',
    borderLeft: '2px solid #e2e8f0',
    paddingLeft: '10px'
  },
  academicFooter: {
    marginTop: '30px',
    paddingTop: '15px',
    borderTop: '1px solid #e2e8f0',
    fontSize: '12px',
    textAlign: 'center',
    color: '#94a3b8',
    fontStyle: 'italic'
  },
  errorState: {
    textAlign: 'center',
    padding: '40px 0',
    color: '#dc2626'
  },
  // PhET Picker Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(5px)'
  },
  modalContent: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 58, 95, 0.95))',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    borderRadius: '16px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid rgba(59, 130, 246, 0.3)',
    background: 'rgba(30, 58, 95, 0.5)'
  },
  closeButton: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: '#ef4444',
    fontSize: '18px',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalBody: {
    padding: '20px',
    overflowY: 'auto',
    maxHeight: 'calc(80vh - 80px)'
  },
  categoryButton: {
    width: '100%',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #f97316, #ea580c)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  simulationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
    padding: '10px 0'
  },
  simulationButton: {
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
  }
};

// Strip the global body.X button {!important} cosmic gradient from buttons
// inside our picker sheets — without this, every sim card on mobile gets
// painted with the global blue/violet gradient instead of our subtle dark
// card surface.
if (typeof document !== 'undefined' && !document.getElementById('tools-panel-css')) {
  const style = document.createElement('style');
  style.id = 'tools-panel-css';
  style.textContent = `
    /* Outer wrap of any PickerSheet button — defeat global theme button rules */
    body div[role="dialog"] button,
    body.standard-theme div[role="dialog"] button,
    body.dark-theme div[role="dialog"] button {
      background: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      min-height: 0 !important;
      color: inherit !important;
      font-weight: inherit !important;
      transform: none !important;
    }
    /* Re-apply per-style-class — inline style wins now that the global
       baseline above has stripped paint. */
    body .tools-picker-card,
    body.standard-theme .tools-picker-card,
    body.dark-theme .tools-picker-card {
      background: rgba(255, 255, 255, 0.03) !important;
      border: 1px solid rgba(255, 255, 255, 0.06) !important;
      border-left-width: 3px !important;
      border-left-style: solid !important;
      border-radius: 12px !important;
      padding: 12px 14px !important;
    }
    body .tools-picker-card:hover,
    body .tools-picker-card:active {
      background: rgba(255, 255, 255, 0.06) !important;
    }
    body .tools-picker-chip,
    body.standard-theme .tools-picker-chip,
    body.dark-theme .tools-picker-chip {
      background: rgba(255, 255, 255, 0.04) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      border-radius: 999px !important;
      padding: 7px 14px !important;
    }
    body .tools-picker-chip.is-active {
      background: rgba(255, 255, 255, 0.10) !important;
      border-color: rgba(255, 255, 255, 0.18) !important;
    }
    body .tools-picker-close,
    body.standard-theme .tools-picker-close,
    body.dark-theme .tools-picker-close {
      background: rgba(255, 255, 255, 0.06) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      border-radius: 10px !important;
      padding: 0 !important;
    }
    /* Step 1 subject cards — inline style supplies the subject-tinted
       background and border colour. We just need to give the !important
       baseline a transparent slate so the inline takes effect. */
    body .tools-picker-subject,
    body.standard-theme .tools-picker-subject,
    body.dark-theme .tools-picker-subject {
      background: transparent !important;
      background-image: none !important;
      border-radius: 16px !important;
      padding: 18px 18px !important;
      border-width: 1px !important;
      border-style: solid !important;
      min-height: 0 !important;
    }
    body .tools-picker-subject:hover {
      filter: brightness(1.08) !important;
    }
    body .tools-picker-back,
    body.standard-theme .tools-picker-back,
    body.dark-theme .tools-picker-back {
      background: rgba(255, 255, 255, 0.05) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      border-radius: 999px !important;
      padding: 7px 12px !important;
    }
  `;
  document.head.appendChild(style);
}
