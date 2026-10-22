import { root } from './lib/config.mjs';
import { run } from './lib/processes.mjs';
// npm_execpath is provided by npm run on Windows, Linux and macOS.
if (!process.env.npm_execpath) throw new Error('Run npm run verify:phase4');
for (const check of ['check:workspace','typecheck','check:contracts','test:contracts','build','test:tooling','test:api','test:web','e2e','test:integration','e2e:real']) {
  console.log(`\nGate 4: ${check}`);
  await run(process.execPath,[process.env.npm_execpath,'run',check],{cwd:root});
}
console.log('GATE 4 AUTOMATED VERIFICATION PASSED');
console.log('Still confirm shared-contract hot reload with npm run dev; see docs/migration/phase-4-results.md.');
