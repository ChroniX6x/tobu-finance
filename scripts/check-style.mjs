import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ESLint } from 'eslint';
import * as prettier from 'prettier';
import { root } from './lib/config.mjs';
import { capture } from './lib/processes.mjs';

const mode = process.argv[2];
const baselineRef = process.argv.find((arg) => arg.startsWith('--baseline-ref='))?.split('=')[1];
if (!['lint', 'format'].includes(mode)) throw new Error('Use lint or format');
const paths = [...new Set((await capture('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root })).split(/\r?\n/))]
    .filter((path) => /^(apps\/(api|web)\/(src|tests|scripts)\/|packages\/contracts\/|scripts\/|eslint\.config\.mjs$)/.test(path))
    .filter((path) => /\.(ts|mjs|cjs|js|html|scss)$/.test(path));
const filename = resolve(root, `docs/migration/evidence/${mode}-baseline.json`);
const baseline = baselineRef ? {} : JSON.parse(await readFile(filename, 'utf8'));
const eslint = new ESLint({ cwd: root });
const errors = [];
const execFileAsync = promisify(execFile);
const hash = (text) => createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex');
for (const path of paths) {
    let text;
    if (baselineRef) {
        try {
            text = (await execFileAsync('git', ['show', `${baselineRef}:${path}`], { cwd: root, encoding: 'utf8', maxBuffer: 5_000_000, windowsHide: true })).stdout;
        } catch {
            continue;
        } // New files never receive baseline exceptions.
    } else text = await readFile(resolve(root, path), 'utf8');
    if (mode === 'format') {
        const options = { ...(await prettier.resolveConfig(resolve(root, path))), filepath: resolve(root, path) };
        if (await prettier.check(text.replaceAll('\r\n', '\n'), options)) continue;
        if (baselineRef) baseline[path] = hash(text);
        else if (baseline[path] !== hash(text)) errors.push(`${path}: run Prettier on this new/changed file`);
    } else if (/\.(ts|mjs|cjs|js)$/.test(path)) {
        const results = await eslint.lintText(text, { filePath: resolve(root, path) });
        const allowed = { ...(baseline[path] ?? {}) };
        const found = {};
        for (const result of results)
            for (const message of result.messages) {
                const lines = text.split(/\r?\n/);
                const selected = lines.slice(message.line - 1, message.endLine ?? message.line);
                selected[selected.length - 1] = selected.at(-1).slice(0, (message.endColumn ?? selected.at(-1).length + 1) - 1);
                selected[0] = selected[0].slice(message.column - 1);
                const snippet = selected.join('\n');
                const key = `${message.ruleId}|${message.message}|${snippet.replace(/\s+/g, ' ').trim()}`;
                found[key] = (found[key] ?? 0) + 1;
                if (!baselineRef && !allowed[key]) errors.push(`${path}:${message.line}: ${message.ruleId}: ${message.message}`);
                else allowed[key]--;
            }
        if (baselineRef && Object.keys(found).length) baseline[path] = found;
    }
}
if (baselineRef) await writeFile(filename, JSON.stringify(baseline, null, 2) + '\n');
else if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
} else console.log(`${mode}: ${mode === 'lint' ? 'ESLint recommended + TypeScript recommended' : 'Prettier'} passed; legacy exceptions are recorded, new violations fail`);
