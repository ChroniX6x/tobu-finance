import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
export const ownedChildren = new Set();

export async function assertPortFree(port) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', () => reject(new Error(`Port ${port} is occupied. Stop the existing service or change the configured port.`)));
    server.listen(port, '127.0.0.1', resolve);
  });
  await new Promise(resolve => server.close(resolve));
}
export function start(command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'inherit', windowsHide: true, ...options });
  ownedChildren.add(child);
  child.once('exit', () => ownedChildren.delete(child));
  child.once('error', error => { child.spawnError = error; ownedChildren.delete(child); });
  child.done = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal })); });
  // Keep spawn failures observable without an unhandled rejection during readiness.
  child.done.catch(() => {});
  return child;
}
export async function run(command, args, options = {}) {
  const child = start(command, args, options);
  const result = await child.done;
  if (result.code !== 0) throw new Error(`${command} ${args[0] ?? ''} failed (${result.code ?? result.signal})`);
}
export async function capture(command, args, options = {}) {
  const child = start(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', error = '';
  child.stdout.on('data', d => { output += d; }); child.stderr.on('data', d => { error += d; });
  const timer = setTimeout(() => child.kill(), 120000);
  try {
    const result = await child.done;
    if (result.code !== 0) throw new Error(error.trim() || `${command} failed`);
    return output.trim();
  } finally { clearTimeout(timer); }
}
export async function stop(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    await capture('taskkill', ['/PID', String(child.pid), '/T', '/F']).catch(() => { child.kill('SIGTERM'); });
  } else {
    if (child.spawnargs && child.pid) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
    }
  }
  let timer;
  try { await Promise.race([child.done.catch(() => {}), new Promise(resolve => { timer = setTimeout(resolve, 5000); })]); }
  finally { clearTimeout(timer); }
  if (child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    await child.done.catch(() => {});
  }
}
export async function waitHttp(url, child, timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (child?.spawnError) throw child.spawnError;
    if (child && (child.exitCode !== null || child.signalCode !== null)) throw new Error(`Service exited before readiness: ${url}`);
    try { const response = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (response.ok) return; } catch {}
    await delay(250);
  }
  throw new Error(`Readiness timeout: ${url}`);
}
