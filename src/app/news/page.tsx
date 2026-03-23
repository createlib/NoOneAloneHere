'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Bell } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { NOAH_NEWS_DATA } from '@/lib/newsData';

function formatText(text: string) {
  if (!text) return '';
  let rawHtml = '';
  try {
    rawHtml = marked.parse(text, { breaks: true, gfm: true }) as string;
  } catch (e) {
    rawHtml = text.replace(/\n/g, '<br />');
  }
  return DOMPurify.sanitize(rawHtml);
}

function NewsContent() {
  const searchParams = useSearchParams();
  const articleId = searchParams.get('id');

  if (articleId) {
    const article = NOAH_NEWS_DATA.find(item => item.id.toString() === articleId);
    
    if (article) {
      return (
        <div className="bg-[#fffdf9] shadow-md border border-[#e8dfd1] p-6 sm:p-10 relative">
          <div className="mb-8 border-b border-[#e8dfd1] pb-6">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm text-[#a09080] font-mono">{article.date}</span>
              <span className="text-[10px] bg-[#f7f5f0] text-[#725b3f] border border-[#e8dfd1] px-2 py-0.5 rounded-sm tracking-widest font-bold">{article.category}</span>
            </div>
            <h1 className="text-2xl font-bold text-[#3e2723] leading-relaxed">{article.title}</h1>
          </div>
          
          <div 
             className="markdown-body max-w-none"
             dangerouslySetInnerHTML={{ __html: formatText(article.content) }}
          />

          <div className="mt-16 pt-8 border-t border-[#e8dfd1] text-center">
            <Link href="/news" className="inline-flex items-center justify-center px-6 py-3 bg-[#f7f5f0] text-[#725b3f] font-bold text-sm tracking-widest border border-[#c8b9a6] hover:bg-[#e8dfd1] transition-colors">
              お知らせ一覧に戻る
            </Link>
          </div>
        </div>
      );
    } else {
      return (
        <div className="bg-[#fffdf9] shadow-md border border-[#e8dfd1] p-6 sm:p-10 relative text-center py-10">
          <p className="text-[#8b6a4f] mb-6 font-bold tracking-widest">お探しの記事は見つかりませんでした。</p>
          <Link href="/news" className="inline-flex items-center justify-center px-6 py-3 bg-[#f7f5f0] text-[#725b3f] font-bold text-sm tracking-widest border border-[#c8b9a6] hover:bg-[#e8dfd1] transition-colors">
            お知らせ一覧に戻る
          </Link>
        </div>
      );
    }
  }

  // List View
  if (NOAH_NEWS_DATA.length === 0) {
    return (
        <div className="bg-[#fffdf9] shadow-md border border-[#e8dfd1] p-6 sm:p-10 relative text-center text-[#a09080] py-10">
            現在お知らせはありません。
        </div>
    );
  }

  return (
    <div className="bg-[#fffdf9] shadow-md border border-[#e8dfd1] p-6 sm:p-10 relative">
        <ul className="divide-y divide-[#e8dfd1]">
            {NOAH_NEWS_DATA.map(item => (
                <li key={item.id} className="py-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 group">
                    <span className="text-sm text-[#a09080] font-mono w-28 shrink-0">{item.date}</span>
                    <span className="text-[10px] bg-[#f7f5f0] text-[#725b3f] border border-[#e8dfd1] px-2 py-0.5 rounded-sm tracking-widest w-fit font-bold">{item.category}</span>
                    <Link href={`/news?id=${item.id}`} className="text-base text-[#4a3b32] group-hover:text-[#8b6a4f] transition-colors leading-relaxed flex-1 font-medium mt-1 sm:mt-0">
                        {item.title}
                    </Link>
                </li>
            ))}
        </ul>
    </div>
  );
}

export default function NewsPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-texture relative">
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8 z-10">
        <Link href="/" className="inline-flex items-center text-xs font-bold text-[#8b6a4f] hover:text-[#5c4a3d] transition-colors tracking-widest">
            <ArrowLeft size={16} className="mr-2" />
            NOAHについて
        </Link>
      </div>

      <div className="max-w-4xl mx-auto pt-10">
        <div className="text-center mb-16">
          <Bell className="w-10 h-10 text-[#8b6a4f] mx-auto mb-4" strokeWidth={1.5} />
          <h1 className="text-3xl font-bold text-[#3e2723] sm:text-4xl font-serif tracking-widest">News & Updates</h1>
          <p className="mt-4 text-sm text-[#725b3f] tracking-widest uppercase">お知らせ・アップデート</p>
          <div className="w-16 h-[1px] bg-[#8b6a4f] mt-6 mx-auto"></div>
        </div>

        <Suspense fallback={<div className="text-center py-20 text-[#a09080]">Loading...</div>}>
            <NewsContent />
        </Suspense>
      </div>

      <footer className="mt-24 pb-12 text-center text-sm text-[#725b3f]">
        <p className="mb-1 font-serif tracking-widest">NOAH - No One Alone, Here</p>
        <p>&copy; {new Date().getFullYear()} NOAH Community. All rights reserved.</p>
      </footer>
    </div>
  );
}
