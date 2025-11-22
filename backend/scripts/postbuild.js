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
  "const { DataSource } = require('typeorm');",
  "const path = require('path');",
  "const entitiesGlob = path.join(__dirname, '**/*.entity.js');",
  "const migrationsGlob = path.join(__dirname, 'migrations/*.js');",
  "const cfg = {",
  "  type: 'postgres',",
  "  host: process.env.DB_HOST,",
  "  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,",
  "  username: process.env.DB_USER,",
  "  password: process.env.DB_PASS,",
  "  database: process.env.DB_NAME,",
  "  url: process.env.DB_URL || undefined,",
  "  entities: [entitiesGlob],",
  "  migrations: [migrationsGlob],",
  "  synchronize: false,",
  "  migrationsRun: false,",
  "  logging: false,",
  "};",
  "const ds = new DataSource(cfg);",
  "module.exports = ds;",
  "module.exports.default = ds;",
  "module.exports.AppDataSource = ds;",
  '',
].join('\n');

fs.writeFileSync(targetPath, stub);
console.log('[postbuild] Wrote dist/data-source.js stub.');
