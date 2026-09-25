import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('client', 'dist', { recursive: true });
await cp('shared', 'dist/shared', { recursive: true });
console.log('Built game client in dist/');
