import fs from 'fs';
import path from 'path';

const files = [
  'src/app/user/edit/page.tsx',
  'src/app/register/page.tsx',
  'src/app/search/page.tsx',
  'src/app/news/page.tsx',
  'src/app/media/videos/new/page.tsx',
  'src/app/media/podcasts/new/page.tsx',
  'src/app/events/page.tsx'
];

for (const f of files) {
  const filePath = path.resolve(f);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf-8');

  // Remove the exact injected line from previous script
  content = content.replace(/import \{ Suspense \} from 'react';\n/g, '');

  const hasReactSuspense = /import\s+[^'"]*Suspense[^'"]*from\s+['"]react['"]/.test(content);
  if (!hasReactSuspense) {
    if (content.startsWith("'use client';")) {
        content = content.replace(/'use client';\r?\n/, "'use client';\nimport { Suspense } from 'react';\n");
    } else {
        content = "import { Suspense } from 'react';\n" + content;
    }
  }

  fs.writeFileSync(filePath, content);
  console.log(`Cleaned imports for ${f}`);
}
