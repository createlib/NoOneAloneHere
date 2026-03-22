import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        // ★修正: addDoc と serverTimestamp を追加インポート
        import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
        import { getStorage, ref, uploadBytesResumable, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

        let currentUser = null;
        let myData = null;
        let isAdmin = false;
        
        let videoInputType = 'url'; 
        let currentVideoFile = null;
        let currentThumbFile = null;
        
        let parsedVideoUrl = '';
        let isEmbedMode = false;

        const urlParams = new URLSearchParams(window.location.search);
        const editVid = urlParams.get('vid');

        const isAdminMock = localStorage.getItem('isAdminMock') === 'true';

        onAuthStateChanged(auth, async (user) => {
            if(isAdminMock) {
                currentUser = { uid: 'test_admin_uid' };
                isAdmin = true;
                myData = { name: '管理者', photoURL: '' };
                document.getElementById('admin-override-section').classList.remove('hidden');
                if(editVid) loadEditData();
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
                            alert("動画の投稿はSETTLER以上の会員のみ可能です。");
                            window.location.href = 'upgrade.html';
                        }
                    }
                } catch(e){}
                
                if(editVid) loadEditData();
            } else {
                window.location.href = 'login.html';
            }
        });

        window.switchVideoType = (type) => {
            if (type === 'upload' && !editVid && !isAdminMock && !isAdmin) {
                alert('動画ファイルの直接アップロード機能は現在準備中です。\nYouTube等の「URLを指定」機能をご利用ください。');
                return;
            }

            videoInputType = type;
            const btnUpload = document.getElementById('tab-upload');
            const btnUrl = document.getElementById('tab-url');
            const areaUpload = document.getElementById('video-upload-area');
            const areaUrl = document.getElementById('video-url-area');
            const playerContainer = document.getElementById('video-preview-container');
            const player = document.getElementById('video-player');
            const embedPlayer = document.getElementById('embed-player');

            playerContainer.classList.add('hidden');
            player.src = '';
            embedPlayer.src = '';
            currentVideoFile = null;
            parsedVideoUrl = '';
            isEmbedMode = false;
            
            document.getElementById('video-file').value = '';
            document.getElementById('video-url').value = '';

            if (type === 'upload') {
                btnUpload.className = 'tab-btn active pb-2 border-b-2 text-sm tracking-widest transition-colors flex items-center gap-1.5';
                btnUrl.className = 'tab-btn pb-2 border-b-2 border-transparent text-brand-400 hover:text-brand-600 text-sm tracking-widest transition-colors';
                areaUpload.classList.remove('hidden');
                areaUrl.classList.add('hidden');
            } else {
                btnUrl.className = 'tab-btn active pb-2 border-b-2 text-sm tracking-widest transition-colors';
                btnUpload.className = 'tab-btn pb-2 border-b-2 border-transparent text-brand-400 hover:text-brand-600 text-sm tracking-widest transition-colors flex items-center gap-1.5';
                areaUrl.classList.remove('hidden');
                areaUpload.classList.add('hidden');
            }
        };

        function parseVideoUrl(url) {
            let embedUrl = null;
            let isEmbed = false;
            let thumbUrl = null;

            if (!url) return { isEmbed: false, url: '', thumbUrl: null };

            const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
            if (ytMatch && ytMatch[1]) {
                embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
                thumbUrl = `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
                isEmbed = true;
            }
            else if (url.includes('vimeo.com')) {
                const vimeoMatch = url.match(/(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:[a-zA-Z0-9_\-]+)?/i);
                if (vimeoMatch && vimeoMatch[1]) {
                    embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
                    isEmbed = true;
                }
            } 
            else if (url.includes('drive.google.com/file/d/')) {
                const match = url.match(/d\/([a-zA-Z0-9_-]+)/);
                if (match) {
                    embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
                    isEmbed = true;
                }
            }

            return { isEmbed, url: isEmbed ? embedUrl : url, thumbUrl };
        }

        window.previewVideoUpload = (input) => {
            const file = input.files[0];
            if (file) {
                currentVideoFile = file;
                const url = URL.createObjectURL(file);
                const player = document.getElementById('video-player');
                const embedPlayer = document.getElementById('embed-player');
                
                isEmbedMode = false;
                embedPlayer.classList.add('hidden');
                
                player.src = url;
                player.classList.remove('hidden');
                document.getElementById('video-preview-container').classList.remove('hidden');
            }
        };

        window.previewVideoUrl = (url) => {
            const container = document.getElementById('video-preview-container');
            const videoPlayer = document.getElementById('video-player');
            const embedPlayer = document.getElementById('embed-player');

            if (url) {
                const parsed = parseVideoUrl(url);
                parsedVideoUrl = parsed.url;
                isEmbedMode = parsed.isEmbed;
                
                container.classList.remove('hidden');

                if (isEmbedMode) {
                    videoPlayer.classList.add('hidden');
                    videoPlayer.src = '';
                    embedPlayer.src = parsedVideoUrl;
                    embedPlayer.classList.remove('hidden');
                    
                    if (parsed.thumbUrl && !currentThumbFile) {
                        const img = document.getElementById('thumb-preview');
                        img.src = parsed.thumbUrl;
                        img.classList.remove('hidden');
                        document.getElementById('thumb-placeholder').classList.add('hidden');
                    }
                } else {
                    embedPlayer.classList.add('hidden');
                    embedPlayer.src = '';
                    videoPlayer.src = parsedVideoUrl;
                    videoPlayer.classList.remove('hidden');
                }
            } else {
                container.classList.add('hidden');
                parsedVideoUrl = '';
                isEmbedMode = false;
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
                const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', editVid));
                if(snap.exists()) {
                    const data = snap.data();
                    if(data.authorId !== currentUser.uid && !isAdmin) {
                        alert("編集権限がありません");
                        window.location.href = 'videos.html';
                        return;
                    }
                    
                    document.getElementById('title').value = data.title || '';
                    document.getElementById('description').value = data.description || '';
                    
                    if (data.sourceType === 'url' || data.embedUrl) {
                        switchVideoType('url');
                        document.getElementById('video-url').value = data.sourceUrl || data.embedUrl || '';
                        previewVideoUrl(data.sourceUrl || data.embedUrl);
                    } else {
                        switchVideoType('upload');
                        document.getElementById('video-preview-container').classList.remove('hidden');
                        document.getElementById('embed-player').classList.add('hidden');
                        const player = document.getElementById('video-player');
                        player.src = data.sourceUrl || '';
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

        window.saveVideo = async (e) => {
            e.preventDefault();
            
            const title = document.getElementById('title').value.trim();
            let finalVideoUrl = '';
            let finalThumbUrl = '';
            let finalEmbedUrl = '';

            if (!editVid) {
                if (videoInputType === 'upload' && !currentVideoFile && !isAdminMock) {
                    return alert('動画ファイルを選択してください');
                }
                if (videoInputType === 'url' && !document.getElementById('video-url').value.trim() && !isAdminMock) {
                    return alert('動画のURLを入力してください');
                }
            }

            if (videoInputType === 'upload' && currentVideoFile) {
                const maxSize = 100 * 1024 * 1024; // 100MB制限
                if (currentVideoFile.size > maxSize) {
                    return alert(`動画ファイルが大きすぎます (上限100MB)\n現在のサイズ: ${(currentVideoFile.size / 1024 / 1024).toFixed(1)}MB`);
                }
            }
            if (currentThumbFile) {
                const maxThumbSize = 5 * 1024 * 1024; // 5MB制限
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
                progressText.textContent = 'アップロードの準備中...';
            }

            try {
                // 1. Video Upload
                if (videoInputType === 'upload' && currentVideoFile && !isAdminMock) {
                    const storageRef = ref(storage, `videos/video/${currentUser.uid}/${Date.now()}_${currentVideoFile.name}`);
                    const uploadTask = uploadBytesResumable(storageRef, currentVideoFile);
                    
                    await new Promise((resolve, reject) => {
                        uploadTask.on('state_changed', 
                            (snapshot) => {
                                const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 75; 
                                progressBar.style.width = (5 + p) + '%';
                                progressText.textContent = `動画をアップロード中... (${Math.floor(5 + p)}%)`;
                            }, 
                            (error) => {
                                console.error("Video Upload Error:", error);
                                reject(new Error(`動画のアップロードに失敗: ${error.message}`));
                            }, 
                            async () => {
                                try {
                                    finalVideoUrl = await getDownloadURL(uploadTask.snapshot.ref);
                                    resolve();
                                } catch(err) {
                                    reject(new Error("動画URLの取得に失敗しました"));
                                }
                            }
                        );
                    });
                } else if (videoInputType === 'url') {
                    const rawUrl = document.getElementById('video-url').value.trim();
                    const parsed = parseVideoUrl(rawUrl);
                    finalVideoUrl = rawUrl; 
                    finalEmbedUrl = parsed.url; 
                    isEmbedMode = parsed.isEmbed;
                    
                    if (!currentThumbFile && parsed.thumbUrl) {
                        finalThumbUrl = parsed.thumbUrl;
                    }
                }

                // ★修正: サムネイル画像は「一括アップロード」に変更してフリーズを回避
                if (currentThumbFile && !isAdminMock) {
                    progressBar.style.width = '80%';
                    progressText.textContent = '画像をアップロード中...';
                    
                    try {
                        const thumbRef = ref(storage, `videos/thumbnails/${currentUser.uid}/${Date.now()}_${currentThumbFile.name}`);
                        const snap = await uploadBytes(thumbRef, currentThumbFile);
                        finalThumbUrl = await getDownloadURL(snap.ref);
                        progressBar.style.width = '95%';
                    } catch (err) {
                        console.error("Thumb Upload Error:", err);
                        throw new Error(`画像のアップロードに失敗: ${err.message}`);
                    }
                }

                if (editVid && !isAdminMock) {
                    const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', editVid));
                    if(snap.exists()) {
                        const oldData = snap.data();
                        if (!finalVideoUrl && !finalEmbedUrl) {
                            finalVideoUrl = oldData.sourceUrl || '';
                            finalEmbedUrl = oldData.embedUrl || '';
                            isEmbedMode = !!oldData.embedUrl;
                        }
                        if (!finalThumbUrl) finalThumbUrl = oldData.thumbnailUrl;
                    }
                }

                progressBar.style.width = '100%';
                progressText.textContent = 'データを保存しています...';

                // ★修正: myData が null の場合でもエラーにならないように安全に処理
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
                            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up text-xl"></i> 動画を公開する';
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
                        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up text-xl"></i> 動画を公開する';
                        btn.disabled = false;
                        modal.classList.add('hidden');
                        return;
                    }
                }

                const desc = document.getElementById('description').value;
                const allowComments = document.querySelector('input[name="allowComments"]:checked').value === 'true';

                const checkedTags = Array.from(document.querySelectorAll('.tag-cb:checked')).map(cb => cb.value);
                const customTags = document.getElementById('custom-tags').value.split(',').map(t=>t.trim()).filter(t=>t);
                const tags = [...new Set([...checkedTags, ...customTags])];

                const docId = editVid || Date.now().toString();
                const videoData = {
                    authorId: finalAuthorId,
                    authorName: finalAuthorName,
                    authorIcon: finalAuthorIcon,
                    sourceType: videoInputType,
                    sourceUrl: finalVideoUrl || (isAdminMock ? 'dummy_video.mp4' : ''),
                    embedUrl: isEmbedMode ? finalEmbedUrl : '', 
                    thumbnailUrl: finalThumbUrl || null,
                    title: title,
                    description: desc,
                    tags: tags,
                    allowComments: allowComments,
                    updatedAt: new Date().toISOString()
                };

                if(!editVid) videoData.createdAt = videoData.updatedAt;

                if(isAdminMock) {
                    alert(`保存成功(テスト)\n※代理ID: ${overrideUserId || 'なし'}`);
                    window.location.href = 'videos.html';
                    return;
                }

                const vidRef = doc(db, 'artifacts', appId, 'public', 'data', 'videos', docId);
                await setDoc(vidRef, videoData, { merge: true });
                
                // ★追加: 新規投稿の場合、フォロワーに通知を送る
                if (!editVid) {
                    try {
                        const followersSnap = await getDocs(collection(db, 'artifacts', appId, 'users', finalAuthorId, 'followers'));
                        const notifyPromises = [];
                        followersSnap.forEach(fDoc => {
                            const followerId = fDoc.id;
                            const notifRef = collection(db, 'artifacts', appId, 'users', followerId, 'notifications');
                            notifyPromises.push(addDoc(notifRef, {
                                type: 'new_video',
                                fromUid: finalAuthorId,
                                contentId: docId,
                                createdAt: serverTimestamp(),
                                isRead: false
                            }));
                        });
                        await Promise.all(notifyPromises);
                    } catch (notifyErr) {
                        console.error("Failed to send notifications:", notifyErr);
                    }
                }

                window.location.href = `video_detail.html?vid=${docId}`;
                
            } catch(error) {
                console.error(error);
                alert(`保存中にエラーが発生しました。\n${error.message}\n\n※通信環境やファイルのサイズをご確認ください。`);
                btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-2 text-xl"></i> 保存を再試行';
                btn.disabled = false;
                modal.classList.add('hidden');
                progressBar.style.width = '0%';
            }
        };