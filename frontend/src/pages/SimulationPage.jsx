import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SimulationsPanel from '../components/SimulationsPanel';

const SimulationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { type, defaultSlug, defaultUrl, label } = location.state || { type: 'geogebra', defaultSlug: '', defaultUrl: '', label: '' };

  // Add the body class on mount so the page-specific CSS rule below
  // (body.simulation-page-active { overflow: hidden; ... }) takes effect,
  // and remove it on unmount so navigating back to the dashboard restores
  // normal scrolling. Belt-and-braces against React's edge cases where
  // an injected <style> tag could outlive the component.
  useEffect(() => {
    document.body.classList.add('simulation-page-active');
    return () => {
      document.body.classList.remove('simulation-page-active');
    };
  }, []);

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.header} className="simulation-page-header">
        <button onClick={() => navigate(-1)} style={styles.backButton}>
          ← Back
        </button>
        <h2 style={styles.title}>
          {label || (type === 'geogebra' ? 'GeoGebra' : 'PhET Simulation')}
        </h2>
      </div>

      <div style={styles.content} className="simulation-page-content">
        <SimulationsPanel
          type={type}
          defaultSlug={defaultSlug}
          defaultUrl={defaultUrl}
          isFullscreen={true}
        />
      </div>

      <style>{`
        /* IMPORTANT: scoped to the simulation page only — applying
           overflow:hidden directly to <body> previously persisted in
           the document even after navigating away, locking scroll on
           the dashboard. The .simulation-page-active class is added
           on mount and removed on unmount (see useEffect below). */
        body.simulation-page-active { margin: 0; overflow: hidden; background: #0f172a; }

        @media screen and (max-width: 768px) and (orientation: portrait) {
            .simulation-page-content {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100dvh !important;
                height: 100dvw !important;
                transform: rotate(90deg) translateX(0) translateY(-100dvw) !important;
                transform-origin: top left !important;
                z-index: 1000 !important;
                background: #000 !important;
                /* Account for safe areas (notches/islands) */
                padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left) !important;
                box-sizing: border-box !important;
            }
          
            .simulation-page-header {
                display: none !important;
            }
          
            .floating-back-btn {
                position: fixed;
                bottom: calc(10px + env(safe-area-inset-bottom));
                right: calc(10px + env(safe-area-inset-right));
                z-index: 10001;
                padding: 10px 15px;
                background: rgba(59, 130, 246, 0.8);
                color: white;
                border: none;
                border-radius: 50px;
                font-size: 14px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                display: block !important;
            }
        }

        @media screen and (max-width: 768px) {
          .simulation-page-header {
            padding: 8px 12px !important;
          }
          .simulation-page-header h2 {
            font-size: 16px !important;
          }
          .simulation-page-header button {
            padding: 6px 12px !important;
            font-size: 13px !important;
          }
          .floating-back-btn {
            display: none;
          }
        }
        
        @media screen and (orientation: landscape) {
          .floating-back-btn {
            display: none;
          }
        }
      `}</style>

      <button className="floating-back-btn" onClick={() => navigate(-1)}>
        ← Exit
      </button>
    </div>
  );
};

const styles = {
  pageWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    width: '100vw',
    backgroundColor: '#0f172a',
    color: 'white',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '15px 20px',
    background: 'rgba(30, 58, 95, 0.8)',
    borderBottom: '1px solid rgba(59, 130, 246, 0.3)',
    backdropFilter: 'blur(10px)',
    zIndex: 10,
    transition: 'all 0.2s',
  },
  backButton: {
    padding: '8px 16px',
    background: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    borderRadius: '8px',
    color: 'white',
    cursor: 'pointer',
    marginRight: '15px',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }
};

export default SimulationPage;
