import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { endpoints } from '@tobu/contracts/endpoints';
import { ErrorResponse } from '@tobu/contracts/resources';
import { activityOpenApiSchemas } from '@tobu/contracts/activity';
import { root, apiRequire } from './lib/config.mjs';
const YAML = apiRequire('yaml');
const { z } = apiRequire('zod');
const schema = (value, io = 'input') => {
    const result = z.toJSONSchema(value, { target: 'draft-2020-12', io });
    delete result.$schema;
    return result;
};
export function generateOpenApi() {
    const paths = {};
    const error = { description: 'Existing validation, authentication or domain error; resource-not-found may be plain text.', content: { 'application/json': { schema: schema(ErrorResponse) }, 'text/plain': { schema: { type: 'string' } } } };
    for (const e of endpoints) {
        const path = e.path.replace(/:([^/]+)/g, '{$1}');
        const parameters = [...e.path.matchAll(/:([^/]+)/g)].map(([, name]) => ({ name, in: 'path', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }));
        if (e.query) {
            // Query coercion/normalization has a typed output; HTTP values arrive as strings.
            const query = schema(e.query, 'output');
            for (const [name, value] of Object.entries(query.properties ?? {})) {
                const item = { name, in: 'query', required: (query.required?.includes(name) && value.default === undefined) || false, schema: value };
                if (name === 'include') Object.assign(item, { style: 'form', explode: false });
                parameters.push(item);
            }
        }
        const success = { description: e.status === 204 ? 'No content' : 'Success' };
        if (e.response) success.content = { 'application/json': { schema: schema(e.response, 'input') } };
        paths[path] ??= {};
        paths[path][e.method] = {
            operationId: e.method + e.path.replace(/[^a-zA-Z0-9]+/g, '_'),
            security: e.auth === 'bearer' ? [{ bearerAuth: [] }] : [],
            ...(parameters.length ? { parameters } : {}),
            ...(e.body ? { requestBody: { required: true, content: { 'application/json': { schema: schema(e.body) } } } } : {}),
            responses: { [e.status]: success, ...Object.fromEntries([400, 401, 403, 404, 409, 422].map((status) => [status, { $ref: '#/components/responses/ApiError' }])) }
        };
        if (e.path === '/api/transactions')
            paths[path][e.method].description =
                'Create: booked requires bookDate; without bookDate month (YYYY-MM) is required; private payments require paidByMemberId. Patch rules use merged state; split inheritance and sum constraints are checked against the database. GET accepts categoryIds and categoryIds[]; parent-list items include children, explicit child-list items do not.';
    }
    // Contract-only schemas: the activity route and its endpoint contract are added with E06 (check:contracts requires route parity).
    // Shared sub-schemas are hoisted into components so the 31 code variants are not repeated inline.
    const activitySchemas = {};
    for (const [name, value] of Object.entries(activityOpenApiSchemas)) {
        const raw = z.toJSONSchema(value, { target: 'draft-2020-12', io: name === 'ActivityQuery' ? 'output' : 'input', reused: 'ref' });
        delete raw.$schema;
        const defs = raw.$defs ?? {};
        delete raw.$defs;
        if (name === 'ActivityPage') {
            raw.properties.items.items = { $ref: '#/components/schemas/ActivityItem' };
            for (const key of Object.keys(defs)) delete defs[key];
        }
        const rewrite = (node) => JSON.parse(JSON.stringify(node).replaceAll('#/$defs/', '#/components/schemas/' + name + '_'));
        activitySchemas[name] = { ...rewrite(raw), description: 'Activity platform contract (E01). No route implements it yet.' };
        for (const [key, def] of Object.entries(defs)) activitySchemas[name + '_' + key] = rewrite(def);
    }
    return {
        openapi: '3.1.0',
        info: {
            title: 'ToBu Finance API',
            version: '0.0.0',
            description: 'Generated from @tobu/contracts. Runtime Zod refinements and database-dependent rules also apply. Global admin does not imply account access; full authorization enforcement remains a separate tracked task.'
        },
        components: { schemas: activitySchemas, responses: { ApiError: error }, securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
        paths
    };
}
const inventory = [
    '# API-Endpunktinventar (generiert)',
    '',
    'Quelle: packages/contracts/src/endpoints.ts. Keine weiteren API-Verbraucher sind bekannt.',
    '',
    '| Methode | Pfad | Auth | Body | Query | Erfolg |',
    '| --- | --- | --- | --- | --- | --- |',
    ...endpoints.map((e) => '| ' + e.method.toUpperCase() + ' | ' + e.path + ' | ' + e.auth + ' | ' + (e.body ? 'Zod-Schema' : '—') + ' | ' + (e.query ? 'Zod-Schema' : '—') + ' | ' + e.status + ' |'),
    '',
    'Fehler: bestehende JSON-Varianten (error oder code/message), teilweise text/plain bei 404. Bearer bedeutet Authentifizierung; die vollständige Kontoberechtigungsprüfung bleibt separat offen.',
    ''
].join('\n');
const inventoryPath = resolve(root, 'docs/architecture/api-endpoints.md');
const target = resolve(root, 'apps/api/docs/openapi.yaml');
const output = '# Generated by npm run contracts:generate. Do not edit manually.\n' + YAML.stringify(generateOpenApi());
if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== output) throw new Error('OpenAPI drift. Run npm run contracts:generate and review the diff.');
    if (readFileSync(inventoryPath, 'utf8').replaceAll('\r\n', '\n') !== inventory) throw new Error('Endpoint inventory drift');
    console.log('OpenAPI and inventory match all shared endpoint contracts.');
} else {
    writeFileSync(target, output);
    writeFileSync(inventoryPath, inventory);
    console.log('Generated OpenAPI and endpoint inventory.');
}
