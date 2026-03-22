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

  if (content.includes('<React.Suspense')) {
    content = content.replace(/<React\.Suspense/g, '<Suspense');
    content = content.replace(/<\/React\.Suspense>/g, '</Suspense>');
    
    // Check if Suspense is imported
    if (!content.includes('import { Suspense } from \'react\'') && !content.includes('import {Suspense} from \'react\'')) {
      // Find the last import and add it after, or at the top if no imports
      const lastImportMatch = [...content.matchAll(/import .* from .*\n/g)].pop();
      if (lastImportMatch) {
         const insertPos = lastImportMatch.index + lastImportMatch[0].length;
         content = content.slice(0, insertPos) + 'import { Suspense } from \'react\';\n' + content.slice(insertPos);
      } else {
         // Insert after 'use client'; if present
         if (content.startsWith("'use client';")) {
             content = content.replace("'use client';", "'use client';\nimport { Suspense } from 'react';\n");
         } else {
             content = 'import { Suspense } from \'react\';\n' + content;
         }
      }
    }
    fs.writeFileSync(filePath, content);
    console.log(`Fixed React.Suspense in ${f}`);
  }
}
