import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveChromeBin, systemChromeCandidates } from '../lib/browser.mjs';

const never = () => false;
const only =
    (...paths) =>
    (path) =>
        paths.includes(path);
const windowsEnv = { LOCALAPPDATA: 'C:\\Users\\dev\\AppData\\Local', PROGRAMFILES: 'C:\\Program Files', 'PROGRAMFILES(X86)': 'C:\\Program Files (x86)' };

test('an explicit CHROME_BIN is never replaced, even if the file is missing', () => {
    const result = resolveChromeBin({ env: { CHROME_BIN: '/custom/chrome' }, platform: 'linux', exists: never, playwright: () => '/pw/chrome' });
    assert.deepEqual(result, { source: 'env', path: '/custom/chrome' });
});

test('an empty CHROME_BIN counts as not set', () => {
    assert.deepEqual(resolveChromeBin({ env: { CHROME_BIN: '' }, platform: 'linux', exists: only('/pw/chrome'), playwright: () => '/pw/chrome' }), { source: 'playwright', path: '/pw/chrome' });
});

test('system Chrome candidates match what ChromeHeadless searches, on every host OS', () => {
    assert.deepEqual(systemChromeCandidates('linux', { PATH: '/opt/bin::/usr/bin' }), ['/opt/bin/google-chrome', '/opt/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']);
    assert.deepEqual(systemChromeCandidates('linux', {}), []);
    assert.deepEqual(systemChromeCandidates('darwin', {}), ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']);
    assert.deepEqual(systemChromeCandidates('win32', windowsEnv), [
        'C:\\Users\\dev\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ]);
    assert.deepEqual(systemChromeCandidates('win32', { PROGRAMFILES: 'C:\\Program Files' }), ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe']);
});

test('an installed system Chrome wins over Playwright Chromium and leaves CHROME_BIN to Karma', () => {
    const cases = [
        ['linux', { PATH: '/opt/bin:/usr/bin' }, '/opt/bin/google-chrome-stable'],
        ['darwin', {}, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
        ['win32', windowsEnv, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe']
    ];
    for (const [platform, env, chrome] of cases) assert.deepEqual(resolveChromeBin({ env, platform, exists: only(chrome, '/pw/chrome'), playwright: () => '/pw/chrome' }), { source: 'system' });
});

test('Chromium alone is not a system Chrome for ChromeHeadless and falls back to Playwright', () => {
    const exists = only('/usr/bin/chromium', '/usr/bin/chromium-browser', '/pw/chrome');
    assert.deepEqual(resolveChromeBin({ env: { PATH: '/usr/bin' }, platform: 'linux', exists, playwright: () => '/pw/chrome' }), { source: 'playwright', path: '/pw/chrome' });
});

test('Playwright Chromium is only a fallback and only if the binary exists', () => {
    assert.deepEqual(resolveChromeBin({ env: {}, platform: 'linux', exists: only('/pw/chrome'), playwright: () => '/pw/chrome' }), { source: 'playwright', path: '/pw/chrome' });
    assert.deepEqual(resolveChromeBin({ env: {}, platform: 'linux', exists: never, playwright: () => '/pw/chrome' }), { source: 'none' });
    assert.deepEqual(resolveChromeBin({ env: {}, platform: 'linux', exists: only('/pw/chrome'), playwright: () => undefined }), { source: 'none' });
});
