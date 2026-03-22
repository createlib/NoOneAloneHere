import fs from 'fs';

let code = fs.readFileSync('src/app/media/podcasts/new/page.tsx', 'utf8');

code = code.replace(
  /export default function PodcastPostPage\(\) \{/,
  'function PodcastPostInternalForm() {'
);

code = code.replace(
  /await uploadThumb\(\);[\s\S]+?if \(editPid\) \{/,
  'await uploadThumb();\n\n            let finalIsEmbedMode = isEmbedMode;\n            if (editPid) {'
);

code = code.replace(
  /isEmbedMode = oldData\.isEmbed \|\| false;/g,
  'finalIsEmbedMode = oldData.isEmbed || false;'
);

code = code.replace(
  /isEmbed: isEmbedMode,/g,
  'isEmbed: finalIsEmbedMode,'
);

code += `\nexport default function PodcastPostPage() {\n    return (\n        <React.Suspense fallback={<div className="min-h-screen bg-texture flex items-center justify-center"><div className="w-10 h-10 border-4 border-[#b8860b] border-t-transparent rounded-full animate-spin"></div></div>}>\n            <PodcastPostInternalForm />\n        </React.Suspense>\n    );\n}\n`;

fs.writeFileSync('src/app/media/podcasts/new/page.tsx', code);
