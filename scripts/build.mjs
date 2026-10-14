import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const destination = resolve('dist');
await mkdir(destination, { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'assets']) {
  await cp(resolve(file), resolve(destination, file), { recursive: true });
}
console.log('Mira is built. Deploy the dist directory to any static host.');
