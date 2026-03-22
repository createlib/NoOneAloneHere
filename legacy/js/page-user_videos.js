import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        import { getFirestore, collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

        const urlParams = new URLSearchParams(window.location.search);
        const targetUid = urlParams.get('uid');
        let allVideos = [];

        if (!targetUid) {
            alert('ユーザーが指定されていません');
            window.location.href = 'videos.html';
        }

        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';
        let currentUser = null;

        onAuthStateChanged(auth, async (user) => {
            if (isAdminMock) {
                currentUser = { uid: 'test_admin_uid' };
                updateNavForAuth(true);
                loadUserAndVideos();
                return;
            }

            if (user && !user.isAnonymous) {
                currentUser = user;
                updateNavForAuth(true);
            } else {
                updateNavForAuth(false);
            }
            loadUserAndVideos();
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

        async function loadUserAndVideos() {
            try {
                if (isAdminMock && targetUid === 'test_admin_uid') {
                    document.getElementById('user-name').textContent = 'NOAH 運営';
                    document.getElementById('user-id').textContent = '@admin';
                    document.getElementById('user-job').textContent = 'NOAH運営';
                    document.getElementById('header-icon').src = 'https://via.placeholder.com/150';
                } else {
                    const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', targetUid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        document.getElementById('user-name').textContent = data.name || data.userId || '名無し';
                        document.getElementById('user-id').textContent = '@' + (data.userId || targetUid);
                        document.getElementById('user-job').textContent = data.jobTitle || '';
                        if (data.photoURL) document.getElementById('header-icon').src = data.photoURL;
                    } else {
                        document.getElementById('user-name').textContent = '退会したユーザー';
                    }
                }
                document.getElementById('author-profile-link').href = `user.html?uid=${targetUid}`;
                document.getElementById('btn-profile').href = `user.html?uid=${targetUid}`;
            } catch (e) {
                console.error("User fetch error", e);
            }

            try {
                const videosRef = collection(db, 'artifacts', appId, 'public', 'data', 'videos');
                const q = query(videosRef, where("authorId", "==", targetUid));
                const snap = await getDocs(q);
                
                let userVideos = [];
                snap.forEach(doc => {
                    userVideos.push({ id: doc.id, ...doc.data() });
                });
                
                userVideos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                renderVideos(userVideos);
            } catch (error) {
                console.error("Error fetching videos:", error);
                document.getElementById('video-grid').innerHTML = '<div class="col-span-full text-center text-red-500 py-10">動画の取得に失敗しました</div>';
            }
        }

        function renderVideos(videos) {
            const grid = document.getElementById('video-grid');
            document.getElementById('video-count').textContent = `${videos.length}件`;

            if (videos.length === 0) {
                grid.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center text-brand-400 py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200"><i class="fa-solid fa-film text-4xl mb-3 text-brand-200"></i><p class="font-bold tracking-widest">まだ投稿された動画はありません。</p></div>';
                return;
            }

            let html = '';
            videos.forEach(v => {
                const date = new Date(v.createdAt);
                const dateStr = `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`;
                
                html += `
                <a href="video_detail.html?vid=${v.id}" class="video-card flex flex-col group cursor-pointer bg-[#fffdf9] rounded-sm overflow-hidden border border-brand-100 shadow-sm hover:shadow-xl">
                    <div class="relative w-full aspect-video bg-[#000] overflow-hidden border-b border-brand-100">
                        <img src="${v.thumbnailUrl || 'https://via.placeholder.com/640x360?text=No+Image'}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" onerror="this.src='https://via.placeholder.com/640x360?text=NOAH'">
                        <div class="thumb-overlay absolute inset-0 bg-black/40 opacity-0 transition-all duration-300 flex items-center justify-center">
                            <div class="play-icon w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/50 transition-transform duration-300">
                                <i class="fa-solid fa-play text-white text-xl ml-1"></i>
                            </div>
                        </div>
                    </div>
                    <div class="p-4">
                        <div class="flex flex-wrap gap-1 mb-2 h-5 overflow-hidden">
                            ${(v.tags || []).slice(0,3).map(t => `<span class="text-[9px] bg-brand-50 border border-brand-200 text-brand-600 px-1.5 py-0.5 rounded-sm font-bold tracking-widest truncate">#${t}</span>`).join('')}
                        </div>
                        <h3 class="text-sm font-bold text-brand-900 leading-snug line-clamp-2 mb-2 group-hover:text-brand-600 transition-colors font-serif tracking-wide h-10">${v.title}</h3>
                        <p class="text-[10px] text-brand-400 font-mono flex justify-between items-center">
                            <span><i class="fa-regular fa-clock mr-1"></i>${dateStr}</span>
                        </p>
                    </div>
                </a>
                `;
            });
            grid.innerHTML = html;
        }