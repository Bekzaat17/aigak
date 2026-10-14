import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}
const graph = new Map();
const violations = [];
for (const file of ['server', 'shared', 'src'].flatMap(files)) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const classes = source.statements.filter(ts.isClassDeclaration);
  if (classes.length > 1) violations.push(`${file}: only one class per file is allowed`);
  for (const declaration of classes)
    if (path.basename(file, '.ts') !== declaration.name.text)
      violations.push(`${file}: name the file ${declaration.name.text}.ts`);
  const edges = [];
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
    const specifier = node.moduleSpecifier?.text;
    if (!specifier) continue;
    const target = specifier.startsWith('.')
      ? path.normalize(path.join(path.dirname(file), specifier))
      : specifier;
    if (file.startsWith('shared/') && (target.startsWith('src/') || target.startsWith('server/')))
      violations.push(`${file}: shared must not depend on ${target}`);
    if (file.startsWith('src/') && target.startsWith('server/'))
      violations.push(`${file}: UI must not depend on server implementations`);
    if (file.startsWith('server/') && target.startsWith('src/'))
      violations.push(`${file}: server must not depend on UI`);
    if (
      file.startsWith('server/application/') &&
      /^(express|multer|playwright|tesseract.js|docxtemplater|pizzip|node:(fs|sqlite|http|https|dns)|server\/(http|bootstrap|storage|collection|templates)\/)/.test(
        target,
      )
    )
      violations.push(`${file}: application must depend on a port, not ${target}`);
    if (node.isTypeOnly || node.importClause?.isTypeOnly) continue;
    if (specifier.startsWith('.')) {
      const resolved = [
        target,
        target + '.ts',
        target + '.tsx',
        path.join(target, 'index.ts'),
      ].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      assert.ok(resolved, `${file}: unresolved import ${specifier}`);
      edges.push(resolved);
    }
  }
  graph.set(file, edges);
}
const visited = new Set();
const active = new Set();
function visit(file, chain = []) {
  if (active.has(file)) {
    violations.push(`Runtime dependency cycle: ${[...chain, file].join(' -> ')}`);
    return;
  }
  if (visited.has(file)) return;
  active.add(file);
  for (const target of graph.get(file) || []) visit(target, [...chain, file]);
  active.delete(file);
  visited.add(file);
}
for (const file of graph.keys()) visit(file);
if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else console.log(`Architecture checks passed (${graph.size} modules).`);
