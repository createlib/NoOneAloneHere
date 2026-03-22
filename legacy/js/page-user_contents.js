import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        import { getFirestore, collection, getDocs, doc, getDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

        const urlParams = new URLSearchParams(window.location.search);
        const urlTargetUid = urlParams.get('uid');

        if (!urlTargetUid) {
            alert('ユーザーが指定されていません');
            window.location.href = 'home.html';
        }

        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';
        let currentUser = null;
        let myProfile = null;
        let myRank = 'arrival';
        let isAdmin = false;
        
        let currentTab = 'videos';

        // 状態保持用データ
        let targetUserData = null;
        let myVideos = [];
        let myPodcasts = [];
        let likedVideos = [];
        let likedPodcasts = [];
        let isLikedVideosLoaded = false;
        let isLikedPodcastsLoaded = false;

        let roomUnsubscribe = null;

        // --- Auth State ---
        onAuthStateChanged(auth, async (user) => {
            if (isAdminMock) {
                currentUser = { uid: 'test_admin_uid' };
                isAdmin = true;
                myRank = 'covenant';
                myProfile = { name: '管理者', userId: 'admin', photoURL: 'https://via.placeholder.com/150' };
                if (urlTargetUid === 'test_admin_uid') {
                    document.getElementById('tab-liked-videos')?.classList.remove('hidden');
                    document.getElementById('tab-liked-podcasts')?.classList.remove('hidden');
                }
                await loadUserInfo();
                loadMyContents();
                checkLiveStatus();
                return;
            }

            if (user && !user.isAnonymous) {
                currentUser = user;
                if (currentUser.uid === urlTargetUid) {
                    document.getElementById('tab-liked-videos')?.classList.remove('hidden');
                    document.getElementById('tab-liked-podcasts')?.classList.remove('hidden');
                }
                try {
                    const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));
                    if (snap.exists()) {
                        myProfile = snap.data();
                        myRank = myProfile.membershipRank || 'arrival';
                        if (myProfile.userId === 'admin') isAdmin = true;
                    }
                } catch(e){}
                updateNavForAuth(true);
            } else {
                updateNavForAuth(false);
            }
            await loadUserInfo();
            loadMyContents();
            checkLiveStatus();
        });

        window.handleAuthAction = () => {
            if (currentUser || isAdminMock) {
                if (isAdminMock) localStorage.removeItem('isAdminMock');
                signOut(auth);
                window.location.reload(); 
            } else {
                window.location.href = 'login.html';
            }
        };

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
            document.querySelectorAll('.auth-required').forEach(el => el.style.display = isLoggedIn ? '' : 'none');
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

        async function loadUserInfo() {
            try {
                if (isAdminMock && urlTargetUid === 'test_admin_uid') {
                    targetUserData = { name: 'NOAH 運営', userId: 'admin', jobTitle: 'NOAH運営', photoURL: 'https://via.placeholder.com/150' };
                } else {
                    const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', urlTargetUid));
                    if (userDoc.exists()) {
                        targetUserData = userDoc.data();
                    } else {
                        targetUserData = { name: '退会したユーザー', userId: urlTargetUid };
                    }
                }
                
                document.getElementById('user-name').textContent = targetUserData.name || targetUserData.userId || '名無し';
                document.getElementById('user-id').textContent = '@' + (targetUserData.userId || urlTargetUid);
                document.getElementById('user-job').textContent = targetUserData.jobTitle || '';
                if (targetUserData.photoURL) document.getElementById('header-icon').src = targetUserData.photoURL;
                
                const btnProfile = document.getElementById('btn-profile');
                if(btnProfile) btnProfile.href = `user.html?uid=${urlTargetUid}`;

                const canHost = (myRank === 'guardian' || myRank === 'covenant' || isAdmin);
                if (currentUser && currentUser.uid === urlTargetUid && canHost) {
                    document.getElementById('btn-create-room')?.classList.remove('hidden');
                }
            } catch (e) { console.error("User fetch error", e); }
        }

        // ==============================================================
        // ライブ配信 (SIGNAL CAST) への導線
        // ==============================================================

        window.openCreateRoomModal = () => {
            if (!currentUser) return alert('ログインが必要です');
            window.location.href = 'live_room.html?action=create';
        };

        window.attemptJoinLive = () => {
            const badge = document.getElementById('live-badge');
            if (badge && !badge.classList.contains('hidden')) {
                window.location.href = `live_room.html?roomId=${urlTargetUid}`;
            }
        };

        function checkLiveStatus() {
            if (isAdminMock) return; 
            const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', urlTargetUid);
            
            roomUnsubscribe = onSnapshot(roomRef, (snap) => {
                const ring = document.getElementById('header-icon-ring');
                const badge = document.getElementById('live-badge');
                const overlay = document.getElementById('live-overlay');
                const btnCreate = document.getElementById('btn-create-room');

                if (snap.exists() && snap.data().status === 'live') {
                    // 配信中
                    if(ring) ring.classList.add('live-ring', 'cursor-pointer');
                    if(badge) badge.classList.remove('hidden');
                    if(overlay) overlay.classList.remove('hidden');
                    
                    if (currentUser && currentUser.uid === urlTargetUid) {
                        if(btnCreate) {
                            btnCreate.innerHTML = '<i class="fa-solid fa-satellite-dish animate-pulse"></i> 配信ルームに戻る';
                            btnCreate.onclick = () => window.location.href = `live_room.html?roomId=${urlTargetUid}`;
                        }
                    }
                } else {
                    // 配信していない
                    if(ring) ring.classList.remove('live-ring', 'cursor-pointer');
                    if(badge) badge.classList.add('hidden');
                    if(overlay) overlay.classList.add('hidden');
                    
                    if (currentUser && currentUser.uid === urlTargetUid && (myRank === 'guardian' || myRank === 'covenant' || isAdmin)) {
                        if(btnCreate) {
                            btnCreate.innerHTML = '<i class="fa-solid fa-satellite-dish animate-pulse"></i> SIGNAL CAST を配信する';
                            btnCreate.onclick = window.openCreateRoomModal;
                        }
                    }
                }
            });
        }

        // ==========================================
        // Data Load & Render (Videos / Podcasts)
        // ==========================================
        async function loadMyContents() {
            try {
                const videosRef = collection(db, 'artifacts', appId, 'public', 'data', 'videos');
                const qV = query(videosRef, where("authorId", "==", urlTargetUid));
                const snapV = await getDocs(qV);
                myVideos = [];
                snapV.forEach(doc => myVideos.push({ id: doc.id, ...doc.data() }));
                myVideos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                const podRef = collection(db, 'artifacts', appId, 'public', 'data', 'podcasts');
                const qP = query(podRef, where("authorId", "==", urlTargetUid));
                const snapP = await getDocs(qP);
                myPodcasts = [];
                snapP.forEach(doc => myPodcasts.push({ id: doc.id, ...doc.data() }));
                myPodcasts.sort((a, b) => new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt));

                renderCurrentTab();
            } catch (error) {
                console.error("Error fetching contents:", error);
                document.getElementById('content-grid').innerHTML = '<div class="col-span-full text-center text-red-500 py-10">コンテンツの取得に失敗しました</div>';
            }
        }

        async function loadLikedVideos() {
            if (isLikedVideosLoaded || isAdminMock) return;
            const grid = document.getElementById('content-grid');
            grid.innerHTML = '<div class="col-span-full text-center py-12 text-brand-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>お気に入りの動画を探しています...</div>';
            
            try {
                const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'videos'));
                const promises = snap.docs.map(async (d) => {
                    const likeSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', d.id, 'likes', currentUser.uid));
                    if(likeSnap.exists()) return { id: d.id, ...d.data(), likedAt: likeSnap.data().timestamp };
                    return null;
                });
                const results = await Promise.all(promises);
                likedVideos = results.filter(v => v !== null).sort((a,b) => {
                    const tA = a.likedAt?.toMillis ? a.likedAt.toMillis() : 0;
                    const tB = b.likedAt?.toMillis ? b.likedAt.toMillis() : 0;
                    return tB - tA;
                });
                isLikedVideosLoaded = true;
                renderCurrentTab();
            } catch (e) {
                console.error(e);
                grid.innerHTML = '<div class="col-span-full text-center text-red-500 py-10">お気に入りの取得に失敗しました</div>';
            }
        }

        async function loadLikedPodcasts() {
            if (isLikedPodcastsLoaded || isAdminMock) return;
            const grid = document.getElementById('content-grid');
            grid.innerHTML = '<div class="col-span-full text-center py-12 text-brand-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>お気に入りの音声を探しています...</div>';
            
            try {
                const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'podcasts'));
                const promises = snap.docs.map(async (d) => {
                    const likeSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'podcasts', d.id, 'likes', currentUser.uid));
                    if(likeSnap.exists()) return { id: d.id, ...d.data(), likedAt: likeSnap.data().timestamp };
                    return null;
                });
                const results = await Promise.all(promises);
                likedPodcasts = results.filter(p => p !== null).sort((a,b) => {
                    const tA = a.likedAt?.toMillis ? a.likedAt.toMillis() : 0;
                    const tB = b.likedAt?.toMillis ? b.likedAt.toMillis() : 0;
                    return tB - tA;
                });
                isLikedPodcastsLoaded = true;
                renderCurrentTab();
            } catch (e) {
                console.error(e);
                grid.innerHTML = '<div class="col-span-full text-center text-red-500 py-10">お気に入りの取得に失敗しました</div>';
            }
        }

        window.switchTab = async (tabName) => {
            currentTab = tabName;
            
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active', 'border-[#b8860b]', 'text-[#b8860b]');
                btn.classList.add('border-transparent', 'text-brand-400');
            });
            const activeBtn = document.getElementById(`tab-${tabName}`);
            if(activeBtn) {
                activeBtn.classList.remove('border-transparent', 'text-brand-400');
                activeBtn.classList.add('active', 'border-[#b8860b]', 'text-[#b8860b]');
            }

            if (tabName === 'liked-videos' && !isLikedVideosLoaded && !isAdminMock) {
                await loadLikedVideos();
            } else if (tabName === 'liked-podcasts' && !isLikedPodcastsLoaded && !isAdminMock) {
                await loadLikedPodcasts();
            } else {
                renderCurrentTab();
            }
        };

        function renderCurrentTab() {
            const grid = document.getElementById('content-grid');
            
            if (currentTab === 'videos') {
                renderVideos(myVideos, grid, "投稿された動画はありません。");
            } else if (currentTab === 'podcasts') {
                renderPodcasts(myPodcasts, grid, "投稿された音声はありません。");
            } else if (currentTab === 'liked-videos') {
                renderVideos(likedVideos, grid, "お気に入りした動画はありません。");
            } else if (currentTab === 'liked-podcasts') {
                renderPodcasts(likedPodcasts, grid, "お気に入りした音声はありません。");
            }
        }

        function renderVideos(videos, container, emptyMsg) {
            if (videos.length === 0) {
                container.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center text-brand-400 py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200"><i class="fa-solid fa-film text-4xl mb-3 text-brand-200"></i><p class="font-bold tracking-widest">${emptyMsg}</p></div>`;
                return;
            }

            let html = '';
            videos.forEach(v => {
                const date = new Date(v.createdAt);
                const dateStr = `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`;
                
                html += `
                <a href="video_detail.html?vid=${v.id}" class="flex flex-col group cursor-pointer bg-[#fffdf9] rounded-sm overflow-hidden border border-brand-100 shadow-sm hover:shadow-md hover:border-brand-400 transition-all w-full h-full">
                    <div class="relative w-full aspect-video bg-[#000] overflow-hidden border-b border-brand-100">
                        <img src="${v.thumbnailUrl || 'https://via.placeholder.com/640x360?text=No+Image'}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onerror="this.src='https://via.placeholder.com/640x360?text=NOAH'">
                        <div class="absolute inset-0 bg-black/30 opacity-0 transition-all duration-300 flex items-center justify-center group-hover:opacity-100">
                            <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/50 transition-transform duration-300 group-hover:scale-110">
                                <i class="fa-solid fa-play text-white text-lg ml-1"></i>
                            </div>
                        </div>
                    </div>
                    <div class="p-4 flex gap-3 flex-1">
                        <div class="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                                <h3 class="text-sm font-bold text-brand-900 leading-snug line-clamp-2 mb-1.5 group-hover:text-brand-600 transition-colors font-serif tracking-wide">${v.title || 'タイトルなし'}</h3>
                            </div>
                            <p class="text-[9px] text-brand-400 font-mono tracking-widest">${dateStr}</p>
                        </div>
                    </div>
                </a>
                `;
            });
            container.innerHTML = html;
        }

        function formatDuration(sec) {
            if(!sec || isNaN(sec) || !isFinite(sec)) return "";
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return `${m}:${s < 10 ? '0'+s : s}`;
        }

        function renderPodcasts(podcasts, container, emptyMsg) {
            if (podcasts.length === 0) {
                container.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center text-brand-400 py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200"><i class="fa-solid fa-podcast text-4xl mb-3 text-brand-200"></i><p class="font-bold tracking-widest">${emptyMsg}</p></div>`;
                return;
            }

            let html = '';
            podcasts.forEach(p => {
                const date = new Date(p.createdAt || p.updatedAt || Date.now());
                const dateStr = `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`;
                const thumbUrl = p.thumbnailUrl || 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=640&auto=format&fit=crop';
                
                let plainDesc = p.description ? p.description.replace(/[#*`\->]/g, '').trim() : '説明がありません';
                const tagsHtml = (p.tags || []).slice(0,2).map(t => `<span class="text-[8px] sm:text-[9px] bg-brand-50 border border-brand-200 text-[#b8860b] px-1.5 py-0.5 rounded-sm font-bold tracking-widest truncate">#${t}</span>`).join('');
                const durationStr = p.duration ? formatDuration(p.duration) : '';
                const durationHtml = durationStr ? `<span class="text-[8px] sm:text-[9px] text-[#b8860b] font-mono tracking-wider ml-1 bg-brand-50 px-1 rounded-sm border border-brand-100"><i class="fa-regular fa-clock mr-0.5"></i>${durationStr}</span>` : '';

                html += `
                <a href="podcast_detail.html?pid=${p.id}" class="flex flex-col bg-[#fffdf9] p-4 rounded-md border border-brand-200 shadow-sm hover:shadow-md transition-all hover:border-[#b8860b]/50 group w-full h-full">
                    <div class="flex gap-3 sm:gap-4 items-start mb-3">
                        <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-md bg-[#1a110f] overflow-hidden flex-shrink-0 border border-brand-100 relative shadow-inner mt-0.5">
                            <img src="${thumbUrl}" class="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500">
                            <div class="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors">
                                <i class="fa-solid fa-play text-white/90 text-xl shadow-sm drop-shadow-md group-hover:scale-110 transition-transform"></i>
                            </div>
                        </div>
                        <div class="flex-1 min-w-0 flex flex-col justify-center h-14 sm:h-16">
                            <h3 class="text-sm sm:text-base font-bold text-brand-900 leading-snug line-clamp-2 font-serif group-hover:text-[#b8860b] transition-colors m-0 tracking-wide">${p.title || 'タイトルなし'}</h3>
                        </div>
                    </div>
                    
                    <p class="text-[11px] sm:text-xs text-brand-500 line-clamp-2 leading-relaxed mb-4 flex-1 tracking-wide">${plainDesc}</p>
                    
                    <div class="flex flex-wrap items-center justify-between gap-2 mt-auto pt-3 border-t border-brand-100/70">
                        <div class="flex items-center gap-1.5 min-w-0 pr-2">
                            ${durationHtml}
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <div class="flex gap-1">${tagsHtml}</div>
                            <span class="text-[9px] text-brand-400 font-mono tracking-widest">${dateStr}</span>
                        </div>
                    </div>
                </a>
                `;
            });
            container.innerHTML = html;
        }

        window.addEventListener('unload', () => {
            if(roomUnsubscribe) roomUnsubscribe();
        });