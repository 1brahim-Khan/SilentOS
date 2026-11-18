// Vercel serves only this generated static directory, never the Python workspace.
import {cp, mkdir, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';
import {DEFAULT_URL} from '../flare.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'public');
// The directory is an explicit build output under this project, not an env path.
if (output !== join(resolve(root), 'public')) throw new Error('Invalid output path');
const endpoint = new URL(process.env.FLARE_API_URL || DEFAULT_URL);
if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
  throw new Error('FLARE_API_URL must be a public HTTPS API base URL without credentials, query or fragment');
}
await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});
await cp(join(root, 'static'), output, {recursive: true});
await writeFile(join(output, 'config.json'), JSON.stringify({
  api_url: endpoint.href.replace(/\/$/, ''), transport: 'direct',
}) + '\n');
console.log('Built SilentOS static site with direct, audio-free video uploads to FLARE.');
