import { writeFileSync } from 'node:fs';
writeFileSync(new URL('../lib/module/package.json', import.meta.url), JSON.stringify({ type: 'module' }));
