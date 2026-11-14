// CI guard: the v3.1 app must not silently reintroduce the retired v1/v2 frontend.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const retired = [
  'src/App.tsx', 'src/screens', 'src/lib', 'src/styles',
  'src/design-system', 'src/sekka-system.css', 'src/auth-login-screen-two.css',
];
const stillThere = retired.filter(name => fs.existsSync(path.join(root, name)));
if (stillThere.length) {
  console.error('Retired frontend paths must stay out of the active source tree:', stillThere.join(', '));
  process.exitCode = 1;
}
const entry = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
if (!entry.includes('from "./v2/App"') || !entry.includes('from "./v2/preferences"')) {
  console.error('The entrypoint must use the current v3.1 application and preferences.');
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
