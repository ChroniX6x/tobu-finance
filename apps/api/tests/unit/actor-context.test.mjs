import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('system actor: closed trigger set, verified initiator format, immutable', async () => {
    const { createSystemActor } = await import(pathToFileURL(join(root, 'dist/src/auth/system-actor.js')).href);
    for (const trigger of ['account_open', 'automation', 'system_reconciliation']) {
        const actor = createSystemActor(trigger);
        assert.deepEqual({ ...actor }, { kind: 'system', trigger });
        assert.ok(Object.isFrozen(actor));
    }
    const initiated = createSystemActor('account_open', '0123456789abcdef01234567');
    assert.equal(initiated.initiatedByUserId, '0123456789abcdef01234567');
    for (const trigger of ['user_action', 'cron', '', undefined, { kind: 'automation' }]) assert.throws(() => createSystemActor(trigger), /Unknown system trigger/);
    for (const bad of ['alice', '123', {}, ['0123456789abcdef01234567']]) assert.throws(() => createSystemActor('automation', bad), /verified user id/);
});

test('system actor is internal: no route and no request-reading code can reach it', () => {
    const routeDir = join(root, 'src/routes');
    for (const file of readdirSync(routeDir).filter((name) => name.endsWith('.ts'))) {
        const source = stripComments(readFileSync(join(routeDir, file), 'utf8'));
        assert.doesNotMatch(source, /system-actor|createSystemActor|SystemActor/, `${file} must not create a system actor`);
        assert.doesNotMatch(source, /req(uest)?\.(body|data)\??\.(actor|trigger|subject|actorUserId|actorKind|initiatedByUserId)\b/, `${file} must not read actor fields from the request`);
        assert.doesNotMatch(source, /req\.headers?\[?['"]x-/i, `${file} must not trust identity headers`);
    }
    const system = stripComments(readFileSync(join(root, 'src/auth/system-actor.ts'), 'utf8'));
    assert.doesNotMatch(system, /\b(req|res|request|headers|body)\b|from ['"]express/, 'the system actor module never touches the request');
    const context = stripComments(readFileSync(join(root, 'src/auth/account-context.ts'), 'utf8'));
    assert.doesNotMatch(context, /req\.(body|data|headers|query|params)\b/, 'identity comes only from the verified token');
    assert.doesNotMatch(context, /roles/, 'global roles are never consulted for account access');
});
