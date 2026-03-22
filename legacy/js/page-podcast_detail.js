import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, setDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

        const urlParams = new URLSearchParams(window.location.search);
        const podcastId = urlParams.get('pid');

        if (!podcastId) { window.location.href = 'podcasts.html'; }

        let currentUser = null;
        let myProfile = null;
        let podcastData = null;
        let isAdmin = false;
        let isLiked = false;
        let commentsUnsubscribe = null;
        let likesUnsubscribe = null;
        
        let isMiniPlayerActive = false; // ミニプレーヤー状態フラグ

        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';
        const DEFAULT_ICON = 'https://via.placeholder.com/150/f7f5f0/c8b9a6?text=U';

        window.handleAuthAction = () => {
            if (currentUser || isAdminMock) {
                if (isAdminMock) localStorage.removeItem('isAdminMock');
                signOut(auth);
                window.location.reload(); 
            } else {
                window.location.href = 'login.html';
            }
        };

        // --- ミニプレーヤー切替関数 ---
        window.toggleMiniPlayer = () => {
            const fullUi = document.getElementById('full-screen-ui');
            const miniUi = document.getElementById('mini-player-ui');
            
            isMiniPlayerActive = !isMiniPlayerActive;
            
            if (isMiniPlayerActive) {
                fullUi.classList.add('hidden');
                miniUi.classList.remove('hidden');
                document.body.style.overflow = ''; // 背景のスクロールを許可
                
                // 情報をミニプレーヤーに同期
                if (podcastData) {
                    document.getElementById('mini-title').textContent = podcastData.title || 'タイトルなし';
                    document.getElementById('mini-author').textContent = podcastData.authorName || '名無し';
                    document.getElementById('mini-thumb').src = podcastData.thumbnailUrl || 'https://via.placeholder.com/150?text=NOAH';
                }
                
                // Note: iframeなどがある場合、hiddenにすると一部ブラウザで再生が止まる可能性があります。
                // 完全にバックグラウンド再生させる場合は、iframeを画面外（top: -9999pxなど）に飛ばす手法も有効ですが、
                // 今回はシンプルなクラス付け替え(hidden)で対応しています。
                
            } else {
                fullUi.classList.remove('hidden');
                miniUi.classList.add('hidden');
                document.body.style.overflow = 'hidden'; // オプション: フルスクリーン時スクロール制御
                setTimeout(() => { document.body.style.overflow = ''; }, 10);
            }
        };

        onAuthStateChanged(auth, async (user) => {
            if (isAdminMock) {
                currentUser = { uid: 'test_admin_uid' };
                isAdmin = true;
                myProfile = { name: '管理者', photoURL: DEFAULT_ICON };
                document.getElementById('my-icon').src = myProfile.photoURL;
                loadPodcastData();
                loadRelated();
                return;
            }

            if (user && !user.isAnonymous) {
                currentUser = user;
                try {
                    const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));
                    if (snap.exists()) {
                        myProfile = snap.data();
                        document.getElementById('my-icon').src = myProfile.photoURL || DEFAULT_ICON;
                        if (myProfile.userId === 'admin') isAdmin = true;
                    }
                } catch(e) {}
            } else {
                document.getElementById('comment-form-area').innerHTML = '<div class="w-full text-center py-4 bg-brand-50 border border-brand-200 rounded-sm text-sm font-bold text-brand-600 tracking-widest">コメントを投稿するには乗船（ログイン）してください。</div>';
            }
            loadPodcastData();
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

        // ファイルの長さを 分:秒 形式にフォーマット
        function formatDuration(seconds) {
            if (!seconds || isNaN(seconds)) return '--:--';
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m}:${s < 10 ? '0'+s : s}`;
        }

        async function loadPodcastData() {
            try {
                const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'podcasts', podcastId));
                if (snap.exists()) {
                    podcastData = snap.data();
                    
                    document.getElementById('podcast-title').textContent = podcastData.title || 'タイトルなし';
                    
                    // ★ 投稿者リンクを MEDIA LOG タブへ飛ぶように修正
                    document.getElementById('author-link').href = `user.html?uid=${podcastData.authorId}&tab=media`;
                    document.getElementById('author-name').innerHTML = `${podcastData.authorName || '名無し'} <i class="fa-solid fa-circle-check text-[10px] sm:text-xs text-[#d4af37]"></i>`;
                    document.getElementById('author-icon').src = podcastData.authorIcon || DEFAULT_ICON;

                    // メタ情報 (日付・長さ)
                    const date = new Date(podcastData.createdAt || podcastData.updatedAt || Date.now());
                    document.getElementById('podcast-date').textContent = `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}`;
                    document.getElementById('podcast-duration').textContent = formatDuration(podcastData.duration);

                    // プレイヤーの表示分岐
                    const thumbUrl = podcastData.thumbnailUrl || 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=640&auto=format&fit=crop';
                    document.getElementById('podcast-large-thumb').src = thumbUrl;

                    document.getElementById('loading-player').classList.add('hidden');

                    if (podcastData.isEmbed) {
                        const iframe = document.getElementById('embed-iframe');
                        iframe.src = podcastData.audioUrl;
                        document.getElementById('embed-container').classList.remove('hidden');
                    } else if (podcastData.audioUrl) {
                        const centerThumb = document.getElementById('podcast-center-thumb');
                        centerThumb.src = thumbUrl;
                        centerThumb.classList.remove('hidden');
                        
                        const audio = document.getElementById('direct-audio-player');
                        audio.src = podcastData.audioUrl;
                        audio.classList.remove('hidden');
                    } else {
                        // 音声データがない（アーカイブ枠など）
                        document.getElementById('embed-container').classList.remove('hidden');
                        document.getElementById('embed-container').innerHTML = `<div class="w-full h-40 sm:h-60 rounded-md bg-black/50 border border-[#5c4a3d] flex flex-col items-center justify-center text-[#a09080] font-bold tracking-widest"><i class="fa-solid fa-microphone-slash text-3xl mb-3"></i>音声データは準備中です</div>`;
                    }

                    // Description & Note Embed
                    const descContainer = document.getElementById('podcast-desc');
                    descContainer.innerHTML = formatText(podcastData.description || '概要はありません。');

                    // 関連記事 (Note等) の表示処理を複数対応＆余白調整
                    const existingRelated = document.getElementById('rendered-related-article');
                    if (existingRelated) existingRelated.remove();

                    // 互換性のため、配列と単一文字列の両方を処理
                    let urls = [];
                    if (podcastData.relatedArticleUrls && Array.isArray(podcastData.relatedArticleUrls)) {
                        urls = podcastData.relatedArticleUrls;
                    } else if (podcastData.relatedArticleUrl) {
                        urls = [podcastData.relatedArticleUrl];
                    }

                    if (urls.length > 0) {
                        let articleHtml = `
                            <div id="rendered-related-article" class="mt-8 pt-6 border-t border-brand-100">
                                <h3 class="text-base font-bold text-brand-900 mb-4 flex items-center font-serif tracking-widest">
                                    <div class="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center border border-brand-200 text-brand-400 shadow-inner mr-3 flex-shrink-0">
                                        <i class="fa-solid fa-link text-xs"></i>
                                    </div>
                                    関連記事
                                </h3>
                                <div class="space-y-4">
                        `;
                        
                        urls.forEach(url => {
                            const noteMatch = url.match(/note\.com\/.*?n\/(n[a-zA-Z0-9]+)/) || url.match(/note\.com\/embed\/notes\/(n[a-zA-Z0-9]+)/);
                            
                            if (noteMatch && noteMatch[1]) {
                                // iframeの高さを固定しすぎず、note側の推奨に近いコンパクトなサイズに
                                articleHtml += `
                                    <iframe class="w-full max-w-full rounded-sm border border-brand-200 shadow-sm" src="https://note.com/embed/notes/${noteMatch[1]}" style="border: 0; display: block; padding: 0px; margin: 0px; width: 100%; height: 260px;"></iframe>
                                `;
                            } else {
                                articleHtml += `
                                    <a href="${url}" target="_blank" class="block p-3 bg-brand-50 border border-brand-200 rounded-sm hover:border-[#b8860b] transition-colors text-sm text-brand-700 font-bold truncate shadow-sm">
                                        <i class="fa-solid fa-arrow-up-right-from-square mr-2 text-[#8b6a4f]"></i>${url}
                                    </a>
                                `;
                            }
                        });
                        
                        articleHtml += `</div></div>`;
                        descContainer.insertAdjacentHTML('beforeend', articleHtml);
                    }
                    
                    const tagsEl = document.getElementById('podcast-tags');
                    tagsEl.innerHTML = '';
                    if (podcastData.tags) {
                        podcastData.tags.forEach(tag => {
                            tagsEl.innerHTML += `<span class="bg-brand-50 border border-brand-200 text-[#b8860b] px-3 py-1 rounded-sm text-xs font-bold tracking-widest shadow-sm">#${tag}</span>`;
                        });
                    }

                    if (podcastData.allowComments === false) {
                        document.getElementById('comments-section').innerHTML = '<div class="text-center py-6 text-brand-400 text-sm tracking-widest border border-dashed border-brand-200 bg-brand-50 rounded-sm"><i class="fa-solid fa-comment-slash mr-2"></i>コメントはオフになっています</div>';
                    } else {
                        listenComments();
                    }
                    
                    listenLikes();

                    if ((currentUser && currentUser.uid === podcastData.authorId) || isAdmin) {
                        document.getElementById('admin-actions').classList.remove('hidden');
                        document.getElementById('admin-actions').classList.add('flex');
                    }

                } else {
                    document.querySelector('main').innerHTML = '<div class="text-center py-20 text-brand-500 font-bold tracking-widest bg-[#fffdf9] border border-brand-200 rounded-sm mt-10 w-full shadow-sm">エピソードが存在しないか、削除されました。</div>';
                }
            } catch (e) {
                console.error(e);
                document.querySelector('main').innerHTML = '<div class="text-center py-20 text-red-500 font-bold tracking-widest w-full">エラーが発生しました。</div>';
            }
        }

        // --- 匿名化対応付きの参加者情報取得 ---
        function getParticipantInfo() {
            let safeName = myProfile ? (myProfile.name || myProfile.userId) : '名無し';
            let safeIcon = myProfile ? myProfile.photoURL : null;

            if (!isAdminMock) {
                const isPublicSetting = myProfile && myProfile.profilePublic === 'true';
                const isPaidMember = myProfile && myProfile.membershipRank !== 'arrival';
                const canPublish = isPaidMember || isAdmin;
                
                if (!(isPublicSetting && canPublish)) {
                    if (!window.anonymousName) {
                        window.anonymousName = 'listener' + Math.floor(Math.random() * 10000);
                    }
                    safeName = window.anonymousName;
                    safeIcon = DEFAULT_ICON;
                }
            }
            return { safeName, safeIcon };
        }

        // --- Comments ---
        function listenComments() {
            if (isAdminMock) {
                document.getElementById('comments-list').innerHTML = '<div class="text-center py-6 text-brand-400 text-sm tracking-widest">モック環境ではコメントは表示されません</div>';
                return;
            }
            
            const commentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'podcasts', podcastId, 'comments');
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
                    if (isAdmin || (currentUser && currentUser.uid === c.userId) || (currentUser && currentUser.uid === podcastData.authorId)) {
                        delBtn = `<button onclick="deleteComment('${docSnap.id}')" class="text-red-400 hover:text-red-600 text-sm transition-colors ml-4"><i class="fa-solid fa-trash"></i></button>`;
                    }

                    let textHtml = `<p class="text-sm text-brand-700 leading-relaxed whitespace-pre-wrap">${c.text}</p>`;
                    let bgClass = "bg-brand-50 border-brand-100";
                    
                    if (c.isPrivate) {
                        const isOwner = currentUser && currentUser.uid === c.userId;
                        const isAuthor = currentUser && currentUser.uid === podcastData.authorId;
                        
                        if (isAdmin || isOwner || isAuthor) {
                            bgClass = "bg-[#fffdf9] border-[#b8860b] border-2";
                            textHtml = `
                                <div class="mb-2 text-[10px] sm:text-xs text-[#b8860b] font-bold tracking-widest flex items-center gap-1 border-b border-brand-200 pb-1 w-fit"><i class="fa-solid fa-lock"></i> 投稿者にのみ公開されています</div>
                                <p class="text-sm text-brand-900 leading-relaxed whitespace-pre-wrap">${c.text}</p>
                            `;
                        } else {
                            textHtml = `<div class="py-2 text-xs sm:text-sm text-brand-400 italic flex items-center gap-2 tracking-widest font-bold"><i class="fa-solid fa-lock"></i> このコメントは投稿者のみ公開されています</div>`;
                        }
                    }

                    html += `
                    <div class="flex gap-4 group">
                        <img src="${c.userIcon || DEFAULT_ICON}" class="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-brand-200 object-cover flex-shrink-0 shadow-sm mt-1" onerror="this.src='${DEFAULT_ICON}'">
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
                    const { safeName, safeIcon } = getParticipantInfo();
                    
                    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'podcasts', podcastId, 'comments'), {
                        userId: currentUser.uid,
                        userName: safeName,
                        userIcon: safeIcon,
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
                btn.innerHTML = '送信';
                btn.disabled = false;
            }
        };

        window.deleteComment = async (cid) => {
            if(!confirm("コメントを削除しますか？")) return;
            try {
                if (!isAdminMock) {
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'podcasts', podcastId, 'comments', cid));
                }
            } catch(e) { console.error(e); alert("削除に失敗しました"); }
        };

        // --- Likes ---
        function listenLikes() {
            if (isAdminMock) return;
            const likesRef = collection(db, 'artifacts', appId, 'public', 'data', 'podcasts', podcastId, 'likes');
            
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
                const likeRef = doc(db, 'artifacts', appId, 'public', 'data', 'podcasts', podcastId, 'likes', currentUser.uid);
                if (isLiked) {
                    await deleteDoc(likeRef);
                } else {
                    await setDoc(likeRef, { timestamp: serverTimestamp() });
                }
            } catch(e) { console.error(e); }
        };

        // --- Actions ---
        window.sharePodcast = () => {
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

        window.editPodcast = () => {
            window.location.href = `podcast_post.html?pid=${podcastId}`;
        };

        window.deletePodcast = async () => {
            if(!confirm("本当にこのエピソードを削除しますか？\n※この操作は元に戻せません。")) return;
            if(isAdminMock) {
                alert("【テスト】削除しました");
                window.location.href = 'podcasts.html';
                return;
            }
            try {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'podcasts', podcastId));
                alert("エピソードを削除しました");
                window.location.href = 'podcasts.html';
            } catch(e) {
                console.error(e);
                alert("削除に失敗しました");
            }
        };

        async function loadRelated() {
            try {
                const pRef = collection(db, 'artifacts', appId, 'public', 'data', 'podcasts');
                const snap = await getDocs(pRef);
                const pods = [];
                snap.forEach(d => { if(d.id !== podcastId) pods.push({id:d.id, ...d.data()}); });
                pods.sort((a,b) => new Date(b.createdAt||b.updatedAt) - new Date(a.createdAt||a.updatedAt));
                
                let html = '';
                pods.slice(0, 5).forEach(p => {
                    const date = new Date(p.createdAt||p.updatedAt);
                    const thumbUrl = p.thumbnailUrl || 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=640&auto=format&fit=crop';
                    
                    html += `
                    <a href="podcast_detail.html?pid=${p.id}" class="flex gap-3 group cursor-pointer bg-[#fffdf9] p-3 rounded-md border border-brand-200 hover:border-[#b8860b]/50 hover:shadow-md transition-all">
                        <div class="w-20 h-20 bg-[#1a110f] rounded-md overflow-hidden flex-shrink-0 relative border border-brand-100 shadow-inner">
                            <img src="${thumbUrl}" class="w-full h-full object-cover opacity-90 transition-transform group-hover:scale-110 duration-500">
                            <div class="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-center justify-center"><i class="fa-solid fa-play text-white/90 text-lg shadow-sm"></i></div>
                        </div>
                        <div class="flex-1 min-w-0 flex flex-col justify-center py-0.5">
                            <h4 class="text-sm font-bold text-brand-900 leading-snug line-clamp-2 mb-1.5 group-hover:text-[#b8860b] transition-colors font-serif">${p.title || 'タイトルなし'}</h4>
                            <p class="text-[10px] text-brand-500 truncate mb-1">${p.authorName||'名無し'}</p>
                            <div class="flex items-center justify-between mt-auto">
                                <span class="text-[9px] text-brand-400 font-mono tracking-widest">${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()}</span>
                            </div>
                        </div>
                    </a>
                    `;
                });
                document.getElementById('related-podcasts').innerHTML = html;
            } catch(e){}
        }

        window.addEventListener('unload', () => {
            if(commentsUnsubscribe) commentsUnsubscribe();
            if(likesUnsubscribe) likesUnsubscribe();
        });