// Works on Windows and POSIX shells without shell-specific environment syntax.
process.env.NODE_ENV ??= 'production';
await import('../dist/src/server.js');
