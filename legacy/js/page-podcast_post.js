import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        // ★修正: addDoc を追加インポート
        import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where, deleteDoc, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
        import { getStorage, ref, uploadBytesResumable, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

        let currentUser = null;
        let myData = null;
        let isAdmin = false;
        
        let audioInputType = 'upload'; // 'upload' | 'url' | 'live'
        let currentAudioFile = null;
        let currentThumbFile = null;
        let currentDuration = 0; 
        
        let parsedAudioUrl = '';
        let isEmbedMode = false;

        const urlParams = new URLSearchParams(window.location.search);
        const editPid = urlParams.get('pid');

        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';

        const rankLevels = { 'arrival': 0, 'settler': 1, 'builder': 2, 'guardian': 3, 'covenant': 4, 'admin': 99 };
        function getRankLevel(rank) { return rankLevels[rank] || 0; }
        const getVal = (id, def = '') => { const el = document.getElementById(id); if (!el) return def; return (el.value === undefined || el.value === null) ? def : el.value; };

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

        onAuthStateChanged(auth, async (user) => {
            if(isAdminMock) {
                currentUser = { uid: 'test_admin_uid' };
                isAdmin = true;
                myData = { name: '管理者', photoURL: '', membershipRank: 'admin' };
                document.getElementById('admin-override-section').classList.remove('hidden'); 
                checkLiveTabVisibility();
                if(editPid) loadEditData();
                return;
            }

            if (user && !user.isAnonymous) {
                currentUser = user;
                try {
                    const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));
                    if(snap.exists()) {
                        myData = snap.data();
                        const rank = myData.membershipRank || 'arrival';
                        
                        if(myData.userId === 'admin') {
                            isAdmin = true;
                            document.getElementById('admin-override-section').classList.remove('hidden');
                        }
                        
                        if(rank === 'arrival' && !isAdmin) {
                            alert("音声の配信はSETTLER以上の会員のみ可能です。");
                            window.location.href = 'upgrade.html';
                        }
                    }
                } catch(e){}
                
                checkLiveTabVisibility();
                if(editPid) loadEditData();
            } else {
                window.location.href = 'login.html';
            }
        });

        function checkLiveTabVisibility() {
            const btnLive = document.getElementById('tab-live');
            const rLevel = getRankLevel((myData?.membershipRank || 'arrival').toLowerCase());
            
            if ((rLevel >= 3 || isAdminMock || isAdmin) && !editPid) {
                btnLive.classList.remove('hidden');
                btnLive.classList.add('inline-flex');
            } else {
                btnLive.classList.add('hidden');
                btnLive.classList.remove('inline-flex');
            }
        }

        window.switchAudioType = (type) => {
            audioInputType = type;
            const btnUpload = document.getElementById('tab-upload');
            const btnUrl = document.getElementById('tab-url');
            const btnLive = document.getElementById('tab-live');
            
            const areaUpload = document.getElementById('audio-upload-area');
            const areaUrl = document.getElementById('audio-url-area');
            const playerContainer = document.getElementById('audio-preview-container');
            const liveSettingsArea = document.getElementById('live-settings-area');
            const commentsSettingArea = document.getElementById('comments-setting-area');
            const btnSave = document.getElementById('btn-save');

            playerContainer.classList.add('hidden');
            document.getElementById('audio-player').src = '';
            document.getElementById('embed-player').src = '';
            currentAudioFile = null;
            currentDuration = 0; 
            parsedAudioUrl = '';
            isEmbedMode = false;
            
            document.getElementById('audio-file').value = '';
            document.getElementById('audio-url').value = '';

            btnUpload.className = 'tab-btn pb-2 border-b-2 border-transparent text-brand-400 hover:text-brand-600 text-xs sm:text-sm tracking-widest transition-colors whitespace-nowrap';
            btnUrl.className = 'tab-btn pb-2 border-b-2 border-transparent text-brand-400 hover:text-brand-600 text-xs sm:text-sm tracking-widest transition-colors whitespace-nowrap';
            
            const baseLiveClass = 'tab-btn pb-2 border-b-2 border-transparent text-red-400 hover:text-red-600 text-xs sm:text-sm tracking-widest transition-colors whitespace-nowrap inline-flex items-center gap-1';
            btnLive.className = baseLiveClass;

            areaUpload.classList.add('hidden');
            areaUrl.classList.add('hidden');
            liveSettingsArea.classList.add('hidden');
            commentsSettingArea.classList.remove('hidden'); 

            if (type === 'upload') {
                btnUpload.className = 'tab-btn active pb-2 border-b-2 text-[#b8860b] border-[#b8860b] font-bold text-xs sm:text-sm tracking-widest transition-colors whitespace-nowrap';
                areaUpload.classList.remove('hidden');
                btnSave.innerHTML = '<i class="fa-solid fa-podcast text-xl"></i> 音声を配信する';
                btnSave.className = 'w-full py-4 bg-gradient-to-r from-[#2a1a17] to-[#3e2723] text-[#d4af37] font-bold text-lg rounded-sm hover:from-[#1a110f] hover:to-[#2a1a17] transition-all shadow-xl tracking-widest border border-[#b8860b] flex items-center justify-center gap-3 transform hover:-translate-y-0.5';
            } else if (type === 'url') {
                btnUrl.className = 'tab-btn active pb-2 border-b-2 text-[#b8860b] border-[#b8860b] font-bold text-xs sm:text-sm tracking-widest transition-colors whitespace-nowrap';
                areaUrl.classList.remove('hidden');
                btnSave.innerHTML = '<i class="fa-solid fa-podcast text-xl"></i> 音声を配信する';
                btnSave.className = 'w-full py-4 bg-gradient-to-r from-[#2a1a17] to-[#3e2723] text-[#d4af37] font-bold text-lg rounded-sm hover:from-[#1a110f] hover:to-[#2a1a17] transition-all shadow-xl tracking-widest border border-[#b8860b] flex items-center justify-center gap-3 transform hover:-translate-y-0.5';
            } else if (type === 'live') {
                btnLive.className = baseLiveClass + ' active text-red-600 border-red-600 font-bold';
                liveSettingsArea.classList.remove('hidden');
                commentsSettingArea.classList.add('hidden');
                btnSave.innerHTML = '<i class="fa-solid fa-satellite-dish animate-pulse text-xl"></i> ライブ配信を START する';
                btnSave.className = 'w-full py-4 bg-gradient-to-r from-[#3e2723] to-red-900 text-white font-bold text-lg rounded-sm hover:from-[#2a1a17] hover:to-red-800 transition-all shadow-xl tracking-widest border border-red-600 flex items-center justify-center gap-3 transform hover:-translate-y-0.5';
            }
            
            checkLiveTabVisibility(); 
        };

        function parsePodcastUrl(url) {
            let embedUrl = null;
            let isEmbed = false;

            if (!url) return { isEmbed: false, url: '' };

            if (url.includes('open.spotify.com/episode/')) {
                const match = url.match(/episode\/([a-zA-Z0-9]+)/);
                if (match) { embedUrl = `https://open.spotify.com/embed/episode/${match[1]}?utm_source=generator`; isEmbed = true; }
            } else if (url.includes('open.spotify.com/show/')) {
                const match = url.match(/show\/([a-zA-Z0-9]+)/);
                if (match) { embedUrl = `https://open.spotify.com/embed/show/${match[1]}?utm_source=generator`; isEmbed = true; }
            } 
            else if (url.includes('podcasts.apple.com')) {
                embedUrl = url.replace('podcasts.apple.com', 'embed.podcasts.apple.com');
                isEmbed = true;
            } 
            else if (url.includes('drive.google.com/file/d/')) {
                const match = url.match(/d\/([a-zA-Z0-9_-]+)/);
                if (match) { embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`; isEmbed = true; }
            }

            return { isEmbed, url: isEmbed ? embedUrl : url };
        }

        window.previewAudioUpload = (input) => {
            const file = input.files[0];
            if (file) {
                currentAudioFile = file;
                const url = URL.createObjectURL(file);
                const player = document.getElementById('audio-player');
                const embedPlayer = document.getElementById('embed-player');
                
                isEmbedMode = false;
                embedPlayer.classList.add('hidden');
                
                player.src = url;
                player.classList.remove('hidden');
                document.getElementById('audio-preview-container').classList.remove('hidden');
                
                player.onloadedmetadata = () => {
                    currentDuration = player.duration;
                };
            }
        };

        window.previewAudioUrl = (url) => {
            const container = document.getElementById('audio-preview-container');
            const audioPlayer = document.getElementById('audio-player');
            const embedPlayer = document.getElementById('embed-player');

            if (url) {
                const parsed = parsePodcastUrl(url);
                parsedAudioUrl = parsed.url;
                isEmbedMode = parsed.isEmbed;
                
                container.classList.remove('hidden');

                if (isEmbedMode) {
                    audioPlayer.classList.add('hidden');
                    audioPlayer.src = '';
                    embedPlayer.src = parsedAudioUrl;
                    embedPlayer.classList.remove('hidden');
                    currentDuration = 0; 
                } else {
                    embedPlayer.classList.add('hidden');
                    embedPlayer.src = '';
                    audioPlayer.src = parsedAudioUrl;
                    audioPlayer.classList.remove('hidden');
                    audioPlayer.onloadedmetadata = () => {
                        currentDuration = audioPlayer.duration;
                    };
                }
            } else {
                container.classList.add('hidden');
                parsedAudioUrl = '';
                isEmbedMode = false;
                currentDuration = 0;
            }
        };

        window.previewThumb = (input) => {
            const file = input.files[0];
            if (file) {
                currentThumbFile = file;
                const url = URL.createObjectURL(file);
                const img = document.getElementById('thumb-preview');
                img.src = url;
                img.classList.remove('hidden');
                document.getElementById('thumb-placeholder').classList.add('hidden');
            }
        };

        async function loadEditData() {
            if(isAdminMock) return; 
            try {
                const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'podcasts', editPid));
                if(snap.exists()) {
                    const data = snap.data();
                    if(data.authorId !== currentUser.uid && !isAdmin) {
                        alert("編集権限がありません");
                        window.location.href = 'podcasts.html';
                        return;
                    }
                    
                    document.getElementById('title').value = data.title || '';
                    document.getElementById('description').value = data.description || '';
                    document.getElementById('guests').value = data.guests ? data.guests.join(', ') : '';
                    
                    // ★修正: 関連記事データの読み込み (配列と文字列の両方に対応)
                    if (data.relatedArticleUrls && Array.isArray(data.relatedArticleUrls)) {
                        document.getElementById('related-article').value = data.relatedArticleUrls.join(', ');
                    } else if (data.relatedArticleUrl) {
                        document.getElementById('related-article').value = data.relatedArticleUrl;
                    } else {
                        document.getElementById('related-article').value = '';
                    }
                    
                    currentDuration = data.duration || 0;
                    
                    if (data.sourceType === 'url') {
                        switchAudioType('url');
                        document.getElementById('audio-url').value = data.audioUrl || '';
                        previewAudioUrl(data.audioUrl);
                    } else {
                        switchAudioType('upload');
                        document.getElementById('audio-preview-container').classList.remove('hidden');
                        document.getElementById('embed-player').classList.add('hidden');
                        const player = document.getElementById('audio-player');
                        player.src = data.audioUrl || '';
                        player.classList.remove('hidden');
                    }

                    if (data.thumbnailUrl) {
                        const img = document.getElementById('thumb-preview');
                        img.src = data.thumbnailUrl;
                        img.classList.remove('hidden');
                        document.getElementById('thumb-placeholder').classList.add('hidden');
                    }

                    if(data.allowComments === false) {
                        document.querySelector('input[name="allowComments"][value="false"]').checked = true;
                    }

                    const allTags = data.tags || [];
                    document.querySelectorAll('.tag-cb').forEach(cb => {
                        if(allTags.includes(cb.value)) { cb.checked = true; }
                    });
                    const presetValues = Array.from(document.querySelectorAll('.tag-cb')).map(cb=>cb.value);
                    const customTags = allTags.filter(t => !presetValues.includes(t));
                    document.getElementById('custom-tags').value = customTags.join(', ');

                    document.getElementById('btn-save').innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-2 text-xl"></i> 編集を保存する';
                }
            } catch(e){}
        }

        window.savePodcast = async (e) => {
            e.preventDefault();
            
            const title = document.getElementById('title').value.trim();
            let finalAudioUrl = '';
            let finalThumbUrl = '';

            if (audioInputType !== 'live' && !editPid) {
                if (audioInputType === 'upload' && !currentAudioFile && !isAdminMock) {
                    return alert('音声ファイルを選択してください');
                }
                if (audioInputType === 'url' && !document.getElementById('audio-url').value.trim() && !isAdminMock) {
                    return alert('音声のURLを入力してください');
                }
            }

            if (audioInputType === 'upload' && currentAudioFile) {
                const maxSize = 30 * 1024 * 1024; 
                if (currentAudioFile.size > maxSize) {
                    return alert(`音声ファイルが大きすぎます (上限30MB)\n現在のサイズ: ${(currentAudioFile.size / 1024 / 1024).toFixed(1)}MB`);
                }
            }
            if (currentThumbFile) {
                const maxThumbSize = 5 * 1024 * 1024; 
                if (currentThumbFile.size > maxThumbSize) {
                    return alert(`画像サイズが大きすぎます (上限5MB)\n現在のサイズ: ${(currentThumbFile.size / 1024 / 1024).toFixed(1)}MB`);
                }
            }
            
            const btn = document.getElementById('btn-save');
            const modal = document.getElementById('progress-modal');
            const progressBar = document.getElementById('progress-bar');
            const progressText = document.getElementById('progress-text');
            
            btn.disabled = true;
            if (!isAdminMock) {
                modal.classList.remove('hidden');
                progressBar.style.width = '5%';
                progressText.textContent = audioInputType === 'live' ? '配信の準備中...' : 'アップロードの準備中...';
            }

            try {
                // --- LiveCast (生配信) の場合の処理 ---
                if (audioInputType === 'live') {
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
                            console.warn("古いデータの初期化エラー (無視して続行):", initErr);
                        }
                    }

                    // ★修正: サムネイル画像は「一括アップロード」に変更
                    if (currentThumbFile && !isAdminMock) {
                        try {
                            const thumbRef = ref(storage, `live_thumbs/${currentUser.uid}/${Date.now()}_${currentThumbFile.name}`);
                            const snap = await uploadBytes(thumbRef, currentThumbFile);
                            finalThumbUrl = await getDownloadURL(snap.ref);
                        } catch(err) {
                            console.warn("Thumbnail upload failed:", err);
                        }
                    }

                    // ★修正: myDataがnullでも安全に処理
                    let finalAuthorId = currentUser.uid;
                    let finalAuthorName = myData ? (myData.name || myData.userId) : '名無し';
                    let finalAuthorIcon = myData ? myData.photoURL : null;

                    const overrideUserIdInput = document.getElementById('override-userid');
                    const overrideUserId = overrideUserIdInput ? overrideUserIdInput.value.trim() : '';

                    if (isAdmin && overrideUserId && !isAdminMock) {
                        const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
                        const q = query(usersRef, where("userId", "==", overrideUserId));
                        const querySnapshot = await getDocs(q);
                        if (!querySnapshot.empty) {
                            const targetDoc = querySnapshot.docs[0];
                            finalAuthorId = targetDoc.id;
                            const tData = targetDoc.data();
                            finalAuthorName = tData.name || tData.userId;
                            finalAuthorIcon = tData.photoURL || null;
                        }
                    }

                    const checkedTags = Array.from(document.querySelectorAll('.tag-cb:checked')).map(cb => cb.value);
                    const customTags = document.getElementById('custom-tags').value.split(',').map(t=>t.trim()).filter(t=>t);
                    const tags = [...new Set([...checkedTags, ...customTags])];

                    const roomData = {
                        hostId: finalAuthorId,
                        hostName: finalAuthorName,
                        hostIcon: finalAuthorIcon,
                        title: title,
                        desc: document.getElementById('description').value,
                        guestsStr: document.getElementById('guests').value,
                        privacy: getVal('room-privacy'),
                        type: getVal('room-type'),
                        tags: tags,
                        isRecord: document.querySelector('input[name="roomRecord"]:checked').value === 'true',
                        thumbUrl: finalThumbUrl || null,
                        status: 'live',
                        startedAt: serverTimestamp()
                    };

                    if (!isAdminMock) {
                        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', finalAuthorId);
                        await setDoc(roomRef, roomData);

                        const partRef = doc(db, 'artifacts', appId, 'public', 'data', 'live_rooms', finalAuthorId, 'participants', finalAuthorId);
                        await setDoc(partRef, {
                            uid: finalAuthorId,
                            name: finalAuthorName,
                            icon: finalAuthorIcon,
                            role: 'host',
                            isMuted: false,
                            joinedAt: serverTimestamp()
                        });

                        // ★追加: フォロワーにライブ配信開始の通知を送る
                        try {
                            const followersSnap = await getDocs(collection(db, 'artifacts', appId, 'users', finalAuthorId, 'followers'));
                            const notifyPromises = [];
                            followersSnap.forEach(fDoc => {
                                const followerId = fDoc.id;
                                const notifRef = collection(db, 'artifacts', appId, 'users', followerId, 'notifications');
                                notifyPromises.push(addDoc(notifRef, {
                                    type: 'live_start',
                                    fromUid: finalAuthorId,
                                    contentId: finalAuthorId,
                                    createdAt: serverTimestamp(),
                                    isRead: false
                                }));
                            });
                            await Promise.all(notifyPromises);
                        } catch (notifyErr) {
                            console.error("Failed to send live notifications:", notifyErr);
                        }
                    }

                    window.location.href = `live_room.html?roomId=${finalAuthorId}`;
                    return;
                }

                // --- 通常の Podcast (録音) の場合の処理 ---
                
                // 1. Audio Upload
                if (audioInputType === 'upload' && currentAudioFile && !isAdminMock) {
                    const storageRef = ref(storage, `podcasts/audio/${currentUser.uid}/${Date.now()}_${currentAudioFile.name}`);
                    const uploadTask = uploadBytesResumable(storageRef, currentAudioFile);
                    
                    await new Promise((resolve, reject) => {
                        uploadTask.on('state_changed', 
                            (snapshot) => {
                                const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 75; 
                                progressBar.style.width = (5 + p) + '%';
                                progressText.textContent = `音声をアップロード中... (${Math.floor(5 + p)}%)`;
                            }, 
                            (error) => {
                                reject(new Error(`音声のアップロードに失敗: ${error.message}`));
                            }, 
                            async () => {
                                try {
                                    finalAudioUrl = await getDownloadURL(uploadTask.snapshot.ref);
                                    resolve();
                                } catch(err) {
                                    reject(new Error("音声URLの取得に失敗しました"));
                                }
                            }
                        );
                    });
                } else if (audioInputType === 'url') {
                    const rawUrl = document.getElementById('audio-url').value.trim();
                    const parsed = parsePodcastUrl(rawUrl);
                    finalAudioUrl = parsed.url;
                    isEmbedMode = parsed.isEmbed;
                }

                // ★修正: サムネイル画像は「一括アップロード」に変更
                if (currentThumbFile && !isAdminMock) {
                    progressBar.style.width = '80%';
                    progressText.textContent = '画像をアップロード中...';
                    
                    try {
                        const thumbRef = ref(storage, `podcasts/thumbnails/${currentUser.uid}/${Date.now()}_${currentThumbFile.name}`);
                        const snap = await uploadBytes(thumbRef, currentThumbFile);
                        finalThumbUrl = await getDownloadURL(snap.ref);
                        progressBar.style.width = '95%';
                    } catch (err) {
                        console.error("Thumb Upload Error:", err);
                        throw new Error(`画像のアップロードに失敗: ${err.message}`);
                    }
                }

                if (editPid && !isAdminMock) {
                    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'podcasts', editPid));
                    if(snap.exists()) {
                        const oldData = snap.data();
                        if (!finalAudioUrl) {
                            finalAudioUrl = oldData.audioUrl;
                            isEmbedMode = oldData.isEmbed || false;
                        }
                        if (!finalThumbUrl) finalThumbUrl = oldData.thumbnailUrl;
                    }
                }

                progressBar.style.width = '100%';
                progressText.textContent = 'データを保存しています...';

                // ★修正: myDataがnullでも安全に処理
                let finalAuthorId = currentUser.uid;
                let finalAuthorName = myData ? (myData.name || myData.userId) : '名無し';
                let finalAuthorIcon = myData ? myData.photoURL : null;

                const overrideUserIdInput = document.getElementById('override-userid');
                const overrideUserId = overrideUserIdInput ? overrideUserIdInput.value.trim() : '';

                if (isAdmin && overrideUserId && !isAdminMock) {
                    try {
                        const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
                        const q = query(usersRef, where("userId", "==", overrideUserId));
                        const querySnapshot = await getDocs(q);
                        
                        if (querySnapshot.empty) {
                            alert(`エラー: 指定されたユーザーID「@${overrideUserId}」は見つかりませんでした。\n正しいIDを指定するか、空欄にしてやり直してください。`);
                            btn.innerHTML = '<i class="fa-solid fa-podcast text-xl"></i> 音声を配信する';
                            btn.disabled = false;
                            modal.classList.add('hidden');
                            return;
                        }
                        
                        const targetDoc = querySnapshot.docs[0];
                        finalAuthorId = targetDoc.id;
                        const tData = targetDoc.data();
                        finalAuthorName = tData.name || tData.userId;
                        finalAuthorIcon = tData.photoURL || null;
                        
                    } catch (error) {
                        console.error("Override fetch error:", error);
                        alert("代理投稿ユーザーの取得中にエラーが発生しました。");
                        btn.innerHTML = '<i class="fa-solid fa-podcast text-xl"></i> 音声を配信する';
                        btn.disabled = false;
                        modal.classList.add('hidden');
                        return;
                    }
                }

                const desc = document.getElementById('description').value;
                const guestsStr = document.getElementById('guests').value.trim();
                const guests = guestsStr ? guestsStr.split(',').map(s=>s.trim()).filter(s=>s) : [];
                const allowComments = document.querySelector('input[name="allowComments"]:checked').value === 'true';
                
                // ★修正: 関連記事URLをカンマ区切りで配列化
                const relatedArticleInput = document.getElementById('related-article').value.trim();
                const relatedArticleUrls = relatedArticleInput ? relatedArticleInput.split(',').map(s=>s.trim()).filter(s=>s) : [];

                const checkedTags = Array.from(document.querySelectorAll('.tag-cb:checked')).map(cb => cb.value);
                const customTags = document.getElementById('custom-tags').value.split(',').map(t=>t.trim()).filter(t=>t);
                const tags = [...new Set([...checkedTags, ...customTags])];

                const docId = editPid || Date.now().toString();
                const podcastData = {
                    authorId: finalAuthorId,
                    authorName: finalAuthorName,
                    authorIcon: finalAuthorIcon,
                    sourceType: audioInputType,
                    audioUrl: finalAudioUrl || (isAdminMock ? 'dummy_audio.mp3' : ''),
                    isEmbed: isEmbedMode,
                    thumbnailUrl: finalThumbUrl || null,
                    title: title,
                    description: desc,
                    relatedArticleUrls: relatedArticleUrls, // ★配列で保存
                    guests: guests,
                    tags: tags,
                    allowComments: allowComments,
                    duration: currentDuration, 
                    updatedAt: new Date().toISOString()
                };

                if(!editPid) podcastData.createdAt = podcastData.updatedAt;

                if(isAdminMock) {
                    alert(`保存成功(テスト)\n※代理ID: ${overrideUserId || 'なし'}`);
                    window.location.href = 'podcasts.html';
                    return;
                }

                const pidRef = doc(db, 'artifacts', appId, 'public', 'data', 'podcasts', docId);
                await setDoc(pidRef, podcastData, { merge: true });
                
                // ★追加: 新規投稿の場合、フォロワーに通知を送る
                if (!editPid) {
                    try {
                        const followersSnap = await getDocs(collection(db, 'artifacts', appId, 'users', finalAuthorId, 'followers'));
                        const notifyPromises = [];
                        followersSnap.forEach(fDoc => {
                            const followerId = fDoc.id;
                            const notifRef = collection(db, 'artifacts', appId, 'users', followerId, 'notifications');
                            notifyPromises.push(addDoc(notifRef, {
                                type: 'new_podcast',
                                fromUid: finalAuthorId,
                                contentId: docId,
                                createdAt: serverTimestamp(),
                                isRead: false
                            }));
                        });
                        await Promise.all(notifyPromises);
                    } catch (notifyErr) {
                        console.error("Failed to send podcast notifications:", notifyErr);
                    }
                }

                window.location.href = `podcast_detail.html?pid=${docId}`;
                
            } catch(error) {
                console.error(error);
                alert(`処理中にエラーが発生しました。\n${error.message}`);
                btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-2 text-xl"></i> 保存を再試行';
                btn.disabled = false;
                modal.classList.add('hidden');
                progressBar.style.width = '0%';
            }
        };