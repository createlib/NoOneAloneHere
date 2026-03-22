import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, setDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('vid');

        if (!videoId) { window.location.href = 'videos.html'; }

        let currentUser = null;
        let myProfile = null;
        let videoData = null;
        let isAdmin = false;
        let isLiked = false;
        let commentsUnsubscribe = null;
        let likesUnsubscribe = null;

        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';

        // スマホ用メニュー開閉
        window.toggleTheaterMenu = () => {
            const menu = document.getElementById('sp-theater-menu');
            const content = document.getElementById('sp-theater-menu-content');
            if (!menu || !content) return;
            if (menu.classList.contains('hidden')) {
                menu.classList.remove('hidden');
                setTimeout(() => content.classList.remove('translate-y-full'), 10);
            } else {
                content.classList.add('translate-y-full');
                setTimeout(() => menu.classList.add('hidden'), 300);
            }
        };

        // ナビゲーションのログイン/ログアウト表示切り替え
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

        onAuthStateChanged(auth, async (user) => {
            if (isAdminMock) {
                currentUser = { uid: 'test_admin_uid' };
                isAdmin = true;
                myProfile = { name: '管理者', photoURL: 'https://via.placeholder.com/40' };
                document.getElementById('my-icon').src = myProfile.photoURL;
                updateNavForAuth(true);
                loadVideoData();
                loadRelated();
                return;
            }

            if (user && !user.isAnonymous) {
                currentUser = user;
                try {
                    const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));
                    if (snap.exists()) {
                        myProfile = snap.data();
                        document.getElementById('my-icon').src = myProfile.photoURL || 'https://via.placeholder.com/40?text=U';
                        if (myProfile.userId === 'admin') isAdmin = true;
                    }
                } catch(e) {}
                updateNavForAuth(true);
            } else {
                updateNavForAuth(false);
                document.getElementById('comment-form-area').innerHTML = '<div class="w-full text-center py-4 bg-brand-50 border border-brand-200 rounded-sm text-sm font-bold text-brand-600 tracking-widest">コメントを投稿するには乗船（ログイン）してください。</div>';
            }
            loadVideoData();
            loadRelated();
        });

        function formatText(text) {
            if (!text) return '';
            let rawHtml = '';
            try {
                if (window.marked) rawHtml = window.marked.parse(text, { breaks: true });
                else rawHtml = text.replace(/\n/g, '<br>');
            } catch (e) { rawHtml = text.replace(/\n/g, '<br>'); }
            return window.DOMPurify.sanitize(rawHtml);
        }

        async function loadVideoData() {
            try {
                const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', videoId));
                if (snap.exists()) {
                    videoData = snap.data();
                    
                    document.getElementById('video-title').textContent = videoData.title || 'タイトルなし';
                    
                    // ★ 投稿者リンクを MEDIA LOG タブへ飛ぶように修正
                    document.getElementById('author-link').href = `user.html?uid=${videoData.authorId}&tab=media`;
                    document.getElementById('author-name').innerHTML = `${videoData.authorName || '名無し'} <i class="fa-solid fa-circle-check text-[10px] sm:text-xs text-[#d4af37]"></i>`;
                    if (videoData.authorIcon) document.getElementById('author-icon').src = videoData.authorIcon;

                    const date = new Date(videoData.createdAt);
                    document.getElementById('video-date').textContent = `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}`;

                    document.getElementById('player-container').innerHTML = `<iframe src="${videoData.embedUrl || videoData.sourceUrl}" class="absolute inset-0 w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

                    document.getElementById('video-desc').innerHTML = formatText(videoData.description);
                    
                    const tagsEl = document.getElementById('video-tags');
                    tagsEl.innerHTML = '';
                    if (videoData.tags) {
                        videoData.tags.forEach(tag => {
                            tagsEl.innerHTML += `<span class="bg-brand-50 border border-brand-200 text-brand-600 px-3 py-1 rounded-sm text-xs font-bold tracking-widest shadow-sm">#${tag}</span>`;
                        });
                    }

                    if (videoData.allowComments === false) {
                        document.getElementById('comments-section').innerHTML = '<div class="text-center py-6 text-brand-400 text-sm tracking-widest"><i class="fa-solid fa-comment-slash mr-2"></i>コメントはオフになっています</div>';
                    } else {
                        listenComments();
                    }
                    
                    listenLikes();

                    if ((currentUser && currentUser.uid === videoData.authorId) || isAdmin) {
                        document.getElementById('admin-actions').classList.remove('hidden');
                        document.getElementById('admin-actions').classList.add('flex');
                    }

                } else {
                    document.querySelector('main').innerHTML = '<div class="text-center py-20 text-brand-500 font-bold tracking-widest bg-[#fffdf9] border border-brand-200 rounded-sm mt-10">動画が存在しないか、削除されました。</div>';
                }
            } catch (e) {
                console.error(e);
                document.querySelector('main').innerHTML = '<div class="text-center py-20 text-red-500 font-bold tracking-widest">エラーが発生しました。</div>';
            }
        }

        // --- Comments ---
        function listenComments() {
            if (isAdminMock) {
                document.getElementById('comments-list').innerHTML = '<div class="text-center py-6 text-brand-400 text-sm tracking-widest">モック環境ではコメントは表示されません</div>';
                return;
            }
            
            const commentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'videos', videoId, 'comments');
            const q = query(commentsRef, orderBy('createdAt', 'desc'));
            
            commentsUnsubscribe = onSnapshot(q, (snapshot) => {
                document.getElementById('comment-count').textContent = `(${snapshot.size})`;
                const list = document.getElementById('comments-list');
                
                if (snapshot.empty) {
                    list.innerHTML = '<div class="text-center py-10 text-brand-400 text-sm tracking-widest border border-dashed border-brand-200 bg-brand-50 rounded-sm">まだコメントはありません。<br>最初の感想を伝えてみましょう！</div>';
                    return;
                }
                
                let html = '';
                snapshot.forEach(docSnap => {
                    const c = docSnap.data();
                    const d = c.createdAt ? new Date(c.createdAt.toMillis()) : new Date();
                    const dateStr = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                    
                    let delBtn = '';
                    if (isAdmin || (currentUser && currentUser.uid === c.userId) || (currentUser && currentUser.uid === videoData.authorId)) {
                        delBtn = `<button onclick="deleteComment('${docSnap.id}')" class="text-red-400 hover:text-red-600 text-sm transition-colors ml-4"><i class="fa-solid fa-trash"></i></button>`;
                    }

                    let textHtml = `<p class="text-sm text-brand-700 leading-relaxed whitespace-pre-wrap">${c.text}</p>`;
                    let bgClass = "bg-brand-50 border-brand-100";
                    
                    if (c.isPrivate) {
                        const isOwner = currentUser && currentUser.uid === c.userId;
                        const isAuthor = currentUser && currentUser.uid === videoData.authorId;
                        
                        if (isAdmin || isOwner || isAuthor) {
                            bgClass = "bg-red-50 border-red-200";
                            textHtml = `
                                <div class="mb-2 text-[10px] sm:text-xs text-red-500 font-bold tracking-widest flex items-center gap-1 border-b border-red-200 pb-1 w-fit"><i class="fa-solid fa-lock"></i> 投稿者にのみ公開されています</div>
                                <p class="text-sm text-brand-900 leading-relaxed whitespace-pre-wrap">${c.text}</p>
                            `;
                        } else {
                            textHtml = `<div class="py-2 text-xs sm:text-sm text-brand-400 italic flex items-center gap-2 tracking-widest font-bold"><i class="fa-solid fa-lock"></i> このコメントは投稿者のみ公開されています</div>`;
                        }
                    }

                    html += `
                    <div class="flex gap-4 group">
                        <img src="${c.userIcon || 'https://via.placeholder.com/40'}" class="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-brand-200 object-cover flex-shrink-0 shadow-sm mt-1" onerror="this.src='https://via.placeholder.com/40?text=U'">
                        <div class="flex-1 min-w-0">
                            <div class="${bgClass} border p-4 rounded-sm rounded-tl-none shadow-sm relative">
                                <div class="flex justify-between items-start mb-2">
                                    <div class="flex items-center gap-3">
                                        <span class="font-bold text-brand-900 text-sm tracking-widest">${c.userName || '名無し'}</span>
                                        <span class="text-[10px] text-brand-400 font-mono">${dateStr}</span>
                                    </div>
                                    ${delBtn}
                                </div>
                                ${textHtml}
                            </div>
                        </div>
                    </div>
                    `;
                });
                list.innerHTML = html;
            });
        }

        window.postComment = async () => {
            if (!currentUser) return alert('コメントするにはログインが必要です');
            const input = document.getElementById('comment-input');
            const text = input.value.trim();
            if (!text) return;
            
            const isPrivate = document.getElementById('comment-private').checked;
            const btn = document.getElementById('btn-submit-comment');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btn.disabled = true;

            try {
                if (!isAdminMock) {
                    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'videos', videoId, 'comments'), {
                        userId: currentUser.uid,
                        userName: myProfile?.name || myProfile?.userId || '名無し',
                        userIcon: myProfile?.photoURL || null,
                        text: text,
                        isPrivate: isPrivate,
                        createdAt: serverTimestamp()
                    });
                }
                input.value = '';
                document.getElementById('comment-private').checked = false;
            } catch(e) {
                console.error(e);
                alert("コメントの送信に失敗しました");
            } finally {
                btn.innerHTML = 'コメント送信';
                btn.disabled = false;
            }
        };

        window.deleteComment = async (cid) => {
            if(!confirm("コメントを削除しますか？")) return;
            try {
                if (!isAdminMock) {
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', videoId, 'comments', cid));
                }
            } catch(e) { console.error(e); alert("削除に失敗しました"); }
        };

        // --- Likes ---
        function listenLikes() {
            if (isAdminMock) return;
            const likesRef = collection(db, 'artifacts', appId, 'public', 'data', 'videos', videoId, 'likes');
            
            likesUnsubscribe = onSnapshot(likesRef, (snapshot) => {
                document.getElementById('like-count').textContent = snapshot.size;
                
                if (currentUser) {
                    const myLike = snapshot.docs.find(d => d.id === currentUser.uid);
                    isLiked = !!myLike;
                    const btn = document.getElementById('btn-like');
                    const icon = document.getElementById('icon-like');
                    if (isLiked) {
                        icon.classList.remove('fa-regular', 'text-brand-400');
                        icon.classList.add('fa-solid', 'text-red-500');
                        btn.classList.add('border-red-200', 'bg-red-50');
                    } else {
                        icon.classList.remove('fa-solid', 'text-red-500');
                        icon.classList.add('fa-regular', 'text-brand-400');
                        btn.classList.remove('border-red-200', 'bg-red-50');
                    }
                }
            });
        }

        window.toggleLike = async () => {
            if (!currentUser) return alert("いいねするにはログインが必要です");
            if (isAdminMock) return alert("【テスト】いいねしました");

            try {
                const likeRef = doc(db, 'artifacts', appId, 'public', 'data', 'videos', videoId, 'likes', currentUser.uid);
                if (isLiked) {
                    await deleteDoc(likeRef);
                } else {
                    await setDoc(likeRef, { timestamp: serverTimestamp() });
                }
            } catch(e) { console.error(e); }
        };

        // --- Actions ---
        window.shareVideo = () => {
            const url = window.location.href;
            const textArea = document.createElement("textarea");
            textArea.value = url;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                const notif = document.getElementById('notification');
                document.getElementById('notif-message').textContent = 'URLをコピーしました！';
                notif.classList.remove('hidden', 'translate-y-20');
                setTimeout(() => notif.classList.add('translate-y-20'), 3000);
                setTimeout(() => notif.classList.add('hidden'), 3300);
            } catch (err) {
                alert('コピーに失敗しました。\n' + url);
            }
            document.body.removeChild(textArea);
        };

        window.editVideo = () => {
            window.location.href = `video_post.html?vid=${videoId}`;
        };

        window.deleteVideo = async () => {
            if(!confirm("本当にこの動画を削除しますか？\n※この操作は元に戻せません。")) return;
            if(isAdminMock) {
                alert("【テスト】削除しました");
                window.location.href = 'videos.html';
                return;
            }
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', videoId));
                alert("動画を削除しました");
                window.location.href = 'videos.html';
            } catch(e) {
                console.error(e);
                alert("削除に失敗しました");
            }
        };

        async function loadRelated() {
            try {
                const vRef = collection(db, 'artifacts', appId, 'public', 'data', 'videos');
                const snap = await getDocs(vRef);
                const vids = [];
                snap.forEach(d => { if(d.id !== videoId) vids.push({id:d.id, ...d.data()}); });
                vids.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                let html = '';
                vids.slice(0, 5).forEach(v => {
                    const date = new Date(v.createdAt);
                    html += `
                    <a href="video_detail.html?vid=${v.id}" class="flex gap-3 group cursor-pointer bg-[#fffdf9] p-2 sm:p-3 rounded-sm border border-brand-100 hover:border-brand-300 hover:shadow-md transition-all">
                        <div class="w-36 sm:w-40 aspect-video bg-black rounded-sm overflow-hidden flex-shrink-0 relative border border-brand-200">
                            <img src="${v.thumbnailUrl||'https://via.placeholder.com/320x180?text=NOAH'}" class="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500">
                            <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><i class="fa-solid fa-play text-white text-xl"></i></div>
                        </div>
                        <div class="flex-1 min-w-0 flex flex-col justify-center py-1">
                            <h4 class="text-xs sm:text-sm font-bold text-brand-900 leading-snug line-clamp-2 mb-1 group-hover:text-brand-600 transition-colors font-serif">${v.title}</h4>
                            <p class="text-[10px] text-brand-500 truncate mb-0.5">${v.authorName||'名無し'}</p>
                            <p class="text-[9px] text-brand-400 font-mono">${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}</p>
                        </div>
                    </a>
                    `;
                });
                document.getElementById('related-videos').innerHTML = html;
            } catch(e){}
        }

        window.addEventListener('unload', () => {
            if(commentsUnsubscribe) commentsUnsubscribe();
            if(likesUnsubscribe) likesUnsubscribe();
        });