import React, { useMemo, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Budget / Credit-Flow Flowchart for the Developer Dashboard.
//
// Shows how requests fan out across paid GCP/Firebase services so devs can spot
// which paths drive billing. Click a node for pricing model, code refs and the
// mitigations currently in place.
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY = {
    high:    { color: '#ef4444', label: 'High cost driver',  ring: 'rgba(239,68,68,0.35)' },
    medium:  { color: '#f59e0b', label: 'Medium cost driver',ring: 'rgba(245,158,11,0.35)' },
    low:     { color: '#10b981', label: 'Low / mostly free', ring: 'rgba(16,185,129,0.30)' },
    threat:  { color: '#dc2626', label: 'Threat vector',     ring: 'rgba(220,38,38,0.40)' },
};

const NODES = [
    {
        id: 'users',
        x: 60,  y: 120, w: 200, h: 86,
        icon: '👤',
        title: 'Authenticated Users',
        subtitle: 'Students, Teachers, Admins',
        severity: 'low',
        pricing: 'No direct cost. Drives downstream usage of every other service.',
        codeRefs: [
            { label: 'Auth hook', file: 'frontend/src/hooks/useAuth.js' },
        ],
        mitigations: ['Role-based routing prevents non-admins from triggering heavy admin endpoints.'],
    },
    {
        id: 'bots',
        x: 60,  y: 260, w: 200, h: 86,
        icon: '🤖',
        title: 'Public Internet / Bots',
        subtitle: 'Crawlers, scanners, scrapers',
        severity: 'threat',
        pricing: 'No revenue, only cost. Any unauthenticated, expensive endpoint becomes a billing leak.',
        codeRefs: [
            { label: 'Hosting → Cloud Run rewrite', file: 'firebase.json:48' },
        ],
        mitigations: [
            'May 2026 incident: bots hammered /api/leaderboard for 4 days = ₹978 bill.',
            'PATCHED — verifyAuth middleware now rejects unauth requests before any DB read.',
        ],
    },
    {
        id: 'hosting',
        x: 320, y: 60,  w: 200, h: 86,
        icon: '🌐',
        title: 'Firebase Hosting',
        subtitle: 'Static frontend + /api/** rewrites',
        severity: 'low',
        pricing: 'Free 10 GB storage + 360 MB/day egress on Spark; ~$0.026/GB egress on Blaze.',
        codeRefs: [
            { label: 'Rewrites config', file: 'firebase.json' },
            { label: 'Built bundle', file: 'frontend/dist' },
        ],
        mitigations: ['Vite production build is minified and code-split.'],
    },
    {
        id: 'auth',
        x: 320, y: 440, w: 200, h: 86,
        icon: '🔐',
        title: 'Firebase Auth',
        subtitle: 'Login, ID tokens, session',
        severity: 'low',
        pricing: 'Free for email/password and most providers. Phone/MFA is paid per-verification.',
        codeRefs: [
            { label: 'Auth service', file: 'frontend/src/services/firebase.js' },
            { label: 'verifyIdToken usage', file: 'backend/server.js:76' },
        ],
        mitigations: ['No SMS/phone auth wired up — billing surface stays at $0.'],
    },
    {
        id: 'cloudrun',
        x: 600, y: 200, w: 220, h: 100,
        icon: '⚙️',
        title: 'Cloud Run Backend',
        subtitle: 'Express API (Node + Chromium + Python TTS)',
        severity: 'high',
        pricing: 'Billed per request + per-second of vCPU and GB-RAM while a container is alive. Heavy Chromium image = high RAM-second cost on every cold start.',
        codeRefs: [
            { label: 'Server entry', file: 'backend/server.js' },
            { label: 'Container image', file: 'backend/Dockerfile' },
            { label: 'Routes', file: 'backend/routes/' },
        ],
        mitigations: [
            'verifyAuth on /api/leaderboard and /api/user/update-password.',
            'Defense-in-depth .limit(50000) on full-collection scans.',
            'Recommended: cap Cloud Run with --max-instances=2 and add a GCP billing budget alert.',
        ],
    },
    {
        id: 'functions',
        x: 600, y: 420, w: 220, h: 100,
        icon: '⚡',
        title: 'Cloud Functions',
        subtitle: 'onCreate, onWrite, onCall triggers',
        severity: 'medium',
        pricing: '$0.40 per million invocations + per-100ms compute. Recursive triggers (a write that fires another write) are the classic runaway-cost pattern.',
        codeRefs: [
            { label: 'Functions index', file: 'functions/index.js' },
        ],
        mitigations: [
            'No onSchedule / pubsub.schedule functions.',
            'onWrite on users/{uid} writes to Auth, not Firestore — no recursion.',
        ],
    },
    {
        id: 'firestore',
        x: 900, y: 100,  w: 200, h: 86,
        icon: '🔥',
        title: 'Firestore',
        subtitle: 'NoSQL document DB',
        severity: 'medium',
        pricing: 'Per-document reads ($0.06 / 100k), writes ($0.18 / 100k), storage ($0.18/GB-mo). Unlimited collection scans without .limit() are how a single API hit becomes thousands of reads.',
        codeRefs: [
            { label: 'Security rules', file: 'firestore.rules' },
            { label: 'Leaderboard scans (capped)', file: 'backend/server.js:118' },
            { label: 'Indexes', file: 'firestore.indexes.json' },
        ],
        mitigations: [
            'Auth-gated rules in firestore.rules.',
            'SCAN_LIMIT = 50000 cap on leaderboard queries.',
        ],
    },
    {
        id: 'storage',
        x: 900, y: 280, w: 200, h: 86,
        icon: '📦',
        title: 'Cloud Storage',
        subtitle: 'PDFs, audio, profile photos',
        severity: 'medium',
        pricing: 'Per-GB storage + per-GB egress + per-1k operations. PDF and TTS audio uploads accumulate over time.',
        codeRefs: [
            { label: 'Storage rules', file: 'storage.rules' },
            { label: 'PDF service', file: 'backend/services/pdfService.js' },
            { label: 'CORS config', file: 'frontend/cors.json' },
        ],
        mitigations: ['Lifecycle rules NOT configured — consider auto-delete for /tmp PDFs after 30d.'],
    },
    {
        id: 'external',
        x: 900, y: 460, w: 200, h: 86,
        icon: '🧠',
        title: 'External AI / TTS',
        subtitle: 'Gemini, Puppeteer',
        severity: 'high',
        pricing: 'Per-token / per-character billing on Gemini and TTS providers. Variable cost — a single chat session can spend more than a day of Cloud Run time.',
        codeRefs: [
            { label: 'AI routes', file: 'backend/routes/ai.js' },
            { label: 'TTS service', file: 'backend/tts_service.py' },
        ],
        mitigations: ['Rate limiter (100 req / 15 min per IP) on /api.'],
    },
];

// Edges — kept sparse to stay readable. Labels are short on purpose.
const EDGES = [
    { from: 'users', to: 'hosting',  label: 'Page loads' },
    { from: 'users', to: 'auth',     label: 'Login / ID token' },
    { from: 'users', to: 'firestore',label: 'Direct SDK reads/writes' },
    { from: 'users', to: 'functions',label: 'onCall' },
    { from: 'bots',  to: 'cloudrun', label: 'Bot scans (patched)', danger: true },
    { from: 'hosting',  to: 'cloudrun',  label: '/api/** rewrite' },
    { from: 'cloudrun', to: 'firestore', label: 'Queries' },
    { from: 'cloudrun', to: 'storage',   label: 'Uploads' },
    { from: 'cloudrun', to: 'external',  label: 'Gemini / TTS' },
    { from: 'functions',to: 'firestore', label: 'Trigger writes' },
];

// ── Geometry helpers ────────────────────────────────────────────────────────
const nodeById = (id) => NODES.find(n => n.id === id);
// pick the side of the source/target boxes that gives the cleanest horizontal arrow
function edgeAnchors(a, b) {
    const aRight = a.x + a.w, bRight = b.x + b.w;
    let x1, y1, x2, y2;
    if (b.x >= aRight - 4) { x1 = aRight; x2 = b.x; }
    else if (a.x >= bRight - 4) { x1 = a.x; x2 = bRight; }
    else { x1 = a.x + a.w / 2; x2 = b.x + b.w / 2; }
    y1 = a.y + a.h / 2;
    y2 = b.y + b.h / 2;
    return { x1, y1, x2, y2 };
}

// ── Component ───────────────────────────────────────────────────────────────
export default function BudgetFlowPanel() {
    const [selectedId, setSelectedId] = useState('cloudrun');
    const selected = useMemo(() => nodeById(selectedId), [selectedId]);

    const VIEW_W = 1180, VIEW_H = 600;

    return (
        <div style={S.panel}>
            <div style={S.headerRow}>
                <h2 style={S.heading}>💸 Credit Flow</h2>
                <div style={S.legend}>
                    {Object.entries(SEVERITY).map(([k, v]) => (
                        <div key={k} style={S.legendItem}>
                            <span style={{ ...S.legendDot, background: v.color }} />
                            <span style={S.legendText}>{v.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <p style={S.intro}>
                Each node is a paid GCP / Firebase service. Arrows show how a single user request
                can fan out into billing across the stack. Click a node for pricing model, code refs
                and active mitigations.
            </p>

            <div style={S.layout}>
                {/* ── Diagram ────────────────────────────────────────────── */}
                <div style={{ ...S.canvas, aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
                    <svg
                        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                        preserveAspectRatio="xMidYMid meet"
                        style={S.svg}
                    >
                        <defs>
                            <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                                <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
                            </marker>
                            <marker id="arrow-danger" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                                <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
                            </marker>
                        </defs>

                        {EDGES.map((e, i) => {
                            const a = nodeById(e.from), b = nodeById(e.to);
                            if (!a || !b) return null;
                            const { x1, y1, x2, y2 } = edgeAnchors(a, b);
                            const midX = (x1 + x2) / 2;
                            const midY = (y1 + y2) / 2;
                            const stroke = e.danger ? '#ef4444' : '#94a3b8';
                            const marker = e.danger ? 'url(#arrow-danger)' : 'url(#arrow)';
                            // gentle curve via quadratic control point offset perpendicular to the line
                            const dx = x2 - x1, dy = y2 - y1;
                            const len = Math.sqrt(dx * dx + dy * dy) || 1;
                            const nx = -dy / len, ny = dx / len;
                            const curveAmt = 18;
                            const cx = midX + nx * curveAmt;
                            const cy = midY + ny * curveAmt;
                            return (
                                <g key={i}>
                                    <path
                                        d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                                        stroke={stroke}
                                        strokeWidth={e.danger ? 2 : 1.4}
                                        fill="none"
                                        strokeDasharray={e.danger ? '6 4' : 'none'}
                                        opacity={0.85}
                                        markerEnd={marker}
                                    />
                                    <text
                                        x={cx}
                                        y={cy - 4}
                                        textAnchor="middle"
                                        fontSize="11"
                                        fill={e.danger ? '#fca5a5' : '#94a3b8'}
                                        fontWeight={e.danger ? 600 : 400}
                                    >
                                        {e.label}
                                    </text>
                                </g>
                            );
                        })}

                        {NODES.map(n => {
                            const sev = SEVERITY[n.severity];
                            const isSelected = selectedId === n.id;
                            return (
                                <g
                                    key={n.id}
                                    transform={`translate(${n.x}, ${n.y})`}
                                    onClick={() => setSelectedId(n.id)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {isSelected && (
                                        <rect
                                            x={-6} y={-6}
                                            width={n.w + 12} height={n.h + 12}
                                            rx={16}
                                            fill="none"
                                            stroke={sev.color}
                                            strokeWidth={2}
                                            opacity={0.9}
                                        />
                                    )}
                                    <rect
                                        width={n.w} height={n.h} rx={12}
                                        fill="rgba(15, 23, 42, 0.92)"
                                        stroke={sev.color}
                                        strokeWidth={1.5}
                                    />
                                    <rect
                                        width={4} height={n.h} rx={2}
                                        fill={sev.color}
                                    />
                                    <text x={20} y={28} fontSize="20">{n.icon}</text>
                                    <text x={48} y={30} fontSize="14" fontWeight="700" fill="#e2e8f0">
                                        {n.title}
                                    </text>
                                    <text x={20} y={56} fontSize="11" fill="#94a3b8">
                                        {n.subtitle}
                                    </text>
                                    <text x={20} y={n.h - 12} fontSize="10" fontWeight="600" fill={sev.color} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                        {sev.label}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </div>

                {/* ── Detail pane ────────────────────────────────────────── */}
                <aside style={S.detail}>
                    {selected ? (
                        <>
                            <div style={S.detailHead}>
                                <span style={S.detailIcon}>{selected.icon}</span>
                                <div>
                                    <div style={S.detailTitle}>{selected.title}</div>
                                    <div style={S.detailSubtitle}>{selected.subtitle}</div>
                                </div>
                            </div>
                            <div style={{ ...S.sevBadge, background: SEVERITY[selected.severity].ring, color: SEVERITY[selected.severity].color, borderColor: SEVERITY[selected.severity].color }}>
                                {SEVERITY[selected.severity].label}
                            </div>

                            <h4 style={S.h4}>Pricing model</h4>
                            <p style={S.body}>{selected.pricing}</p>

                            <h4 style={S.h4}>Code paths</h4>
                            <ul style={S.list}>
                                {selected.codeRefs.map((c, i) => (
                                    <li key={i} style={S.listItem}>
                                        <span style={S.refLabel}>{c.label}</span>
                                        <code style={S.code}>{c.file}</code>
                                    </li>
                                ))}
                            </ul>

                            <h4 style={S.h4}>Mitigations in place</h4>
                            <ul style={S.list}>
                                {selected.mitigations.map((m, i) => (
                                    <li key={i} style={{ ...S.listItem, color: '#cbd5e1' }}>{m}</li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <div style={{ color: '#94a3b8' }}>Click a node to see details.</div>
                    )}
                </aside>
            </div>

            {/* ── Recent incident footer ──────────────────────────────── */}
            <div style={S.incident}>
                <div style={S.incidentTitle}>📅 May 1–4, 2026 — ₹978 bill incident</div>
                <div style={S.incidentBody}>
                    <code style={S.code}>/api/leaderboard</code> was publicly reachable and ran 4 unbounded
                    Firestore collection scans per request. Bots hitting it for 4 days drove the entire bill.
                    Patched: <code style={S.code}>verifyAuth</code> middleware on the route +
                    <code style={S.code}>.limit(50000)</code> on each query. Set Cloud Run
                    <code style={S.code}>--max-instances=2</code> and a GCP budget alert as the next backstop.
                </div>
            </div>
        </div>
    );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const S = {
    panel: { padding: 'clamp(12px, 3vw, 24px)', maxWidth: '100%', overflowY: 'auto' },
    headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
    heading: { color: '#e2e8f0', fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 },
    legend: { display: 'flex', gap: 14, flexWrap: 'wrap' },
    legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5, display: 'inline-block' },
    legendText: { color: '#94a3b8', fontSize: 12 },
    intro: { color: '#94a3b8', fontSize: 13, lineHeight: 1.5, margin: '4px 0 18px' },
    layout: { display: 'grid', gridTemplateColumns: 'minmax(0, 2.2fr) minmax(280px, 1fr)', gap: 18, alignItems: 'start' },
    canvas: { background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 12, width: '100%' },
    svg: { width: '100%', height: '100%', display: 'block' },
    detail: { background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, minHeight: 480 },
    detailHead: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 },
    detailIcon: { fontSize: 28 },
    detailTitle: { color: '#e2e8f0', fontSize: 18, fontWeight: 700 },
    detailSubtitle: { color: '#94a3b8', fontSize: 12 },
    sevBadge: { display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, border: '1px solid', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 },
    h4: { color: '#e2e8f0', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, margin: '14px 0 6px' },
    body: { color: '#cbd5e1', fontSize: 13, lineHeight: 1.55, margin: 0 },
    list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 },
    listItem: { fontSize: 12, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    refLabel: { color: '#94a3b8' },
    code: { fontFamily: 'monospace', fontSize: 11.5, background: 'rgba(99,102,241,0.12)', color: '#c7d2fe', padding: '2px 6px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.25)' },
    incident: { marginTop: 18, padding: 16, borderRadius: 14, background: 'linear-gradient(135deg, rgba(239,68,68,0.10), rgba(220,38,38,0.04))', border: '1px solid rgba(239,68,68,0.30)' },
    incidentTitle: { color: '#fca5a5', fontSize: 14, fontWeight: 700, marginBottom: 6 },
    incidentBody: { color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 },
};
