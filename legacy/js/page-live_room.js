import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        // ★修正: addDoc を追加インポート
        import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy, limit, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
        import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";
        import * as jose from 'https://cdn.jsdelivr.net/npm/jose@5.2.3/+esm';

        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        const targetRoomId = urlParams.get('roomId');

        const DEFAULT_ICON = 'https://via.placeholder.com/150/f7f5f0/c8b9a6?text=U';

        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';
        let currentUser = null;
        let myProfile = null;
        let myRank = 'arrival';
        let isAdmin = false;

        let currentRoomId = null; 
        let currentRole = 'none'; 
        let roomUnsubscribe = null;
        let partsUnsubscribe = null;
        let commentsUnsubscribe = null;
        let isHandRaised = false;
        let isLeaving = false; 

        const LIVEKIT_URL = "wss://noonealonehere-eoyjqp8c.livekit.cloud";
        const LIVEKIT_API_KEY = "APIvGriAyz8L7Tm";
        const LIVEKIT_API_SECRET = "IvJ9RG8pdaey7sKqJ8Hh9qFZxvYINz776eT6zStiLuL";
        let livekitRoom = null;

        let audioContext = null;
        let analyser = null;
        let microphone = null;
        let isMicActive = false;
        let micInterval = null;
        
        let isMiniPlayer = false;
        window.anonymousName = null;

        const rankLevels = { 'arrival': 0, 'settler': 1, 'builder': 2, 'guardian': 3, 'covenant': 4, 'admin': 99 };
        function getRankLevel(rank) { return rankLevels[rank] || 0; }
        const getVal = (id, def = '') => { const el = document.getElementById(id); return el ? el.value : def; };

        function getParticipantInfo() {
            let safeName = myProfile ? (myProfile.name || myProfile.userId) : '名無し';
            let safeIcon = myProfile ? myProfile.photoURL : null;

            if (currentRole !== 'host' && !isAdminMock) {
                const isPublicSetting = myProfile && myProfile.profilePublic === 'true';
                const isPaidMember = myRank !== 'arrival';
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

        window.toggleRecordWarning = (isRecord) => {
            const warningEl = document.getElementById('record-warning');
            if (warningEl) {
                if (isRecord) {
                    warningEl.classList.remove('hidden');
                    if (!window.hasShownRecordAlert) {
                        alert("【重要確認】\n配信の自動録音機能はありません。\n\n必ずご自身のボイスレコーダー等で録音を行い、配信終了後にマイページから音声ファイルをアップロードしてください。");
                        window.hasShownRecordAlert = true;
                    }
                } else {
                    warningEl.classList.add('hidden');
                }
            }
        };

        window.showNotification = (msg, isError = false) => {
            const notif = document.getElementById('notification');
            document.getElementById('notif-message').textContent = msg;
            notif.classList.remove('hidden', 'translate-y-10');
            setTimeout(() => {
                notif.classList.add('translate-y-10');
                setTimeout(() => notif.classList.add('hidden'), 300);
            }, 3000);
        };

        window.shareMyRoom = () => {
            if (!currentUser) return;
            const url = `${window.location.origin}${window.location.pathname}?roomId=${currentUser.uid}`;
            copyToClipboard(url, 'あなたの配信ルームURLをコピーしました！\nSNS等で告知してください。');
        };

        window.shareLiveRoom = () => {
            const roomId = currentRoomId || targetRoomId || currentUser?.uid;
            if (!roomId) return;
            const url = `${window.location.origin}${window.location.pathname}?roomId=${roomId}`;
            copyToClipboard(url, '配信ルームのURLをコピーしました！');
        };

        function copyToClipboard(text, successMsg) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                showNotification(successMsg);
            } catch (err) {
                console.error('Copy failed', err);
                alert('URLのコピーに失敗しました。\n' + text);
            }
            document.body.removeChild(textArea);
        }

        onAuthStateChanged(auth, async (user) => {
            if (isAdminMock) {
                currentUser = { uid: 'test_admin_uid' };
                isAdmin = true;
                myRank = 'admin';
                myProfile = { name: '管理者', userId: 'admin', photoURL: 'https://via.placeholder.com/150' };
                initView();
                return;
            }

            if (user && !user.isAnonymous) {
                currentUser = user;
                try {
                    const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));
                    if (snap.exists()) {
                        myProfile = snap.data();
                        myRank = myProfile.membershipRank || 'arrival';
                        if (myProfile.userId === 'admin') { isAdmin = true; myRank = 'admin'; }
                    }
                } catch(e){}
                initView();
            } else {
                if(action === 'create' || targetRoomId) {
                    if(confirm('参加するにはログインが必要です。ログインしますか？')) {
                        window.location.href = 'login.html';
                    } else {
                        window.location.href = 'home.html';
                    }
                } else {
                    window.location.href = 'home.html';
                }
            }
        });

        function initView() {
            const rLevel = getRankLevel((myRank || 'arrival').toLowerCase());
            
            const isAuthorizedHost = rLevel >= 3 || isAdmin || isAdminMock;
            const isAuthorizedListener = rLevel >= 1 || isAdmin || isAdminMock;

            if (action === 'create') {
                if (!isAuthorizedHost) {
                    alert('配信をホストしてルームを作成できるのは GUARDIAN 以上の機能です。契約変更をご検討ください。');
                    window.location.href = 'upgrade.html';
                    return;
                }
                document.getElementById('create-view').classList.remove('hidden');
                document.getElementById('create-view').classList.add('flex');
            } else if (targetRoomId) {
                if (!isAuthorizedListener) {
                    alert('ライブ配信の視聴・参加は SETTLER 以上の会員限定です。契約変更をご検討ください。');
                    window.location.href = 'upgrade.html';
                    return;
                }
                document.getElementById('live-cast-modal').classList.remove('hidden');
                joinLiveRoom(targetRoomId);
            } else {
                window.location.href = 'home.html';
            }
        }

        async function generateLiveKitToken(roomName, participantName, isPublisher) {
            const secret = new TextEncoder().encode(LIVEKIT_API_SECRET);
            const jwt = await new jose.SignJWT({
                video: { room: roomName, roomJoin: true, canPublish: isPublisher, canSubscribe: true },
                name: participantName,
            })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuer(LIVEKIT_API_KEY)
            .setSubject(currentUser.uid)
            .setExpirationTime('12h')
            .sign(secret);
            return jwt;
        }

        async function connectLiveKit(roomName, isPublisher) {
            try {
                if (livekitRoom) await livekitRoom.disconnect();
                
                const token = await generateLiveKitToken(roomName, myProfile?.name || currentUser.uid, isPublisher);
                livekitRoom = new LivekitClient.Room({ adaptiveStream: true, dynacast: true });

                livekitRoom.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
                    if (track.kind === 'audio') document.body.appendChild(track.attach());
                });

                livekitRoom.on(LivekitClient.RoomEvent.ActiveSpeakersChanged, (speakers) => {
                    document.querySelectorAll('[id^="speaker-"]').forEach(el => el.classList.remove('speaking-ripple', 'border-[#d4af37]'));
                    document.querySelectorAll('[id^="speaker-"]').forEach(el => el.classList.add('border-white/10'));
                    
                    speakers.forEach(speaker => {
                        const el = document.getElementById(`speaker-${speaker.identity}`);
                        if (el) {
                            el.classList.add('speaking-ripple', 'border-[#d4af37]');
                            el.classList.remove('border-white/10');
                        }
                    });
                });

                await livekitRoom.connect(LIVEKIT_URL, token);
                if (isPublisher) await livekitRoom.localParticipant.setMicrophoneEnabled(true);
            } catch(e) {
                console.warn("音声サーバーへの接続に失敗しました。チャットのみの利用となります。");
            }
        }

        async function disconnectLiveKit() {
            if (livekitRoom) {
                await livekitRoom.disconnect();
                livekitRoom = null;
            }
        }

        window.startLiveCast = async () => {
            if (!currentUser) return;
            const title = getVal('room-title');
            if(!title) return alert("タイトルは必須です");

            const btn = document.getElementById('btn-start-cast');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 準備中...';
            btn.disabled = true;

            try {
                if (!isAdminMock) {
                    try {
                        const oldCommentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentUser.uid, 'comments');
                        const oldCommentsSnap = await getDocs(oldCommentsRef);
                        const deleteComments = oldCommentsSnap.docs.map(d => deleteDoc(d.ref));
                        
                        const oldPartsRef = collection(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentUser.uid, 'participants');
                        const oldPartsSnap = await getDocs(oldPartsRef);
                        const deleteParts = oldPartsSnap.docs.map(d => deleteDoc(d.ref));
                        
                        await Promise.all([...deleteComments, ...deleteParts]);
                    } catch (initErr) {
                        console.warn("古いデータの初期化に失敗しました (無視して続行します):", initErr);
                    }
                }

                let thumbUrl = null;
                const fileEl = document.getElementById('room-thumb');
                if (fileEl && fileEl.files[0] && !isAdminMock) {
                    try {
                        const snap = await uploadBytes(ref(storage, `live_thumbs/${currentUser.uid}/${Date.now()}_${fileEl.files[0].name}`), fileEl.files[0]);
                        thumbUrl = await getDownloadURL(snap.ref);
                    } catch (uploadErr) {
                        console.warn("Thumbnail upload failed:", uploadErr);
                    }
                }

                const checkedTags = Array.from(document.querySelectorAll('.room-tag-cb:checked')).map(cb => cb.value);
                const isRecord = document.querySelector('input[name="roomRecord"]:checked').value === 'true';

                const safeName = myProfile ? (myProfile.name || myProfile.userId) : '名無し';
                const safeIcon = myProfile ? myProfile.photoURL : null;

                const relatedArticleInput = getVal('room-related-article');
                const relatedArticleUrls = relatedArticleInput ? relatedArticleInput.split(',').map(s=>s.trim()).filter(s=>s) : [];

                const roomData = {
                    hostId: currentUser.uid,
                    hostName: safeName,
                    hostIcon: safeIcon,
                    title: title,
                    desc: getVal('room-desc'),
                    guestsStr: getVal('room-guests'),
                    relatedArticleUrls: relatedArticleUrls, 
                    privacy: getVal('room-privacy'),
                    type: getVal('room-type'),
                    tags: checkedTags,
                    isRecord: isRecord,
                    thumbUrl: thumbUrl,
                    status: 'live',
                    pinnedComment: null, // 初期化
                    startedAt: serverTimestamp()
                };

                if (!isAdminMock) {
                    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentUser.uid);
                    await setDoc(roomRef, roomData);

                    const partRef = doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentUser.uid, 'participants', currentUser.uid);
                    await setDoc(partRef, {
                        uid: currentUser.uid,
                        name: safeName,
                        icon: safeIcon,
                        role: 'host',
                        isMuted: false,
                        joinedAt: serverTimestamp()
                    });

                    // ★追加: フォロワーにライブ配信開始の通知を送る
                    try {
                        const followersSnap = await getDocs(collection(db, 'artifacts', appId, 'users', currentUser.uid, 'followers'));
                        const notifyPromises = [];
                        followersSnap.forEach(fDoc => {
                            const followerId = fDoc.id;
                            const notifRef = collection(db, 'artifacts', appId, 'users', followerId, 'notifications');
                            notifyPromises.push(addDoc(notifRef, {
                                type: 'live_start',
                                fromUid: currentUser.uid,
                                contentId: currentUser.uid,
                                createdAt: serverTimestamp(),
                                isRead: false
                            }));
                        });
                        await Promise.all(notifyPromises);
                    } catch (notifyErr) {
                        console.error("Failed to send live notifications:", notifyErr);
                    }
                }

                document.getElementById('create-view').classList.add('hidden');
                document.getElementById('create-view').classList.remove('flex');
                document.getElementById('live-cast-modal').classList.remove('hidden');
                
                window.history.replaceState(null, '', `?roomId=${currentUser.uid}`);
                
                joinLiveRoom(currentUser.uid);

            } catch (e) {
                console.error(e);
                alert('配信の開始に失敗しました。\n' + e.message);
                btn.innerHTML = '<i class="fa-solid fa-satellite-dish animate-pulse"></i> 配信を START する';
                btn.disabled = false;
            }
        };

        window.joinLiveRoom = async (hostUid) => {
            currentRoomId = hostUid;
            isLeaving = false; 
            document.body.style.overflow = 'hidden'; 
            
            if (isAdminMock) {
                document.getElementById('live-header-title').textContent = "テスト配信ルーム";
                document.getElementById('mini-title').textContent = "テスト配信ルーム";
                document.getElementById('live-info-title').textContent = "テスト配信ルーム";
                document.getElementById('live-info-desc').textContent = "モックデータです";
                setupMockLiveUI();
                return;
            }

            if (currentUser.uid === hostUid) {
                currentRole = 'host';
            } else {
                currentRole = 'listener';
                const { safeName, safeIcon } = getParticipantInfo();

                const partRef = doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', hostUid, 'participants', currentUser.uid);
                await setDoc(partRef, {
                    uid: currentUser.uid,
                    name: safeName,
                    icon: safeIcon,
                    role: 'listener',
                    handRaised: false,
                    joinedAt: serverTimestamp()
                }, { merge: true });
            }

            connectLiveKit(hostUid, currentRole === 'host').catch(e => {
                console.error("LiveKit connection handled:", e);
                showNotification("音声サーバーに接続できませんでしたが、チャットは利用可能です。", true);
            });

            const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', hostUid);
            roomUnsubscribe = onSnapshot(roomRef, (snap) => {
                if (!snap.exists() || snap.data().status !== 'live') {
                    if(!isLeaving) {
                        isLeaving = true;
                        alert('この配信は終了しました。');
                        closeModalUI();
                    }
                    return;
                }
                const data = snap.data();
                document.getElementById('live-header-title').textContent = data.title || '配信中';
                document.getElementById('mini-title').textContent = data.title || '配信中';
                document.getElementById('live-info-title').textContent = data.title || '配信中';
                if (data.thumbUrl) {
                    const mt = document.getElementById('mini-thumb');
                    if(mt) mt.src = data.thumbUrl;
                }
                
                // ★追加: ピン留めコメントの表示処理
                const pinnedContainer = document.getElementById('pinned-comment-container');
                if (data.pinnedComment && data.pinnedComment.text) {
                    document.getElementById('pinned-comment-text').textContent = data.pinnedComment.text;
                    document.getElementById('pinned-comment-author').textContent = data.pinnedComment.author;
                    pinnedContainer.classList.remove('hidden');
                    
                    if (currentRole === 'host') {
                        document.getElementById('btn-unpin').classList.remove('hidden');
                    }
                } else {
                    pinnedContainer.classList.add('hidden');
                }

                const descContainer = document.getElementById('live-info-desc');
                descContainer.innerHTML = ''; 
                
                const descText = document.createElement('div');
                descText.innerHTML = data.desc ? data.desc.replace(/\n/g, '<br>') : '概要はありません。';
                descText.className = 'whitespace-pre-wrap leading-relaxed mb-4';
                descContainer.appendChild(descText);

                let urls = [];
                if (data.relatedArticleUrls && Array.isArray(data.relatedArticleUrls)) {
                    urls = data.relatedArticleUrls;
                } else if (data.relatedArticleUrl) {
                    urls = [data.relatedArticleUrl];
                }

                if (urls.length > 0) {
                    const articleDiv = document.createElement('div');
                    articleDiv.className = "mt-5 pt-4 border-t border-white/10";
                    articleDiv.innerHTML = `<h4 class="text-[10px] text-[#d4af37] tracking-widest mb-3 font-bold uppercase flex items-center gap-1.5"><i class="fa-solid fa-link"></i>関連記事</h4>`;
                    
                    const linksContainer = document.createElement('div');
                    linksContainer.className = "space-y-4";

                    urls.forEach(url => {
                        const noteMatch = url.match(/note\.com\/.*?n\/(n[a-zA-Z0-9]+)/) || url.match(/note\.com\/embed\/notes\/(n[a-zA-Z0-9]+)/);
                        if (noteMatch && noteMatch[1]) {
                            linksContainer.innerHTML += `
                                <iframe class="w-full max-w-full rounded-sm border border-white/10 shadow-lg bg-white" src="https://note.com/embed/notes/${noteMatch[1]}" style="border: 0; display: block; padding: 0px; margin: 0px; width: 100%; height: 260px;"></iframe>
                            `;
                        } else {
                            linksContainer.innerHTML += `
                                <a href="${url}" target="_blank" class="block p-3.5 bg-white/5 border border-white/10 rounded-sm hover:border-[#d4af37]/50 hover:bg-white/10 transition-all text-xs text-white/90 truncate shadow-md backdrop-blur-sm">
                                    <i class="fa-solid fa-arrow-up-right-from-square mr-2 text-[#d4af37]"></i>${url}
                                </a>
                            `;
                        }
                    });
                    articleDiv.appendChild(linksContainer);
                    descContainer.appendChild(articleDiv);
                }
                
                const tagsEl = document.getElementById('live-info-tags');
                tagsEl.innerHTML = '';
                if(data.tags && data.tags.length > 0) {
                    tagsEl.innerHTML = data.tags.map(t => `<span class="bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#f7f5f0] px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-widest backdrop-blur-sm">#${t}</span>`).join('');
                }
            });

            const partsRef = collection(db, 'artifacts', appId, 'public', 'data', 'live_rooms', hostUid, 'participants');
            partsUnsubscribe = onSnapshot(partsRef, async (snap) => {
                let speakers = [];
                let listeners = [];
                let myData = null;

                snap.forEach(docSnap => {
                    const p = docSnap.data();
                    if (p.uid === currentUser.uid) myData = p;
                    if (p.role === 'host' || p.role === 'speaker') speakers.push(p);
                    if (p.role === 'listener') listeners.push(p);
                });

                if (myData) {
                    const prevRole = currentRole;
                    currentRole = myData.role;
                    isHandRaised = myData.handRaised || false;

                    if (prevRole === 'listener' && currentRole === 'speaker') {
                        connectLiveKit(currentRoomId, true).catch(e=>{});
                    } else if (prevRole === 'speaker' && currentRole === 'listener') {
                        connectLiveKit(currentRoomId, false).catch(e=>{});
                    }
                }
                updateLiveUI(speakers, listeners);
            });

            const commentsRef = collection(db, 'artifacts', appId, 'public', 'data', 'live_rooms', hostUid, 'comments');
            const q = query(commentsRef, orderBy('timestamp', 'asc'), limit(50));
            commentsUnsubscribe = onSnapshot(q, (snap) => {
                const list = document.getElementById('live-comments-list');
                list.innerHTML = '';
                snap.forEach(docSnap => {
                    const c = docSnap.data();
                    const isMe = c.uid === currentUser.uid;
                    const align = isMe ? 'justify-end' : 'justify-start';
                    
                    const bg = isMe ? 'bg-[#d4af37]/20 border border-[#d4af37]/30 text-[#f7f5f0] backdrop-blur-md' : 'bg-white/10 border border-white/5 text-[#f7f5f0] backdrop-blur-md';
                    const nameColor = isMe ? 'text-[#d4af37]' : 'text-white/70';
                    
                    list.innerHTML += `
                        <div class="flex ${align} w-full mb-4">
                            ${!isMe ? `<img src="${c.icon || DEFAULT_ICON}" onerror="this.src='${DEFAULT_ICON}'" class="w-7 h-7 rounded-full mr-2.5 self-end object-cover border border-white/20 shadow-sm">` : ''}
                            <div class="max-w-[85%]">
                                ${!isMe ? `<p class="text-[9px] ${nameColor} mb-1 ml-1 tracking-widest font-bold">${c.name}</p>` : ''}
                                <div class="${bg} px-3.5 py-2.5 rounded-2xl ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'} text-xs sm:text-sm leading-relaxed break-words shadow-sm font-medium tracking-wide">${c.text}</div>
                            </div>
                        </div>
                    `;
                });
                list.scrollTop = list.scrollHeight;
            });
        };

        function updateLiveUI(speakers, listeners) {
            document.getElementById('live-listener-count').textContent = listeners.length;
            
            const grid = document.getElementById('speakers-grid');
            grid.innerHTML = speakers.map(s => {
                const micIcon = s.isMuted ? '<i class="fa-solid fa-microphone-slash text-white absolute bottom-0 right-0 bg-red-600 rounded-full p-1.5 text-[10px] border border-white/20 shadow-md"></i>' : '';
                const hostIcon = s.role === 'host' ? '<div class="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-[#d4af37] text-[#2a1a17] text-[9px] px-2.5 py-0.5 rounded-sm font-bold border border-[#fffdf9]/50 shadow-md tracking-widest z-10">HOST</div>' : '';
                const ringClass = s.isSpeaking ? 'speaking-ripple border-[#d4af37]' : 'border-white/10'; 
                
                return `
                <div class="flex flex-col items-center gap-2.5">
                    <div id="speaker-${s.uid}" class="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-[3px] bg-black/50 relative shadow-xl transition-all duration-300 ${ringClass}">
                        ${hostIcon}
                        <img src="${s.icon || DEFAULT_ICON}" onerror="this.src='${DEFAULT_ICON}'" class="w-full h-full rounded-full object-cover">
                        ${micIcon}
                    </div>
                    <span class="text-[11px] sm:text-xs font-bold tracking-widest text-white/90 max-w-[100px] truncate text-center drop-shadow-md">${s.name}</span>
                </div>
                `;
            }).join('');

            const btnRaise = document.getElementById('btn-raise-hand');
            const btnMic = document.getElementById('btn-mic');
            const btnLeaveStage = document.getElementById('btn-leave-stage');
            const btnEnd = document.getElementById('btn-end-cast');
            const tabListeners = document.getElementById('tab-live-listeners');
            const hostPinOption = document.getElementById('host-pin-option');

            btnRaise.classList.add('hidden');
            btnMic.classList.add('hidden');
            btnLeaveStage.classList.add('hidden');
            btnEnd.classList.add('hidden');
            hostPinOption?.classList.add('hidden');
            
            if (currentRole === 'host') {
                btnMic.classList.remove('hidden');
                btnEnd.classList.remove('hidden');
                tabListeners.classList.remove('hidden');
                hostPinOption?.classList.remove('hidden'); // ★追加: ホストのみピン留め表示
                renderListenersAdmin(listeners); 
                if(!isMicActive) startMicAnalysis();
            } else if (currentRole === 'speaker') {
                btnMic.classList.remove('hidden');
                btnLeaveStage.classList.remove('hidden');
                tabListeners.classList.add('hidden');
                if(!isMicActive) startMicAnalysis();
            } else if (currentRole === 'listener') {
                const rLevel = getRankLevel((myRank || 'arrival').toLowerCase());
                if (rLevel >= 2 || isAdmin || isAdminMock) {
                    btnRaise.classList.remove('hidden');
                    if (isHandRaised) {
                        btnRaise.innerHTML = '<i class="fa-solid fa-hand text-[#d4af37] mr-2"></i> リクエスト中...';
                        btnRaise.classList.replace('bg-white/10', 'bg-white/20');
                        btnRaise.classList.add('border-[#d4af37]');
                    } else {
                        btnRaise.innerHTML = '<i class="fa-solid fa-hand mr-2 text-white/70 group-hover:text-[#d4af37] transition-colors"></i> 登壇をリクエスト';
                        btnRaise.classList.replace('bg-white/20', 'bg-white/10');
                        btnRaise.classList.remove('border-[#d4af37]');
                    }
                }
                tabListeners.classList.add('hidden');
                stopMicAnalysis();
            }
        }

        function renderListenersAdmin(listeners) {
            const list = document.getElementById('live-listeners-list');
            let reqCount = 0;
            list.innerHTML = listeners.map(l => {
                if (l.handRaised) reqCount++;
                const reqBtn = l.handRaised 
                    ? `<button onclick="approveSpeaker('${l.uid}')" class="bg-[#d4af37] text-[#2a1a17] text-[10px] font-bold px-2.5 py-1 rounded-sm shadow-md hover:bg-[#b8860b] transition-colors border border-white/20">承認</button>` 
                    : '';
                return `
                <div class="flex items-center justify-between p-2.5 hover:bg-white/10 rounded-sm transition-colors group border-b border-white/5 last:border-0">
                    <div class="flex items-center gap-3 min-w-0">
                        <img src="${l.icon || DEFAULT_ICON}" onerror="this.src='${DEFAULT_ICON}'" class="w-7 h-7 rounded-full object-cover border border-white/20 shadow-sm">
                        <span class="text-xs text-white/90 truncate tracking-wide font-medium">${l.name}</span>
                    </div>
                    <div class="flex items-center gap-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${reqBtn}
                        <button onclick="kickUser('${l.uid}')" class="text-red-400 hover:text-red-500 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-500/20 transition-colors" title="退出させる"><i class="fa-solid fa-ban text-[10px]"></i></button>
                    </div>
                </div>
                `;
            }).join('');
            
            document.getElementById('req-count').textContent = reqCount;
            
            const tabBadge = document.getElementById('tab-req-badge');
            if (tabBadge) {
                if (reqCount > 0) {
                    tabBadge.textContent = reqCount;
                    tabBadge.classList.remove('hidden');
                } else {
                    tabBadge.classList.add('hidden');
                }
            }
        }

        window.switchLiveTab = (tab) => {
            const tabs = ['comments', 'listeners', 'info'];
            tabs.forEach(t => {
                const btn = document.getElementById(`tab-live-${t}`);
                const area = document.getElementById(`area-live-${t}`);
                if(!btn || !area) return;
                
                if (t === tab) {
                    btn.className = 'flex-1 p-3.5 text-xs font-bold tracking-widest border-b-2 border-[#d4af37] text-[#d4af37] transition-colors drop-shadow-sm';
                    area.classList.remove('hidden');
                } else {
                    let hideClass = '';
                    if (t === 'listeners' && currentRole !== 'host') hideClass = ' hidden';
                    btn.className = 'flex-1 p-3.5 text-xs font-bold tracking-widest border-b-2 border-transparent text-white/50 hover:text-white/90 transition-colors relative' + hideClass;
                    area.classList.add('hidden');
                }
            });
        };

        window.sendLiveComment = async (e) => {
            e.preventDefault();
            if(!currentUser) return;
            const input = document.getElementById('live-comment-input');
            const text = input.value.trim();
            if(!text || !currentRoomId) return;
            
            const isPin = document.getElementById('is-pin-comment')?.checked;
            const { safeName, safeIcon } = getParticipantInfo();

            if(!isAdminMock) {
                await setDoc(doc(collection(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentRoomId, 'comments')), {
                    uid: currentUser.uid,
                    name: safeName,
                    icon: safeIcon,
                    text: text,
                    timestamp: serverTimestamp()
                });
                
                // ★追加: ホストがピン留めにチェックを入れた場合の処理
                if (isPin && currentRole === 'host') {
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentRoomId), {
                        pinnedComment: {
                            text: text,
                            author: safeName
                        }
                    });
                }
            } else {
                document.getElementById('live-comments-list').innerHTML += `<div class="flex justify-end w-full mb-4"><div class="bg-[#d4af37]/20 border border-[#d4af37]/30 text-[#f7f5f0] backdrop-blur-md px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-xs sm:text-sm shadow-sm font-medium tracking-wide">テスト: ${text}</div></div>`;
            }
            
            input.value = '';
            if(document.getElementById('is-pin-comment')) document.getElementById('is-pin-comment').checked = false;
        };

        // ★追加: ピン留めを解除する関数
        window.unpinComment = async () => {
            if (currentRole !== 'host' || isAdminMock) return;
            try {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentRoomId), {
                    pinnedComment: null
                });
            } catch(e) {
                console.error("Unpin error", e);
            }
        };

        window.toggleHandRaise = async () => {
            if(!currentRoomId || !currentUser) return;
            if(!isAdminMock) {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentRoomId, 'participants', currentUser.uid), {
                    handRaised: !isHandRaised
                });
            }
        };

        window.approveSpeaker = async (targetUid) => {
            if(!currentRoomId) return;
            if(!isAdminMock) {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentRoomId, 'participants', targetUid), {
                    role: 'speaker',
                    handRaised: false
                });
            }
        };

        window.leaveStage = async () => {
            if(!currentRoomId || !currentUser) return;
            if(!isAdminMock) {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentRoomId, 'participants', currentUser.uid), {
                    role: 'listener',
                    isSpeaking: false
                });
            }
            stopMicAnalysis();
        };

        window.kickUser = async (targetUid) => {
            if(!confirm("このユーザーをルームから退出させますか？")) return;
            if(!isAdminMock) {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentRoomId, 'participants', targetUid));
            }
        };

        window.toggleMic = async () => {
            const icon = document.getElementById('icon-mic');
            const btn = document.getElementById('btn-mic');
            const isMuted = icon.classList.contains('fa-microphone-slash'); 
            
            if (livekitRoom && livekitRoom.localParticipant) {
                await livekitRoom.localParticipant.setMicrophoneEnabled(isMuted);
            }

            if (!isMuted) {
                icon.className = 'fa-solid fa-microphone-slash text-white relative z-10';
                btn.className = 'w-16 h-16 rounded-full bg-red-600/80 backdrop-blur-md text-white flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:scale-105 transition-transform border border-red-400 relative group';
                if(!isAdminMock) updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentRoomId, 'participants', currentUser.uid), { isMuted: true, isSpeaking: false });
            } else {
                icon.className = 'fa-solid fa-microphone relative z-10';
                btn.className = 'w-16 h-16 rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8860b] text-[#1a110f] flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:scale-105 transition-transform border border-[#f7f5f0]/30 relative group';
                if(!isAdminMock) updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentRoomId, 'participants', currentUser.uid), { isMuted: false });
            }
        };

        window.toggleMiniPlayer = () => {
            const modal = document.getElementById('live-cast-modal');
            const fullUi = document.getElementById('live-full-ui');
            const miniUi = document.getElementById('live-mini-ui');
            const bgDeco = modal.querySelector('.pointer-events-none.z-0');
            
            isMiniPlayer = !isMiniPlayer;
            
            if (isMiniPlayer) {
                modal.classList.remove('inset-0', 'bg-[#1a110f]');
                modal.classList.add('bottom-[5rem]', 'right-4', 'w-[calc(100%-2rem)]', 'sm:w-[360px]', 'h-[76px]', 'bg-transparent');
                fullUi.classList.add('hidden');
                fullUi.classList.remove('flex');
                if(bgDeco) bgDeco.classList.add('hidden');
                miniUi.classList.remove('hidden');
                document.body.style.overflow = ''; 
            } else {
                modal.classList.add('inset-0', 'bg-[#1a110f]');
                modal.classList.remove('bottom-[5rem]', 'right-4', 'w-[calc(100%-2rem)]', 'sm:w-[360px]', 'h-[76px]', 'bg-transparent');
                miniUi.classList.add('hidden');
                if(bgDeco) bgDeco.classList.remove('hidden');
                fullUi.classList.remove('hidden');
                fullUi.classList.add('flex');
                document.body.style.overflow = 'hidden'; 
            }
        };

        // --- Web Audio API ---
        async function startMicAnalysis() {
            if (isMicActive) return;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                microphone = audioContext.createMediaStreamSource(stream);
                microphone.connect(analyser);
                analyser.fftSize = 256;
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                isMicActive = true;
                
                let lastUpdateTime = 0;
                
                function analyze() {
                    if(!isMicActive) return;
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for(let i=0; i<bufferLength; i++) sum += dataArray[i];
                    let avg = sum / bufferLength;
                    
                    const mySpeakerEl = document.getElementById(`speaker-${currentUser.uid}`);
                    const isMuted = document.getElementById('icon-mic')?.classList.contains('fa-microphone-slash');
                    const isTalkingNow = avg > 15 && !isMuted;
                    
                    if(mySpeakerEl) {
                        if(isTalkingNow) {
                            mySpeakerEl.classList.add('speaking-ripple', 'border-[#d4af37]');
                            mySpeakerEl.classList.remove('border-white/10');
                        } else {
                            mySpeakerEl.classList.remove('speaking-ripple', 'border-[#d4af37]');
                            mySpeakerEl.classList.add('border-white/10');
                        }
                    }

                    const now = Date.now();
                    if (now - lastUpdateTime > 1000 && !isAdminMock && currentRoomId && currentRole !== 'listener') {
                        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentRoomId, 'participants', currentUser.uid), {
                            isSpeaking: isTalkingNow
                        }).catch(e=>{});
                        lastUpdateTime = now;
                    }
                    micInterval = requestAnimationFrame(analyze);
                }
                analyze();
            } catch(e) { console.warn("マイクアクセス不可"); }
        }

        function stopMicAnalysis() {
            isMicActive = false;
            if(micInterval) cancelAnimationFrame(micInterval);
            if(microphone) microphone.disconnect();
            if(audioContext) audioContext.close();
            if(!isAdminMock && currentUser && currentRoomId && currentRole !== 'listener') {
                updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentRoomId, 'participants', currentUser.uid), { isSpeaking: false }).catch(e=>{});
            }
        }

        window.leaveLiveRoom = async () => {
            if (isLeaving) return; 
            
            if (!currentRoomId || !currentUser) {
                window.location.href = 'home.html';
                return;
            }

            if (!isAdminMock && currentRole === 'host') {
                if(!confirm("ルームを退出すると配信が終了します。よろしいですか？")) {
                    return;
                }
            }
            
            isLeaving = true;
            stopMicAnalysis();

            if (!isAdminMock) {
                if (currentRole === 'host') {
                    await endLiveCast();
                } else {
                    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentRoomId, 'participants', currentUser.uid));
                    closeModalUI();
                }
            } else {
                closeModalUI();
            }
        };

        window.endLiveCast = async () => {
            if(!isAdminMock) {
                try {
                    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', currentRoomId);
                    const roomSnap = await getDoc(roomRef);
                    
                    if (roomSnap.exists()) {
                        const roomData = roomSnap.data();
                        
                        await updateDoc(roomRef, { status: 'ended' });

                        if (roomData.isRecord) {
                            const podcastData = {
                                authorId: roomData.hostId,
                                authorName: roomData.hostName,
                                authorIcon: roomData.hostIcon,
                                sourceType: 'live_archive', 
                                audioUrl: '', 
                                isEmbed: false,
                                thumbnailUrl: roomData.thumbUrl || null,
                                title: roomData.title,
                                description: roomData.desc || 'この配信は SIGNAL CAST（ライブ配信） のアーカイブです。',
                                relatedArticleUrls: roomData.relatedArticleUrls || [],
                                guests: roomData.guestsStr ? roomData.guestsStr.split(',').map(s=>s.trim()).filter(s=>s) : [],
                                tags: roomData.tags || [],
                                allowComments: true, 
                                duration: 0, 
                                createdAt: roomData.startedAt || serverTimestamp(),
                                updatedAt: serverTimestamp()
                            };
                            
                            const newPodcastRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'podcasts'));
                            await setDoc(newPodcastRef, podcastData);
                            
                            alert('配信が終了しました。\nアーカイブ設定がONのため、ポッドキャストとして自動投稿されました。\n※音声ファイルはご自身で録音したものをマイページからアップロードしてください。');
                        }
                    }

                    await deleteDoc(roomRef);
                } catch(e){ console.error(e); }
            } else {
                alert('【テスト】配信が終了しました。アーカイブ設定ONの場合はポッドキャストに保存されます。');
            }
            closeModalUI();
        };

        async function closeModalUI() {
            if(roomUnsubscribe) roomUnsubscribe();
            if(partsUnsubscribe) partsUnsubscribe();
            if(commentsUnsubscribe) commentsUnsubscribe();
            await disconnectLiveKit(); 
            
            if(isMiniPlayer) toggleMiniPlayer(); 
            document.getElementById('live-cast-modal').classList.add('hidden');
            document.body.style.overflow = '';
            
            // ★修正: 遷移先のユーザーIDを保存しておく
            const returnUid = currentRoomId || (currentUser ? currentUser.uid : null);
            
            currentRoomId = null;
            currentRole = 'none';
            isLeaving = false; 
            
            // ★修正: 履歴で戻るのではなく、明示的にプロフィール（またはホーム）へ遷移させる
            if (returnUid) {
                window.location.href = `user_contents.html?uid=${returnUid}`;
            } else {
                window.location.href = 'home.html';
            }
        }

        function setupMockLiveUI() {
            updateLiveUI([
                { uid: currentUser.uid, name: 'ホスト(あなた)', role: 'host', isSpeaking: true },
                { uid: 'u1', name: 'ゲストA', role: 'speaker', isSpeaking: false }
            ], [
                { uid: 'u2', name: 'リスナー太郎', role: 'listener', handRaised: true }
            ]);
        }