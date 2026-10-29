import { root } from './lib/config.mjs';
import { run } from './lib/processes.mjs';
import { resolveChromeBin } from './lib/browser.mjs';

if (!process.env.npm_execpath) throw new Error('Use npm run test:web');
const env = { ...process.env };
// Look up on the live process.env: on Windows it is case-insensitive (ProgramFiles vs PROGRAMFILES), a copy is not.
const browser = resolveChromeBin({ env: process.env });
if (browser.source === 'playwright') {
    env.CHROME_BIN = browser.path;
    console.log(`CHROME_BIN not set and no system Chrome found; using Playwright Chromium: ${browser.path}`);
} else if (browser.source === 'none') {
    console.warn('No Chrome found. Install Playwright Chromium (npm exec --workspace=@tobu/web -- playwright install chromium) or set CHROME_BIN; Karma will fail without a browser.');
}
await run(process.execPath, [process.env.npm_execpath, 'run', 'test:unit', '--workspace=@tobu/web'], { cwd: root, env });
