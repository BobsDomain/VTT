// Folds core.mjs into worker.mjs as bot/worker.js: one file to paste into the Cloudflare Worker editor.
//   node bot/build.mjs
import fs from 'node:fs';
const dir = new URL('.', import.meta.url);
const core = fs.readFileSync(new URL('core.mjs', dir), 'utf8').replace(/^export (const|function) /gm, '$1 ');
const worker = fs.readFileSync(new URL('worker.mjs', dir), 'utf8').replace(/^import \{ createBot \} from '\.\/core\.mjs';\n/m, '');
const [head, ...rest] = worker.split('\nexport default');
fs.writeFileSync(new URL('worker.js', dir), `${head}\n// ----- made by bot/build.mjs from core.mjs and worker.mjs: change those, then run node bot/build.mjs -----\n\n${core}\nexport default${rest.join('\nexport default')}`);
console.log('bot/worker.js written');
