const fs = require('fs');
let file = fs.readFileSync('frontend/src/pages/StudentDashboardMobile.jsx', 'utf8');

file = file.replace(
  /<motion\.div\n\s*whileTap={{ scale: 0\.98 }}\n\s*onClick={\(\) => window\.dispatchEvent\(new CustomEvent\('open-astra'\)\)}\n\s*style={{ \.\.\.S\.astraCard, marginTop: 24 }}\n\s*>/g,
  `<motion.div
        whileTap={isGated ? { scale: 0.98 } : {}}
        onClick={() => isGated ? window.dispatchEvent(new CustomEvent('open-astra')) : null}
        style={{
          ...S.astraCard,
          marginTop: 24,
          background: isGated ? S.astraCard.background : 'rgba(16, 185, 129, 0.1)',
          border: isGated ? S.astraCard.border : '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: isGated ? S.astraCard.boxShadow : 'none'
        }}
      >`
);

file = file.replace(
  /<div style={S\.astraGlow}><span style={{ fontSize: 22 }}>🎧<\/span><\/div>/g,
  `<div style={{
          ...S.astraGlow,
          background: isGated ? S.astraGlow.background : 'radial-gradient(circle at center, rgba(16, 185, 129, 0.4) 0%, transparent 70%)',
          boxShadow: isGated ? S.astraGlow.boxShadow : '0 0 20px rgba(16, 185, 129, 0.4)'
        }}>
          <span style={{ fontSize: 22 }}>{isGated ? '🎧' : '✅'}</span>
        </div>`
);

file = file.replace(
  /<div style={S\.astraTitle}>ASTRA daily check-in<\/div>/g,
  `<div style={S.astraTitle}>{isGated ? 'ASTRA daily check-in' : 'ASTRA Check-in Completed'}</div>`
);

file = file.replace(
  /<div style={S\.astraSub}>Open a private voice check-in to track today's mood<\/div>/g,
  `<div style={S.astraSub}>{isGated ? "Open a private voice check-in to track today's mood" : "You've successfully completed your check-in for today."}</div>`
);

file = file.replace(
  /<ChevronRightIcon size={20} color={C\.purple} \/>/g,
  `{isGated && <ChevronRightIcon size={20} color={C.purple} />}`
);

fs.writeFileSync('frontend/src/pages/StudentDashboardMobile.jsx', file);
console.log('patched');
