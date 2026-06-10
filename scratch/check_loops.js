const fs = require('fs');
const path = require('path');

const SRC_DIR = '/Users/sathwikjpoojary/Documents/TriSphere/frontend/src';

// Helper to recursively list files
function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, fileList);
    } else if (name.endsWith('.jsx') || name.endsWith('.js')) {
      fileList.push(name);
    }
  }
  return fileList;
}

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes('useEffect')) return;

  const relativePath = path.relative(SRC_DIR, filePath);
  
  // Basic regex to find useEffect blocks
  const useEffectRegex = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[([\s\S]*?)\]\s*\)/g;
  let match;
  let foundIssues = false;

  while ((match = useEffectRegex.exec(content)) !== null) {
    const blockBody = match[1];
    const dependenciesRaw = match[2];
    
    // Parse dependencies
    const dependencies = dependenciesRaw
      .split(',')
      .map(d => d.trim().replace(/\?/g, ''))
      .filter(d => d && !d.includes('.') && !d.includes('"') && !d.includes("'"));

    // Find state setters like setXYZ inside body
    const stateSetters = [];
    const setterRegex = /set([A-Z][a-zA-Z0-9_]*)/g;
    let setterMatch;
    while ((setterMatch = setterRegex.exec(blockBody)) !== null) {
      const setterName = setterMatch[1];
      const stateVar = setterName.charAt(0).toLowerCase() + setterName.slice(1);
      stateSetters.push(stateVar);
    }

    // Check for overlap between state variables being updated and dependencies
    const overlap = dependencies.filter(dep => stateSetters.includes(dep));
    
    if (overlap.length > 0) {
      if (!foundIssues) {
        console.log(`\n📄 File: ${relativePath}`);
        foundIssues = true;
      }
      console.log(`  ⚠️ Potential loop risk detected:`);
      console.log(`    - Dependencies: [${dependenciesRaw.trim().replace(/\s+/g, ' ')}]`);
      console.log(`    - Overlapping state variable(s) mutated inside: ${JSON.stringify(overlap)}`);
      
      // Print first few lines of body for context
      const snippet = blockBody.split('\n').slice(0, 5).join('\n');
      console.log(`    - Body preview:\n      ${snippet.replace(/\n/g, '\n      ')}`);
    }
  }
}

console.log('🔍 Starting TriSphere Codebase Loop Audit...');
const files = getFiles(SRC_DIR);
files.forEach(auditFile);
console.log('\n✅ Audit completed.');
