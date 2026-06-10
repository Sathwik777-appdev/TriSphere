import React, { useState, useEffect, useRef } from 'react';
import { getTextbooks } from '../services/firestoreService';

const extractGeoGebraId = (input) => {
  if (!input) return '';
  // If it's a full URL, try to extract the material id
  const m = input.match(/geogebra\.org\/(material|classic)\/(?:id\/)?([A-Za-z0-9_-]{6,})/i);
  if (m && m[2]) return m[2];
  // If user pasted just the id
  const simple = input.match(/^([A-Za-z0-9_-]{6,})$/);
  return simple ? simple[1] : '';
};

export default function SimulationsPanel({ type = 'geogebra', defaultSlug = '', defaultUrl = '', isFullscreen = false }) {
  const [geoInput, setGeoInput] = useState('');
  const [phetInput, setPhetInput] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [height, setHeight] = useState(600);
  const [embedAllowed, setEmbedAllowed] = useState(null); // null = unknown, true = ok, false = blocked
  const [loadingEmbed, setLoadingEmbed] = useState(false);
  const iframeRef = useRef(null);
  const [textbooks, setTextbooks] = useState([]);
  const [selectedChapters, setSelectedChapters] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({ Physics: true, Chemistry: true, Biology: true });

  useEffect(() => {
    // Caller-provided URL (e.g. "open Graphing Calculator" or a deep-linked
    // PhET sim) wins over the default landing URL.
    if (defaultUrl) {
      setEmbedUrl(defaultUrl);
      setLoadingEmbed(true);
      setEmbedAllowed(null);
      return;
    }
    if (type === 'geogebra') {
      setEmbedUrl('https://www.geogebra.org/classic');
    } else if (type === 'phet') {
      setEmbedUrl('https://phet.colorado.edu/en/simulations');
    }
  }, [type, defaultUrl]);

  const loadGeo = () => {
    const id = extractGeoGebraId(geoInput.trim());
    if (!id) {
      if (geoInput.trim().startsWith('http')) {
        setEmbedUrl(geoInput.trim());
        return;
      }
      alert('Please enter a GeoGebra material ID or URL (e.g. mXyAbC1)');
      return;
    }

    // For mobile, we want GeoGebra to be responsive
    const isMobile = false;
    const vWidth = document.documentElement.clientWidth;
    const vHeight = document.documentElement.clientHeight;

    const geoWidth = 900;
    const geoHeight = height;

    // Using a more robust embed URL with scale parameters
    const src = `https://www.geogebra.org/material/iframe/id/${id}/width/${geoWidth}/height/${geoHeight}/border/none/rc/false/ai/true/sdz/true/sfsb/true/smb/false/stb/true/stbh/false/ld/false/sri/true/allowUpscale/true`;
    setEmbedUrl(src);
    setEmbedAllowed(null);
    setLoadingEmbed(true);
  };

  const loadPhet = (input) => {
    const v = (typeof input === 'string' ? input : phetInput).trim();
    if (!v) {
      alert('Enter a full PhET simulation URL or a simulation slug (e.g. circuit-construction-kit-dc)');
      return;
    }
    if (v.startsWith('http')) {
      setEmbedUrl(v);
      setEmbedAllowed(null);
      setLoadingEmbed(true);
      return;
    }
    // assume user entered slug
    const slug = v;
    const src = `https://phet.colorado.edu/sims/html/${slug}/latest/${slug}_en.html`;
    setEmbedUrl(src);
    setEmbedAllowed(null);
    setLoadingEmbed(true);
  };

  const slugify = (s) => s ? s.toString().toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') : '';

  const computePhetSrc = (slug) => {
    const s = slugify(slug);
    return `https://phet.colorado.edu/sims/html/${s}/latest/${s}_en.html`;
  };

  // load available chapters (textbooks) so teacher can open them in PhET
  useEffect(() => {
    if (type === 'phet') {
      (async () => {
        try {
          const list = await getTextbooks();
          setTextbooks(list || []);
          // default-select all
          const sel = {};
          (list || []).forEach(t => { sel[t.id || t.chapterName] = true; });
          setSelectedChapters(sel);
        } catch (e) {
          setTextbooks([]);
        }
      })();
    }
  }, [type]);

  const toggleChapter = (key) => {
    setSelectedChapters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // comprehensive curated list of PhET simulations for Chemistry, Physics, and Biology
  const recommendedPhET = [
    // Physics simulations
    { slug: 'circuit-construction-kit-dc', label: 'Circuit Construction Kit: DC', category: 'Physics' },
    { slug: 'forces-and-motion-basics', label: 'Forces and Motion: Basics', category: 'Physics' },
    { slug: 'gravity-and-orbits', label: 'Gravity and Orbits', category: 'Physics' },
    { slug: 'projectile-motion', label: 'Projectile Motion', category: 'Physics' },
    { slug: 'pendulum-lab', label: 'Pendulum Lab', category: 'Physics' },
    { slug: 'wave-on-a-string', label: 'Wave on a String', category: 'Physics' },
    { slug: 'sound-waves', label: 'Sound Waves', category: 'Physics' },
    { slug: 'energy-skate-park-basics', label: 'Energy Skate Park', category: 'Physics' },
    { slug: 'collision-lab', label: 'Collision Lab', category: 'Physics' },
    { slug: 'capacitor-lab-basics', label: 'Capacitor Lab', category: 'Physics' },
    // Chemistry simulations
    { slug: 'balancing-chemical-equations', label: 'Balancing Chemical Equations', category: 'Chemistry' },
    { slug: 'reactants-products-reversible', label: 'Reactants, Products and Leftovers', category: 'Chemistry' },
    { slug: 'ph-scale', label: 'pH Scale', category: 'Chemistry' },
    { slug: 'states-of-matter-basics', label: 'States of Matter: Basics', category: 'Chemistry' },
    { slug: 'molecular-shapes', label: 'Molecular Shapes', category: 'Chemistry' },
    { slug: 'concentration', label: 'Concentration', category: 'Chemistry' },
    { slug: 'density', label: 'Density', category: 'Chemistry' },
    { slug: 'gas-properties', label: 'Gas Properties', category: 'Chemistry' },
    { slug: 'acid-base-solutions', label: 'Acid-Base Solutions', category: 'Chemistry' },
    { slug: 'atomic-interactions', label: 'Atomic Interactions', category: 'Chemistry' },
    // Biology simulations
    { slug: 'models-of-the-hydrogen-atom', label: 'Models of the Hydrogen Atom', category: 'Biology' },
    { slug: 'gene-expression-essentials', label: 'Gene Expression: Essentials', category: 'Biology' },
    { slug: 'enzyme-kinetics', label: 'Enzyme Kinetics', category: 'Biology' },
    { slug: 'photosynthesis-lab', label: 'Photosynthesis Lab', category: 'Biology' },
    { slug: 'natural-selection', label: 'Natural Selection', category: 'Biology' },
    { slug: 'genetics-lab', label: 'Genetics Lab (Pea Plants)', category: 'Biology' },
  ];

  // auto-load default slug for PhET when opening from ToolsPanel
  useEffect(() => {
    if (type === 'phet' && defaultSlug) {
      // set the input and attempt to load immediately
      setPhetInput(defaultSlug);
      // slight delay to ensure state updates and to trigger loading
      const t = setTimeout(() => loadPhet(defaultSlug), 50);
      return () => clearTimeout(t);
    }
  }, [type, defaultSlug]);

  return (
    <div style={isFullscreen ? styles.fullscreenContainer : styles.container}>
      {!isFullscreen && <h3 style={{ marginTop: 0 }}>{type === 'geogebra' ? 'GeoGebra' : 'PhET'} Simulations</h3>}

      {type === 'geogebra' ? (
        !isFullscreen && (
          <div style={styles.formRow}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>GeoGebra material ID or URL</label>
              <input
                placeholder="Enter material id (e.g. mXyAbC1) or full URL"
                value={geoInput}
                onChange={(e) => setGeoInput(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={{ width: 140, marginLeft: 12 }}>
              <label style={styles.label}>Height</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value) || 600)}
                style={{ ...styles.input, width: '100%' }}
              />
            </div>
            <div style={{ marginLeft: 12, display: 'flex', alignItems: 'flex-end' }}>
              <button style={styles.button} onClick={loadGeo}>Load GeoGebra</button>
            </div>
          </div>
        )
      ) : (
        // PhET section - only show picker when not fullscreen
        !isFullscreen && (
          <div>
            <div style={styles.formRow}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>PhET simulation slug or full URL</label>
                <input
                  placeholder="Enter slug (e.g. circuit-construction-kit-dc) or full URL"
                  value={phetInput}
                  onChange={(e) => setPhetInput(e.target.value)}
                  style={styles.input}
                />
                <small style={{ color: '#666' }}>If you paste a full URL it will be used directly.</small>
              </div>
              <div style={{ marginLeft: 12, display: 'flex', alignItems: 'flex-end' }}>
                <button style={styles.button} onClick={() => loadPhet()}>Load PhET</button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4 style={{ margin: '8px 0' }}>Quick Picks</h4>
              {['Physics', 'Chemistry', 'Biology'].map(cat => {
                const catSims = recommendedPhET.filter(r => r.category === cat);
                const isExpanded = expandedCategories[cat];
                return (
                  <div key={cat} style={{ marginBottom: 12 }}>
                    <button
                      onClick={() => setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))}
                      style={{ ...styles.button, backgroundColor: '#f97316', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      {cat} ({catSims.length})
                      <span>{isExpanded ? '▼' : '▶'}</span>
                    </button>
                    {isExpanded && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 8 }}>
                        {catSims.map(r => (
                          <button key={r.slug} style={{ ...styles.button, padding: '6px 10px', fontSize: 13 }} onClick={() => { setPhetInput(r.slug); loadPhet(r.slug); }}>{r.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      <div style={isFullscreen ? { height: '100%', display: 'flex', flexDirection: 'column' } : { marginTop: 16 }}>
        {!isFullscreen && <div style={styles.note}>Embedded preview (if the simulation allows embedding):</div>}
        <div style={isFullscreen ? { flex: 1, display: 'flex' } : { marginTop: 8 }}>
          {embedUrl ? (
            <>
              {/* Mobile landscape wrapper - Disabled rotation logic if in separate page for now to avoid confusion, but class remains for CSS base */}
              <div className={isFullscreen ? "" : "simulation-landscape-container"} style={isFullscreen ? { flex: 1, display: 'flex' } : {}}>
                <iframe
                  ref={iframeRef}
                  src={embedUrl}
                  title="simulation-embed"
                  className="simulation-iframe"
                  style={{
                    width: '100%',
                    height: isFullscreen ? '100%' : `${height}px`,
                    border: isFullscreen ? 'none' : '1px solid #ddd',
                    borderRadius: isFullscreen ? 0 : 6
                  }}
                  allow="geolocation; microphone; camera; midi; encrypted-media; fullscreen"
                  onLoad={() => {
                    setLoadingEmbed(false);
                    try {
                      const cw = iframeRef.current && iframeRef.current.contentWindow;
                      if (cw) setEmbedAllowed(true);
                      else setEmbedAllowed(false);
                    } catch (err) {
                      setEmbedAllowed(false);
                    }
                  }}
                  onError={() => { setLoadingEmbed(false); setEmbedAllowed(false); }}
                />
              </div>

              {loadingEmbed && <div style={{ padding: 12, color: isFullscreen ? 'white' : '#333' }}>Loading simulation…</div>}

              {embedAllowed === false && (
                <div style={{ marginTop: 12, padding: 12, background: '#fff8f0', border: '1px solid #ffd8a8', borderRadius: 6, color: '#333' }}>
                  <div style={{ marginBottom: 8 }}>This simulation cannot be embedded here due to the remote site's security settings (X-Frame-Options/CSP).</div>
                  <div>
                    <button
                      style={{ ...styles.button, backgroundColor: '#2b6cb0' }}
                      onClick={() => window.open(embedUrl, '_blank')}
                    >
                      Open simulation in a new tab
                    </button>
                    <span style={{ marginLeft: 12, color: '#666' }}>Or paste the URL directly into the browser if needed.</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: 12, color: isFullscreen ? 'white' : '#666' }}>No simulation selected yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: 'white',
    border: '1px solid #eee',
    padding: 16,
    borderRadius: 8,
  },
  fullscreenContainer: {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column'
  },
  formRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-end'
  },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 13,
    color: '#333'
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #ddd',
    fontSize: 14
  },
  button: {
    padding: '10px 14px',
    backgroundColor: '#3182ce',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer'
  },
  note: {
    color: '#666',
    fontSize: 13
  }
};
