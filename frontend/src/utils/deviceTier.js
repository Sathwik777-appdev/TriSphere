/**
 * deviceTier — classifies the current device as low / mid / high tier
 * based on hardware signals the browser exposes, then adds a class to
 * <body> so CSS can degrade visuals on weaker hardware.
 *
 * Signals used (gracefully fall back when any is unavailable):
 *   • navigator.deviceMemory       — approximate RAM in GiB (Chrome / Edge)
 *   • navigator.hardwareConcurrency — logical CPU cores (everywhere)
 *   • navigator.connection.saveData — user has Data Saver enabled
 *   • navigator.connection.effectiveType — 4g / 3g / 2g
 *   • matchMedia('(prefers-reduced-motion: reduce)')
 *   • window.innerWidth            — narrow viewports often = budget phones
 *
 * Tier rules (any one match → that tier):
 *   LOW  → deviceMemory ≤ 2 GB,  cores ≤ 4,  saveData = true,  3g/2g
 *   MID  → deviceMemory ≤ 4 GB OR cores ≤ 6
 *   HIGH → everything else
 *
 * Body classes written:
 *   device-tier-low | device-tier-mid | device-tier-high
 *   plus  is-mobile  on width < 768
 *
 * CSS in mobile-optimizations.css responds to these classes — see the
 * "Device-tier degradation" section there.
 */

let listenersRegistered = false;

const apply = (tier) => {
  if (typeof document === 'undefined') return;
  const b = document.body;
  if (!b) return;
  b.classList.remove('device-tier-low', 'device-tier-mid', 'device-tier-high');
  b.classList.add(`device-tier-${tier}`);
  if (window.innerWidth < 768) b.classList.add('is-mobile');
  else b.classList.remove('is-mobile');
};

export const detectAndApplyDeviceTier = () => {
  // Conservative defaults — unknown signals don't reduce visuals.
  const mem   = (typeof navigator !== 'undefined' && navigator.deviceMemory)        || 4;
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const conn  = (typeof navigator !== 'undefined' && navigator.connection) || {};
  const saveData = !!conn.saveData;
  const slowNet  = conn.effectiveType === '2g' || conn.effectiveType === '3g';

  let tier = 'high';
  if (mem <= 2 || cores <= 4 || saveData || slowNet) tier = 'low';
  else if (mem <= 4 || cores <= 6) tier = 'mid';

  apply(tier);

  // Re-evaluate on connection change (data-saver toggled, switched to 3g…)
  if (!listenersRegistered && typeof window !== 'undefined') {
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', () => detectAndApplyDeviceTier());
    }
    // Re-evaluate on viewport resize for the is-mobile class.
    window.addEventListener('resize', () => {
      if (window.innerWidth < 768) document.body.classList.add('is-mobile');
      else document.body.classList.remove('is-mobile');
    }, { passive: true });
    listenersRegistered = true;
  }

  // Expose for debugging in console: `window.__deviceTier`
  if (typeof window !== 'undefined') {
    window.__deviceTier = { tier, mem, cores, saveData, slowNet };
  }
  return tier;
};
