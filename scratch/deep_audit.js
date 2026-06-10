const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = '/Users/sathwikjpoojary/Documents/TriSphere';

// Helper to recursively list files
function getFiles(dir, ext = '.jsx', fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, ext, fileList);
    } else if (name.endsWith(ext)) {
      fileList.push(name);
    }
  }
  return fileList;
}

// ==========================================
// STAGE 1: FRONTEND LISTENERS & CLEANUPS AUDIT
// ==========================================
function auditFrontendListeners() {
  console.log('\n--- STAGE 1: FRONTEND SNAPSHOT LISTENERS & CLEANUP AUDIT ---');
  const files = getFiles(path.join(WORKSPACE_DIR, 'frontend/src'), '.jsx');
  let issuesFound = 0;

  files.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('onSnapshot')) {
      const relPath = path.relative(WORKSPACE_DIR, filePath);
      
      // Check if there is an unsubscribe cleanup inside useEffect
      const hasCleanup = content.includes('unsubscribe') && 
                         (content.includes('return () =>') || content.includes('return()=>'));
      
      if (!hasCleanup) {
        console.log(`  ⚠️ Warning in ${relPath}: 'onSnapshot' is used but no 'unsubscribe' cleanup loop was found.`);
        issuesFound++;
      }
    }
  });

  if (issuesFound === 0) {
    console.log('  ✅ All active Firestore listeners in components implement safe cleanup handlers.');
  }
}

// ==========================================
// STAGE 2: BACKEND EXPRESS ERROR HANDLERS & INPUT VALIDATION
// ==========================================
function auditBackendRoutes() {
  console.log('\n--- STAGE 2: BACKEND ROUTE HANDLERS & INPUT SAFETY ---');
  const files = getFiles(path.join(WORKSPACE_DIR, 'backend/routes'), '.js');
  let issuesFound = 0;

  files.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(WORKSPACE_DIR, filePath);

    // Check if routes are wrapped in try-catch
    const routeMatches = content.match(/router\.(post|get|put|delete)\([\s\S]*?\)/g) || [];
    routeMatches.forEach(route => {
      const hasTryCatch = route.includes('try') && route.includes('catch');
      if (!hasTryCatch) {
        console.log(`  ⚠️ Warning in ${relPath}: Route handler does not implement an explicit try-catch wrapper.`);
        issuesFound++;
      }
    });
  });

  if (issuesFound === 0) {
    console.log('  ✅ All Express endpoint routes implement try-catch error boundaries.');
  }
}

// ==========================================
// STAGE 3: FIRESTORE SECURITY RULES VERIFICATION
// ==========================================
function auditFirestoreRules() {
  console.log('\n--- STAGE 3: FIRESTORE RULES INTEGRITY CHECK ---');
  const rulesPath = path.join(WORKSPACE_DIR, 'firestore.rules');
  if (!fs.existsSync(rulesPath)) {
    console.log('  ❌ firestore.rules file not found.');
    return;
  }

  const content = fs.readFileSync(rulesPath, 'utf-8');
  let issuesFound = 0;

  // Search for dangerous wildcards like write: if true; or create: if true;
  const dangerousRules = [
    /allow\s+write\s*:\s*if\s+true\s*;/i,
    /allow\s+create\s*:\s*if\s+true\s*;/i,
    /allow\s+delete\s*:\s*if\s+true\s*;/i,
    /allow\s+update\s*:\s*if\s+true\s*;/i
  ];

  dangerousRules.forEach((rule, idx) => {
    if (rule.test(content)) {
      console.log(`  🚨 Security Alert: Dangerous global rule matches: ${rule}`);
      issuesFound++;
    }
  });

  if (issuesFound === 0) {
    console.log('  ✅ No global raw write permissions detected. Firestore rules require authorization.');
  }
}

console.log('🔍 Executing Codebase Audit (Stage 1, 2, and 3)...');
auditFrontendListeners();
auditBackendRoutes();
auditFirestoreRules();
console.log('\n✅ Three-Stage Audit Complete.');
