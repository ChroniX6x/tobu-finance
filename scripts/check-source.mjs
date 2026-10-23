import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, apiRequire } from './lib/config.mjs';
import { capture } from './lib/processes.mjs';

const ts = apiRequire('typescript');
const mode = process.argv[2];
if (mode !== 'lint') throw new Error('Use lint');
const paths = (await capture('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root })).split(/\r?\n/);
const errors = [];
for (const path of new Set(paths)) {
    // Historical migration sources and vendor assets are preserved byte-for-byte.
    if (!/^(apps\/(api|web)\/(src|tests|scripts)\/|packages\/contracts\/|scripts\/)/.test(path) || !/\.(ts|mjs|cjs|js|html|scss|json)$/.test(path)) continue;
    const text = await readFile(resolve(root, path), 'utf8');
    if (/^(<<<<<<< |=======\s*$|>>>>>>> )/m.test(text)) errors.push(`${path}: merge conflict marker`);
    if (!/\.(ts|mjs|cjs|js)$/.test(path)) continue;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    for (const diagnostic of source.parseDiagnostics) errors.push(`${path}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
    const visit = (node) => {
        if (node.kind === ts.SyntaxKind.DebuggerStatement) errors.push(`${path}: debugger statement`);
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            const call = node.expression.getText(source);
            if (/^(test|it|describe)(\.\w+)*\.(only|skip|fixme|todo)$/.test(call)) errors.push(`${path}: forbidden focused/skipped test ${call}`);
        }
        if (path.startsWith('apps/web/src/') && ts.isImportDeclaration(node)) {
            const target = node.moduleSpecifier.text;
            if (/^(node:|mongodb$|mongoose$|express$|@tobu\/api)/.test(target) || target.includes('/apps/api/')) errors.push(`${path}: server-only import ${target}`);
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
}
if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
} else console.log('Source safety rules passed');
