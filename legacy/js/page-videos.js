import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

        let currentUser = null;
        let isAdmin = false;
        let myRank = 'arrival';
        let allVideos = [];
        let followingIds = [];
        let currentTag = '';

        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';

        onAuthStateChanged(auth, async (user) => {
            if (isAdminMock) {
                currentUser = { uid: 'test_admin_uid' };
                isAdmin = true;
                myRank = 'covenant';
                followingIds = ['target_user']; // ダミーのフォロー
                document.getElementById('btn-post').classList.remove('hidden');
                document.getElementById('btn-post').classList.add('inline-flex');
                updateNavForAuth(true);
                fetchVideos();
                return;
            }

            if (user && !user.isAnonymous) {
                currentUser = user;
                try {
                    const mySnap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));
                    if (mySnap.exists()) {
                        myRank = mySnap.data().membershipRank || 'arrival';
                        if (mySnap.data().userId === 'admin') isAdmin = true;
                        
                        // 投稿ボタンの表示 (SETTLER以上)
                        if (myRank !== 'arrival' || isAdmin) {
                            const btnPost = document.getElementById('btn-post');
                            btnPost.classList.remove('hidden');
                            btnPost.classList.add('inline-flex');
                        }
                    }
                    
                    // フォロー中のユーザーを取得
                    const followSnap = await getDocs(collection(db, 'artifacts', appId, 'users', user.uid, 'following'));
                    followingIds = followSnap.docs.map(d => d.id);
                    
                } catch(e) { console.error(e); }
                updateNavForAuth(true);
                fetchVideos();
            } else {
                updateNavForAuth(false);
                fetchVideos();
            }
        });

        // SP用 メディアメニューのトグル
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

        window.goToPost = () => {
            window.location.href = 'video_post.html';
        };

        async function fetchVideos() {
            try {
                const videosRef = collection(db, 'artifacts', appId, 'public', 'data', 'videos');
                const snap = await getDocs(videosRef);
                
                allVideos = [];
                snap.forEach(doc => {
                    allVideos.push({ id: doc.id, ...doc.data() });
                });
                
                // 日付の降順でソート
                allVideos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                // URLパラメータにタグがあれば初期選択
                const urlParams = new URLSearchParams(window.location.search);
                const tagParam = urlParams.get('tag');
                if (tagParam) {
                    filterByTag(tagParam);
                } else {
                    renderDisplay();
                }
            } catch (error) {
                console.error("Error fetching videos:", error);
                document.getElementById('recommended-grid').innerHTML = '<div class="col-span-full text-center text-red-500 py-10">動画の取得に失敗しました</div>';
            }
        }

        window.filterByTag = (tag) => {
            currentTag = tag;
            
            document.querySelectorAll('.tag-btn').forEach(btn => {
                if ((tag === '' && btn.textContent === 'すべて') || btn.textContent.includes(tag) && tag !== '') {
                    btn.className = 'tag-btn active whitespace-nowrap px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm bg-[#3e2723] text-[#f7f5f0] border border-[#3e2723] transform scale-105';
                } else {
                    btn.className = 'tag-btn whitespace-nowrap px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm bg-[#fffdf9] text-brand-600 border border-brand-200 hover:bg-brand-50 hover:border-brand-300 transform hover:scale-105';
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

        // ★追加・変更: isScrollMode に応じて横幅のクラスを切り替える
        function createVideoCardHtml(v, isScrollMode = true) {
            const date = new Date(v.createdAt);
            const dateStr = `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`;
            
            // スクロール内かグリッド内かで幅設定を切り替え
            const widthClass = isScrollMode ? "w-full h-full snap-start" : "w-full h-full";

            return `
            <a href="video_detail.html?vid=${v.id}" class="video-card flex flex-col group cursor-pointer bg-[#fffdf9] rounded-sm overflow-hidden border border-brand-100 shadow-sm hover:shadow-xl ${widthClass}">
                <div class="relative w-full aspect-video bg-[#000] overflow-hidden">
                    <img src="${v.thumbnailUrl || 'https://via.placeholder.com/640x360?text=No+Image'}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onerror="this.src='https://via.placeholder.com/640x360?text=NOAH'">
                    <div class="thumb-overlay absolute inset-0 bg-black/40 opacity-0 transition-all duration-300 flex items-center justify-center">
                        <div class="play-icon w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/50 transition-transform duration-300">
                            <i class="fa-solid fa-play text-white text-xl ml-1"></i>
                        </div>
                    </div>
                </div>
                <div class="p-4 flex gap-3 flex-1">
                    <img src="${v.authorIcon || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full border border-brand-200 object-cover flex-shrink-0 shadow-sm" onerror="this.src='https://via.placeholder.com/40?text=U'">
                    <div class="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                            <h3 class="text-sm font-bold text-brand-900 leading-snug line-clamp-2 mb-1.5 group-hover:text-brand-600 transition-colors font-serif tracking-wide">${v.title}</h3>
                            <div class="flex items-center text-xs text-brand-500 mb-1">
                                <span class="truncate hover:text-brand-800 transition-colors">${v.authorName || '名無し'}</span>
                                <i class="fa-solid fa-circle-check text-[10px] ml-1 text-[#d4af37]"></i>
                            </div>
                        </div>
                        <p class="text-[10px] text-brand-400 font-mono">${dateStr}</p>
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
            
            let filtered = allVideos.filter(v => {
                const matchTag = currentTag === '' || (v.tags && v.tags.includes(currentTag));
                const matchSearch = searchQ === '' || 
                                    (v.title && v.title.toLowerCase().includes(searchQ)) || 
                                    (v.description && v.description.toLowerCase().includes(searchQ));
                return matchTag && matchSearch;
            });

            if (filtered.length === 0) {
                grid.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center text-brand-400 py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200"><i class="fa-solid fa-film text-4xl mb-3 text-brand-200"></i><p>該当する動画がありません。</p></div>';
            } else {
                // 検索結果はグリッドなので false
                grid.innerHTML = filtered.map(v => createVideoCardHtml(v, false)).join('');
            }
        }

        function renderDefaultSections() {
            // Following Section (横スクロール 3段)
            const followingSection = document.getElementById('following-section');
            const followingScroll = document.getElementById('following-scroll');
            let followingVideos = allVideos.filter(v => followingIds.includes(v.authorId));
            
            if (followingVideos.length > 0) {
                followingSection.classList.remove('hidden');
                // 3段積みを想定して最大15件表示
                followingScroll.innerHTML = followingVideos.slice(0, 15).map(v => createVideoCardHtml(v, true)).join('');
            } else {
                followingSection.classList.add('hidden');
            }

            // Recommended Section (横スクロール 3段)
            const recommendedScroll = document.getElementById('recommended-scroll');
            let otherVideos = allVideos.filter(v => !followingIds.includes(v.authorId));
            
            if (otherVideos.length === 0) {
                otherVideos = [...allVideos];
            }
            
            let shuffled = shuffleArray([...otherVideos]);
            
            if (shuffled.length === 0) {
                recommendedScroll.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center text-brand-400 py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200 w-full"><i class="fa-solid fa-film text-4xl mb-3 text-brand-200"></i><p>まだ動画がありません。</p></div>';
            } else {
                // 3段積みを想定して最大15件表示
                recommendedScroll.innerHTML = shuffled.slice(0, 15).map(v => createVideoCardHtml(v, true)).join('');
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
                targetData = allVideos.filter(v => followingIds.includes(v.authorId));
            } else if (type === 'recommended') {
                title.innerHTML = '<i class="fa-solid fa-sparkles text-[#b8860b] mr-2"></i>おすすめ';
                let otherVideos = allVideos.filter(v => !followingIds.includes(v.authorId));
                if (otherVideos.length === 0) otherVideos = [...allVideos];
                targetData = otherVideos; // 全件表示
            }
            
            grid.innerHTML = targetData.map(v => createVideoCardHtml(v, false)).join('');
            
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        };

        window.closeMoreModal = () => {
            document.getElementById('more-modal').classList.add('hidden');
            document.body.style.overflow = '';
        };