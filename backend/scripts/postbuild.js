const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const compiledPath = path.join(distDir, 'src', 'data-source.js');
const targetPath = path.join(distDir, 'data-source.js');
const mirrorDirs = ['entities', 'cycle-count', 'skart'];

if (!fs.existsSync(compiledPath)) {
  console.warn('[postbuild] Compiled data-source not found at', compiledPath);
  process.exit(0);
}

mirrorDirs.forEach((dir) => {
  const source = path.join(distDir, dir);
  const target = path.join(distDir, 'src', dir);
  if (!fs.existsSync(source)) {
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
  console.log(`[postbuild] Synced directory ${dir} into dist/src/${dir}.`);
});

const stub = [
  "const exported = require('./src/data-source.js');",
  'module.exports = exported;',
  "if (exported && typeof exported === 'object') {",
  "  if (exported.default && !('default' in module.exports)) {",
  '    module.exports.default = exported.default;',
  '  }',
  "  if (exported.AppDataSource && !('AppDataSource' in module.exports)) {",
  '    module.exports.AppDataSource = exported.AppDataSource;',
  '  }',
  '}',
  '',
].join('\n');

fs.writeFileSync(targetPath, stub);
console.log('[postbuild] Wrote dist/data-source.js stub.');


