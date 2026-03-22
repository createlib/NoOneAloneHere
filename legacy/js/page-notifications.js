import { app, auth, db, appId } from "./firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
        import { getFirestore, collection, getDocs, doc, getDoc, query, orderBy, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

        let currentUser = null;
        let notifications = [];

        const DEFAULT_ICON = 'https://via.placeholder.com/150/f7f5f0/c8b9a6?text=U';

        onAuthStateChanged(auth, async (user) => {
            if (user && !user.isAnonymous) {
                currentUser = user;
                loadNotifications();
            } else {
                window.location.href = 'login.html';
            }
        });

        async function loadNotifications() {
            try {
                const notifRef = collection(db, 'artifacts', appId, 'users', currentUser.uid, 'notifications');
                const q = query(notifRef, orderBy('createdAt', 'desc'));
                const snap = await getDocs(q);
                
                if (snap.empty) {
                    document.getElementById('notifications-list').innerHTML = '<div class="text-center py-16 text-brand-400 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200 text-sm tracking-widest font-bold"><i class="fa-regular fa-bell-slash text-4xl mb-4 text-brand-200 opacity-50 block"></i>新しい通知はありません</div>';
                    return;
                }

                notifications = [];
                const userCache = {};

                const promises = snap.docs.map(async (d) => {
                    const data = d.data();
                    let fromUser = { name: '退会したユーザー', photoURL: DEFAULT_ICON };
                    
                    if (data.fromUid) {
                        if (!userCache[data.fromUid]) {
                            try {
                                const uSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', data.fromUid));
                                if (uSnap.exists()) {
                                    userCache[data.fromUid] = uSnap.data();
                                }
                            } catch(e){}
                        }
                        if (userCache[data.fromUid]) {
                            fromUser = userCache[data.fromUid];
                        }
                    }

                    notifications.push({
                        id: d.id,
                        ...data,
                        fromUser
                    });
                });

                await Promise.all(promises);
                
                // 念のため作成日時の降順で再ソート
                notifications.sort((a, b) => {
                    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return tB - tA;
                });

                renderNotifications();

            } catch (e) {
                console.error(e);
                document.getElementById('notifications-list').innerHTML = '<div class="text-center py-10 text-red-500">読み込みに失敗しました</div>';
            }
        }

        function renderNotifications() {
            const list = document.getElementById('notifications-list');
            let html = '';

            notifications.forEach(n => {
                const date = n.createdAt ? new Date(n.createdAt.toMillis()) : new Date();
                const dateStr = `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
                
                const isRead = n.isRead;
                const bgClass = isRead ? 'bg-[#fffdf9]' : 'bg-brand-50 border-[#b8860b]/50 shadow-md';
                const dotHtml = isRead ? '' : '<div class="absolute top-1/2 -left-1.5 transform -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full border-2 border-[#f7f5f0] shadow-sm"></div>';
                
                let iconHtml = '';
                let textHtml = '';
                let linkUrl = '#';

                const userName = n.fromUser.name || n.fromUser.userId || '名無し';
                const userIcon = n.fromUser.photoURL || DEFAULT_ICON;

                if (n.type === 'follow') {
                    iconHtml = '<i class="fa-solid fa-user-plus text-brand-500"></i>';
                    textHtml = `<span class="font-bold text-brand-900">${userName}</span> さんがあなたをフォローしました。`;
                    linkUrl = `user.html?uid=${n.fromUid}`;
                } else if (n.type === 'live_start') {
                    iconHtml = '<i class="fa-solid fa-satellite-dish text-[#f7f5f0] animate-pulse"></i>';
                    const iconBg = 'bg-red-600 border-red-700'; // ライブ用特別カラー
                    textHtml = `<span class="font-bold text-brand-900">${userName}</span> さんが <span class="text-red-600 font-bold bg-red-50 px-1 rounded-sm border border-red-200">SIGNAL CAST</span> の配信を開始しました！`;
                    linkUrl = `live_room.html?roomId=${n.contentId}`;
                } else if (n.type === 'new_video') {
                    iconHtml = '<i class="fa-solid fa-film text-brand-500"></i>';
                    textHtml = `<span class="font-bold text-brand-900">${userName}</span> さんが新しい <span class="font-bold">動画</span> を投稿しました。`;
                    linkUrl = `video_detail.html?vid=${n.contentId}`;
                } else if (n.type === 'new_podcast') {
                    iconHtml = '<i class="fa-solid fa-podcast text-[#b8860b]"></i>';
                    textHtml = `<span class="font-bold text-brand-900">${userName}</span> さんが新しい <span class="font-bold">音声</span> を配信しました。`;
                    linkUrl = `podcast_detail.html?pid=${n.contentId}`;
                } else {
                    iconHtml = '<i class="fa-solid fa-bell text-brand-400"></i>';
                    textHtml = '新しい通知があります。';
                }

                // アイコン背景のデフォルト（ライブ以外）
                const defaultIconBg = n.type === 'live_start' ? 'bg-red-600 border-red-800' : 'bg-[#fffdf9] border-brand-200';

                html += `
                <a href="${linkUrl}" onclick="markAsRead('${n.id}')" class="block relative group">
                    ${dotHtml}
                    <div class="${bgClass} border border-brand-200 rounded-sm p-4 flex items-start gap-4 hover:shadow-lg transition-all group-hover:border-brand-400">
                        <div class="relative w-12 h-12 flex-shrink-0 mt-0.5">
                            <img src="${userIcon}" class="w-12 h-12 rounded-full object-cover border border-brand-200 shadow-sm" onerror="this.src='${DEFAULT_ICON}'">
                            <div class="absolute -bottom-1 -right-1 w-6 h-6 ${defaultIconBg} rounded-full border flex items-center justify-center text-[10px] shadow-sm">
                                ${iconHtml}
                            </div>
                        </div>
                        <div class="flex-1 min-w-0 pt-0.5">
                            <p class="text-sm text-brand-800 leading-relaxed tracking-wide mb-1.5">${textHtml}</p>
                            <p class="text-[10px] text-brand-400 font-mono tracking-widest"><i class="fa-regular fa-clock mr-1"></i>${dateStr}</p>
                        </div>
                    </div>
                </a>
                `;
            });

            list.innerHTML = html;
        }

        window.markAsRead = async (notifId) => {
            if (!currentUser) return;
            try {
                await updateDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'notifications', notifId), {
                    isRead: true
                });
            } catch (e) { console.error(e); }
        };

        window.markAllAsRead = async () => {
            if (!currentUser || notifications.length === 0) return;
            
            try {
                const batch = writeBatch(db);
                let hasUnread = false;
                
                notifications.forEach(n => {
                    if (!n.isRead) {
                        const ref = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'notifications', n.id);
                        batch.update(ref, { isRead: true });
                        n.isRead = true;
                        hasUnread = true;
                    }
                });
                
                if (hasUnread) {
                    await batch.commit();
                    renderNotifications();
                }
            } catch (e) {
                console.error(e);
            }
        };