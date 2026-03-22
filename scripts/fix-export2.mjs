import fs from 'fs';
import path from 'path';

const dirs = [
  'src/app/media/live_room/[id]',
  'src/app/media/podcasts/[id]',
  'src/app/media/videos/[id]',
  'src/app/user/[id]'
];

for (const d of dirs) {
  const dirPath = path.resolve(d);
  const pagePath = path.join(dirPath, 'page.tsx');

  if (fs.existsSync(pagePath)) {
    let content = fs.readFileSync(pagePath, 'utf-8');
    content = content.replace('return [];', "return [{ id: '[id]' }];");
    fs.writeFileSync(pagePath, content);
  }
}

console.log('Fixed export files');
