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
  const layoutPath = path.join(dirPath, 'layout.tsx');
  const pagePath = path.join(dirPath, 'page.tsx');
  const clientPagePath = path.join(dirPath, 'ClientPage.tsx');

  if (fs.existsSync(layoutPath)) {
    fs.unlinkSync(layoutPath);
  }

  if (fs.existsSync(pagePath)) {
    fs.renameSync(pagePath, clientPagePath);
  }

  const content = `import ClientPage from './ClientPage';

export function generateStaticParams() {
  return [];
}

export default function Page({ params }: { params: { id: string } }) {
  return <ClientPage params={params} />;
}
`;

  fs.writeFileSync(pagePath, content);
}

console.log('Fixed export files');
