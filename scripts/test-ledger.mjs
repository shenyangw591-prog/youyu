import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['tests/ledger.test.ts'],outfile:'.sites-runtime/tests/ledger.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
await import('../.sites-runtime/tests/ledger.mjs');
