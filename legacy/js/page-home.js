import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, query, orderBy, getDocs, where } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';

        let myEvents = []; 
        let currentCalendarDate = new Date();
        let myProfile = null;
        let isAdmin = false;
        let currentUser = null; 

        // --- マークダウン対応フォーマット関数（エラー回避・堅牢化） ---
        function formatText(text) {
            if (!text) return '';
            const textStr = String(text);
            let processedText = textStr.replace(/__(.*?)__/g, '<u>$1</u>');

            let rawHtml = '';
            try {
                if (window.marked && typeof window.marked.parse === 'function') {
                    // URL自動リンク化(gfm: true)と改行反映(breaks: true)を有効化
                    rawHtml = window.marked.parse(processedText, { breaks: true, gfm: true });
                } else if (typeof window.marked === 'function') {
                    rawHtml = window.marked(processedText, { breaks: true, gfm: true });
                } else {
                    rawHtml = processedText.replace(/\n/g, '<br>');
                }
            } catch (e) {
                console.error("Markdown Parse Error:", e);
                rawHtml = processedText.replace(/\n/g, '<br>'); 
            }
            
            let sanitizedHtml = rawHtml;
            try {
                if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
                    sanitizedHtml = window.DOMPurify.sanitize(rawHtml, { 
                        ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'u', 'span', 'blockquote', 'code', 'pre', 'hr'],
                        ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
                    });
                }
            } catch (e) {
                console.error("DOMPurify Error:", e);
            }

            try {
                // 生成されたリンク(aタグ)にtarget="_blank"とrel="noopener noreferrer"を付与して安全性を確保し、はみ出し防止クラスを付与
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = sanitizedHtml;
                tempDiv.querySelectorAll('a').forEach(a => {
                    a.setAttribute('target', '_blank');
                    a.setAttribute('rel', 'noopener noreferrer');
                    a.classList.add('break-all', 'text-brand-500', 'underline', 'hover:text-brand-700');
                });
                return tempDiv.innerHTML;
            } catch (e) {
                console.error("Link Formatting Error:", e);
                return sanitizedHtml;
            }
        }

        onAuthStateChanged(auth, async (user) => {
            if (isAdminMock) {
                currentUser = { uid: 'test_admin_uid' }; 
                isAdmin = true;
                myProfile = { name: 'テスト管理者', userId: 'admin' };
                document.getElementById('participating-events-list').innerHTML = '<div class="text-xs text-brand-400 italic p-6 bg-[#fffdf9] rounded-sm border border-brand-200 text-center tracking-widest">管理者モード: 参加イベントなし</div>';
                document.getElementById('hosting-events-list').innerHTML = '<div class="text-xs text-brand-400 italic p-6 bg-[#fffdf9] rounded-sm border border-brand-200 text-center tracking-widest">管理者モード: 主催イベントなし</div>';
                return;
            }

            if (user && !user.isAnonymous) {
                currentUser = user; 
                try {
                    const docSnap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));
                    if (docSnap.exists()) {
                        myProfile = docSnap.data();
                        if (myProfile.userId === 'admin') isAdmin = true;
                    } else {
                        myProfile = { name: 'User', userId: user.uid };
                    }
                } catch (e) { console.error(e); }
                
                loadEvents(user.uid);
            } else {
                window.location.href = 'login.html';
            }
        });

        // --- 招待リンクコピー機能 ---
        window.copyInviteLink = () => {
            if (!myProfile || !myProfile.userId) return alert('ユーザーIDが取得できませんでした');
            
            const currentUrl = new URL(window.location.href);
            currentUrl.pathname = currentUrl.pathname.replace('home.html', 'register.html');
            if(!currentUrl.pathname.includes('register.html')) {
                currentUrl.pathname = '/register.html';
            }
            currentUrl.search = `?ref=${myProfile.userId}`;
            const url = currentUrl.toString();
            
            const userName = myProfile.name || myProfile.userId;
            const inviteText = `${userName}さんからNOAHに招待されました。
下記のリンクから乗船手続きを進めてください。

■新規登録｜NOAH｜No One Alone, Here
${url}

■公式LINE｜公式LINEを登録し、いつでも乗船できるようにしてください。
https://lin.ee/aaP0V9F

■公式オープンチャット｜「フルネーム＠NOAHのID」でご参加ください。
https://line.me/ti/g2/yo2C_bp7U7agH9Rz--E2YhZ4Sc4Yy1ybqhQQZw?utm_source=invitation&utm_medium=link_copy&utm_campaign=default`;
            
            const textArea = document.createElement("textarea");
            textArea.value = inviteText; 
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                const notif = document.getElementById('notification');
                if(notif) {
                    document.getElementById('notif-message').textContent = '招待リンクをコピーしました！';
                    notif.classList.remove('hidden', 'translate-y-20');
                    setTimeout(() => notif.classList.add('translate-y-20'), 3000);
                    setTimeout(() => notif.classList.add('hidden'), 3300);
                } else {
                    alert('URLをコピーしました！');
                }
            } catch (err) {
                console.error('Copy error', err);
                alert('コピーに失敗しました。\n' + url);
            }
            document.body.removeChild(textArea);
        };

        // --- 招待した人一覧を表示する機能 ---
        window.openReferralsModal = async () => {
            const modal = document.getElementById('referrals-modal');
            modal.classList.remove('hidden');
            
            const listContainer = document.getElementById('referrals-list');
            listContainer.innerHTML = '<div class="text-center text-brand-400 py-12"><i class="fa-solid fa-compass fa-spin text-3xl mb-4 opacity-50"></i><p class="text-sm tracking-widest font-bold">乗船記録を検索中...</p></div>';
            
            let referrals = [];
            
            if (isAdminMock) {
                referrals = [
                    { name: "テストユーザーA", userId: "user_a", id: "dummy1", profileScore: 85, photoURL: "" },
                    { name: "テストユーザーB", userId: "user_b", id: "dummy2", profileScore: 40, photoURL: "" },
                ];
            } else {
                if (!myProfile || !myProfile.userId) {
                    listContainer.innerHTML = '<div class="text-center text-red-500 py-8 text-xs font-bold tracking-widest">ユーザーIDが設定されていません。</div>';
                    return;
                }
                
                try {
                    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
                    const q = query(usersRef, where("referrerId", "==", myProfile.userId));
                    const snap = await getDocs(q);
                    
                    snap.forEach(d => {
                        const data = d.data();
                        referrals.push({
                            id: d.id, 
                            name: data.name,
                            userId: data.userId, 
                            photoURL: data.photoURL || '',
                            profileScore: data.profileScore || 0
                        });
                    });
                } catch (e) {
                    console.error("Referral fetch error", e);
                    listContainer.innerHTML = '<div class="text-center text-red-500 py-8 text-xs font-bold tracking-widest">データの取得に失敗しました。</div>';
                    return;
                }
            }
            
            document.getElementById('referrals-count').textContent = referrals.length;
            
            if (referrals.length === 0) {
                listContainer.innerHTML = '<div class="text-center text-brand-400 py-12 border border-dashed border-brand-200 rounded-sm bg-brand-50"><i class="fa-solid fa-users-slash text-3xl mb-3 opacity-50"></i><p class="text-sm tracking-widest font-bold">まだ招待した乗船者はいません。</p></div>';
            } else {
                listContainer.innerHTML = '';
                referrals.forEach(refUser => {
                    const score = refUser.profileScore || 0;
                    
                    let iconHtml = '';
                    if (refUser.photoURL) {
                        iconHtml = `
                        <img src="${refUser.photoURL}" class="w-14 h-14 rounded-sm object-cover border border-brand-100 bg-brand-50 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
                        <div class="hidden w-14 h-14 rounded-sm border border-brand-100 bg-brand-50 flex items-center justify-center text-brand-300 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                            <i class="fa-solid fa-anchor text-2xl"></i>
                        </div>`;
                    } else {
                        iconHtml = `
                        <div class="w-14 h-14 rounded-sm border border-brand-100 bg-brand-50 flex items-center justify-center text-brand-300 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                            <i class="fa-solid fa-anchor text-2xl"></i>
                        </div>`;
                    }
                    
                    const item = document.createElement('div');
                    item.className = 'flex items-center gap-4 p-4 bg-[#fffdf9] border border-brand-200 rounded-sm mb-3 shadow-sm hover:shadow-md transition-shadow group cursor-pointer';
                    item.onclick = () => window.location.href = `user.html?uid=${refUser.id}`;
                    item.innerHTML = `
                        ${iconHtml}
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-start mb-2">
                                <h4 class="font-bold text-brand-900 truncate text-base font-serif tracking-wide group-hover:text-brand-600 transition-colors">${refUser.name || '名称未設定'}</h4>
                                <span class="text-[10px] text-brand-500 bg-[#f7f5f0] px-2 py-0.5 rounded-sm border border-brand-200 font-bold tracking-widest">@${refUser.userId || '未設定'}</span>
                            </div>
                            <div class="w-full bg-brand-100 h-2 mt-2 rounded-full overflow-hidden flex items-center relative shadow-inner">
                                <div class="bg-gradient-to-r from-[#8b6a4f] to-[#b8860b] h-full" style="width: ${score}%"></div>
                            </div>
                            <p class="text-[10px] text-brand-500 mt-1.5 text-right tracking-widest">充実度: <span class="font-bold text-[#b8860b]">${score}%</span></p>
                        </div>
                    `;
                    listContainer.appendChild(item);
                });
            }
        };

        window.closeReferralsModal = () => {
            document.getElementById('referrals-modal').classList.add('hidden');
        };

        // --- SP Menu Toggle ---
        window.toggleTheaterMenu = () => {
            const menu = document.getElementById('sp-theater-menu');
            const content = document.getElementById('sp-theater-menu-content');
            if (menu && menu.classList.contains('hidden')) {
                menu.classList.remove('hidden');
                setTimeout(() => { if(content) content.classList.remove('translate-y-full'); }, 10);
            } else if(menu) {
                if(content) content.classList.add('translate-y-full');
                setTimeout(() => menu.classList.add('hidden'), 300);
            }
        };

        async function loadEvents(uid) {
            const now = new Date().toISOString();

            // 1. Hosting Events
            try {
                const eventsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events');
                const snapHost = await getDocs(eventsRef);
                
                let hostEvents = [];
                snapHost.forEach(d => {
                    const evt = d.data();
                    if (evt.organizerId === uid && (!evt.endTimestamp || evt.endTimestamp >= now)) {
                        evt.id = d.id;
                        hostEvents.push(evt);
                    }
                });

                hostEvents.sort((a,b) => {
                    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return tB - tA;
                });

                renderEventList('hosting-events-list', hostEvents, '主催する予定のイベントはありません');
            } catch (e) { 
                console.error("Host load err", e);
                document.getElementById('hosting-events-list').innerHTML = '<div class="text-xs text-red-500 p-4 tracking-widest">読み込みエラーが発生しました</div>';
            }

            // 2. Participating Events
            try {
                const myJoinColl = collection(db, 'artifacts', appId, 'users', uid, 'participating_events');
                const snapJoin = await getDocs(myJoinColl);
                
                const listEl = document.getElementById('participating-events-list');
                listEl.innerHTML = '';

                if (snapJoin.empty) {
                    listEl.innerHTML = `
                        <div class="text-sm text-brand-500 py-10 bg-[#fffdf9] rounded-sm border border-brand-200 border-dashed text-center tracking-widest flex flex-col items-center justify-center">
                            <i class="fa-solid fa-calendar-xmark text-3xl mb-3 text-brand-300"></i>
                            参加予定のイベントはありません<br>
                            <a href="events.html" class="text-brand-700 font-bold border border-brand-300 px-6 py-2 mt-4 inline-block hover:bg-brand-50 transition-colors rounded-sm shadow-sm">イベントを探す</a>
                        </div>`;
                } else {
                    const eventPromises = snapJoin.docs.map(async (joinDoc) => {
                        const eventId = joinDoc.id; 
                        try {
                            const evtRef = doc(db, 'artifacts', appId, 'public', 'data', 'events', eventId);
                            const evtSnap = await getDoc(evtRef);
                            if (evtSnap.exists()) {
                                const data = evtSnap.data();
                                data.id = evtSnap.id;
                                return data;
                            }
                        } catch (e) { console.error(e); }
                        return null; 
                    });

                    const allJoinedEvents = (await Promise.all(eventPromises)).filter(e => e !== null);
                    
                    myEvents = allJoinedEvents.filter(evt => !evt.endTimestamp || evt.endTimestamp >= now);
                    
                    myEvents.sort((a, b) => {
                        const dateA = new Date(a.startDate).getTime() || 0;
                        const dateB = new Date(b.startDate).getTime() || 0;
                        return dateA - dateB;
                    });

                    if (myEvents.length === 0) {
                         listEl.innerHTML = '<div class="text-sm text-brand-500 py-10 bg-[#fffdf9] rounded-sm border border-brand-200 border-dashed text-center tracking-widest">参加予定のイベントは終了しました</div>';
                    } else {
                        myEvents.forEach(evt => renderEventItem(listEl, evt));
                        renderCalendar(); 
                    }
                }
            } catch (e) { 
                console.error("Join load err", e); 
                document.getElementById('participating-events-list').innerHTML = '<div class="text-xs text-red-500 p-4 tracking-widest">読み込みエラーが発生しました</div>';
            }
        }

        function renderEventList(containerId, events, emptyMsg) {
            const container = document.getElementById(containerId);
            container.innerHTML = '';
            if (events.length === 0) {
                container.innerHTML = `<div class="text-sm text-brand-400 py-8 bg-[#fffdf9] rounded-sm border border-brand-200 border-dashed text-center tracking-widest">${emptyMsg}</div>`;
                return;
            }
            events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            events.forEach(evt => renderEventItem(container, evt));
        }

        function renderEventItem(container, evt) {
            const thumb = evt.thumbnailUrl || 'https://via.placeholder.com/150?text=NOAH';
            const imageCountBadge = (evt.imageUrls && evt.imageUrls.length > 1) 
                ? `<div class="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded-sm flex items-center gap-1 z-10"><i class="fa-regular fa-images"></i>${evt.imageUrls.length}</div>` 
                : '';

            const el = document.createElement('div');
            el.className = 'event-card flex items-center gap-4 p-4 bg-[#fffdf9] rounded-sm border border-brand-200 cursor-pointer';
            el.onclick = () => openEventDetail(evt);
            
            const dateStr = (evt.startDate === evt.endDate) 
                    ? `${evt.startDate || ''} ${evt.startTime || ''}`
                    : `${evt.startDate || ''} ${evt.startTime || ''} 〜 ${evt.endDate || ''} ${evt.endTime || ''}`;
                    
            el.innerHTML = `
                <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-sm overflow-hidden flex-shrink-0 border border-brand-100 relative shadow-sm">
                    <img src="${thumb}" class="w-full h-full object-cover">
                    ${imageCountBadge}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap gap-1 mb-1.5">
                        ${(evt.tags || []).slice(0,2).map(t => `<span class="text-[9px] bg-brand-50 border border-brand-200 text-brand-600 px-1.5 py-0.5 rounded-sm font-bold tracking-widest">#${t}</span>`).join('')}
                    </div>
                    <h4 class="font-bold text-brand-900 truncate text-sm sm:text-base mb-1.5 font-serif tracking-wide">${evt.title || '名称未設定'}</h4>
                    <p class="text-[10px] sm:text-xs text-brand-600 flex items-center gap-3 tracking-widest font-medium">
                        <span class="truncate"><i class="fa-regular fa-clock mr-1 text-brand-400"></i>${dateStr}</span>
                        <span class="truncate hidden sm:inline"><i class="fa-solid fa-location-dot mr-1 text-brand-400"></i>${evt.locationName || '未設定'}</span>
                    </p>
                </div>
                <div class="text-brand-300 pr-2 group-hover:text-brand-500 transition-colors">
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            `;
            container.appendChild(el);
        }

        // --- View Switcher ---
        window.switchView = (view) => {
            const listEl = document.getElementById('participating-events-list');
            const calEl = document.getElementById('participating-events-calendar');
            const btnList = document.getElementById('btn-view-list');
            const btnCal = document.getElementById('btn-view-calendar');

            if (view === 'list') {
                listEl.classList.remove('hidden');
                calEl.classList.add('hidden');
                
                btnList.classList.add('bg-[#3e2723]', 'text-[#d4af37]', 'border-[#b8860b]', 'shadow-sm');
                btnList.classList.remove('text-brand-700', 'border-transparent');
                
                btnCal.classList.remove('bg-[#3e2723]', 'text-[#d4af37]', 'border-[#b8860b]', 'shadow-sm');
                btnCal.classList.add('text-brand-700', 'border-transparent');
            } else {
                listEl.classList.add('hidden');
                calEl.classList.remove('hidden');
                
                btnCal.classList.add('bg-[#3e2723]', 'text-[#d4af37]', 'border-[#b8860b]', 'shadow-sm');
                btnCal.classList.remove('text-brand-700', 'border-transparent');
                
                btnList.classList.remove('bg-[#3e2723]', 'text-[#d4af37]', 'border-[#b8860b]', 'shadow-sm');
                btnList.classList.add('text-brand-700', 'border-transparent');
                renderCalendar();
            }
        };

        // --- Calendar Logic ---
        window.changeMonth = (diff) => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + diff);
            renderCalendar();
        };

        function renderCalendar() {
            const container = document.getElementById('calendar-days');
            container.innerHTML = '';
            const year = currentCalendarDate.getFullYear();
            const month = currentCalendarDate.getMonth();
            document.getElementById('calendar-month-year').textContent = `${year}年 ${month + 1}月`;

            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startingDay = firstDay.getDay(); 

            for (let i = 0; i < startingDay; i++) {
                container.appendChild(document.createElement('div'));
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const hasEvent = myEvents.some(e => e.startDate === dateStr);
                
                const dayEl = document.createElement('div');
                dayEl.className = `calendar-day text-sm sm:text-base ${hasEvent ? 'has-event' : ''}`;
                dayEl.textContent = d;
                dayEl.onclick = () => selectDate(dateStr, dayEl);
                container.appendChild(dayEl);
            }
            document.getElementById('calendar-selected-events').classList.add('hidden');
        }

        function selectDate(dateStr, el) {
            document.querySelectorAll('.calendar-day').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected');

            const eventsOnDate = myEvents.filter(e => e.startDate === dateStr);
            const list = document.getElementById('calendar-events-list');
            list.innerHTML = '';

            const parts = dateStr.split('-');
            document.getElementById('selected-date-label').textContent = `${parts[1]}月${parts[2]}日 のイベント`;
            document.getElementById('calendar-selected-events').classList.remove('hidden');

            if (eventsOnDate.length === 0) {
                list.innerHTML = '<p class="text-xs text-brand-400 italic tracking-widest py-4 text-center bg-brand-50 rounded-sm border border-brand-100">この日の予定はありません</p>';
            } else {
                eventsOnDate.forEach(evt => renderEventItem(list, evt));
            }
        }

        // --- フルスクリーン・スライドショー操作関数 ---
        window.moveEventSlide = (id, dir) => {
            const container = document.getElementById(`event-slider-${id}`);
            if (container) {
                container.scrollBy({ left: dir * container.clientWidth, behavior: 'smooth' });
            }
        };

        window.updateSlideDots = (container, id, total) => {
            const index = Math.round(container.scrollLeft / container.clientWidth);
            const dotsContainer = document.getElementById(`event-slider-dots-${id}`);
            if (dotsContainer) {
                Array.from(dotsContainer.children).forEach((dot, i) => {
                    if (i === index) {
                        dot.className = "w-1.5 h-1.5 rounded-full bg-white scale-125 transition-all shadow-sm";
                    } else {
                        dot.className = "w-1.5 h-1.5 rounded-full bg-white/50 transition-all shadow-sm";
                    }
                });
            }
        };

        window.openFullscreenImage = (url) => {
            const modal = document.getElementById('fullscreen-image-modal');
            const img = document.getElementById('fullscreen-image');
            if(modal && img) {
                img.src = url;
                modal.classList.remove('hidden');
            }
        };

        window.closeFullscreenImage = () => {
            const modal = document.getElementById('fullscreen-image-modal');
            if(modal) modal.classList.add('hidden');
        };

        // --- Detail Modal (Home画面用) ---
        window.openEventDetail = async (evt) => {
            const modal = document.getElementById('event-detail-modal');
            
            const sliderContainer = document.getElementById('modal-event-slider-container');
            let images = evt.imageUrls || (evt.thumbnailUrl ? [evt.thumbnailUrl] : ['https://via.placeholder.com/400x200?text=NOAH+Event']);
            
            let sliderHtml = '';
            if (images.length <= 1) {
                // エスケープ処理を追加
                const safeUrl = images[0].replace(/'/g, "\\'").replace(/"/g, '&quot;');
                sliderHtml = `<img src="${images[0]}" class="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" onclick="openFullscreenImage('${safeUrl}')">`;
            } else {
                let slides = images.map((url) => {
                    const safeUrl = url.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    return `
                    <div class="w-full h-full flex-shrink-0 snap-center relative cursor-pointer group" onclick="openFullscreenImage('${safeUrl}')">
                        <img src="${url}" class="w-full h-full object-cover group-hover:opacity-90 transition-opacity">
                        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div class="bg-black/50 text-white rounded-full p-3"><i class="fa-solid fa-expand"></i></div>
                        </div>
                    </div>
                `}).join('');
                
                let dots = images.map((_, i) => `<div class="w-1.5 h-1.5 rounded-full ${i===0?'bg-white scale-125':'bg-white/50'} transition-all shadow-sm" id="slide-dot-${evt.id}-${i}"></div>`).join('');
                
                sliderHtml = `
                <div class="relative w-full h-full overflow-hidden group">
                    <div id="event-slider-${evt.id}" class="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar" onscroll="updateSlideDots(this, '${evt.id}', ${images.length})">
                        ${slides}
                    </div>
                    <!-- 矢印ボタン -->
                    <button onclick="moveEventSlide('${evt.id}', -1)" class="absolute left-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"><i class="fa-solid fa-chevron-left text-sm ml-[-2px]"></i></button>
                    <button onclick="moveEventSlide('${evt.id}', 1)" class="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"><i class="fa-solid fa-chevron-right text-sm ml-[2px]"></i></button>
                    <!-- ドットインジケーター -->
                    <div class="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10 pointer-events-none" id="event-slider-dots-${evt.id}">
                        ${dots}
                    </div>
                </div>`;
            }
            sliderContainer.innerHTML = sliderHtml;

            document.getElementById('modal-event-title').textContent = evt.title || '名称未設定';
            
            const dateStr = (evt.startDate === evt.endDate) 
                    ? `${evt.startDate || ''} ${evt.startTime || ''} 〜 ${evt.endTime || ''}`
                    : `${evt.startDate || ''} ${evt.startTime || ''} 〜 ${evt.endDate || ''} ${evt.endTime || ''}`;
            document.getElementById('modal-event-date').textContent = dateStr;
            
            document.getElementById('modal-event-location').textContent = evt.locationName || '未設定';
            document.getElementById('modal-event-organizer').textContent = evt.organizerName || '不明';
            
            // ★マークダウン対応フォーマット関数を使用して詳細を表示
            document.getElementById('modal-event-desc').innerHTML = formatText(evt.description || evt.desc || '詳細はありません');
            
            const tagsEl = document.getElementById('modal-event-tags');
            tagsEl.innerHTML = '';
            if (evt.tags) {
                evt.tags.forEach(tag => {
                    tagsEl.innerHTML += `<span class="bg-brand-50 border border-brand-200 text-brand-600 px-3 py-1 rounded-sm text-[10px] font-bold tracking-widest shadow-sm">#${tag}</span>`;
                });
            }

            const startStr = (evt.startDate || '').replace(/-/g, '') + 'T' + (evt.startTime ? evt.startTime.replace(/:/g, '') + '00' : '000000');
            const endStr = (evt.endDate ? evt.endDate.replace(/-/g, '') : startStr.substring(0,8)) + 'T' + (evt.endTime ? evt.endTime.replace(/:/g, '') + '00' : '235900');
            const gcalUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(evt.title || '')}&dates=${startStr}/${endStr}&details=${encodeURIComponent(evt.description || '')}&location=${encodeURIComponent(evt.locationName || '')}`;
            
            const gcalBtn = document.getElementById('modal-gcal-btn');
            if (gcalBtn) gcalBtn.href = gcalUrl;
            
            const eventLinkBtn = document.getElementById('modal-event-link');
            if (eventLinkBtn) eventLinkBtn.href = `events.html?eventId=${evt.id}`;
            
            const partsContainer = document.getElementById('modal-event-participants');
            const countEl = document.getElementById('modal-event-participants-count');
            partsContainer.innerHTML = '<div class="text-[10px] text-brand-400 w-full text-center py-2"><i class="fa-solid fa-spinner fa-spin mr-1"></i>読み込み中...</div>';
            countEl.textContent = '0';
            
            modal.classList.remove('hidden');

            let participants = [];
            if (isAdminMock) {
                participants = ['user1', 'user2']; 
            } else {
                try {
                    const partsRef = collection(db, 'artifacts', appId, 'public', 'data', 'events', evt.id, 'participants');
                    const partsSnap = await getDocs(partsRef);
                    partsSnap.forEach(d => participants.push(d.id));
                } catch(e) {
                    console.error("Parts fetch error:", e);
                }
            }

            countEl.textContent = participants.length;
            
            const isOrganizer = currentUser && myProfile && (myProfile.userId === evt.organizerId || currentUser.uid === evt.organizerId);

            if (evt.isParticipantsPublic || isOrganizer || isAdmin) {
                if (participants.length === 0) {
                    partsContainer.innerHTML = '<div class="text-[10px] text-brand-500 w-full text-center py-2">まだ参加者はいません</div>';
                } else {
                    partsContainer.innerHTML = '<div class="flex -space-x-3 overflow-hidden py-1 pl-2 w-full" id="modal-participants-icons"></div>';
                    const iconsContainer = document.getElementById('modal-participants-icons');
                    
                    const participantDataPromises = participants.map(async (uid) => {
                        let avatarUrl = 'https://via.placeholder.com/32?text=U';
                        let isVisible = false; // デフォルト非表示
                        
                        if (!isAdminMock) {
                            try {
                                const uDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid));
                                if(uDoc.exists()) {
                                    const data = uDoc.data();
                                    if(data.photoURL) avatarUrl = data.photoURL;
                                    
                                    if (isOrganizer || isAdmin) {
                                        isVisible = true; // 主催者・管理者は全員見える
                                    } else {
                                        // 一般ユーザーは、その参加者が「非公開」でなければ見える
                                        if (data.isHidden !== true) {
                                            isVisible = true;
                                        }
                                    }
                                }
                            } catch(e){ isVisible = false; }
                        } else {
                            isVisible = true; // テスト環境では常に表示
                        }
                        return { uid, avatarUrl, isVisible };
                    });

                    const resolvedParticipants = await Promise.all(participantDataPromises);
                    const visibleList = resolvedParticipants.filter(p => p.isVisible);

                    let partsHtml = '';
                    let count = 0;
                    for (const p of visibleList) {
                        if (count >= 10) break;
                        const userLinkAction = currentUser ? `window.location.href='user.html?uid=${p.uid}'` : `if(confirm('プロフィールを見るにはログインが必要です。ログイン画面へ移動しますか？')) window.location.href='login.html'`;
                        partsHtml += `<div onclick="${userLinkAction}" class="cursor-pointer inline-block h-10 w-10 rounded-full ring-2 ring-[#fffdf9] bg-brand-100 border border-brand-300 flex items-center justify-center overflow-hidden hover:scale-110 transition-transform shadow-sm"><img src="${p.avatarUrl}" class="w-full h-full object-cover"></div>`;
                        count++;
                    }
                    
                    const remainingCount = participants.length - count;
                    if (remainingCount > 0) {
                        partsHtml += `<div class="flex items-center justify-center h-10 w-10 rounded-full ring-2 ring-[#fffdf9] bg-brand-50 text-[10px] font-bold text-brand-600 border border-brand-200 shadow-sm">+${remainingCount}</div>`;
                    }
                    iconsContainer.innerHTML = partsHtml;
                }
            } else {
                partsContainer.innerHTML = '<div class="text-[10px] text-brand-500 bg-brand-100 px-3 py-2 rounded-sm border border-brand-200 w-full text-center"><i class="fa-solid fa-lock mr-1"></i>参加者は主催者のみ確認できます</div>';
            }
        };

        window.closeDetailModal = () => {
            document.getElementById('event-detail-modal').classList.add('hidden');
        };

        window.handleLogout = () => {
            if (isAdminMock) localStorage.removeItem('isAdminMock');
            signOut(auth);
            window.location.href = 'login.html';
        };