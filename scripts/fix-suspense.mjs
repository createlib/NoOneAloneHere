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

  // Check if it already has Suspense wrapping
  if (content.includes('function ' + 'EditProfilePage' + 'Content()')) continue;
  if (content.includes('React.Suspense')) continue;

  const match = content.match(/export default function\s+([A-Za-z0-9_]+)\s*\(/);
  if (match) {
    const compName = match[1];
    content = content.replace(`export default function ${compName}`, `function ${compName}Content`);
    
    // Append the Suspense wrapper
    content += `

export default function ${compName}() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-texture flex items-center justify-center"><div className="w-10 h-10 border-4 border-[#b8860b] border-t-transparent rounded-full animate-spin"></div></div>}>
      <${compName}Content />
    </React.Suspense>
  );
}
`;
    fs.writeFileSync(filePath, content);
    console.log(`Wrapped ${compName} in Suspense in ${f}`);
  }
}
