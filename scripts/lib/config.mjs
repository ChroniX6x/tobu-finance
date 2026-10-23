import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const apiRoot = resolve(root, 'apps/api');
export const webRoot = resolve(root, 'apps/web');
export const apiRequire = createRequire(resolve(apiRoot, 'package.json'));
export const webRequire = createRequire(resolve(webRoot, 'package.json'));
const { parse } = apiRequire('dotenv');
export function readEnv(path) {
    return existsSync(path) ? parse(readFileSync(path)) : {};
}
export function initializeConfig() {
    const path = resolve(root, '.env');
    if (!existsSync(path)) writeFileSync(path, readFileSync(resolve(root, '.env.example')), { flag: 'wx' });
}
export function loadConfig(environment = process.env) {
    const values = { ...readEnv(resolve(root, '.env.example')), ...readEnv(resolve(root, '.env')), ...environment };
    if (!['docker', 'external'].includes(values.DB_MODE)) throw new Error('DB_MODE must be docker or external');
    const port = (key) => {
        const n = Number(values[key]);
        if (!Number.isInteger(n) || n < 1024 || n > 65535) throw new Error(`Invalid ${key}`);
        return n;
    };
    const apiPort = port('API_PORT'),
        webPort = port('WEB_PORT'),
        dbPort = port('DB_PORT');
    if (new Set([apiPort, webPort, dbPort]).size !== 3) throw new Error('API_PORT, WEB_PORT and DB_PORT must differ');
    if (!/^[a-z0-9][a-z0-9_-]+$/.test(values.COMPOSE_PROJECT)) throw new Error('Invalid COMPOSE_PROJECT');
    if (!/^tobu_[a-z0-9_]+$/.test(values.DEV_DB_NAME)) throw new Error('DEV_DB_NAME must start with tobu_ and contain only lowercase letters, digits and underscores');
    const uri = values.DB_MODE === 'docker' ? `mongodb://127.0.0.1:${dbPort}/${values.DEV_DB_NAME}?directConnection=true&replicaSet=tobu-local` : values.MONGODB_URI;
    if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error('DB_MODE=external requires an explicit MongoDB URI; no fallback');
    const pathname = new URL(uri).pathname.slice(1);
    if (!pathname || ['admin', 'config', 'local'].includes(pathname)) throw new Error('Choose an explicit application database, not admin/config/local');
    return { mode: values.DB_MODE, uri, dbName: pathname, project: values.COMPOSE_PROJECT, apiPort, webPort, dbPort, month: values.SEED_MONTH || undefined };
}
export function apiEnvironment(config) {
    return {
        ...process.env,
        ...readEnv(resolve(apiRoot, '.env')),
        NODE_ENV: 'development',
        MONGODB_URI: config.uri,
        PORT: String(config.apiPort),
        HOST: '127.0.0.1',
        CORS_ORIGIN: `http://localhost:${config.webPort}`,
        ...(config.month ? { SEED_MONTH: config.month } : {})
    };
}
