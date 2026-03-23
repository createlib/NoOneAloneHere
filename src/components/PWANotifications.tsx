'use client';

import { useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function PWANotifications() {
    const { user } = useAuth();

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            Notification.requestPermission().catch(console.warn);
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        
        let initialLoad = true;
        const q = query(
            collection(db, 'artifacts', APP_ID, 'users', user.uid, 'notifications'), 
            where('isRead', '==', false)
        );
        
        const unsub = onSnapshot(q, (snapshot) => {
            // Web App Badge capability
            if (typeof navigator !== 'undefined' && (navigator as any).setAppBadge) {
                (navigator as any).setAppBadge(snapshot.docs.length).catch(console.warn);
            }
            
            // Prevent spamming local pushes for existing unread items on first mount
            if (initialLoad) {
                initialLoad = false;
                return;
            }
            
            // Trigger raw HTML5 notifications on client device for new documents only
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    
                    // Fallback to title/body mapping for old formats
                    let nTitle = data.title;
                    let nBody = data.body;
                    
                    if (!nTitle || !nBody) {
                        if (data.type === 'live_start') {
                            nTitle = 'NOAH SIGNAL CAST';
                            nBody = 'フォローしているユーザーが配信を開始しました。';
                        } else if (data.type === 'new_podcast') {
                            nTitle = '新しい音声の配信';
                            nBody = 'フォローしているユーザーが音声を配信しました。';
                        } else if (data.type === 'new_video') {
                            nTitle = '新しい動画の公開';
                            nBody = 'フォローしているユーザーが動画を公開しました。';
                        } else if (data.type === 'follow') {
                            nTitle = '新しいフォロー';
                            nBody = '誰かがあなたをフォローしました。';
                        } else {
                            nTitle = 'NOAH';
                            nBody = '新しい通知があります';
                        }
                    }

                    // Only push if created within the last 15 seconds to avoid backlog flooding
                    if (data.createdAt && Date.now() - (typeof data.createdAt === 'number' ? data.createdAt : data.createdAt.toMillis()) < 15000) {
                        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                            const n = new Notification(nTitle, {
                                body: nBody,
                                icon: '/img/icon.png',
                                badge: '/img/icon.png',
                                tag: change.doc.id
                            });
                            
                            n.onclick = () => {
                                window.focus();
                                n.close();
                            };
                        }
                    }
                }
            });
        });
        
        return () => unsub();
    }, [user]);

    return null;
}
