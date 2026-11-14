import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as prettier from 'prettier';

const paths = execFileSync('git', ['diff', '--name-only', '65dd4f3', '--', 'apps/web'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/).filter(path => path.endsWith('.ts'));
for (const relative of paths) {
    const path = resolve(relative);
    const text = (await readFile(path, 'utf8')).replaceAll('\r\n', '\n');
    const options = { ...(await prettier.resolveConfig(path)), filepath: path };
    const formatted = await prettier.format(text, options);
    if (text !== formatted) { await writeFile(path, formatted); console.log(relative); }
}
