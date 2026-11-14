// F5 replay: historical route bodies are read verbatim from Git, never reconstructed.
// Current auth/bootstrap/models keep the probe local and authenticated; this is not a claim about the full old runtime.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const uri = new URL(process.env.MONGODB_URI);
if (process.env.NODE_ENV !== 'test' || !['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname) || !/^\/tobu_test_[a-f0-9]{32}$/.test(uri.pathname)) throw new Error('An isolated local P02 test database is mandatory');
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const revision = execFileSync('git', ['rev-parse', '1296f3bee3ac3fe92178b45211b48538be42c0cd^'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const bindImports = (source, base, replacements = new Map()) =>
    source.replace(/(from\s+|import\s+)(['"])([^'"]+)\2/g, (_match, prefix, quote, specifier) => {
        const resolved = specifier.startsWith('.') ? new URL(specifier, base).href : import.meta.resolve(specifier);
        return `${prefix}${quote}${replacements.get(resolved) ?? resolved}${quote}`;
    });
const replacements = new Map();
for (const name of ['categories', 'recurrences', 'category-budgets']) {
    const source = execFileSync('git', ['show', `${revision}:apps/api/src/routes/${name}.ts`], { cwd: root, encoding: 'utf8', windowsHide: true });
    console.log(JSON.stringify({ historicalRoute: name, revision, sha256: createHash('sha256').update(source).digest('hex') }));
    const currentUrl = new URL(`../../dist/src/routes/${name}.js`, import.meta.url);
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
    replacements.set(currentUrl.href, dataUrl(bindImports(js, currentUrl)));
}
const server = new URL('../../dist/src/server.js', import.meta.url);
await import(dataUrl(bindImports(readFileSync(server, 'utf8'), server, replacements)));
