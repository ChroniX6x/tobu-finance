import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, posix, win32 } from 'node:path';
import { root } from './config.mjs';

// Mirrors where karma-chrome-launcher looks for ChromeHeadless (Linux: google-chrome[-stable] on PATH). Chromium is
// deliberately not listed: ChromeHeadless does not use it, so it is only reachable through an explicit CHROME_BIN.
export function systemChromeCandidates(platform = process.platform, env = process.env) {
    if (platform === 'win32') return [env.LOCALAPPDATA, env.PROGRAMFILES, env['PROGRAMFILES(X86)']].filter(Boolean).map((base) => win32.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    if (platform === 'darwin') return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
    return (env.PATH ?? '')
        .split(':')
        .filter(Boolean)
        .flatMap((directory) => ['google-chrome', 'google-chrome-stable'].map((name) => posix.join(directory, name)));
}

export function playwrightChromium() {
    try {
        return createRequire(join(root, 'package.json'))('@playwright/test').chromium.executablePath();
    } catch {
        return undefined;
    }
}

// An explicit CHROME_BIN or an installed system Chrome always wins. Playwright's Chromium is only a local fallback.
export function resolveChromeBin({ env = process.env, platform = process.platform, exists = existsSync, playwright = playwrightChromium } = {}) {
    if (env.CHROME_BIN) return { source: 'env', path: env.CHROME_BIN };
    if (systemChromeCandidates(platform, env).some((candidate) => exists(candidate))) return { source: 'system' };
    const bundled = playwright();
    if (bundled && exists(bundled)) return { source: 'playwright', path: bundled };
    return { source: 'none' };
}
