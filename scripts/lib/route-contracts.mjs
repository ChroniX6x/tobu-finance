import { apiRequire } from './config.mjs';

const ts = apiRequire('typescript');
const methods = new Set(['get', 'post', 'put', 'patch', 'delete']);

// Parse syntax instead of depending on quote style, whitespace or comments.
export function implementedRoutes(source, routerName) {
    const file = ts.createSourceFile('routes.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const routes = [];
    function visit(node) {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            const { expression: receiver, name } = node.expression;
            if (ts.isIdentifier(receiver) && receiver.text === routerName && methods.has(name.text)) {
                const path = node.arguments[0];
                if (!path || (!ts.isStringLiteral(path) && !ts.isNoSubstitutionTemplateLiteral(path))) {
                    throw new Error(`Cannot statically check ${routerName}.${name.text} route path`);
                }
                routes.push({ method: name.text, path: path.text });
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(file);
    return routes;
}
