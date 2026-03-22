const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../legacy/js/page-news-script.js');
const destPath = path.join(__dirname, '../src/lib/newsData.ts');

try {
  let content = fs.readFileSync(srcPath, 'utf8');
  
  // Extract window.NOAH_NEWS_DATA = [...]
  const match = content.match(/window\.NOAH_NEWS_DATA\s*=\s*(\[[\s\S]*?\]);/);
  
  if (match) {
    const dataArrayStr = match[1];
    const tsContent = `export const NOAH_NEWS_DATA = ${dataArrayStr};\n`;
    fs.writeFileSync(destPath, tsContent, 'utf8');
    console.log('Successfully fixed newsData.ts encoding.');
  } else {
    console.log('Could not find window.NOAH_NEWS_DATA matching block.');
  }
} catch (e) {
  console.error(e);
}
