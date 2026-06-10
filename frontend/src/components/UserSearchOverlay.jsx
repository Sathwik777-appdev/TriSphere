import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, doc, getDoc, getDocs, limit as fsLimit, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { ProfilePhoto } from './ProfilePhoto';
import { SearchIcon, CloseIcon, FireIcon, TaskIcon, CheckCircleIcon, TimerIcon } from './Icons';

// Small inline back arrow — Icons.jsx doesn't ship one.
const BackArrow = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const AVATAR_MAP = {
  avatar_robot:      { name: 'Robot',           img: '/avatars/robot.png' },
  avatar_wizard:     { name: 'Wizard',          img: '/avatars/wizard.png' },
  avatar_astronaut:  { name: 'Astronaut',       img: '/avatars/astronaut.png' },
  avatar_ninja:      { name: 'Ninja',           img: '/avatars/ninja.png' },
  avatar_superhero:  { name: 'Learn Hero',      img: '/avatars/superhero.png' },
  avatar_alien:      { name: 'Space Explorer',  img: '/avatars/alien.png' },
  avatar_dragon:     { name: 'Scholar Dragon',  img: '/avatars/dragon.png' },
  avatar_unicorn:    { name: 'Magic Unicorn',   img: '/avatars/unicorn.png' },
  avatar_shonen:     { name: 'Shonen Hero',     img: '/avatars/shonen_hero.png' },
  avatar_shinobi:    { name: 'Mystic Shinobi',  img: '/avatars/mystic_shinobi.png' },
  avatar_ethereal:   { name: 'Ethereal Spirit', img: '/avatars/ethereal_spirit.png' },
  avatar_cyber:      { name: 'Cyber Samurai',   img: '/avatars/cyber_samurai.png' },
  avatar_inferno:    { name: 'Inferno Knight',  img: '/avatars/inferno_knight.jpg' },
};

const FRAME_MAP = {
  frame_bronze:   { name: 'Bronze',   img: '/frames/bronze.png',   accent: '#cd7f32' },
  frame_silver:   { name: 'Silver',   img: '/frames/silver.png',   accent: '#c0c0c0' },
  frame_gold:     { name: 'Gold',     img: '/frames/gold.png',     accent: '#fbbf24' },
  frame_platinum: { name: 'Platinum', img: '/frames/platinum.png', accent: '#e5e4e2' },
  frame_diamond:  { name: 'Diamond',  img: '/frames/diamond.png',  accent: '#7dd3fc' },
};

/**
 * Full-screen search overlay for students. Two states inside one modal:
 *   1) Search results — typing live-queries `users` by lowercased
 *      `searchUsername` (a field already maintained by the
 *      `normalizeUserSearchNames` Cloud Function on every user write).
 *   2) Selected profile — shows the picked user's avatar, frame, XP,
 *      tasks done, avg score, day streak, and their inventory.
 *
 * Privacy guard: search is restricted to the current user's `schoolName`
 * so cross-school discovery is blocked.
 */
