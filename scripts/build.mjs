import {cp, mkdir, rm} from 'node:fs/promises';
await rm('dist', {recursive:true, force:true});
await mkdir('dist', {recursive:true});
for (const f of ['index.html','src','data']) await cp(f, `dist/${f}`, {recursive:true});
await cp('public','dist', {recursive:true});
console.log('Static build ready in dist/');
