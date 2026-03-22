'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, getDocs, doc, getDoc, updateDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Bell, BellOff, CheckDouble, UserPlus, Radio, Film, Podcast, Clock } from 'lucide-react';
import Link from 'next/link';

interface NotificationData {
    id: string;
    createdAt: Timestamp;
    fromUid?: string;
    isRead?: boolean;
    type?: string;
    contentId?: string;
    fromUser?: {
        name: string;
        photoURL: string;
    };
}

const DEFAULT_ICON = 'https://via.placeholder.com/150/f7f5f0/c8b9a6?text=U';

export default function NotificationsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const loadNotifications = async () => {
            try {
                const notifRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'notifications');
                const q = query(notifRef, orderBy('createdAt', 'desc'));
                const snap = await getDocs(q);
                
                if (snap.empty) {
                    setNotifications([]);
                    setIsLoadingData(false);
                    return;
                }

                const notifs: NotificationData[] = [];
                const userCache: Record<string, any> = {};

                const promises = snap.docs.map(async (d) => {
                    const data = d.data() as Partial<NotificationData>;
                    let fromUser = { name: '退会したユーザー', photoURL: DEFAULT_ICON };
                    
                    if (data.fromUid) {
                        if (!userCache[data.fromUid]) {
                            try {
                                const uSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', data.fromUid));
                                if (uSnap.exists()) {
                                    userCache[data.fromUid] = uSnap.data();
                                }
                            } catch(e) {}
                        }
                        if (userCache[data.fromUid]) {
                            fromUser = {
                                name: userCache[data.fromUid].name || '名無し',
                                photoURL: userCache[data.fromUid].photoURL || DEFAULT_ICON
                            };
                        }
                    }

                    notifs.push({
                        id: d.id,
                        fromUser,
                        createdAt: data.createdAt || Timestamp.now(),
                        fromUid: data.fromUid,
                        isRead: data.isRead || false,
                        type: data.type || 'unknown',
                        contentId: data.contentId
                    });
                });

                await Promise.all(promises);
                
                notifs.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
                setNotifications(notifs);

            } catch (e) {
                console.error(e);
            } finally {
                setIsLoadingData(false);
            }
        };

        loadNotifications();
    }, [user, loading, router]);

    const markAsRead = async (notifId: string) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'notifications', notifId), {
                isRead: true
            });
            setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
        } catch (e) { console.error(e); }
    };

    const markAllAsRead = async () => {
        if (!user || notifications.length === 0) return;
        
        try {
            const batch = writeBatch(db);
            let hasUnread = false;
            
            const updatedNotifs = notifications.map(n => {
                if (!n.isRead) {
                    const ref = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'notifications', n.id);
                    batch.update(ref, { isRead: true });
                    hasUnread = true;
                    return { ...n, isRead: true };
                }
                return n;
            });
            
            if (hasUnread) {
                await batch.commit();
                setNotifications(updatedNotifs);
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (loading || isLoadingData) {
        return (
            <div className="min-h-screen bg-texture flex items-center justify-center">
                <div className="text-brand-400 font-bold tracking-widest text-sm animate-pulse">
                    通知を読み込み中...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-texture">
            <nav className="glass-header border-b border-brand-200 fixed w-full z-[1500] top-0 h-16 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
                    <button onClick={() => router.back()} className="text-brand-500 hover:text-brand-800 transition-colors flex items-center gap-2 text-sm font-bold tracking-widest">
                        <ArrowLeft size={16} /> <span className="hidden sm:inline">戻る</span>
                    </button>
                    <div className="font-serif font-bold text-brand-900 tracking-widest text-base sm:text-lg flex items-center gap-2">
                        <Bell className="w-5 h-5 text-[#b8860b]" /> 通知
                    </div>
                    <div className="w-8 sm:w-16"></div>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto pt-24 px-4 sm:px-6 pb-20">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-xl font-bold text-brand-900 font-serif tracking-widest">お知らせ・通知</h1>
                    <button onClick={markAllAsRead} className="text-xs text-brand-500 hover:text-brand-800 font-bold tracking-widest transition-colors flex items-center gap-1 bg-[#fffdf9] px-3 py-1.5 rounded-sm border border-brand-200 shadow-sm">
                        <CheckDouble size={14} /> すべて既読にする
                    </button>
                </div>
                
                <div className="space-y-3">
                    {notifications.length === 0 ? (
                        <div className="text-center py-16 text-brand-400 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200 text-sm tracking-widest font-bold">
                            <BellOff className="w-10 h-10 mx-auto mb-4 text-brand-200 opacity-50" />
                            新しい通知はありません
                        </div>
                    ) : (
                        notifications.map(n => {
                            const date = n.createdAt ? new Date(n.createdAt.toMillis()) : new Date();
                            const dateStr = `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
                            
                            const isRead = n.isRead;
                            const bgClass = isRead ? 'bg-[#fffdf9]' : 'bg-brand-50 border-[#b8860b]/50 shadow-md';
                            
                            let IconComponent = Bell;
                            let htmlContent = <></>;
                            let linkUrl = '#';
                            let iconColor = 'text-brand-400';
                            let iconCircleBg = 'bg-[#fffdf9] border-brand-200';

                            if (n.type === 'follow') {
                                IconComponent = UserPlus;
                                iconColor = 'text-brand-500';
                                htmlContent = <><span className="font-bold text-brand-900">{n.fromUser?.name}</span> さんがあなたをフォローしました。</>;
                                linkUrl = `/user/${n.fromUid}`;
                            } else if (n.type === 'live_start') {
                                IconComponent = Radio;
                                iconColor = 'text-[#f7f5f0] animate-pulse';
                                iconCircleBg = 'bg-red-600 border-red-800';
                                htmlContent = <><span className="font-bold text-brand-900">{n.fromUser?.name}</span> さんが <span className="text-red-600 font-bold bg-red-50 px-1 rounded-sm border border-red-200">SIGNAL CAST</span> の配信を開始しました！</>;
                                linkUrl = `/live?roomId=${n.contentId}`;
                            } else if (n.type === 'new_video') {
                                IconComponent = Film;
                                iconColor = 'text-brand-500';
                                htmlContent = <><span className="font-bold text-brand-900">{n.fromUser?.name}</span> さんが新しい <span className="font-bold">動画</span> を投稿しました。</>;
                                linkUrl = `/media/videos/${n.contentId}`;
                            } else if (n.type === 'new_podcast') {
                                IconComponent = Podcast;
                                iconColor = 'text-[#b8860b]';
                                htmlContent = <><span className="font-bold text-brand-900">{n.fromUser?.name}</span> さんが新しい <span className="font-bold">音声</span> を配信しました。</>;
                                linkUrl = `/media/podcasts/${n.contentId}`;
                            } else {
                                htmlContent = <>新しい通知があります。</>;
                            }

                            return (
                                <Link href={linkUrl} key={n.id} onClick={() => markAsRead(n.id)} className="block relative group">
                                    {!isRead && (
                                        <div className="absolute top-1/2 -left-1.5 transform -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full border-2 border-[#f7f5f0] shadow-sm z-10"></div>
                                    )}
                                    <div className={`${bgClass} border border-brand-200 rounded-sm p-4 flex items-start gap-4 hover:shadow-lg transition-all group-hover:border-brand-400 relative`}>
                                        <div className="relative w-12 h-12 flex-shrink-0 mt-0.5">
                                            <img src={n.fromUser?.photoURL || DEFAULT_ICON} className="w-12 h-12 rounded-full object-cover border border-brand-200 shadow-sm" alt="User Icon" />
                                            <div className={`absolute -bottom-1 -right-1 w-6 h-6 ${iconCircleBg} rounded-full border flex items-center justify-center shadow-sm`}>
                                                <IconComponent className={`w-3 h-3 ${iconColor}`} />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0 pt-0.5">
                                            <p className="text-sm text-brand-800 leading-relaxed tracking-wide mb-1.5">{htmlContent}</p>
                                            <p className="text-[10px] text-brand-400 font-mono tracking-widest flex items-center gap-1">
                                                <Clock size={10} /> {dateStr}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
            </main>
        </div>
    );
}
