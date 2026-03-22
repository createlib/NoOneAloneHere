import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, getCountFromServer, addDoc, query, where, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

        // ▼▼▼▼ Firebase Config ▼▼▼▼
        let currentUser = null;
        let isSelf = false;
        let isAdmin = false;
        let targetUid = null;
        let isFollowing = false;
        let isMutual = false;
        let myRank = 'arrival';
        
        let privateMemos = []; 
        let commonMutualIds = []; 

        // メディアログ用データ
        let myVideos = [];
        let myPodcasts = [];
        let likedVideos = [];
        let likedPodcasts = [];
        
        // プレイリスト用データ
        let myPlaylists = [];
        let currentPlaylistItems = [];
        let editingPlaylistId = null;
        let playlistFilterType = 'video';

        let isLikedVideosLoaded = false;
        let isLikedPodcastsLoaded = false;
        let isMyContentsLoaded = false;
        let currentMediaTab = 'videos';

        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';
        const urlParams = new URLSearchParams(window.location.search);
        targetUid = urlParams.get('uid');
        const initialTab = urlParams.get('tab'); // ★追加: 初期タブのパラメータ取得

        // OSテーマカラーの定義
        const THEME_COLORS = {
            '甲': { bg: '#041208', main: '#10B981', sub: '#34D399' },
            '乙': { bg: '#08140B', main: '#34D399', sub: '#6EE7B7' },
            '丙': { bg: '#1A0808', main: '#EF4444', sub: '#FCA5A5' },
            '丁': { bg: '#180B05', main: '#F97316', sub: '#FDBA74' },
            '戊': { bg: '#171105', main: '#D97706', sub: '#FCD34D' },
            '己': { bg: '#141208', main: '#B45309', sub: '#FDE047' },
            '庚': { bg: '#080A0F', main: '#94A3B8', sub: '#CBD5E1' },
            '辛': { bg: '#0B0D14', main: '#CBD5E1', sub: '#F1F5F9' },
            '壬': { bg: '#050A14', main: '#3B82F6', sub: '#93C5FD' },
            '癸': { bg: '#060913', main: '#C5A880', sub: '#3B82F6' }
        };

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

        function formatText(text) {
            if (!text) return '';
            
            const textStr = String(text);
            let processedText = textStr.replace(/__(.*?)__/g, '<u>$1</u>');

            let rawHtml = '';
            try {
                if (window.marked && typeof window.marked.parse === 'function') {
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
            
            return window.DOMPurify.sanitize(rawHtml, { 
                ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'u', 'span', 'blockquote', 'code', 'pre'],
                ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
            });
        }

        function setElText(id, text) { const el = document.getElementById(id); if(el) el.textContent = text || '-'; }
        function setElHtml(id, html) { const el = document.getElementById(id); if(el) el.innerHTML = html || ''; }

        window.showNotification = (msg) => {
            const notif = document.getElementById('notification');
            const msgEl = document.getElementById('notif-message');
            if (notif && msgEl) {
                msgEl.textContent = msg;
                notif.classList.remove('hidden', 'translate-y-20');
                setTimeout(() => notif.classList.add('translate-y-20'), 3000);
                setTimeout(() => notif.classList.add('hidden'), 3300);
            } else {
                alert(msg);
            }
        };

        window.copyPublicProfileLink = async () => {
            if (!currentUser) return;
            
            let currentUrl = window.location.href.split('?')[0]; 
            if (currentUrl.endsWith('/')) {
                currentUrl += 'public_profile.html';
            } else {
                const lastSlash = currentUrl.lastIndexOf('/');
                currentUrl = currentUrl.substring(0, lastSlash + 1) + 'public_profile.html';
            }
            
            const finalUrl = `${currentUrl}?uid=${currentUser.uid}`;
            
            const fallbackCopy = () => {
                const textArea = document.createElement("textarea");
                textArea.value = finalUrl;
                textArea.style.position = "fixed"; 
                textArea.style.left = "-999999px"; 
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    showNotification('自己紹介用リンクをコピーしました！');
                } catch (err) {
                    console.error("Fallback copy failed", err);
                    prompt('コピーに失敗しました。以下のURLを手動でコピーしてください：', finalUrl);
                }
                document.body.removeChild(textArea);
            };

            if (navigator.clipboard && window.isSecureContext) {
                try {
                    await navigator.clipboard.writeText(finalUrl);
                    showNotification('自己紹介用リンクをコピーしました！');
                } catch (err) {
                    console.error("Clipboard API failed", err);
                    fallbackCopy();
                }
            } else {
                fallbackCopy();
            }
        };

        // OSカバーの読み込みと描画
        async function loadAndRenderOSCover(osNumber) {
            if (!osNumber) return;
            
            try {
                const docRef = doc(db, 'artifacts', appId, 'os_blueprints', String(osNumber));
                const docSnap = await getDoc(docRef);
                
                let osData;
                if (docSnap.exists()) {
                    osData = docSnap.data();
                } else if (isAdminMock || osNumber === '50') {
                    osData = { jukkan: "癸", kanji: "玄盤", ruby: "GENBAN" };
                } else {
                    return;
                }
                
                applyOSCover(osData);
            } catch (e) {
                console.error("OS Data load error:", e);
            }
        }

        function applyOSCover(osData) {
            const cover = document.getElementById('profile-cover');
            const bgLayer = document.getElementById('os-cover-bg-layer');
            const content = document.getElementById('os-cover-content');
            const rubyEl = document.getElementById('os-ruby');
            const kanjiEl = document.getElementById('os-kanji');
            
            if (!cover || !bgLayer || !content || !rubyEl || !kanjiEl) return;
            
            const theme = THEME_COLORS[osData.jukkan] || THEME_COLORS['癸'];
            
            cover.classList.remove('cover-gradient');
            cover.style.borderColor = theme.main;
            
            bgLayer.style.backgroundColor = theme.bg;
            bgLayer.style.backgroundImage = `radial-gradient(circle at center, rgba(255,255,255,0.08) 0%, ${theme.bg} 100%)`;
            
            rubyEl.textContent = osData.ruby;
            rubyEl.style.color = theme.sub;
            
            kanjiEl.textContent = osData.kanji;
            kanjiEl.style.color = '#ffffff';
            kanjiEl.style.textShadow = `0 0 15px ${theme.main}`;
            
            content.classList.remove('hidden');
        }

        function resetOSCover() {
            const cover = document.getElementById('profile-cover');
            const bgLayer = document.getElementById('os-cover-bg-layer');
            const content = document.getElementById('os-cover-content');
            
            if (cover) {
                cover.classList.add('cover-gradient');
                cover.style.borderColor = '';
            }
            if (bgLayer) {
                bgLayer.style.backgroundColor = '';
                bgLayer.style.backgroundImage = '';
            }
            if (content) {
                content.classList.add('hidden');
            }
        }

        // ★追加: ページ読み込み時にパラメータがあればタブを切り替える
        document.addEventListener('DOMContentLoaded', () => {
            if (initialTab === 'media') {
                setTimeout(() => {
                    switchMainTab('media');
                }, 50);
            }
        });

        onAuthStateChanged(auth, async (user) => {
            if (isAdminMock) {
                currentUser = { uid: 'test_admin_uid', displayName: '管理者' };
                isAdmin = true;
                myRank = 'covenant';
                if (targetUid && targetUid !== 'test_admin_uid') {
                    isSelf = false;
                    setupViewForOtherUser();
                    checkUserContents(targetUid);
                } else {
                    isSelf = true;
                    targetUid = 'test_admin_uid';
                    const adminData = getAdminMockData();
                    updateDashboardUI(adminData);
                    enableSelfMode(myRank);
                    checkUserContents(targetUid, adminData);
                }
                return;
            }

            if (user && !user.isAnonymous) {
                currentUser = user;
                checkUnreadNotifications(user.uid);
                
                const myProfileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
                const myProfileSnap = await getDoc(myProfileRef);
                if (myProfileSnap.exists()) {
                    const myData = myProfileSnap.data();
                    if (myData.userId === 'admin') isAdmin = true;
                    if (isAdmin) document.getElementById('admin-badge').classList.remove('hidden');
                    myRank = myData.membershipRank || 'arrival'; 
                } else {
                    myRank = 'arrival';
                }

                if (!targetUid || targetUid === user.uid) {
                    isSelf = true;
                    targetUid = user.uid;
                    enableSelfMode(myRank); 
                    if (myProfileSnap.exists()) {
                        const myDataToUse = myProfileSnap.data();
                        updateDashboardUI(myDataToUse);
                        checkUserContents(user.uid, myDataToUse);
                    } else {
                        updateDashboardUI({ userId: user.uid, name: '（未設定）' });
                        checkUserContents(user.uid, null);
                    }
                } else {
                    isSelf = false;
                    await checkFollowStatus(user.uid, targetUid); 
                    await loadPublicProfile(targetUid);
                    
                    await loadPrivateMemo(user.uid, targetUid);
                    const memoBtn = document.getElementById('btn-open-memo');
                    if (memoBtn) {
                        memoBtn.classList.remove('hidden');
                        memoBtn.classList.add('inline-flex');
                    }
                }
                updateFollowCounts(targetUid);
            } else {
                window.location.href = 'login.html';
            }
        });

        // MEDIAタブの表示を制御する
        async function checkUserContents(uid, dataToUse = null) {
            const mediaTabBtn = document.getElementById('tab-main-media');
            
            let hasContent = false;
            
            // 自分であれば「お気に入り」タブを表示
            if (isSelf) {
                hasContent = true; // 自分がアクセスした場合は必ずメディアログタブを見せる
                document.getElementById('tab-media-liked-videos')?.classList.remove('hidden');
                document.getElementById('tab-media-liked-podcasts')?.classList.remove('hidden');
            } else {
                document.getElementById('tab-media-liked-videos')?.classList.add('hidden');
                document.getElementById('tab-media-liked-podcasts')?.classList.add('hidden');
            }

            if (isAdminMock) {
                hasContent = true;
            } else {
                try {
                    const videosRef = collection(db, 'artifacts', appId, 'public', 'data', 'videos');
                    const qV = query(videosRef, where("authorId", "==", uid));
                    const snapV = await getCountFromServer(qV);
                    if (snapV.data().count > 0) hasContent = true;

                    if (!hasContent && !isSelf) {
                        const podRef = collection(db, 'artifacts', appId, 'public', 'data', 'podcasts');
                        const qP = query(podRef, where("authorId", "==", uid));
                        const snapP = await getCountFromServer(qP);
                        if (snapP.data().count > 0) hasContent = true;
                    }
                } catch (e) {
                    console.error("Content check error:", e);
                }
            }

            if (hasContent) {
                if (mediaTabBtn) mediaTabBtn.classList.remove('hidden');
            } else {
                if (mediaTabBtn) mediaTabBtn.classList.add('hidden');
            }
        }

        async function calculateCommonMutuals(myUid, targetUid) {
            if (isAdminMock) {
                commonMutualIds = ['user1', 'user2'];
                document.getElementById('count-common-mutual').textContent = commonMutualIds.length;
                return;
            }

            try {
                const myFollowingSnap = await getDocs(collection(db, 'artifacts', appId, 'users', myUid, 'following'));
                const myFollowersSnap = await getDocs(collection(db, 'artifacts', appId, 'users', myUid, 'followers'));
                
                const myFollowingIds = new Set(myFollowingSnap.docs.map(d => d.id));
                const myMutualIds = myFollowersSnap.docs.map(d => d.id).filter(id => myFollowingIds.has(id));

                if (myMutualIds.length === 0) {
                    commonMutualIds = [];
                    document.getElementById('count-common-mutual').textContent = 0;
                    return;
                }

                const targetFollowingSnap = await getDocs(collection(db, 'artifacts', appId, 'users', targetUid, 'following'));
                const targetFollowersSnap = await getDocs(collection(db, 'artifacts', appId, 'users', targetUid, 'followers'));

                const targetFollowingIds = new Set(targetFollowingSnap.docs.map(d => d.id));
                const targetMutualIds = targetFollowersSnap.docs.map(d => d.id).filter(id => targetFollowingIds.has(id));

                const targetMutualSet = new Set(targetMutualIds);
                commonMutualIds = myMutualIds.filter(id => targetMutualSet.has(id));

                document.getElementById('count-common-mutual').textContent = commonMutualIds.length;

            } catch (e) {
                console.error("Common mutual calc error:", e);
                document.getElementById('count-common-mutual').textContent = '-';
            }
        }

        async function loadPrivateMemo(myUid, targetUid) {
            if (isAdminMock) return;
            try {
                const memoRef = doc(db, 'artifacts', appId, 'users', myUid, 'private_memos', targetUid);
                const memoSnap = await getDoc(memoRef);
                if (memoSnap.exists()) {
                    const data = memoSnap.data();
                    if (data.logs && Array.isArray(data.logs)) {
                        privateMemos = data.logs;
                    } else if (data.content) {
                        privateMemos = [{
                            id: Date.now().toString(),
                            content: data.content,
                            updatedAt: data.updatedAt || new Date().toISOString()
                        }];
                    } else {
                        privateMemos = [];
                    }
                } else {
                    privateMemos = [];
                }
            } catch (e) {
                console.error("Memo load error:", e);
            }
        }

        async function checkUnreadNotifications(uid) {
            try {
                const notifRef = collection(db, 'artifacts', appId, 'users', uid, 'notifications');
                const q = query(notifRef, where('isRead', '==', false));
                const snap = await getCountFromServer(q);
                if (snap.data().count > 0) document.getElementById('nav-badge').classList.remove('hidden');
            } catch (e) { console.error(e); }
        }

        function enableSelfMode(currentRank) {
            const headerActions = document.getElementById('header-actions');
            if(headerActions) {
                headerActions.innerHTML = `
                <div class="flex flex-col items-end gap-1 w-full lg:w-auto">
                    <a href="profile.html" class="inline-flex items-center justify-center px-6 py-2 border border-brand-500 shadow-sm text-sm font-bold rounded-sm text-brand-900 bg-[#fffdf9] hover:bg-brand-50 transition-all active:scale-95 tracking-widest font-serif">
                        航海録を編集
                    </a>
                    <a href="upgrade.html" class="text-[10px] font-bold text-brand-400 hover:text-brand-600 transition-colors mr-1 underline decoration-dotted tracking-widest mt-1">
                        契約の確認・変更
                    </a>
                </div>`;
            }
            
            const pubLinkContainer = document.getElementById('public-link-container');
            if (pubLinkContainer) pubLinkContainer.classList.remove('hidden');

            if (isAdmin) {
                document.getElementById('debug-rank-switcher').classList.remove('hidden');
            }
            
            if (currentRank === 'arrival') {
                document.getElementById('upgrade-cta-container').classList.remove('hidden');
            } else {
                document.getElementById('upgrade-cta-container').classList.add('hidden');
            }
            
            isMutual = true; 
            toggleRestrictedContent(true);
        }

        async function setupViewForOtherUser() {
            const mockTarget = getAdminMockData();
            mockTarget.name = "サンプル太郎";
            mockTarget.userId = "target_user";
            isMutual = confirm("【テスト】相互フォロー状態にしますか？\nOK=相互(全表示), Cancel=片思い/未フォロー");
            isFollowing = true;
            renderFollowButton();
            updateDashboardUI(mockTarget);
            toggleRestrictedContent(isMutual);
            if(isMutual) document.getElementById('mutual-badge').classList.remove('hidden');
            setElText('count-following', '120');
            setElText('count-followers', '45');
            
            const memoBtn = document.getElementById('btn-open-memo');
            if (memoBtn) {
                memoBtn.classList.remove('hidden');
                memoBtn.classList.add('inline-flex');
            }

            document.getElementById('follow-stats-container').classList.remove('grid-cols-2');
            document.getElementById('follow-stats-container').classList.add('grid-cols-3');
            document.getElementById('area-common-mutual').classList.remove('hidden');
            calculateCommonMutuals('me', 'target');
        }

        async function loadPublicProfile(uid) {
            try {
                let dataToUse = null;
                const publicRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', uid);
                const publicSnap = await getDoc(publicRef);

                if (publicSnap.exists()) {
                    dataToUse = publicSnap.data();
                }

                if (dataToUse && dataToUse.membershipRank && dataToUse.membershipRank !== 'arrival' && !isSelf) {
                    const container = document.getElementById('follow-stats-container');
                    const area = document.getElementById('area-common-mutual');
                    if(container && area) {
                        container.classList.remove('grid-cols-2');
                        container.classList.add('grid-cols-3');
                        area.classList.remove('hidden');
                        calculateCommonMutuals(currentUser.uid, uid);
                    }
                }
                
                if (isAdmin || (isMutual && myRank !== 'arrival')) {
                    try {
                        const privateRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'data');
                        const privateSnap = await getDoc(privateRef);
                        if (privateSnap.exists()) {
                            dataToUse = { ...(dataToUse || {}), ...privateSnap.data() };
                        }
                    } catch (e) { console.log("Private load failed", e); }
                }

                if (dataToUse) {
                    updateDashboardUI(dataToUse);
                    checkUserContents(uid, dataToUse);
                } else {
                    document.getElementById('error-container').classList.remove('hidden');
                }
            } catch (e) {
                console.error("Load error:", e);
            }
        }

        async function updateFollowCounts(uid) {
            try {
                const followingColl = collection(db, 'artifacts', appId, 'users', uid, 'following');
                const followersColl = collection(db, 'artifacts', appId, 'users', uid, 'followers');
                const followingSnap = await getCountFromServer(followingColl);
                const followersSnap = await getCountFromServer(followersColl);
                setElText('count-following', followingSnap.data().count);
                setElText('count-followers', followersSnap.data().count);
            } catch (e) {
                setElText('count-following', '-');
                setElText('count-followers', '-');
            }
        }

        async function checkFollowStatus(myUid, targetUid) {
            try {
                const followingRef = doc(db, 'artifacts', appId, 'users', myUid, 'following', targetUid);
                const isFollowingSnap = await getDoc(followingRef);
                isFollowing = isFollowingSnap.exists();

                const followerRef = doc(db, 'artifacts', appId, 'users', myUid, 'followers', targetUid);
                const isFollowedBackSnap = await getDoc(followerRef);
                const isFollowedBack = isFollowedBackSnap.exists();

                isMutual = isFollowing && isFollowedBack;
                renderFollowButton();
                
                const badge = document.getElementById('mutual-badge');
                if (badge) {
                    if (isMutual && !isSelf) badge.classList.remove('hidden');
                    else badge.classList.add('hidden');
                }
            } catch (e) { console.error("Check follow err:", e); }
        }

        function renderFollowButton() {
            const container = document.getElementById('header-actions');
            if(!container) return;
            let btnHtml = '';
            if (isFollowing) {
                btnHtml += `<button onclick="toggleFollow()" class="inline-flex items-center px-4 py-2 border border-brand-500 shadow-sm text-sm font-bold rounded-sm text-brand-900 bg-[#fffdf9] hover:bg-brand-50 transition-all mr-2 tracking-widest font-serif">フォロー中</button>`;
            } else {
                btnHtml += `<button onclick="toggleFollow()" class="inline-flex items-center px-4 py-2 border border-transparent shadow-md text-sm font-bold rounded-sm text-[#f7f5f0] bg-[#3e2723] hover:bg-[#2a1a17] transition-all mr-2 tracking-widest font-serif">フォロー</button>`;
            }
            if (isAdmin && !isSelf) {
                btnHtml += `<a href="profile.html?uid=${targetUid}" class="inline-flex items-center px-3 py-2 border border-brand-300 text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-sm text-sm font-bold transition-all"><i class="fa-solid fa-pen-to-square mr-1"></i>編集</a>`;
                document.getElementById('admin-badge').classList.remove('hidden');
                document.getElementById('debug-rank-switcher').classList.remove('hidden');
            }
            container.innerHTML = btnHtml;
        }

        window.toggleFollow = async () => {
            if (!currentUser || isAdminMock) {
                if(isAdminMock) { isFollowing = !isFollowing; renderFollowButton(); alert('Mock Action'); }
                return;
            }
            const myUid = currentUser.uid;
            const myFollowingRef = doc(db, 'artifacts', appId, 'users', myUid, 'following', targetUid);
            const targetFollowerRef = doc(db, 'artifacts', appId, 'users', targetUid, 'followers', myUid);
            const notificationColl = collection(db, 'artifacts', appId, 'users', targetUid, 'notifications');

            try {
                if (isFollowing) {
                    await deleteDoc(myFollowingRef);
                    await deleteDoc(targetFollowerRef);
                    isFollowing = false;
                } else {
                    const timestamp = serverTimestamp();
                    await setDoc(myFollowingRef, { createdAt: timestamp });
                    await setDoc(targetFollowerRef, { createdAt: timestamp });
                    try {
                        await addDoc(notificationColl, {
                            type: 'follow',
                            fromUid: myUid,
                            createdAt: timestamp,
                            isRead: false
                        });
                    } catch (e) { console.warn("Notify err:", e); }
                    isFollowing = true;
                }
                await checkFollowStatus(myUid, targetUid);
                updateFollowCounts(targetUid);
                loadPublicProfile(targetUid);
            } catch (e) {
                console.error(e);
            }
        };

        window.openFollowModal = async (type) => {
            const modal = document.getElementById('follow-modal');
            const title = document.getElementById('follow-modal-title');
            const list = document.getElementById('follow-list');
            
            modal.classList.remove('hidden');
            
            let displayTitle = '';
            if (type === 'following') displayTitle = 'フォロー中';
            else if (type === 'followers') displayTitle = 'フォロワー';
            else if (type === 'mutual') displayTitle = '共通の航海士';
            
            title.textContent = displayTitle;
            list.innerHTML = '<div class="text-center py-10 text-brand-400 text-xs font-bold tracking-widest"><i class="fa-solid fa-spinner fa-spin mr-2"></i>読み込み中...</div>';

            let users = [];

            if (isAdminMock) {
                users = [
                    { userId: 'user1', name: 'テストユーザーA', photoURL: 'https://via.placeholder.com/150', jobTitle: 'デザイナー', uid: 'mock_uid_1' },
                    { userId: 'user2', name: 'テストユーザーB', photoURL: 'https://via.placeholder.com/150', jobTitle: 'エンジニア', uid: 'mock_uid_2' },
                    { userId: 'user3', name: 'テストユーザーC', photoURL: '', jobTitle: 'マーケター', uid: 'mock_uid_3' }
                ];
            } else if (type === 'mutual') {
                if (commonMutualIds.length === 0) {
                    list.innerHTML = '<div class="text-center py-10 text-brand-400 text-xs font-bold tracking-widest">共通の航海士はいません</div>';
                    return;
                }
                
                try {
                    const userPromises = commonMutualIds.map(async (uid) => {
                        try {
                            const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid));
                            if (userDoc.exists()) {
                                return { uid, ...userDoc.data() };
                            }
                        } catch (e) { console.error(e); }
                        return null;
                    });
                    const results = await Promise.all(userPromises);
                    users = results.filter(u => u !== null);
                } catch (e) { console.error(e); }

            } else {
                try {
                    const colName = type; 
                    const ref = collection(db, 'artifacts', appId, 'users', targetUid, colName);
                    const snap = await getDocs(ref);
                    
                    const userPromises = snap.docs.map(async (d) => {
                        const uid = d.id; 
                        try {
                            const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid));
                            if (userDoc.exists()) {
                                return { uid, ...userDoc.data() };
                            }
                        } catch (e) { console.error(e); }
                        return null;
                    });
                    
                    const results = await Promise.all(userPromises);
                    users = results.filter(u => u !== null);

                } catch (e) {
                    console.error("List load error:", e);
                    list.innerHTML = '<div class="text-center py-10 text-red-500 text-xs font-bold tracking-widest">読み込みに失敗しました</div>';
                    return;
                }
            }

            if (users.length === 0) {
                list.innerHTML = '<div class="text-center py-10 text-brand-400 text-xs font-bold tracking-widest">ユーザーはいません</div>';
            } else {
                list.innerHTML = users.map(u => {
                    const name = u.name || u.userId || '名無し';
                    const job = u.jobTitle || '';
                    const linkUid = u.uid || u.userId; 
                    const displayId = u.userId ? `@${u.userId}` : ''; 

                    const iconHtml = u.photoURL 
                        ? `<img src="${u.photoURL}" class="w-12 h-12 rounded-full border border-brand-200 object-cover bg-white">`
                        : `<div class="w-12 h-12 rounded-full border border-brand-200 bg-brand-50 flex items-center justify-center text-brand-300"><i class="fa-solid fa-anchor text-xl"></i></div>`;

                    return `
                    <a href="user.html?uid=${linkUid}" onclick="closeFollowModal()" class="flex items-center gap-4 p-4 border-b border-brand-100 hover:bg-brand-50 transition-colors group">
                        ${iconHtml}
                        <div class="flex-1 min-w-0">
                            <h4 class="text-sm font-bold text-brand-900 truncate font-serif tracking-wide group-hover:text-brand-600 transition-colors">${name}</h4>
                            <div class="flex items-center gap-2 mt-0.5">
                                <span class="text-[10px] text-brand-500 font-mono font-bold">${displayId}</span>
                                ${job ? `<span class="text-[9px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-sm border border-brand-200 truncate max-w-[120px]">${job}</span>` : ''}
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-right text-brand-300 text-xs group-hover:text-brand-500"></i>
                    </a>
                    `;
                }).join('');
            }
        };

        window.closeFollowModal = () => {
            document.getElementById('follow-modal').classList.add('hidden');
        };

        function toggleRestrictedContent(show) {
            const masks = ['message-mask', 'career-mask', 'personal-mask', 'goals-mask'];
            document.querySelectorAll('.mutual-only').forEach(el => {
                if(show) el.classList.remove('hidden');
                else el.classList.add('hidden');
            });
            if (show) {
                document.getElementById('message-container')?.classList.remove('hidden');
                document.getElementById('message-lock-icon')?.classList.add('hidden');
                document.getElementById('career-container')?.classList.remove('hidden');
                document.getElementById('career-lock-icon')?.classList.add('hidden');
                document.getElementById('goals-container')?.classList.remove('hidden');
                document.getElementById('goals-lock-icon')?.classList.add('hidden');
                masks.forEach(id => document.getElementById(id)?.classList.add('hidden'));
            } else {
                document.getElementById('message-container')?.classList.add('hidden');
                document.getElementById('message-lock-icon')?.classList.remove('hidden');
                document.getElementById('career-container')?.classList.add('hidden');
                document.getElementById('career-lock-icon')?.classList.remove('hidden');
                document.getElementById('goals-container')?.classList.add('hidden');
                document.getElementById('goals-lock-icon')?.classList.remove('hidden');
                masks.forEach(id => document.getElementById(id)?.classList.remove('hidden'));
            }
        }

        function updateDashboardUI(data) {
            document.querySelectorAll('.shimmer').forEach(el => el.classList.remove('shimmer', 'w-32', 'h-8'));

            setElText('profile-name', data.name || data.userId || '（名称未設定）');
            setElText('profile-id', '@' + (data.userId || '-'));
            setElText('profile-job', data.jobTitle || '職業未設定');
            
            let locStr = '-';
            if(data.prefecture && data.birthplace) {
                locStr = `${data.prefecture} (出身: ${data.birthplace})`;
            } else if (data.prefecture) {
                locStr = data.prefecture;
            } else if (data.birthplace) {
                locStr = `出身: ${data.birthplace}`;
            }
            setElText('profile-location', locStr);
            
            setElHtml('profile-bio', formatText(data.bio || ''));
            
            const iconImg = document.getElementById('header-icon-img');
            const iconPh = document.getElementById('header-icon-placeholder');
            if (iconImg && iconPh) {
                if (data.photoURL) {
                    iconImg.src = data.photoURL;
                    iconImg.classList.remove('hidden');
                    iconPh.classList.add('hidden');
                } else {
                    iconImg.classList.add('hidden');
                    iconPh.classList.remove('hidden');
                }
            }

            const rank = data.membershipRank || 'arrival';
            const badgeEl = document.getElementById('rank-badge');
            if (badgeEl) {
                badgeEl.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-widest';
                badgeEl.classList.remove('hidden');
                badgeEl.classList.remove('badge-arrival', 'badge-settler', 'badge-builder', 'badge-guardian', 'badge-covenant');
                
                if (rank === 'covenant') { badgeEl.classList.add('badge-covenant'); badgeEl.innerHTML = '<i class="fa-solid fa-shield-halved mr-1"></i>COVENANT'; } 
                else if (rank === 'guardian') { badgeEl.classList.add('badge-guardian'); badgeEl.innerHTML = '<i class="fa-solid fa-gavel mr-1"></i>GUARDIAN'; } 
                else if (rank === 'builder') { badgeEl.classList.add('badge-builder'); badgeEl.innerHTML = '<i class="fa-solid fa-hammer mr-1"></i>BUILDER'; } 
                else if (rank === 'settler') { badgeEl.classList.add('badge-settler'); badgeEl.innerHTML = '<i class="fa-solid fa-house mr-1"></i>SETTLER'; } 
                else { badgeEl.classList.add('badge-arrival'); badgeEl.innerHTML = '<i class="fa-solid fa-anchor mr-1"></i>ARRIVAL'; }
            }

            const isTargetArrival = rank === 'arrival';
            const isViewerArrival = myRank === 'arrival';
            const isViewerPrivileged = isSelf || isAdmin;
            
            const applyRestriction = (isTargetArrival || isViewerArrival) && !isViewerPrivileged;

            const hideIfRestricted = (id) => {
                const el = document.getElementById(id);
                if (el) {
                    if (applyRestriction) el.classList.add('hidden');
                    else el.classList.remove('hidden');
                }
            };
            
            if (applyRestriction) document.getElementById('profile-bio').parentElement.classList.add('hidden');
            else document.getElementById('profile-bio').parentElement.classList.remove('hidden');

            hideIfRestricted('section-tags');
            hideIfRestricted('section-matching');

            const showRestricted = (isMutual || isViewerPrivileged) && !applyRestriction;
            toggleRestrictedContent(showRestricted);
            
            const score = data.profileScore || 0;
            const isCompleted = score >= 100 || isAdminMock;
            
            // OSカバー（診断結果）の表示処理 (充実度100%を満たしている人のみ)
            if (showRestricted && data.osNumber && isCompleted) {
                loadAndRenderOSCover(data.osNumber);
            } else {
                resetOSCover();
            }

            if (applyRestriction) {
                let maskMsg = '';
                if (isViewerArrival) {
                    maskMsg = '<span class="text-brand-700 font-bold cursor-pointer underline hover:text-brand-900 transition-colors" onclick="location.href=\'upgrade.html\'">SETTLER 以上に契約変更</span> して詳細を表示';
                } else {
                    maskMsg = 'このユーザーの役割（ARRIVAL）により、情報は制限されています';
                }
                document.querySelector('#message-mask p').innerHTML = maskMsg;
                document.querySelector('#career-mask p').innerHTML = maskMsg;
                document.querySelector('#goals-mask p').innerHTML = maskMsg;
                document.querySelector('#personal-mask p').innerHTML = '<i class="fa-solid fa-lock mr-2"></i>' + maskMsg;

                if (!isViewerPrivileged) {
                    document.getElementById('section-message').classList.remove('hidden');
                    document.getElementById('section-goals').classList.remove('hidden');
                    document.getElementById('message-mask').classList.remove('hidden');
                    document.getElementById('career-mask').classList.remove('hidden');
                    document.getElementById('goals-mask').classList.remove('hidden');
                    document.getElementById('personal-mask').classList.remove('hidden');
                }
            } else if (!isMutual && !isViewerPrivileged) {
                const normalMsg = '相互フォローで詳細を表示';
                document.querySelector('#message-mask p').textContent = normalMsg;
                document.querySelector('#career-mask p').textContent = normalMsg;
                document.querySelector('#goals-mask p').textContent = normalMsg;
                document.querySelector('#personal-mask p').textContent = normalMsg;
            }

            if (!applyRestriction) {
                // Skills & Hobbies
                const skillsContainer = document.getElementById('skills-container');
                if (skillsContainer) {
                    skillsContainer.innerHTML = '';
                    const skillsArray = Array.isArray(data.skills) ? data.skills : (data.skills ? [data.skills] : []);
                    if (skillsArray.length > 0) {
                        skillsArray.forEach(tag => {
                            skillsContainer.innerHTML += `<span class="bg-[#f7f5f0] border border-brand-200 text-brand-600 px-3 py-1 rounded-sm text-xs font-bold tracking-widest shadow-sm">#${tag}</span>`;
                        });
                    } else {
                        skillsContainer.innerHTML = '<span class="text-sm text-brand-300 italic">未設定</span>';
                    }
                }
                
                const hobbiesContainer = document.getElementById('hobbies-container');
                if (hobbiesContainer) {
                    hobbiesContainer.innerHTML = '';
                    const hobbiesArray = Array.isArray(data.hobbies) ? data.hobbies : (data.hobbies ? [data.hobbies] : []);
                    if (hobbiesArray.length > 0) {
                        hobbiesArray.forEach(tag => {
                            hobbiesContainer.innerHTML += `<span class="bg-[#f7f5f0] border border-brand-200 text-brand-600 px-3 py-1 rounded-sm text-xs font-bold tracking-widest shadow-sm">#${tag}</span>`;
                        });
                    } else {
                        hobbiesContainer.innerHTML = '<span class="text-sm text-brand-300 italic">未設定</span>';
                    }
                }

                // Matching
                const canOfferList = document.getElementById('list-can-offer');
                if (canOfferList) {
                    const canOfferArray = Array.isArray(data.canOffer) ? data.canOffer : (data.canOffer ? [data.canOffer] : []);
                    canOfferList.innerHTML = canOfferArray.length > 0 
                        ? canOfferArray.map(item => `<li class="flex items-start text-sm text-brand-700"><i class="fa-solid fa-check text-[#8b6a4f] mr-2 mt-1"></i><span>${item}</span></li>`).join('') 
                        : '<li class="text-brand-300 italic text-sm">未設定</li>';
                }
                const lookingForList = document.getElementById('list-looking-for');
                if (lookingForList) {
                    const lookingForArray = Array.isArray(data.lookingFor) ? data.lookingFor : (data.lookingFor ? [data.lookingFor] : []);
                    lookingForList.innerHTML = lookingForArray.length > 0 
                        ? lookingForArray.map(item => `<li class="flex items-start text-sm text-brand-700"><i class="fa-solid fa-magnifying-glass text-[#8b6a4f] mr-2 mt-1"></i><span>${item}</span></li>`).join('') 
                        : '<li class="text-brand-300 italic text-sm">未設定</li>';
                }

                const goalsEl = document.getElementById('profile-goals');
                if (goalsEl) {
                    if (data.goals) {
                        setElHtml('profile-goals', formatText(data.goals));
                    } else {
                        setElText('profile-goals', '未設定');
                    }
                }
            }

            if (showRestricted) {
                setElText('data-gender', data.gender);
                
                let birthDisplay = '-';
                if (data.birthDate) {
                    if (isAdmin || isSelf || data.birthVisibility === 'full') {
                        birthDisplay = data.birthDate;
                    } else if (data.birthVisibility === 'monthDay') {
                        birthDisplay = data.birthDate.substring(5);
                    } else {
                        birthDisplay = '非公開';
                    }
                }
                setElText('data-birth', birthDisplay);

                const careerContainer = document.getElementById('career-container');
                if (careerContainer) {
                    careerContainer.innerHTML = '';
                    const careerArray = Array.isArray(data.career) ? data.career : [];
                    if (careerArray.length > 0) {
                        careerArray.forEach(c => {
                            const formattedDesc = formatText(c.description || '');
                            careerContainer.innerHTML += `
                                <div class="relative pl-6 pb-2">
                                    <div class="absolute left-[-5px] top-1.5 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-[#fffdf9] z-10 shadow-sm border border-brand-300"></div>
                                    <h4 class="font-bold text-brand-900 text-base font-serif tracking-widest">${c.company || '会社名不明'}</h4>
                                    <div class="flex items-center gap-2 mb-3 mt-1">
                                        <span class="text-[10px] font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-sm tracking-widest border border-brand-200">${c.role || '役割'}</span>
                                        <span class="text-xs text-brand-400 font-medium tracking-widest">${c.start || '?'} 〜 ${c.end || '現在'}</span>
                                    </div>
                                    <div class="prose prose-sm max-w-none prose-stone text-brand-700 bg-brand-50 p-4 rounded-sm border border-brand-100 shadow-sm">${formattedDesc}</div>
                                </div>
                            `;
                        });
                    } else {
                        careerContainer.innerHTML = '<div class="text-brand-300 text-sm italic pl-6">経歴情報はありません</div>';
                    }
                }
                
                const snsContainer = document.getElementById('profile-sns-links');
                if (snsContainer) {
                    snsContainer.innerHTML = '';
                    if (data.websiteUrl) snsContainer.innerHTML += `<a href="${data.websiteUrl}" target="_blank" class="w-8 h-8 rounded-full border border-brand-200 bg-brand-50 flex items-center justify-center text-brand-500 hover:bg-brand-100 hover:text-brand-800 transition-colors shadow-sm"><i class="fa-solid fa-globe"></i></a>`;
                    if (data.snsInstagram) snsContainer.innerHTML += `<a href="${data.snsInstagram.startsWith('http') ? data.snsInstagram : 'https://instagram.com/'+data.snsInstagram}" target="_blank" class="w-8 h-8 rounded-full border border-brand-200 bg-brand-50 flex items-center justify-center text-brand-500 hover:bg-brand-100 hover:text-brand-800 transition-colors shadow-sm"><i class="fa-brands fa-instagram"></i></a>`;
                    if (data.snsX) snsContainer.innerHTML += `<a href="${data.snsX.startsWith('http') ? data.snsX : 'https://twitter.com/'+data.snsX}" target="_blank" class="w-8 h-8 rounded-full border border-brand-200 bg-brand-50 flex items-center justify-center text-brand-500 hover:bg-brand-100 hover:text-brand-800 transition-colors shadow-sm"><i class="fa-brands fa-x-twitter"></i></a>`;
                }

                const messageEl = document.getElementById('profile-message');
                if (messageEl) {
                    if (data.message) {
                        setElHtml('profile-message', formatText(data.message));
                        messageEl.classList.remove('text-brand-300');
                    } else {
                        setElText('profile-message', 'まだメッセージがありません。');
                        messageEl.classList.add('text-brand-300');
                    }
                }
            }

            // 自分専用の画面での処理（充実度バー＆診断ボタン制御）
            if (isSelf) {
                const compBar = document.getElementById('completion-bar-container');
                const diagBtn = document.getElementById('diagnostic-btn-container');

                if (isCompleted) {
                    if (compBar) compBar.classList.add('hidden');
                    if (diagBtn) {
                        diagBtn.classList.remove('hidden');
                        const linkEl = diagBtn.querySelector('a');
                        if (linkEl && data.osNumber) {
                            linkEl.href = `diagnostic.html?osId=${data.osNumber}`;
                        } else if (linkEl) {
                            linkEl.href = `diagnostic.html`; 
                        }
                    }
                } else {
                    if (compBar) {
                        compBar.classList.remove('hidden');
                        setElText('score-text', score + '%');
                        const scoreBar = document.getElementById('score-bar');
                        if(scoreBar) scoreBar.style.width = score + '%';
                    }
                    if (diagBtn) {
                        diagBtn.classList.add('hidden');
                    }
                }
            }
        }

        // メインタブ切り替えロジック
        window.switchMainTab = (tab) => {
            const btnProfile = document.getElementById('tab-main-profile');
            const btnMedia = document.getElementById('tab-main-media');
            const areaProfile = document.getElementById('area-main-profile');
            const areaMedia = document.getElementById('area-main-media');

            if (tab === 'profile') {
                btnProfile.classList.add('border-[#b8860b]', 'text-[#b8860b]');
                btnProfile.classList.remove('border-transparent', 'text-brand-400');
                btnMedia.classList.remove('border-[#b8860b]', 'text-[#b8860b]');
                btnMedia.classList.add('border-transparent', 'text-brand-400');
                
                areaProfile.classList.remove('hidden');
                areaMedia.classList.add('hidden');
            } else {
                btnMedia.classList.add('border-[#b8860b]', 'text-[#b8860b]');
                btnMedia.classList.remove('border-transparent', 'text-brand-400');
                btnProfile.classList.remove('border-[#b8860b]', 'text-[#b8860b]');
                btnProfile.classList.add('border-transparent', 'text-brand-400');
                
                areaProfile.classList.add('hidden');
                areaMedia.classList.remove('hidden');

                if (!isMyContentsLoaded && !isAdminMock) {
                    loadMyContents();
                } else if (isAdminMock) {
                    renderMediaCurrentTab();
                }
            }
        };

        // MEDIA LOG サブタブ切り替えロジック
        window.switchMediaTab = async (tab) => {
            currentMediaTab = tab;
            
            document.querySelectorAll('.media-tab-btn').forEach(btn => {
                btn.classList.remove('active', 'bg-[#b8860b]', 'text-[#fffdf9]', 'shadow-md', 'border-[#b8860b]');
                btn.classList.add('bg-[#fffdf9]', 'text-brand-500', 'hover:bg-brand-50', 'border-brand-200');
            });
            const activeBtn = document.getElementById(`tab-media-${tab}`);
            if(activeBtn) {
                activeBtn.classList.remove('bg-[#fffdf9]', 'text-brand-500', 'hover:bg-brand-50', 'border-brand-200');
                activeBtn.classList.add('active', 'bg-[#b8860b]', 'text-[#fffdf9]', 'shadow-md', 'border-[#b8860b]');
            }

            const grid = document.getElementById('media-content-grid');
            grid.classList.remove('hidden');
            
            if (tab === 'liked-videos' && !isLikedVideosLoaded && !isAdminMock) {
                await loadLikedVideos();
            } else if (tab === 'liked-podcasts' && !isLikedPodcastsLoaded && !isAdminMock) {
                await loadLikedPodcasts();
            } else {
                renderMediaCurrentTab();
            }
        };

        // メディアデータの取得処理
        async function loadMyContents() {
            try {
                const videosRef = collection(db, 'artifacts', appId, 'public', 'data', 'videos');
                const qV = query(videosRef, where("authorId", "==", targetUid));
                const snapV = await getDocs(qV);
                myVideos = [];
                snapV.forEach(doc => myVideos.push({ id: doc.id, ...doc.data() }));
                myVideos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                const podRef = collection(db, 'artifacts', appId, 'public', 'data', 'podcasts');
                const qP = query(podRef, where("authorId", "==", targetUid));
                const snapP = await getDocs(qP);
                myPodcasts = [];
                snapP.forEach(doc => myPodcasts.push({ id: doc.id, ...doc.data() }));
                myPodcasts.sort((a, b) => new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt));

                // プレイリストの取得
                const plRef = collection(db, 'artifacts', appId, 'users', targetUid, 'playlists');
                const snapPL = await getDocs(plRef);
                myPlaylists = [];
                snapPL.forEach(doc => myPlaylists.push({ id: doc.id, ...doc.data() }));
                myPlaylists.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

                isMyContentsLoaded = true;
                renderMediaCurrentTab();
            } catch (error) {
                console.error("Error fetching contents:", error);
                document.getElementById('media-content-grid').innerHTML = '<div class="col-span-full text-center text-red-500 py-10">コンテンツの取得に失敗しました</div>';
            }
        }

        async function loadLikedVideos() {
            if (isLikedVideosLoaded || isAdminMock) return;
            const grid = document.getElementById('media-content-grid');
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
                renderMediaCurrentTab();
            } catch (e) {
                console.error(e);
                grid.innerHTML = '<div class="col-span-full text-center text-red-500 py-10">お気に入りの取得に失敗しました</div>';
            }
        }

        async function loadLikedPodcasts() {
            if (isLikedPodcastsLoaded || isAdminMock) return;
            const grid = document.getElementById('media-content-grid');
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
                renderMediaCurrentTab();
            } catch (e) {
                console.error(e);
                grid.innerHTML = '<div class="col-span-full text-center text-red-500 py-10">お気に入りの取得に失敗しました</div>';
            }
        }

        // プレイリスト作成権限（GUARDIAN以上かつ自分のページの場合のみ）
        function hasPlaylistPermission() {
            return isSelf && (myRank === 'guardian' || myRank === 'covenant' || isAdmin || isAdminMock);
        }

        function renderMediaCurrentTab() {
            const grid = document.getElementById('media-content-grid');
            
            if (currentMediaTab === 'videos') {
                renderVideos(myVideos, grid, "投稿された動画はありません。");
            } else if (currentMediaTab === 'podcasts') {
                renderPodcasts(myPodcasts, grid, "投稿された音声はありません。");
            } else if (currentMediaTab === 'liked-videos') {
                renderVideos(likedVideos, grid, "お気に入りした動画はありません。");
            } else if (currentMediaTab === 'liked-podcasts') {
                renderPodcasts(likedPodcasts, grid, "お気に入りした音声はありません。");
            } else if (currentMediaTab === 'playlists') {
                renderPlaylists();
            }
        }

        // プレイリスト一覧の描画 (YouTube風リスト形式に変更)
        function renderPlaylists() {
            const grid = document.getElementById('media-content-grid');
            grid.innerHTML = '';

            // ヘッダー部分（作成ボタン）
            if (hasPlaylistPermission()) {
                const headerHtml = `
                    <div class="col-span-full flex justify-between items-center mb-2">
                        <p class="text-sm font-bold text-brand-700 tracking-widest"><i class="fa-solid fa-folder-open text-[#b8860b] mr-2"></i>プレイリスト</p>
                        <button onclick="openPlaylistModal()" class="bg-[#3e2723] hover:bg-[#2a1a17] text-[#d4af37] px-4 py-2 rounded-sm text-xs font-bold shadow-md transition-colors tracking-widest border border-[#b8860b] flex items-center gap-1">
                            <i class="fa-solid fa-folder-plus"></i> 新規作成
                        </button>
                    </div>
                `;
                grid.innerHTML += headerHtml;
            } else if (myPlaylists.length === 0) {
                grid.innerHTML = '<div class="col-span-full text-center py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200"><i class="fa-solid fa-folder-open text-4xl mb-3 text-brand-200"></i><p class="font-bold tracking-widest text-brand-400">プレイリストはまだありません。</p></div>';
                return;
            }

            if (myPlaylists.length === 0 && hasPlaylistPermission()) {
                grid.innerHTML += '<div class="col-span-full text-center py-10 text-brand-400 text-xs font-bold tracking-widest border border-dashed border-brand-200 bg-[#f7f5f0] mt-4">上の「新規作成」ボタンからプレイリストを作成できます。</div>';
                return;
            }

            let listHtml = '<div class="col-span-full flex flex-col gap-4">';
            myPlaylists.forEach(playlist => {
                const coverImage = playlist.coverImageUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=640&auto=format&fit=crop';
                const itemCount = playlist.items?.length || 0;
                const updatedDate = new Date(playlist.updatedAt || playlist.createdAt).toLocaleDateString();
                const sampleText = itemCount > 0 ? (playlist.items[0].title + (itemCount > 1 ? ' など' : '')) : 'コンテンツなし';

                listHtml += `
                    <div class="flex items-start gap-3 sm:gap-4 group cursor-pointer hover:bg-[#fffdf9] hover:shadow-sm p-2 -mx-2 rounded-sm border border-transparent hover:border-brand-200 transition-all" onclick="openPlaylistDetail('${playlist.id}')">
                        
                        <!-- サムネイル側 -->
                        <div class="relative w-32 sm:w-44 aspect-video bg-brand-100 rounded-sm overflow-hidden border border-brand-200 shrink-0 shadow-sm group-hover:shadow transition-shadow">
                            <img src="${coverImage}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror="this.src='https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=640&auto=format&fit=crop'">
                            
                            <!-- 透過レイヤーで件数表示 (YouTubeの再生リスト風) -->
                            <div class="absolute top-0 right-0 bottom-0 w-[40%] bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-white transition-colors group-hover:bg-black/70">
                                <i class="fa-solid fa-list text-sm sm:text-base mb-0.5"></i>
                                <span class="text-[10px] font-mono font-bold tracking-widest">${itemCount}</span>
                            </div>

                            <div class="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center border border-white/50 transform scale-90 group-hover:scale-100 transition-transform">
                                    <i class="fa-solid fa-play text-white ml-0.5 text-xs sm:text-sm"></i>
                                </div>
                            </div>
                        </div>
                        
                        <!-- テキスト側 -->
                        <div class="flex-1 min-w-0 py-0.5 sm:py-1 flex flex-col justify-center">
                            <h3 class="font-bold text-brand-900 text-sm sm:text-base leading-snug line-clamp-2 font-serif group-hover:text-[#b8860b] transition-colors">${playlist.name}</h3>
                            <p class="text-[10px] sm:text-xs text-brand-500 tracking-widest mt-1 sm:mt-1.5 flex items-center gap-1">
                                <i class="fa-regular fa-clock"></i> 更新: ${updatedDate}
                            </p>
                            <p class="text-[10px] text-brand-400 mt-0.5 sm:mt-1 line-clamp-1">${sampleText}</p>
                        </div>
                    </div>
                `;
            });
            listHtml += '</div>';
            grid.innerHTML += listHtml;
        }

        // プレイリスト詳細 Drawer 制御
        window.openPlaylistDetail = (id) => {
            const pl = myPlaylists.find(p => p.id === id);
            if (!pl) return;

            document.getElementById('playlist-detail-title').textContent = pl.name;
            document.getElementById('playlist-detail-count').textContent = `${pl.items?.length || 0} ITEMS`;
            document.getElementById('playlist-detail-date').textContent = `更新: ${new Date(pl.updatedAt || pl.createdAt).toLocaleDateString()}`;
            
            const coverEl = document.getElementById('playlist-detail-cover');
            if (coverEl) {
                coverEl.src = pl.coverImageUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=640&auto=format&fit=crop';
                coverEl.onerror = () => { coverEl.src = 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=640&auto=format&fit=crop'; };
            }

            const actionsEl = document.getElementById('playlist-detail-actions');
            if (hasPlaylistPermission()) {
                actionsEl.innerHTML = `
                    <button onclick="openPlaylistModal('${pl.id}')" class="w-8 h-8 flex items-center justify-center rounded-sm bg-brand-50 text-brand-600 border border-brand-200 hover:bg-brand-100 hover:text-brand-900 transition-colors shadow-sm" title="編集">
                        <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button onclick="deletePlaylist('${pl.id}')" class="w-8 h-8 flex items-center justify-center rounded-sm bg-brand-50 text-brand-600 border border-brand-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm" title="削除">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                `;
            } else {
                actionsEl.innerHTML = '';
            }

            const itemsEl = document.getElementById('playlist-detail-items');
            if (pl.items && pl.items.length > 0) {
                itemsEl.innerHTML = pl.items.map((item, idx) => {
                    const icon = item.type === 'video' ? '<i class="fa-solid fa-film text-brand-400 text-lg"></i>' : '<i class="fa-solid fa-podcast text-[#b8860b]/80 text-lg"></i>';
                    const linkUrl = item.type === 'video' ? `video_detail.html?vid=${item.id}` : `podcast_detail.html?pid=${item.id}`;
                    return `
                        <a href="${linkUrl}" class="flex items-center gap-3 p-3 rounded-sm border border-brand-100 bg-white hover:border-[#b8860b]/50 hover:shadow-sm transition-all group">
                            <span class="text-brand-300 font-mono text-xs w-4 text-center shrink-0 group-hover:text-brand-500">${idx + 1}</span>
                            <div class="w-10 h-10 rounded-sm bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0 group-hover:bg-brand-100 transition-colors">
                                ${icon}
                            </div>
                            <div class="flex-1 min-w-0">
                                <h4 class="text-sm font-bold text-brand-800 truncate group-hover:text-[#b8860b] transition-colors">${item.title}</h4>
                                <p class="text-[10px] text-brand-400 mt-0.5 tracking-widest">${item.type === 'video' ? 'VIDEO' : 'PODCAST'}</p>
                            </div>
                            <i class="fa-solid fa-chevron-right text-brand-200 text-xs group-hover:text-[#b8860b] transition-colors"></i>
                        </a>
                    `;
                }).join('');
            } else {
                itemsEl.innerHTML = '<div class="text-center py-10 text-brand-300 text-xs italic">コンテンツがありません</div>';
            }

            const overlay = document.getElementById('playlist-detail-overlay');
            const drawer = document.getElementById('playlist-detail-drawer');
            
            overlay.classList.remove('hidden');
            setTimeout(() => {
                overlay.classList.remove('opacity-0');
                overlay.classList.add('opacity-100');
                drawer.classList.remove('translate-x-full');
            }, 10);
            
            document.body.style.overflow = 'hidden';
        };

        window.closePlaylistDetail = () => {
            const overlay = document.getElementById('playlist-detail-overlay');
            const drawer = document.getElementById('playlist-detail-drawer');
            
            overlay.classList.remove('opacity-100');
            overlay.classList.add('opacity-0');
            drawer.classList.add('translate-x-full');
            
            setTimeout(() => {
                overlay.classList.add('hidden');
                document.body.style.overflow = '';
            }, 300);
        };

        // プレイリストモーダル関連の処理
        window.openPlaylistModal = (playlistId = null) => {
            editingPlaylistId = playlistId;
            const modal = document.getElementById('playlist-modal');
            const title = document.getElementById('playlist-modal-title');
            const nameInput = document.getElementById('playlist-name-input');
            const coverInput = document.getElementById('playlist-cover-input');
            
            if (playlistId) {
                const pl = myPlaylists.find(p => p.id === playlistId);
                title.innerHTML = '<i class="fa-solid fa-folder-open text-[#b8860b] mr-2"></i>プレイリスト編集';
                nameInput.value = pl.name || '';
                if(coverInput) coverInput.value = pl.coverImageUrl || '';
                currentPlaylistItems = [...(pl.items || [])];
            } else {
                title.innerHTML = '<i class="fa-solid fa-folder-plus text-[#b8860b] mr-2"></i>プレイリスト作成';
                nameInput.value = '';
                if(coverInput) coverInput.value = '';
                currentPlaylistItems = [];
            }
            
            playlistFilterType = 'video';
            updatePlaylistFilterUI();
            renderPlaylistEditor();
            
            modal.classList.remove('hidden');
        };

        window.closePlaylistModal = () => {
            document.getElementById('playlist-modal').classList.add('hidden');
        };

        window.filterPlaylistAvailable = (type) => {
            playlistFilterType = type;
            updatePlaylistFilterUI();
            renderPlaylistEditor();
        };

        function updatePlaylistFilterUI() {
            const btnV = document.getElementById('pl-filter-video');
            const btnP = document.getElementById('pl-filter-podcast');
            if (playlistFilterType === 'video') {
                btnV.className = 'flex-1 text-[10px] py-1 border border-[#b8860b] bg-[#b8860b] text-white font-bold rounded-sm tracking-widest transition-colors';
                btnP.className = 'flex-1 text-[10px] py-1 border border-brand-300 bg-white text-brand-500 font-bold rounded-sm tracking-widest hover:bg-brand-50 transition-colors';
            } else {
                btnP.className = 'flex-1 text-[10px] py-1 border border-[#b8860b] bg-[#b8860b] text-white font-bold rounded-sm tracking-widest transition-colors';
                btnV.className = 'flex-1 text-[10px] py-1 border border-brand-300 bg-white text-brand-500 font-bold rounded-sm tracking-widest hover:bg-brand-50 transition-colors';
            }
        }

        window.renderPlaylistEditor = () => {
            const availList = document.getElementById('available-items-list');
            const selList = document.getElementById('selected-items-list');
            
            // 左側: 利用可能なコンテンツ
            let availItems = playlistFilterType === 'video' ? myVideos : myPodcasts;
            availList.innerHTML = '';
            
            if (availItems.length === 0) {
                availList.innerHTML = '<div class="text-center py-10 text-brand-300 text-xs font-bold tracking-widest italic">コンテンツがありません</div>';
            } else {
                availItems.forEach(item => {
                    const isAdded = currentPlaylistItems.some(i => i.id === item.id && i.type === playlistFilterType);
                    const titleEscaped = (item.title || 'タイトルなし').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    
                    availList.innerHTML += `
                        <div class="bg-white border ${isAdded ? 'border-brand-100 opacity-60' : 'border-brand-200'} rounded-sm p-2 flex justify-between items-center gap-2 transition-all">
                            <div class="flex-1 min-w-0 flex items-center gap-2">
                                <div class="w-8 h-8 rounded-sm bg-brand-50 border border-brand-100 flex-shrink-0 flex items-center justify-center text-brand-300">
                                    <i class="fa-solid ${playlistFilterType === 'video' ? 'fa-film' : 'fa-podcast'}"></i>
                                </div>
                                <p class="text-[11px] font-bold text-brand-800 truncate">${titleEscaped}</p>
                            </div>
                            <button class="shrink-0 px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-widest transition-colors flex items-center gap-1 ${isAdded ? 'bg-brand-100 text-brand-400 cursor-not-allowed' : 'bg-brand-50 border border-brand-300 text-brand-600 hover:bg-[#b8860b] hover:border-[#b8860b] hover:text-white'}"
                                    ${isAdded ? 'disabled' : `onclick="addPlaylistEditorItem('${item.id}', '${titleEscaped}', '${playlistFilterType}')"`}>
                                ${isAdded ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-plus"></i> 追加'}
                            </button>
                        </div>
                    `;
                });
            }

            // 右側: 選択されたコンテンツ
            selList.innerHTML = '';
            if (currentPlaylistItems.length === 0) {
                selList.innerHTML = '<div class="text-center py-20 text-brand-300 text-xs font-bold tracking-widest flex flex-col items-center"><i class="fa-solid fa-folder-open text-3xl mb-2 text-brand-200"></i>左から追加してください</div>';
            } else {
                currentPlaylistItems.forEach((item, index) => {
                    const iconCls = item.type === 'video' ? 'fa-film text-brand-400' : 'fa-podcast text-[#b8860b]';
                    
                    selList.innerHTML += `
                        <div class="bg-white border border-brand-200 shadow-sm rounded-sm p-2 flex justify-between items-center group transition-colors hover:border-[#b8860b]/50">
                            <div class="flex items-center gap-2 min-w-0 flex-1">
                                <span class="text-xs font-mono font-bold text-brand-300 w-4 shrink-0 text-center">${index + 1}</span>
                                <div class="w-6 h-6 rounded-sm bg-brand-50 border border-brand-100 flex-shrink-0 flex items-center justify-center">
                                    <i class="fa-solid ${iconCls} text-[10px]"></i>
                                </div>
                                <p class="text-[11px] font-bold text-brand-800 truncate">${item.title}</p>
                            </div>
                            <div class="flex items-center gap-1 shrink-0 ml-2">
                                <div class="flex flex-col gap-[2px]">
                                    <button onclick="movePlaylistEditorItem(${index}, -1)" class="w-5 h-4 bg-brand-50 hover:bg-[#b8860b] hover:text-white text-brand-400 rounded-[2px] flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-brand-50 disabled:hover:text-brand-400" ${index === 0 ? 'disabled' : ''}>
                                        <i class="fa-solid fa-caret-up text-[10px]"></i>
                                    </button>
                                    <button onclick="movePlaylistEditorItem(${index}, 1)" class="w-5 h-4 bg-brand-50 hover:bg-[#b8860b] hover:text-white text-brand-400 rounded-[2px] flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:bg-brand-50 disabled:hover:text-brand-400" ${index === currentPlaylistItems.length - 1 ? 'disabled' : ''}>
                                        <i class="fa-solid fa-caret-down text-[10px]"></i>
                                    </button>
                                </div>
                                <button onclick="removePlaylistEditorItem(${index})" class="w-7 h-[34px] bg-red-50 hover:bg-red-500 hover:text-white text-red-400 border border-red-100 rounded-[2px] flex items-center justify-center transition-colors ml-1">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        </div>
                    `;
                });
            }
        };

        window.addPlaylistEditorItem = (id, title, type) => {
            currentPlaylistItems.push({ id, title, type });
            renderPlaylistEditor();
        };

        window.removePlaylistEditorItem = (index) => {
            currentPlaylistItems.splice(index, 1);
            renderPlaylistEditor();
        };

        window.movePlaylistEditorItem = (index, direction) => {
            if (index + direction < 0 || index + direction >= currentPlaylistItems.length) return;
            const temp = currentPlaylistItems[index];
            currentPlaylistItems[index] = currentPlaylistItems[index + direction];
            currentPlaylistItems[index + direction] = temp;
            renderPlaylistEditor();
        };

        window.savePlaylist = async () => {
            const nameInput = document.getElementById('playlist-name-input');
            const coverInput = document.getElementById('playlist-cover-input');
            const name = nameInput.value.trim();
            const coverImageUrl = coverInput ? coverInput.value.trim() : '';

            if (!name) {
                nameInput.classList.add('border-red-500', 'bg-red-50');
                setTimeout(() => nameInput.classList.remove('border-red-500', 'bg-red-50'), 1500);
                return;
            }

            if (isAdminMock) {
                alert("モック環境では保存をスキップします");
                closePlaylistModal();
                return;
            }

            try {
                const payload = {
                    name,
                    coverImageUrl,
                    items: currentPlaylistItems,
                    updatedAt: Date.now()
                };

                if (editingPlaylistId) {
                    await updateDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'playlists', editingPlaylistId), payload);
                } else {
                    payload.createdAt = Date.now();
                    await addDoc(collection(db, 'artifacts', appId, 'users', currentUser.uid, 'playlists'), payload);
                }
                closePlaylistModal();
                showNotification('プレイリストを保存しました');
                await loadMyContents(); // 再読み込み
            } catch (e) {
                console.error(e);
                alert('保存に失敗しました');
            }
        };

        window.deletePlaylist = async (id) => {
            if (!confirm('このプレイリストを削除しますか？\n（コンテンツ自体は削除されません）')) return;
            
            if (isAdminMock) {
                alert("モック環境では削除をスキップします");
                return;
            }

            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'playlists', id));
                showNotification('プレイリストを削除しました');
                closePlaylistDetail();
                await loadMyContents();
            } catch (e) {
                console.error(e);
                alert('削除に失敗しました');
            }
        };

        function renderVideos(videos, container, emptyMsg) {
            if (videos.length === 0) {
                container.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center text-brand-400 py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200"><i class="fa-solid fa-film text-4xl mb-3 text-brand-200"></i><p class="font-bold tracking-widest text-sm">${emptyMsg}</p></div>`;
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
                container.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center text-brand-400 py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200"><i class="fa-solid fa-podcast text-4xl mb-3 text-brand-200"></i><p class="font-bold tracking-widest text-sm">${emptyMsg}</p></div>`;
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

        window.openMemoModal = () => {
            document.getElementById('memo-modal').classList.remove('hidden');
            renderMemoLogs();
        };

        window.closeMemoModal = () => {
            document.getElementById('memo-modal').classList.add('hidden');
        };

        function renderMemoLogs() {
            const container = document.getElementById('memo-log-container');
            if (privateMemos.length === 0) {
                container.innerHTML = '<p class="text-xs text-brand-400 text-center py-6 italic border border-dashed border-brand-200 bg-[#f7f5f0]">まだメモはありません。</p>';
                return;
            }
            
            const sorted = [...privateMemos].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            
            container.innerHTML = sorted.map(memo => {
                const dateObj = new Date(memo.updatedAt);
                const dateStr = `${dateObj.getFullYear()}/${dateObj.getMonth()+1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                
                return `
                <div class="bg-brand-50 border border-brand-200 p-4 rounded-sm relative group shadow-sm transition-all">
                    <div class="flex justify-between items-start mb-2 border-b border-brand-200 pb-2">
                        <span class="text-[10px] text-brand-500 font-bold tracking-widest"><i class="fa-regular fa-clock mr-1"></i>${dateStr}</span>
                        <div class="flex gap-2">
                            <button onclick="editMemoLog('${memo.id}')" class="text-brand-400 hover:text-brand-700 transition-colors px-1"><i class="fa-solid fa-pen text-[10px]"></i></button>
                            <button onclick="deleteMemoLog('${memo.id}')" class="text-brand-400 hover:text-red-600 transition-colors px-1"><i class="fa-solid fa-trash text-[10px]"></i></button>
                        </div>
                    </div>
                    <div id="memo-display-${memo.id}" class="text-xs text-brand-800 whitespace-pre-wrap leading-relaxed">${formatText(memo.content)}</div>
                    
                    <div id="memo-edit-${memo.id}" class="hidden">
                        <textarea id="memo-input-${memo.id}" rows="3" class="w-full border-brand-300 rounded-sm text-xs p-2 bg-white leading-relaxed focus:ring-brand-500 shadow-sm mb-2"></textarea>
                        <div class="flex justify-end gap-2">
                            <button onclick="cancelEditMemo('${memo.id}')" class="text-[10px] text-brand-500 hover:text-brand-800 px-2 py-1 tracking-widest font-bold">キャンセル</button>
                            <button onclick="saveEditMemo('${memo.id}')" class="bg-brand-600 hover:bg-brand-800 text-white px-4 py-1.5 rounded-sm text-[10px] font-bold shadow-sm transition-colors tracking-widest">保存</button>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
            
            sorted.forEach(memo => {
                const inputEl = document.getElementById(`memo-input-${memo.id}`);
                if(inputEl) inputEl.value = memo.content;
            });
        }

        window.addNewMemoLog = async () => {
            const input = document.getElementById('new-memo-content');
            const content = input.value.trim();
            if (!content) return;
            
            const btn = document.getElementById('btn-add-memo');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 追加中...';
            btn.disabled = true;

            const newLog = {
                id: Date.now().toString(),
                content: content,
                updatedAt: new Date().toISOString()
            };
            
            privateMemos.push(newLog);

            try {
                if (!isAdminMock && currentUser && targetUid) {
                    const memoRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'private_memos', targetUid);
                    await setDoc(memoRef, { logs: privateMemos }, { merge: true });
                }
                input.value = '';
                renderMemoLogs();
            } catch (e) {
                console.error(e);
                alert('メモの保存に失敗しました');
                privateMemos.pop(); 
            } finally {
                btn.innerHTML = '<i class="fa-solid fa-plus"></i> 追加する';
                btn.disabled = false;
            }
        };

        window.deleteMemoLog = async (id) => {
            if (!confirm('このメモを削除してもよろしいですか？')) return;
            
            const originalMemos = [...privateMemos];
            privateMemos = privateMemos.filter(m => m.id !== id);
            
            renderMemoLogs();

            try {
                if (!isAdminMock && currentUser && targetUid) {
                    const memoRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'private_memos', targetUid);
                    await setDoc(memoRef, { logs: privateMemos }, { merge: true });
                }
            } catch (e) {
                console.error(e);
                alert('削除に失敗しました');
                privateMemos = originalMemos;
                renderMemoLogs();
            }
        };

        window.editMemoLog = (id) => {
            document.getElementById(`memo-display-${id}`).classList.add('hidden');
            document.getElementById(`memo-edit-${id}`).classList.remove('hidden');
        };

        window.cancelEditMemo = (id) => {
            document.getElementById(`memo-display-${id}`).classList.remove('hidden');
            document.getElementById(`memo-edit-${id}`).classList.add('hidden');
            const originalContent = privateMemos.find(m => m.id === id)?.content || '';
            document.getElementById(`memo-input-${id}`).value = originalContent;
        };

        window.saveEditMemo = async (id) => {
            const input = document.getElementById(`memo-input-${id}`);
            const newContent = input.value.trim();
            if (!newContent) return alert('内容は空にできません');

            const originalMemos = JSON.parse(JSON.stringify(privateMemos));
            const targetMemo = privateMemos.find(m => m.id === id);
            
            if (targetMemo) {
                targetMemo.content = newContent;
                targetMemo.updatedAt = new Date().toISOString();
            }

            try {
                if (!isAdminMock && currentUser && targetUid) {
                    const memoRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'private_memos', targetUid);
                    await setDoc(memoRef, { logs: privateMemos }, { merge: true });
                }
                renderMemoLogs();
            } catch (e) {
                console.error(e);
                alert('編集の保存に失敗しました');
                privateMemos = originalMemos; 
                renderMemoLogs();
            }
        };

        window.changeRank = async (newRole) => {
            if (!currentUser) return;
            const uid = targetUid; 
            try {
                const privateRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'data');
                await updateDoc(privateRef, { membershipRank: newRole });
                
                const publicRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', uid);
                const pubSnap = await getDoc(publicRef);
                if (pubSnap.exists()) {
                    await updateDoc(publicRef, { membershipRank: newRole });
                }
                
                alert(`役割を ${newRole} に変更しました。\n画面をリロードします。`);
                window.location.reload();
            } catch (e) {
                console.error(e);
                alert("変更に失敗しました");
            }
        };

        function getAdminMockData() {
            return {
                userId: 'admin', name: 'NOAH 運営', jobTitle: '航海士', gender: '男性',
                profileScore: 90, hobbies: ['開発', 'デザイン'], skills: ['Firebase', 'HTML/CSS'], email: 'admin@test.com',
                prefecture: '愛知県', message: 'ここでは誰も一人にならない。', bio: 'NOAHの航海を見守る管理者アカウントです。', goals: '誰も取り残さないシステムを作ること。',
                canOffer: ['環境の提供', 'マッチングサポート'], lookingFor: ['共鳴できる仲間'], career: [], membershipRank: 'covenant'
            };
        }

        window.handleLogout = () => {
            if (isAdminMock) {
                localStorage.removeItem('isAdminMock');
                window.location.href = 'login.html';
            } else {
                signOut(auth).then(() => {
                    window.location.href = 'login.html';
                }).catch((error) => {
                    console.error('Logout error', error);
                });
            }
        };