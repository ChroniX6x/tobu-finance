import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root } from './lib/config.mjs';
import { capture, run } from './lib/processes.mjs';

if (!process.env.npm_execpath) throw new Error('Use npm run quality or quality:full');
const full = process.argv.includes('--full');
const checks = ['check:workspace', 'format:check', 'lint', 'typecheck', 'check:contracts', 'test:contracts', 'build', 'test:tooling', 'test:api', 'test:web', 'e2e'];
if (full) checks.push('test:integration', 'e2e:real', 'test:lifecycle', 'package:artifact', 'test:artifact');
const report = { commit: await capture('git', ['rev-parse', 'HEAD'], { cwd: root }), dirty: Boolean(await capture('git', ['status', '--porcelain'], { cwd: root })), node: process.version, full, started: new Date().toISOString(), checks: [] };
try {
    for (const check of checks) {
        console.log(`\nQuality: ${check}`);
        const result = { command: `npm run ${check}`, status: 'failed' };
        report.checks.push(result);
        await run(process.execPath, [process.env.npm_execpath, 'run', check], { cwd: root });
        result.status = 'passed';
    }
    console.log(full ? 'GATE 5 AUTOMATED VERIFICATION PASSED' : 'QUALITY CHECKS PASSED (Docker checks require quality:full)');
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    report.finished = new Date().toISOString();
    await mkdir(resolve(root, 'test-results'), { recursive: true });
    await writeFile(resolve(root, 'test-results/quality.json'), JSON.stringify(report, null, 2) + '\n');
}
