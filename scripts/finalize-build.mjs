import { readdir, readFile, writeFile } from 'node:fs/promises';
const directory = new URL('../dist/', import.meta.url);
// CSS is emitted as one explicit stylesheet. Its source imports must not leak
// into declarations as paths to stylesheets that are absent from the package.
for (const name of await readdir(directory)) {
  if (!name.endsWith('.d.ts')) continue;
  const file = new URL(name, directory);
  const content = await readFile(file, 'utf8');
  await writeFile(file, content.replace(/^import ['"][^'"]+\.css['"];?\r?\n/gm, ''));
}
await writeFile(new URL('style.d.ts', directory), 'export {};\n');
