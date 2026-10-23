import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateKeyPairSync, createPublicKey } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const examplePath = fileURLToPath(new URL("../.env.example", import.meta.url));
let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : readFileSync(examplePath, "utf8");
const original = existsSync(envPath) ? content : null;
const values = parse(content);
function fill(key: string, value: string) {
  if (values[key]) return;
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  content = pattern.test(content) ? content.replace(pattern, () => line) : `${content.trimEnd()}\n${line}\n`;
  values[key] = value;
}
const normalize = (value: string) => value.replace(/\\n/g, "\n");
for (const kind of ["ACCESS", "REFRESH"]) {
  const privateName = `JWT_${kind}_PRIVATE_KEY_PEM`, publicName = `JWT_${kind}_PUBLIC_KEY_PEM`;
  const privateKey = values[privateName], publicKey = values[publicName];
  if (privateKey) {
    const derived = createPublicKey(normalize(privateKey)).export({ type: "spki", format: "pem" }).toString();
    if (publicKey && createPublicKey(normalize(publicKey)).export({ type: "spki", format: "pem" }).toString() !== derived) {
      throw new Error(`${kind} keypair does not match; existing keys were not changed`);
    }
    fill(publicName, derived.trimEnd().replace(/\n/g, "\\n"));
  } else {
    if (publicKey) throw new Error(`${kind} private key is missing; refusing to replace the existing public key`);
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    fill(privateName, pair.privateKey.trimEnd().replace(/\n/g, "\\n"));
    fill(publicName, pair.publicKey.trimEnd().replace(/\n/g, "\\n"));
  }
}
for (const [key, value] of Object.entries(parse(readFileSync(examplePath)))) fill(key, value);
if (content !== original) writeFileSync(envPath, content, { mode: 0o600 });
console.log("API configuration ready; existing values and keys preserved.");
