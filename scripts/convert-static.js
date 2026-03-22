const fs = require('fs');
const path = require('path');

const files = ['terms.html', 'privacy.html', 'tokusho.html'];

files.forEach(file => {
  const name = file.split('.')[0];
  const legacyPath = path.join(__dirname, '../legacy', file);
  const targetDir = path.join(__dirname, '../src/app', name);
  const targetPath = path.join(targetDir, 'page.tsx');

  if (!fs.existsSync(legacyPath)) return;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let html = fs.readFileSync(legacyPath, 'utf8');

  // Extract the main content inside <div class="max-w-4xl mx-auto"> ... </div>
  // Actually, we'll just extract everything inside <body> and strip scripts.
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return;
  
  let content = bodyMatch[1];

  // Remove scripts
  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Replace HTML comments with JSX comments
  content = content.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');

  // Replace class= with className=
  content = content.replace(/class=/g, 'className=');

  // Convert unclosed tags (like <br>, <hr>) to JSX self-closing
  content = content.replace(/<br>/gi, '<br />');
  content = content.replace(/<hr([^>]*)>/gi, '<hr$1 />');
  content = content.replace(/<img([^>]*)>/gi, (match) => {
      if(!match.includes('/')) return match.replace(/>/g, ' />');
      return match;
  });
  
  // Replace font-awesome/lucide specific tags if necessary. Wait, no, they use <i>.
  // We can leave <i> for now, or replace them. The user wants Lucide icons.
  // For static legal pages, they might not have many icons.

  const tsxTemplate = `import Link from 'next/link';
import Footer from '@/components/Footer';
import { ArrowLeft } from 'lucide-react';

export default function ${name.charAt(0).toUpperCase() + name.slice(1)}Page() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-texture relative">
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8 z-10">
        <Link href="/" className="inline-flex items-center text-xs font-bold text-[#8b6a4f] hover:text-[#5c4a3d] transition-colors tracking-widest">
            <ArrowLeft size={16} className="mr-2" />
            NOAHについて
        </Link>
      </div>
      <div className="max-w-4xl mx-auto pt-10 pb-20">
        ${content}
      </div>
    </div>
  );
}
`;

  fs.writeFileSync(targetPath, tsxTemplate);
  console.log(`Converted ${file} to ${targetPath}`);
});