export const UserSearchOverlay = ({ open, onClose }) => {
  const { user, userData } = useAuth();
  const [queryText, setQueryText] = useState('');
  const [pool, setPool] = useState(null); // null = not loaded yet, [] = loaded empty
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const inputRef = useRef(null);

  // Autofocus the input the moment the overlay mounts so the keyboard
  // springs up immediately on mobile — saves one tap.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  // Reset all state when the overlay closes so re-opening starts clean.
  useEffect(() => {
    if (!open) {
      setQueryText('');
      setPool(null);
      setSelected(null);
      setError(null);
    }
  }, [open]);

  // Load the searchable pool once per overlay open. We fetch every
  // public student profile in the searcher's school (same-school privacy
  // boundary). A school has at most a few hundred kids, so this is one
  // cheap Firestore read — far simpler than per-keystroke prefix queries
  // and removes the composite-index dependency entirely. Falls back to a
  // school-less fetch if the searcher's userData has no schoolName.
  useEffect(() => {
    if (!open) return;
    if (pool !== null) return; // already loaded for this open session

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const mySchool = String(userData?.schoolName || '').trim();
        const baseClauses = [where('role', '==', 'student')];
        const scoped = mySchool
          ? [...baseClauses, where('schoolName', '==', mySchool)]
          : baseClauses;

        let snap = await getDocs(query(collection(db, 'publicProfiles'), ...scoped, fsLimit(500)));
        // Whitespace / casing drift between the searcher's schoolName and the
        // targets' would silently hide classmates. If the scoped fetch comes
        // back empty AND we had a school filter, retry without it.
        if (snap.empty && mySchool) {
          snap = await getDocs(query(collection(db, 'publicProfiles'), ...baseClauses, fsLimit(500)));
        }

        const myUid = user?.uid;
        const docs = [];
        snap.forEach((d) => {
          if (d.id === myUid) return;
          const u = d.data();
          docs.push({
            id: d.id,
            username: u.username || 'Student',
            name: u.name || '',
            class: u.class ?? u.classNumber ?? '—',
            schoolName: u.schoolName || '',
            profilePhoto: u.profilePhoto || u.photoURL || null,
            // Normalize once so per-keystroke filtering is just a cheap
            // string `.includes` check against this haystack.
            _hay: (
              (u.searchUsername || u.username || '') + ' ' +
              (u.searchName || u.name || '')
            ).toLowerCase(),
          });
        });
        if (!cancelled) setPool(docs);
      } catch (err) {
        console.error('User search pool load failed:', err);
        if (!cancelled) setError('Could not load student list. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Pool is keyed on overlay open; we don't refetch when queryText changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Live filtering — runs synchronously on every keystroke against the
  // in-memory pool. No debouncing needed because there's no network call.
  const results = useMemo(() => {
    if (!pool) return [];
    const term = queryText.trim().toLowerCase();
    if (term.length < 2) return [];
    return pool
      .filter((p) => p._hay.includes(term))
      // Prioritise prefix matches over substring matches.
      .sort((a, b) => {
        const aStarts = a._hay.startsWith(term) ? 0 : 1;
        const bStarts = b._hay.startsWith(term) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a._hay.localeCompare(b._hay);
      })
      .slice(0, 25);
  }, [pool, queryText]);


  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="search-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={S.overlay}
        onClick={onClose}
      >
        <motion.div
          key="search-sheet"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={S.sheet}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — pure flex row so the close × is GUARANTEED at the
              right edge (it's a real flex sibling, no absolute tricks). */}
          <div style={S.header}>
            {selected ? (
              <button
                onClick={() => setSelected(null)}
                style={S.headerLeftBtn}
                aria-label="Back to search"
              >
                <BackArrow size={22} color="#f1f5f9" />
              </button>
            ) : (
              <div style={S.searchInputWrap}>
                <SearchIcon size={18} color="#94a3b8" />
                <input
                  ref={inputRef}
                  // type="text" + inputMode="search" → mobile keyboard shows
                  // a search-style return key but we avoid the browser's
                  // built-in ✕ clear button that `type="search"` injects.
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder="Search students…"
                  style={S.searchInput}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                {queryText && (
                  <button
                    onClick={() => setQueryText('')}
                    style={S.clearBtn}
                    aria-label="Clear search"
                  >
                    <CloseIcon size={12} color="#94a3b8" />
                  </button>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              style={S.closeBtnEdge}
              aria-label="Close search"
            >
              <CloseIcon size={22} color="#f1f5f9" />
            </button>
          </div>

          {/* Body */}
          <div style={S.body}>
            {selected ? (
              <ProfileSheet student={selected} />
            ) : (
              <ResultsList
                queryText={queryText}
                results={results}
                loading={loading}
                error={error}
                onPick={setSelected}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Results list
// ─────────────────────────────────────────────────────────────────────────────
const ResultsList = ({ queryText, results, loading, error, onPick }) => {
  const term = queryText.trim();
  if (term.length < 2) {
    return (
      <div style={S.emptyState}>
        <div style={S.emptyIcon}>🔎</div>
        <div style={S.emptyTitle}>Discover classmates</div>
        <div style={S.emptyDesc}>
          Type a name or username to find other students in your school.
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div style={S.skeletonList}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={S.skeletonRow}>
            <div style={S.skeletonAvatar} />
            <div style={{ flex: 1 }}>
              <div style={{ ...S.skeletonLine, width: '60%' }} />
              <div style={{ ...S.skeletonLine, width: '35%', marginTop: 8, height: 10 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div style={S.emptyState}>
        <div style={S.emptyIcon}>⚠️</div>
        <div style={S.emptyTitle}>Something went wrong</div>
        <div style={S.emptyDesc}>{error}</div>
      </div>
    );
  }
  if (results.length === 0) {
    return (
      <div style={S.emptyState}>
        <div style={S.emptyIcon}>🙅</div>
        <div style={S.emptyTitle}>No students found</div>
        <div style={S.emptyDesc}>Try a different name or check the spelling.</div>
      </div>
    );
  }
  return (
    <div style={S.resultsList}>
      {results.map((r) => (
        <button key={r.id} onClick={() => onPick(r)} style={S.resultRow}>
          <div style={S.resultAvatar}>
            <ProfilePhoto size={44} editable={false} userData={r} uid={r.id} />
          </div>
          <div style={S.resultInfo}>
            <div style={S.resultUsername}>@{r.username}</div>
            <div style={S.resultMeta}>
              Class {r.class}{r.schoolName ? ` • ${r.schoolName}` : ''}
            </div>
          </div>
          <div style={S.resultChevron}>›</div>
        </button>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Profile sheet — shown after picking a result
// ─────────────────────────────────────────────────────────────────────────────
const ProfileSheet = ({ student }) => {
  const [store, setStore] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Use /publicProfiles for stats (private fields on /users are not
        // readable by peers). /userStore is openly readable so we hit it
        // directly for the inventory.
        const [storeSnap, profileSnap] = await Promise.all([
          getDoc(doc(db, 'userStore', student.id)),
          getDoc(doc(db, 'publicProfiles', student.id)),
        ]);
        if (cancelled) return;
        setStore(storeSnap.exists() ? storeSnap.data() : {});
        setUser(profileSnap.exists() ? profileSnap.data() : {});
      } catch (err) {
        console.error('ProfileSheet fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [student.id]);

  const xp           = store?.xpBalance ?? user?.stats?.xpBalance ?? 0;
  const tasksDone    = user?.stats?.tasksCompleted ?? 0;
  const averageScore = user?.stats?.averageScore ?? 0;
  const streak       = user?.stats?.streak ?? 0;

  const level             = Math.floor(xp / 1000) + 1;
  const currentLevelXp    = xp % 1000;
  const levelProgressPct  = (currentLevelXp / 1000) * 100;

  const equippedAvatarId = store?.equippedItems?.avatar;
  const equippedFrameId  = store?.equippedItems?.frame;
  const equippedAvatar   = equippedAvatarId ? AVATAR_MAP[equippedAvatarId] : null;
  const equippedFrame    = equippedFrameId ? FRAME_MAP[equippedFrameId] : null;

  const ownedAvatars = (store?.ownedItems || []).filter((id) => id.startsWith('avatar_'));
  const ownedFrames  = (store?.ownedItems || []).filter((id) => id.startsWith('frame_'));

  return (
    <div style={S.profile}>
      {/* Hero — large photo with frame, username, class & school chips */}
      <div style={S.heroCard}>
        <div style={S.heroGlow} />
        <div style={S.heroPhotoWrap}>
          <ProfilePhoto size={120} editable={false} userData={student} uid={student.id} />
        </div>
        <div style={S.heroIdentity}>
          <h2 style={S.heroUsername}>@{student.username}</h2>
          <div style={S.heroBadges}>
            <span style={S.heroBadge}>Class {student.class}</span>
            {student.schoolName && (
              <span style={S.heroBadge}>{student.schoolName}</span>
            )}
          </div>
        </div>

        {/* Level + XP rail */}
        <div style={S.xpBlock}>
          <div style={S.xpHeader}>
            <span style={S.xpLevel}>LEVEL {level}</span>
            <span style={S.xpCurrent}>{currentLevelXp} / 1000 XP</span>
          </div>
          <div style={S.xpTrack}>
            <div style={{ ...S.xpFill, width: `${levelProgressPct}%` }} />
          </div>
        </div>
      </div>

      {/* 4-stat grid */}
      <div style={S.statsGrid}>
        <StatTile
          label="Total XP"
          value={xp.toLocaleString()}
          icon={<FireIcon size={18} color="#fbbf24" />}
          accent="#fbbf24"
        />
        <StatTile
          label="Tasks done"
          value={tasksDone}
          icon={<TaskIcon size={18} color="#60a5fa" />}
          accent="#60a5fa"
        />
        <StatTile
          label="Avg score"
          value={`${averageScore}%`}
          icon={<CheckCircleIcon size={18} color="#a78bfa" />}
          accent="#a78bfa"
        />
        <StatTile
          label="Day streak"
          value={streak}
          icon={<TimerIcon size={18} color="#f97316" />}
          accent="#f97316"
        />
      </div>

      {/* Equipped loadout */}
      <div style={S.section}>
        <div style={S.sectionLabel}>Equipped</div>
        <div style={S.loadoutGrid}>
          <LoadoutCard
            title="Avatar"
            empty={!equippedAvatar}
            emptyHint="None"
            name={equippedAvatar?.name}
            img={equippedAvatar?.img}
            accent="#a78bfa"
          />
          <LoadoutCard
            title="Frame"
            empty={!equippedFrame}
            emptyHint="None"
            name={equippedFrame?.name}
            img={equippedFrame?.img}
            accent={equippedFrame?.accent || '#94a3b8'}
          />
        </div>
      </div>

      {/* Collections */}
      <div style={S.section}>
        <div style={S.sectionLabel}>
          Avatar Collection
          <span style={S.sectionCount}>{ownedAvatars.length}</span>
        </div>
        <div style={S.collectionRow}>
          {ownedAvatars.length === 0 ? (
            <div style={S.collectionEmpty}>No avatars yet</div>
          ) : (
            ownedAvatars.map((id) => {
              const a = AVATAR_MAP[id];
              if (!a) return null;
              return (
                <div key={id} style={S.collectionItem} title={a.name}>
                  <img src={a.img} alt={a.name} style={S.collectionImg} />
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={S.section}>
        <div style={S.sectionLabel}>
          Frame Collection
          <span style={S.sectionCount}>{ownedFrames.length}</span>
        </div>
        <div style={S.collectionRow}>
          {ownedFrames.length === 0 ? (
            <div style={S.collectionEmpty}>No frames yet</div>
          ) : (
            ownedFrames.map((id) => {
              const f = FRAME_MAP[id];
              if (!f) return null;
              return (
                <div key={id} style={S.collectionItem} title={f.name}>
                  <img src={f.img} alt={f.name} style={S.collectionImg} />
                </div>
              );
            })
          )}
        </div>
      </div>

      {loading && (
        <div style={S.loadingShim}>Loading details…</div>
      )}
    </div>
  );
};

const StatTile = ({ label, value, icon, accent }) => (
  <div style={{ ...S.statTile, borderColor: `${accent}33` }}>
    <div style={{ ...S.statIconBox, background: `${accent}1a` }}>{icon}</div>
    <div style={S.statValue}>{value}</div>
    <div style={S.statLabel}>{label}</div>
  </div>
);

const LoadoutCard = ({ title, name, img, empty, emptyHint, accent }) => (
  <div style={{ ...S.loadoutCard, borderColor: `${accent}33` }}>
    <div style={S.loadoutTitle}>{title}</div>
    {empty ? (
      <div style={S.loadoutEmpty}>{emptyHint}</div>
    ) : (
      <>
        <div style={{ ...S.loadoutImgWrap, background: `${accent}1a` }}>
          <img src={img} alt={name} style={S.loadoutImg} />
        </div>
        <div style={S.loadoutName}>{name}</div>
      </>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const FONT = '"Google Sans", "Product Sans", "Inter", -apple-system, BlinkMacSystemFont, sans-serif';

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2, 6, 23, 0.78)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 10005,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 0,
    fontFamily: FONT,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    height: '100dvh',
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0b1224 0%, #0b1224 30%, #0a0f1f 100%)',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderLeft: '1px solid rgba(255,255,255,0.04)',
    borderRight: '1px solid rgba(255,255,255,0.04)',
  },
  // Header — pure flex row. Three slots: [search wrap (flex:1)] [close ×].
  // No absolute positioning, no inline background tricks the global
  // mobile-button reset can fight. Close × is GUARANTEED at the right edge.
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
    paddingBottom: '12px',
    paddingLeft: '14px',
    paddingRight: '8px',
    background: 'rgba(11, 18, 36, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    boxSizing: 'border-box',
  },
  searchInputWrap: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 8px 10px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    boxSizing: 'border-box',
    height: 44,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    height: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#f1f5f9',
    fontSize: 15,
    fontFamily: FONT,
    padding: 0,
  },
  // Close × — a real flex sibling on the right of the header. Won't drift.
  // `background: transparent` + `border: none` + `padding: 0` are
  // essential — without them the browser paints its default white button
  // chrome around the SVG and the X disappears against the white box.
  // `marginLeft: auto` pushes it to the right edge in BOTH header states
  // (search-wrap on the left, OR a fixed-width back-arrow on the left).
  closeBtnEdge: {
    flex: '0 0 40px',
    width: 40,
    height: 40,
    padding: 0,
    margin: 0,
    marginLeft: 'auto',
    background: 'transparent',
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#f1f5f9',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    WebkitTapHighlightColor: 'transparent',
    boxShadow: 'none',
  },
  // Back arrow on the selected-profile screen — same footprint as close.
  headerLeftBtn: {
    flex: '0 0 40px',
    width: 40,
    height: 40,
    padding: 0,
    margin: 0,
    background: 'transparent',
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#f1f5f9',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    WebkitTapHighlightColor: 'transparent',
    boxShadow: 'none',
  },
  // Tiny clear × INSIDE the input pill. Just the icon — no chip. Stays
  // visually subordinate to the close × on the right.
  clearBtn: {
    flex: '0 0 20px',
    width: 20,
    height: 20,
    padding: 0,
    margin: 0,
    background: 'transparent',
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#94a3b8',
    appearance: 'none',
    WebkitAppearance: 'none',
    WebkitTapHighlightColor: 'transparent',
    boxShadow: 'none',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },

  // ── Empty / skeleton / error ──
  emptyState: {
    padding: '60px 32px',
    textAlign: 'center',
    color: '#94a3b8',
  },
  emptyIcon: { fontSize: 44, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 },
  emptyDesc: { fontSize: 13, lineHeight: 1.5 },
  skeletonList: { padding: '14px 14px 32px' },
  skeletonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 12px',
    marginBottom: 8,
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    background: 'rgba(255,255,255,0.08)',
  },

  // ── Result rows ──
  resultsList: { padding: '10px 12px 24px' },
  resultRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14,
    color: '#e2e8f0',
    cursor: 'pointer',
    marginBottom: 8,
    transition: 'background 0.15s ease',
    fontFamily: FONT,
    textAlign: 'left',
    WebkitTapHighlightColor: 'transparent',
  },
  resultAvatar: { flexShrink: 0 },
  resultInfo: { flex: 1, minWidth: 0 },
  resultUsername: {
    fontSize: 15,
    fontWeight: 700,
    color: '#f8fafc',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  resultMeta: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  resultChevron: {
    color: '#475569',
    fontSize: 24,
    lineHeight: 1,
    marginLeft: 4,
    flexShrink: 0,
  },

  // ── Profile sheet ──
  profile: { padding: '16px 14px 60px' },
  heroCard: {
    position: 'relative',
    padding: '22px 18px 18px',
    borderRadius: 22,
    background: 'linear-gradient(160deg, rgba(99,102,241,0.18) 0%, rgba(59,130,246,0.08) 55%, rgba(17,24,39,0.6) 100%)',
    border: '1px solid rgba(148,163,184,0.12)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    background: 'radial-gradient(circle, rgba(96,165,250,0.35) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  heroPhotoWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 14,
    position: 'relative',
    zIndex: 1,
  },
  heroIdentity: {
    textAlign: 'center',
    marginBottom: 16,
    position: 'relative',
    zIndex: 1,
  },
  heroUsername: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: '#f8fafc',
    letterSpacing: 0.2,
  },
  heroBadges: {
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  heroBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 999,
    color: '#cbd5e1',
  },
  xpBlock: { position: 'relative', zIndex: 1 },
  xpHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  xpLevel: {
    fontSize: 11,
    fontWeight: 800,
    color: '#fbbf24',
    letterSpacing: 1,
  },
  xpCurrent: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94a3b8',
    letterSpacing: 0.3,
  },
  xpTrack: {
    height: 8,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, #fbbf24, #f97316)',
    boxShadow: '0 0 14px rgba(251,191,36,0.5)',
    transition: 'width 0.4s ease',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
    marginBottom: 18,
  },
  statTile: {
    padding: '14px 12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 800,
    color: '#f8fafc',
    lineHeight: 1.1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94a3b8',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  section: { marginBottom: 18 },
  sectionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    fontWeight: 800,
    color: '#94a3b8',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    color: '#cbd5e1',
    letterSpacing: 0,
  },

  loadoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  },
  loadoutCard: {
    padding: '14px 12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  loadoutTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  loadoutImgWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadoutImg: {
    width: 56,
    height: 56,
    objectFit: 'contain',
  },
  loadoutName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e2e8f0',
  },
  loadoutEmpty: {
    fontSize: 13,
    color: '#64748b',
    padding: '20px 0',
  },

  collectionRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 4,
    WebkitOverflowScrolling: 'touch',
  },
  collectionItem: {
    flex: '0 0 auto',
    width: 56,
    height: 56,
    borderRadius: 12,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  collectionImg: {
    width: 48,
    height: 48,
    objectFit: 'contain',
  },
  collectionEmpty: {
    fontSize: 13,
    color: '#64748b',
    padding: '6px 2px',
  },

  loadingShim: {
    textAlign: 'center',
    fontSize: 12,
    color: '#64748b',
    padding: 12,
  },
};

export default UserSearchOverlay;
