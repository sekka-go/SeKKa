// CI guard: the v3.1 app must not silently reintroduce the retired v1/v2 frontend.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const retired = [
  'src/App.tsx', 'src/screens', 'src/lib', 'src/styles',
  'src/design-system', 'src/sekka-system.css', 'src/auth-login-screen-two.css',
];
const stillThere = retired.filter(name => fs.existsSync(path.join(root, name)));
const retiredRepositoryPaths = [
  'docs/archive/pre-v3.1', 'docs/product-spec',
  'docs/LEGACY_AUDIT.md', 'docs/LEGACY_REPLACEMENT_MATRIX.md',
  'docs/RESET_AUDIT.md', 'docs/OPEN_QUESTIONS.md',
  'docs/PRODUCTION_BACKEND_INTEGRATION.md',
  'web/public/assets/sekka', 'web/public/images/sekka-login-skyline.jpg',
];
const repositoryRoot = path.resolve(root, '..');
const obsolete = retiredRepositoryPaths.filter(name =>
  fs.existsSync(path.join(repositoryRoot, name)));
if (obsolete.length) {
  console.error('Superseded PRD / historical files have returned:', obsolete.join(', '));
  process.exitCode = 1;
}

if (stillThere.length) {
  console.error('Retired frontend paths must stay out of the active source tree:', stillThere.join(', '));
  process.exitCode = 1;
}
const entry = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
// Public entry mounts the real MobileApp; the approved 73-screen gallery must
// remain reachable only through a lazy import on its exact developer route.
// A static App import would bundle the developer gallery into every PWA visit.
const hasPreferences = /from\s+["']\.\/v2\/preferences["']/.test(entry);
const hasMobileApp = /from\s+["']\.\/v2\/MobileApp["']/.test(entry);
const hasLazyGallery = /React\.lazy\s*\(\s*\(\)\s*=>\s*import\s*\(\s*["']\.\/v2\/App["']\s*\)\s*\)/.test(entry);
const hasStaticGallery = /from\s+["']\.\/v2\/App["']/.test(entry);
const hasExactDeveloperRoute = entry.includes('["/dev/screens", "/dev/screens/"].includes(window.location.pathname)');
if (!hasPreferences || !hasMobileApp || !hasLazyGallery || hasStaticGallery || !hasExactDeveloperRoute) {
  console.error('The public entry must mount MobileApp with preferences and lazily isolate the 73-screen gallery on its exact /dev/screens route.');
  process.exitCode = 1;
}
const activeFiles = ['src/main.tsx', 'vite.config.ts'];
function visit(folder) {
  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, item.name);
    if (item.isDirectory()) visit(full);
    else if (/\.(tsx?|css)$/.test(item.name)) activeFiles.push(path.relative(root, full));
  }
}
visit(path.join(root, 'src/v2'));
for (const file of activeFiles) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (/from\s*['"][^'"]*\/(screens|lib|design-system|styles)\/|@import\s*['"][^'"]*\/(screens|lib|design-system|styles)\//.test(content)) {
    console.error('Active file imports retired frontend:', file);
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log('Active seKKa v3.1 frontend has no retired-source dependencies.');
