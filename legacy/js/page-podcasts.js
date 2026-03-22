import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        // ★修正: onSnapshot, query, where を追加
        import { getFirestore, collection, getDocs, doc, getDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

        const DEFAULT_ICON = 'https://via.placeholder.com/150/f7f5f0/c8b9a6?text=U';

        let currentUser = null;
        let isAdmin = false;
        let myRank = 'arrival';
        let allPodcasts = [];
        let followingIds = [];
        let currentTag = '';
        
        let liveRoomsUnsubscribe = null; // ★生配信監視用

        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';

        onAuthStateChanged(auth, async (user) => {
            if (isAdminMock) {
                currentUser = { uid: 'test_admin_uid' };
                isAdmin = true;
                myRank = 'covenant';
                followingIds = ['target_user'];
                document.getElementById('btn-post').classList.remove('hidden');
                document.getElementById('btn-post').classList.add('inline-flex');
                updateNavForAuth(true);
                fetchPodcasts();
                listenLiveRooms(); // ★追加
                return;
            }

            if (user && !user.isAnonymous) {
                currentUser = user;
                try {
                    const mySnap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));
                    if (mySnap.exists()) {
                        myRank = mySnap.data().membershipRank || 'arrival';
                        if (mySnap.data().userId === 'admin') isAdmin = true;
                        
                        if (myRank !== 'arrival' || isAdmin) {
                            const btnPost = document.getElementById('btn-post');
                            btnPost.classList.remove('hidden');
                            btnPost.classList.add('inline-flex');
                        }
                    }
                    
                    const followSnap = await getDocs(collection(db, 'artifacts', appId, 'users', user.uid, 'following'));
                    followingIds = followSnap.docs.map(d => d.id);

                } catch(e) { console.error(e); }
                updateNavForAuth(true);
                fetchPodcasts();
                listenLiveRooms(); // ★追加
            } else {
                updateNavForAuth(false);
                fetchPodcasts();
                listenLiveRooms(); // ★追加（非ログインでも配信中一覧は見れる）
            }
        });

        // ★追加: リアルタイムに生配信中(live)のルームを監視して表示する
        function listenLiveRooms() {
            if (isAdminMock) {
                // テスト表示用
                renderLiveRooms([{
                    id: 'test_admin_uid',
                    hostName: 'NOAH 運営',
                    hostIcon: 'https://via.placeholder.com/150',
                    title: '現在テスト配信中です！'
                }]);
                return;
            }

            const liveRef = collection(db, 'artifacts', appId, 'public', 'data', 'live_rooms');
            const q = query(liveRef, where('status', '==', 'live'));
            
            liveRoomsUnsubscribe = onSnapshot(q, (snap) => {
                let rooms = [];
                snap.forEach(docSnap => {
                    rooms.push({ id: docSnap.id, ...docSnap.data() });
                });
                
                // 新しい順にソート
                rooms.sort((a, b) => {
                    const tA = a.startedAt?.toMillis ? a.startedAt.toMillis() : 0;
                    const tB = b.startedAt?.toMillis ? b.startedAt.toMillis() : 0;
                    return tB - tA;
                });
                
                renderLiveRooms(rooms);
            }, (error) => {
                console.error("Live rooms fetch error:", error);
            });
        }

        // ★追加: 生配信中(live)のルームを画面に描画する
        function renderLiveRooms(rooms) {
            const section = document.getElementById('live-now-section');
            const scroll = document.getElementById('live-now-scroll');
            
            if (rooms.length === 0) {
                section.classList.add('hidden');
                return;
            }
            
            section.classList.remove('hidden');
            scroll.innerHTML = rooms.map(r => {
                const icon = r.hostIcon || DEFAULT_ICON;
                const name = r.hostName || '名無し';
                const title = r.title || '配信中';
                
                return `
                <a href="live_room.html?roomId=${r.id}" class="flex flex-col items-center gap-2 group w-[72px] sm:w-[88px] shrink-0 snap-start">
                    <div class="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[2px] bg-gradient-to-tr from-red-500 via-orange-400 to-[#b8860b] shadow-md group-hover:scale-105 transition-transform">
                        <div class="w-full h-full bg-[#fffdf9] rounded-full p-[2px]">
                            <img src="${icon}" onerror="this.src='${DEFAULT_ICON}'" class="w-full h-full rounded-full object-cover">
                        </div>
                        <div class="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-sm tracking-widest border border-red-800 shadow-sm whitespace-nowrap z-10">LIVE</div>
                    </div>
                    <div class="text-center w-full mt-1 px-1">
                        <p class="text-xs sm:text-sm font-bold text-brand-900 truncate group-hover:text-red-600 transition-colors tracking-wide">${name}</p>
                        <p class="text-[9px] sm:text-[10px] text-brand-500 truncate mt-0.5">${title}</p>
                    </div>
                </a>
                `;
            }).join('');
        }

        window.toggleTheaterMenu = () => {
            const menu = document.getElementById('sp-theater-menu');
            const content = document.getElementById('sp-theater-menu-content');
            if (menu.classList.contains('hidden')) {
                menu.classList.remove('hidden');
                setTimeout(() => content.classList.remove('translate-y-full'), 10);
            } else {
                content.classList.add('translate-y-full');
                setTimeout(() => menu.classList.add('hidden'), 300);
            }
        };

        function updateNavForAuth(isLoggedIn) {
            document.querySelectorAll('.auth-required').forEach(el => {
                el.style.display = isLoggedIn ? '' : 'none';
            });
            const authText = document.getElementById('nav-auth-text');
            const authIcon = document.getElementById('nav-auth-icon');
            if (authText && authIcon) {
                if (isLoggedIn) {
                    authText.textContent = '下船する';
                    authIcon.className = 'fa-solid fa-right-from-bracket text-lg';
                } else {
                    authText.textContent = '乗船する';
                    authIcon.className = 'fa-solid fa-right-to-bracket text-lg';
                }
            }
        }

        window.handleAuthAction = () => {
            if (currentUser || isAdminMock) {
                if (isAdminMock) localStorage.removeItem('isAdminMock');
                signOut(auth);
                window.location.reload(); 
            } else {
                window.location.href = 'login.html';
            }
        };

        async function fetchPodcasts() {
            try {
                const podRef = collection(db, 'artifacts', appId, 'public', 'data', 'podcasts');
                const snap = await getDocs(podRef);
                
                allPodcasts = [];
                snap.forEach(doc => {
                    allPodcasts.push({ id: doc.id, ...doc.data() });
                });
                
                // 日付の降順でソート
                allPodcasts.sort((a, b) => {
                    const dateA = new Date(a.createdAt || a.updatedAt || 0);
                    const dateB = new Date(b.createdAt || b.updatedAt || 0);
                    return dateB - dateA;
                });
                
                const urlParams = new URLSearchParams(window.location.search);
                const tagParam = urlParams.get('tag');
                if (tagParam) {
                    filterByTag(tagParam);
                } else {
                    renderDisplay();
                }
            } catch (error) {
                console.error("Error fetching podcasts:", error);
                document.getElementById('recommended-scroll').innerHTML = '<div class="w-full text-center text-red-500 py-10">音声の取得に失敗しました</div>';
            }
        }

        window.filterByTag = (tag) => {
            currentTag = tag;
            
            document.querySelectorAll('.tag-btn').forEach(btn => {
                if ((tag === '' && btn.textContent === 'すべて') || btn.textContent.includes(tag) && tag !== '') {
                    btn.className = 'tag-btn active whitespace-nowrap px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm bg-[#3e2723] text-[#d4af37] border border-[#b8860b] transform scale-105';
                } else {
                    btn.className = 'tag-btn whitespace-nowrap px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm bg-[#fffdf9] text-brand-600 border border-brand-200 hover:bg-brand-50 hover:border-[#b8860b] transform hover:scale-105';
                }
            });
            renderDisplay();
        };

        document.getElementById('search-input').addEventListener('input', renderDisplay);

        function shuffleArray(array) {
            let curId = array.length;
            while (0 !== curId) {
                let randId = Math.floor(Math.random() * curId);
                curId -= 1;
                let tmp = array[curId];
                array[curId] = array[randId];
                array[randId] = tmp;
            }
            return array;
        }

        // ★追加: 時間フォーマット関数
        function formatDuration(sec) {
            if(!sec || isNaN(sec) || !isFinite(sec)) return "";
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return `${m}:${s < 10 ? '0'+s : s}`;
        }

        function createPodcastCardHtml(p, isScrollMode = true) {
            const date = new Date(p.createdAt || p.updatedAt || Date.now());
            const dateStr = `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`;
            const thumbUrl = p.thumbnailUrl || 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=640&auto=format&fit=crop';
            
            let plainDesc = p.description ? p.description.replace(/[#*`\->]/g, '').trim() : '説明がありません';
            const tagsHtml = (p.tags || []).slice(0,2).map(t => `<span class="text-[8px] sm:text-[9px] bg-brand-50 border border-brand-200 text-[#b8860b] px-1.5 py-0.5 rounded-sm font-bold tracking-widest truncate">#${t}</span>`).join('');

            // ★追加: durationの表示生成
            const durationStr = p.duration ? formatDuration(p.duration) : '';
            const durationHtml = durationStr ? `<span class="text-[9px] text-[#b8860b] font-mono tracking-wider ml-1 bg-brand-50 px-1 rounded-sm border border-brand-100">${durationStr}</span>` : '';

            const widthClass = isScrollMode ? "w-full h-full snap-start" : "w-full h-full";

            return `
            <a href="podcast_detail.html?pid=${p.id}" class="flex flex-col bg-[#fffdf9] p-4 rounded-md border border-brand-200 shadow-sm hover:shadow-md transition-all hover:border-[#b8860b]/50 group ${widthClass}">
                <div class="flex gap-3 sm:gap-4 items-start mb-3">
                    <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-md bg-[#1a110f] overflow-hidden flex-shrink-0 border border-brand-100 relative shadow-inner mt-0.5">
                        <img src="${thumbUrl}" class="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500">
                        <div class="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors">
                            <i class="fa-solid fa-play text-white/90 text-xl shadow-sm drop-shadow-md"></i>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0 flex flex-col justify-center h-14 sm:h-16">
                        <h3 class="text-sm sm:text-base font-bold text-brand-900 leading-snug line-clamp-2 font-serif group-hover:text-[#b8860b] transition-colors m-0 tracking-wide">${p.title || 'タイトルなし'}</h3>
                    </div>
                </div>
                
                <p class="text-[11px] sm:text-xs text-brand-500 line-clamp-2 leading-relaxed mb-4 flex-1 tracking-wide">${plainDesc}</p>
                
                <div class="flex flex-wrap items-center justify-between gap-2 mt-auto pt-3 border-t border-brand-100/70">
                    <div class="flex items-center gap-1.5 min-w-0 pr-2">
                        <img src="${p.authorIcon || 'https://via.placeholder.com/24'}" class="w-5 h-5 rounded-full border border-brand-200 object-cover flex-shrink-0 shadow-sm" onerror="this.src='https://via.placeholder.com/24?text=U'">
                        <span class="text-[10px] text-brand-700 truncate font-bold tracking-widest">${p.authorName || '名無し'}</span>
                        ${durationHtml} <!-- ★追加: 長さ表示 -->
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <div class="flex gap-1">${tagsHtml}</div>
                        <span class="text-[9px] text-brand-400 font-mono">${dateStr}</span>
                    </div>
                </div>
            </a>
            `;
        }

        function renderDisplay() {
            const searchQ = document.getElementById('search-input').value.trim().toLowerCase();
            const isFiltering = searchQ !== '' || currentTag !== '';

            if (isFiltering) {
                document.getElementById('default-sections').classList.add('hidden');
                document.getElementById('search-results-section').classList.remove('hidden');
                renderSearchResults(searchQ);
            } else {
                document.getElementById('default-sections').classList.remove('hidden');
                document.getElementById('search-results-section').classList.add('hidden');
                renderDefaultSections();
            }
        }

        function renderSearchResults(searchQ) {
            const grid = document.getElementById('search-grid');
            
            let filtered = allPodcasts.filter(p => {
                const matchTag = currentTag === '' || (p.tags && p.tags.includes(currentTag));
                const matchSearch = searchQ === '' || 
                                    (p.title && p.title.toLowerCase().includes(searchQ)) || 
                                    (p.guests && p.guests.join(',').toLowerCase().includes(searchQ)) ||
                                    (p.description && p.description.toLowerCase().includes(searchQ));
                return matchTag && matchSearch;
            });

            if (filtered.length === 0) {
                grid.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center text-brand-400 py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200"><i class="fa-solid fa-microphone-slash text-4xl mb-3 text-brand-200"></i><p>該当する配信がありません。</p></div>';
            } else {
                grid.innerHTML = filtered.map(p => createPodcastCardHtml(p, false)).join('');
            }
        }

        function renderDefaultSections() {
            // Following Section
            const followingSection = document.getElementById('following-section');
            const followingScroll = document.getElementById('following-scroll');
            let followingPodcasts = allPodcasts.filter(p => followingIds.includes(p.authorId));
            
            if (followingPodcasts.length > 0) {
                followingSection.classList.remove('hidden');
                followingScroll.innerHTML = followingPodcasts.slice(0, 25).map(p => createPodcastCardHtml(p, true)).join('');
            } else {
                followingSection.classList.add('hidden');
            }

            // Recommended Section
            const recommendedScroll = document.getElementById('recommended-scroll');
            let otherPodcasts = allPodcasts.filter(p => !followingIds.includes(p.authorId));
            
            if (otherPodcasts.length === 0) {
                otherPodcasts = [...allPodcasts];
            }
            
            let shuffled = shuffleArray([...otherPodcasts]);
            
            if (shuffled.length === 0) {
                recommendedScroll.innerHTML = '<div class="w-full flex flex-col items-center justify-center text-brand-400 py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200 col-span-full"><i class="fa-solid fa-microphone-slash text-4xl mb-3 text-brand-200"></i><p>まだ配信がありません。</p></div>';
            } else {
                recommendedScroll.innerHTML = shuffled.slice(0, 25).map(p => createPodcastCardHtml(p, true)).join('');
            }
        }

        // --- モーダル制御 ---
        window.openMoreModal = (type) => {
            const modal = document.getElementById('more-modal');
            const title = document.getElementById('more-modal-title');
            const grid = document.getElementById('more-modal-grid');
            
            let targetData = [];
            
            if (type === 'following') {
                title.innerHTML = '<i class="fa-solid fa-user-group text-brand-400 mr-2"></i>フォロー中の新着';
                targetData = allPodcasts.filter(p => followingIds.includes(p.authorId));
            } else if (type === 'recommended') {
                title.innerHTML = '<i class="fa-solid fa-sparkles text-[#b8860b] mr-2"></i>おすすめ';
                let otherPodcasts = allPodcasts.filter(p => !followingIds.includes(p.authorId));
                if (otherPodcasts.length === 0) otherPodcasts = [...allPodcasts];
                targetData = otherPodcasts; // 全件表示
            }
            
            grid.innerHTML = targetData.map(p => createPodcastCardHtml(p, false)).join('');
            
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        };

        window.closeMoreModal = () => {
            document.getElementById('more-modal').classList.add('hidden');
            document.body.style.overflow = '';
        };

        // ★追加: ページを離れる際に監視を解除
        window.addEventListener('unload', () => {
            if (liveRoomsUnsubscribe) liveRoomsUnsubscribe();
        });