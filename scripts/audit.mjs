import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const originalFiles = execFileSync('git', ['ls-tree', '-rz', '--name-only', 'HEAD'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile).config;
const { options } = ts.parseJsonConfigFileContent(config, ts.sys, process.cwd());
const problems = [];
const rows = [];
let serverFunctions = 0;
for (const file of originalFiles) {
  const original = execFileSync('git', ['show', `HEAD:${file}`], { maxBuffer: 8 * 1024 * 1024 });
  const exists = fs.existsSync(file);
  const data = exists ? fs.readFileSync(file) : original;
  const binary = file.endsWith('.ico');
  const text = binary ? '' : data.toString('utf8');
  const imports = [];
  const tables = [...new Set([...text.matchAll(/\.from\(["']([^"']+)["']\)/g)].map(m => m[1]))];
  if (exists && /\.(ts|tsx)$/.test(file)) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function visit(node) {
      let name;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) name = node.moduleSpecifier.text;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) name = node.arguments[0].text;
      if (name) imports.push(name);
      ts.forEachChild(node, visit);
    }
    visit(source);
    for (const name of imports) {
      if (!name.startsWith('.') && !name.startsWith('@/')) continue;
      const clean = name.split('?')[0];
      const resolved = ts.resolveModuleName(clean, path.resolve(file), options, ts.sys).resolvedModule;
      const asset = name.startsWith('@/') ? path.resolve('src',clean.slice(2)) : path.resolve(path.dirname(file),clean);
      if (!resolved && !fs.existsSync(asset)) problems.push(`${file}: ${name}`);
    }
    serverFunctions += (text.match(/createServerFn\(/g) ?? []).length;
  }
  let kind = binary ? 'Asset binário preservado' : file.startsWith('supabase/migrations/') ? 'Schema / RLS / funções SQL' : file.startsWith('src/routes/') ? 'Rota / layout / API' : file.startsWith('src/components/') ? 'Componente React local' : file.startsWith('src/lib/') ? 'Regra de negócio / schema / utilitário' : file.startsWith('src/hooks/') ? 'Hook React' : file.endsWith('.md') ? 'Documentação' : 'Configuração / integração / tipos';
  if (!exists) kind += ' — removido';
  const hash = createHash('sha256').update(original).digest('hex');
  rows.push({ file, originalBytes: original.length, sha256: hash, lines: binary ? null : text.split('\n').length, kind, imports, tables });
}
fs.mkdirSync('docs',{recursive:true});
fs.writeFileSync('docs/audit.json',JSON.stringify({originalCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), originalFileCount:rows.length, serverFunctions, unresolvedLocalImports:problems, files:rows},null,2)+'\n');
fs.writeFileSync('docs/FILES.md','# Inventário do repositório original\n\nTodos os arquivos rastreados no commit original foram lidos por varredura automatizada; imports locais de TypeScript foram resolvidos e integrações foram inventariadas. Isso não equivale a teste funcional de cada fluxo com dados reais. Os módulos de migração e integrações foram também inspecionados diretamente. Hashes, imports e tabelas por arquivo estão em `audit.json`. O conteúdo de `.env` não é reproduzido.\n\n| Arquivo | Bytes originais | Classificação |\n| --- | ---: | --- |\n'+rows.map(r=>`| \`${r.file}\` | ${r.originalBytes} | ${r.kind} |`).join('\n')+'\n');
console.log(JSON.stringify({files:rows.length,serverFunctions,unresolvedLocalImports:problems},null,2));
if(problems.length) process.exitCode=1;
