lucide.createIcons();
    document.getElementById('year').textContent = new Date().getFullYear();

    // news.html からデータを取得して最新3件を表示する
    document.addEventListener('DOMContentLoaded', () => {
      fetch('news.html')
        .then(response => response.text())
        .then(html => {
          // news.html内のデータ配列を抽出
          const match = html.match(/window\.NOAH_NEWS_DATA\s*=\s*(\[\s*\{[\s\S]*?\])\s*;/);
          if (match) {
            const getNews = new Function(`return ${match[1]};`);
            const newsData = getNews();
            renderLatestNews(newsData);
          } else {
            throw new Error('データが見つかりません');
          }
        })
        .catch(error => {
          console.error('ニュースの取得に失敗しました:', error);
          document.getElementById('news-list').innerHTML = '<li class="text-center py-4 text-[#a09080] text-sm">お知らせを読み込めませんでした。</li>';
        });
    });

    function renderLatestNews(newsData) {
      const list = document.getElementById('news-list');
      if (!newsData || newsData.length === 0) {
          list.innerHTML = '<li class="text-center py-4 text-[#a09080] text-sm">現在お知らせはありません。</li>';
          return;
      }
      
      // 日付降順でソートして上位3件を取得
      const sortedNews = [...newsData].sort((a, b) => new Date(b.date.replace(/\./g, '/')) - new Date(a.date.replace(/\./g, '/')));
      const latestNews = sortedNews.slice(0, 3);
      
      let html = '';
      latestNews.forEach(item => {
          html += `
          <li class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 group">
              <span class="text-xs text-[#a09080] font-mono w-24 shrink-0">${item.date}</span>
              <span class="text-[10px] bg-[#f7f5f0] text-[#725b3f] border border-[#e8dfd1] px-2 py-0.5 rounded-sm tracking-widest w-fit font-bold">${item.category}</span>
              <a href="news.html?id=${item.id}" class="text-sm text-[#4a3b32] group-hover:text-[#8b6a4f] transition-colors leading-relaxed flex-1 font-medium truncate sm:whitespace-normal">
                  ${item.title}
              </a>
          </li>
          `;
      });
      list.innerHTML = html;
      lucide.createIcons(); // アイコン再描画
    }