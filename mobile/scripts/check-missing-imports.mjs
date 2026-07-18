// Guard: fail the build if any React component or react-native global is USED
// in executable code (JSX tag, component={X}, or `X.create`/call) but NOT
// imported/declared in that file.
//
// Why this exists: two consecutive on-device crashes
//   ReferenceError: Property 'StyleSheet' doesn't exist
//   ReferenceError: Property 'ReceiveScreen' doesn't exist
// were both "missing import used at module scope" bugs that Metro bundles
// happily (import statement is syntactically valid) and only crash at runtime
// under Hermes. This scan reproduces the crash class at build time.
//
// Run:  node scripts/check-missing-imports.mjs   (exit 1 on violation)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');
const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx']);

const localImport = /import\s+(?:type\s+)?(?:(?:\*\s+as\s+(\w+))|(\w+)|(\{[^}]*\}))\s+from\s+['"]\./g;
const pkgImport = /import\s+(?:type\s+)?(?:(?:\*\s+as\s+(\w+))|(\w+)|(\{[^}]*\}))\s+from\s+['"]([^.'"][^'"]*)['"]/g;
const declare = /(?:export\s+default\s+(?:function|class|const)\s+(\w+)|(?:const|let|var|function|class)\s+(\w+))/g;
const jsxTag = /<([A-Z][A-Za-z0-9_]*)\b/g;
const componentProp = /component=\{([A-Z][A-Za-z0-9_]*)\}/g;
// Strip block/line comments and string/template literals so we only test
// real executable code, not text like Alert.alert('Switch created').
function stripNoise(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')        // block comments
    .replace(/\/\/[^\n]*/g, ' ')              // line comments
    .replace(/`(?:\\.|[^`\\])*`/g, '``')       // template literals
    .replace(/'(?:\\.|[^'\\])*'/g, "''")       // single-quote strings
    .replace(/"(?:\\.|[^"\\])*"/g, '""');      // double-quote strings
}
// react-native GLOBAL used as a value (e.g. StyleSheet.create / <View/>).
// Only matches real usage, not contract names like createSwitch or switchId.
const rnGlobalUse = /\b(StyleSheet|View|Text|Image|TextInput|ScrollView|TouchableOpacity|Pressable|SafeAreaView|FlatList|Modal|Switch|ActivityIndicator)\b(?:\.(?!_|[a-z]+\()|\s)/g;
const rnImportLine = /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/g;

const RN_BUILTINS = new Set([
  'View','Text','Image','TextInput','ScrollView','TouchableOpacity',
  'TouchableWithoutFeedback','Pressable','SafeAreaView','FlatList','SectionList',
  'ActivityIndicator','Modal','Switch','StatusBar','KeyboardAvoidingView',
  'RefreshControl','Animated','Clipboard','StyleSheet',
]);

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (EXTS.has(p.slice(p.lastIndexOf('.')))) out.push(p);
  }
  return out;
}

let violations = 0;
for (const file of walk(ROOT)) {
  let src;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }

  const imported = new Set();
  const declared = new Set();
  let m;

  while ((m = localImport.exec(src))) {
    if (m[1]) imported.add(m[1]);
    if (m[2]) imported.add(m[2]);
    if (m[3]) for (const n of m[3].match(/\w+/g) || []) imported.add(n);
  }
  while ((m = pkgImport.exec(src))) {
    if (m[1]) imported.add(m[1]);
    if (m[2]) imported.add(m[2]);
    if (m[3]) for (const n of m[3].match(/\w+/g) || []) imported.add(n);
  }
  while ((m = declare.exec(src))) imported.add(m[1] || m[2]);
  const de = src.match(/export\s+default\s+(\w+)/);
  if (de) declared.add(de[1]);

  // 1) executable component usage — scan stripped code only
  const code = stripNoise(src);
  const used = new Set();
  let u;
  while ((u = jsxTag.exec(code))) used.add(u[1]);
  while ((u = componentProp.exec(code))) used.add(u[1]);
  for (const name of used) {
    if (!imported.has(name) && !declared.has(name) && !RN_BUILTINS.has(name)) {
      console.error(`MISSING IMPORT: ${file}\n  uses <${name}/> / component={${name}} but never imports it`);
      violations++;
    }
  }

  // 2) react-native global used but not in the react-native import line
  const rnNames = new Set();
  let r;
  while ((r = rnImportLine.exec(src))) for (const n of r[1].match(/\w+/g) || []) rnNames.add(n);
  const usedRn = new Set();
  while ((u = rnGlobalUse.exec(code))) usedRn.add(u[1]);
  for (const name of usedRn) {
    if (!rnNames.has(name) && !imported.has(name) && !declared.has(name)) {
      console.error(`MISSING RN IMPORT: ${file}\n  uses '${name}.' but '${name}' is not imported from react-native`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\nFAILED: ${violations} missing-import violation(s). Fix before build.`);
  process.exit(1);
}
console.log('OK: no missing-import usages detected.');
