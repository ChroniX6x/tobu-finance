import assert from 'node:assert/strict';
import { test } from 'node:test';
import { implementedRoutes } from '../lib/route-contracts.mjs';

test('route discovery survives formatting and ignores comments and unrelated routers', () => {
    const source = [
        'r.get("/", handler);',
        "r.post('/records', handler);",
        'r.patch(\n  `/records/:id`,\n handler\n);',
        "r.delete ( '/records/:id', handler );",
        '// r.put("/comment", handler);',
        'const text = "r.get(\'/string\', handler)";',
        'router.get("/auth", handler);'
    ].join('\n');
    assert.deepEqual(implementedRoutes(source, 'r'), [
        { method: 'get', path: '/' },
        { method: 'post', path: '/records' },
        { method: 'patch', path: '/records/:id' },
        { method: 'delete', path: '/records/:id' }
    ]);
    assert.deepEqual(implementedRoutes(source, 'router'), [{ method: 'get', path: '/auth' }]);
});

test('route discovery preserves duplicates and rejects dynamic paths', () => {
    assert.equal(implementedRoutes("r.get('/', a); r.get('/', b);", 'r').length, 2);
    assert.throws(() => implementedRoutes('r.get(path, handler)', 'r'), /Cannot statically check/);
});
