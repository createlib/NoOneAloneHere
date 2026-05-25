'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, getDocs, doc, getDoc, updateDoc, writeBatch, Timestamp, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Bell, BellOff, CheckCheck, UserPlus, Radio, Film, Podcast, Clock } from 'lucide-react';
import Link from 'next/link';

// ── Design tokens ──────────────────────────────────────────────────────────────
const SB   = '#1a3024';
const SAGE = '#4a7c59';
const LIME = '#8ecfb2';
const BG   = '#f5f3f0';
const T1   = '#2a2520';
const T2   = '#7a7068';
const TM   = '#ada49c';
const NEU_UP = '6px 6px 14px rgba(0,0,0,.09),-6px -6px 14px rgba(255,255,255,.85)';
const NEU_SM = '3px 3px 8px rgba(0,0,0,.07),-3px -3px 8px rgba(255,255,255,.8)';

interface NotificationData {
    id: string;
    createdAt: Timestamp;
    fromUid?: string;
    isRead?: boolean;
    type?: string;
    contentId?: string;
    title?: string;
    body?: string;
    link?: string;
    fromUser?: { name: string; photoURL: string; };
}

const DEFAULT_ICON = 'https://via.placeholder.com/150/f7f5f0/c8b9a6?text=U';

// Safely convert any createdAt value to milliseconds
function toMillisafe(val: any): number {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis(); // Firestore Timestamp
    if (typeof val === 'number') return val;                        // Date.now() stored as number
    if (typeof val === 'string') return new Date(val).getTime();    // ISO string
    if (val.seconds !== undefined) return val.seconds * 1000;       // plain {seconds, nanoseconds}
    return 0;
}

// ── FollowBack button ──────────────────────────────────────────────────────────
function FollowBackButton({ targetUid, currentUid }: { targetUid: string; currentUid: string }) {
    const [isFollowing, setIsFollowing] = useState(false);
    useEffect(() => {
        if (!targetUid || !currentUid) return;
        getDoc(doc(db, 'artifacts', APP_ID, 'users', currentUid, 'following', targetUid))
            .then(snap => setIsFollowing(snap.exists()));
    }, [targetUid, currentUid]);

    const handleFollow = async (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (isFollowing) return;
        try {
            const ts = serverTimestamp();
            await setDoc(doc(db, 'artifacts', APP_ID, 'users', currentUid, 'following', targetUid), { createdAt: ts });
            await setDoc(doc(db, 'artifacts', APP_ID, 'users', targetUid, 'followers', currentUid), { createdAt: ts });
            setIsFollowing(true);
        } catch(e) { console.error(e); }
    };

    if (isFollowing) {
        return (
            <span style={{
                display:'inline-flex',alignItems:'center',gap:4,marginTop:6,
                fontSize:10,fontWeight:700,color:SAGE,letterSpacing:'.06em',
                padding:'4px 8px',borderRadius:6,background:'rgba(74,124,89,.08)',
                border:`1px solid rgba(74,124,89,.2)`,
            }}>
                <CheckCheck size={10}/> フォロー中
            </span>
        );
    }
    return (
        <button onClick={handleFollow} style={{
            display:'inline-flex',alignItems:'center',gap:4,marginTop:6,
            fontSize:10,fontWeight:700,color:'#fff',letterSpacing:'.06em',
            padding:'5px 10px',borderRadius:6,background:SAGE,border:'none',cursor:'pointer',
            boxShadow:'0 2px 8px rgba(74,124,89,.3)',transition:'opacity .15s',
        }}>
            <UserPlus size={10}/> フォローバック
        </button>
    );
}

// ── Type-based config ──────────────────────────────────────────────────────────
function getTypeConfig(type: string) {
    switch(type) {
        case 'follow':
            return { icon: UserPlus, iconBg: SAGE, iconColor: '#fff', accent: SAGE };
        case 'live_start':
            return { icon: Radio, iconBg: '#ef4444', iconColor: '#fff', accent: '#ef4444' };
        case 'new_video':
            return { icon: Film, iconBg: '#6366f1', iconColor: '#fff', accent: '#6366f1' };
        case 'new_podcast':
            return { icon: Podcast, iconBg: '#d97706', iconColor: '#fff', accent: '#d97706' };
        default:
            return { icon: Bell, iconBg: '#64748b', iconColor: '#fff', accent: '#64748b' };
    }
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    useEffect(() => {
        if (loading) return;
        if (!user) { router.push('/login'); return; }

        const loadNotifications = async () => {
            try {
                const notifRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'notifications');
                const snap = await getDocs(query(notifRef, orderBy('createdAt', 'desc')));
                if (snap.empty) { setNotifications([]); setIsLoadingData(false); return; }

                const notifs: NotificationData[] = [];
                const userCache: Record<string, any> = {};

                await Promise.all(snap.docs.map(async (d) => {
                    const data = d.data() as Partial<NotificationData>;
                    let fromUser = { name: '退会したユーザー', photoURL: DEFAULT_ICON };
                    if (data.fromUid) {
                        if (!userCache[data.fromUid]) {
                            try {
                                const uSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', data.fromUid));
                                if (uSnap.exists()) userCache[data.fromUid] = uSnap.data();
                            } catch(e) {}
                        }
                        if (userCache[data.fromUid]) {
                            fromUser = {
                                name: userCache[data.fromUid].name || '名無し',
                                photoURL: userCache[data.fromUid].photoURL || DEFAULT_ICON,
                            };
                        }
                    }
                    notifs.push({
                        id: d.id, fromUser,
                        createdAt: data.createdAt || Timestamp.now(),
                        fromUid: data.fromUid,
                        isRead: data.isRead || false,
                        type: data.type || 'unknown',
                        contentId: data.contentId,
                        title: data.title, body: data.body, link: data.link,
                    });
                }));

                notifs.sort((a, b) => toMillisafe(b.createdAt) - toMillisafe(a.createdAt));
                setNotifications(notifs);
            } catch(e) { console.error(e); }
            finally { setIsLoadingData(false); }
        };
        loadNotifications();
    }, [user, loading, router]);

    const markAsRead = async (notifId: string) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'notifications', notifId), { isRead: true });
            setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
        } catch(e) { console.error(e); }
    };

    const markAllAsRead = async () => {
        if (!user || notifications.length === 0) return;
        try {
            const batch = writeBatch(db);
            let hasUnread = false;
            const updated = notifications.map(n => {
                if (!n.isRead) {
                    batch.update(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'notifications', n.id), { isRead: true });
                    hasUnread = true;
                    return { ...n, isRead: true };
                }
                return n;
            });
            if (hasUnread) { await batch.commit(); setNotifications(updated); }
        } catch(e) { console.error(e); }
    };

    // ── Loading ────────────────────────────────────────────────────────────────
    if (loading || isLoadingData) {
        return (
            <div style={{minHeight:'100vh',background:BG,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
                <div style={{width:36,height:36,borderRadius:'50%',border:`3px solid rgba(74,124,89,.15)`,borderTopColor:SAGE,animation:'spin .8s linear infinite'}}/>
                <div style={{fontSize:11,color:TM,letterSpacing:'.12em'}}>通知を読み込み中...</div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div style={{minHeight:'100vh',background:BG,display:'flex',flexDirection:'column'}}>
            {/* ── Sticky topbar ── */}
            <div style={{
                position:'sticky',top:0,zIndex:50,
                background:SB,padding:'0 20px',height:52,
                display:'flex',alignItems:'center',justifyContent:'space-between',
                boxShadow:'0 2px 16px rgba(0,0,0,.25)',
            }}>
                <button
                    onClick={() => router.back()}
                    style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',color:'#d4ead9',cursor:'pointer',fontSize:12,fontWeight:700,letterSpacing:'.06em'}}
                >
                    <ArrowLeft size={16}/> 戻る
                </button>

                <div style={{display:'flex',alignItems:'center',gap:8,color:'#e8f4ec',fontSize:14,fontWeight:800,letterSpacing:'.15em'}}>
                    <Bell size={14} color={LIME}/>
                    通知
                    {unreadCount > 0 && (
                        <span style={{
                            background:'#ef4444',color:'#fff',fontSize:9,fontWeight:700,
                            borderRadius:10,padding:'2px 6px',letterSpacing:0,
                        }}>{unreadCount}</span>
                    )}
                </div>

                <button
                    onClick={markAllAsRead}
                    style={{display:'flex',alignItems:'center',gap:4,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.1)',color:'#7aab88',cursor:'pointer',fontSize:10,fontWeight:700,letterSpacing:'.06em',padding:'5px 10px',borderRadius:8}}
                >
                    <CheckCheck size={12}/> 全既読
                </button>
            </div>

            {/* ── Content ── */}
            <div style={{flex:1,maxWidth:640,width:'100%',margin:'0 auto',padding:'24px 16px 80px'}}>

                {notifications.length === 0 ? (
                    /* Empty state */
                    <div style={{
                        textAlign:'center',padding:'64px 20px',
                        background:BG,borderRadius:20,boxShadow:NEU_UP,marginTop:8,
                    }}>
                        <div style={{width:72,height:72,borderRadius:'50%',background:BG,boxShadow:NEU_SM,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',color:TM}}>
                            <BellOff size={28}/>
                        </div>
                        <div style={{fontSize:14,fontWeight:700,color:T2,letterSpacing:'.06em',marginBottom:6}}>新しい通知はありません</div>
                        <div style={{fontSize:11,color:TM}}>フォローすると活動通知が届きます</div>
                    </div>
                ) : (
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                        {notifications.map(n => {
                            const date = new Date(toMillisafe(n.createdAt) || Date.now());
                            const dateStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
                            const { icon: IconComponent, iconBg, iconColor, accent } = getTypeConfig(n.type || '');

                            let linkUrl = '#';
                            let bodyContent: React.ReactNode = null;

                            if (n.type === 'follow') {
                                linkUrl = `/user?uid=${n.fromUid}`;
                                bodyContent = (
                                    <div>
                                        <span style={{fontWeight:700,color:T1}}>{n.fromUser?.name}</span>
                                        <span style={{color:T2}}> さんがあなたをフォローしました</span>
                                        {n.fromUid && user && <div><FollowBackButton targetUid={n.fromUid} currentUid={user.uid}/></div>}
                                    </div>
                                );
                            } else if (n.type === 'live_start') {
                                linkUrl = `/live?roomId=${n.contentId}`;
                                bodyContent = (
                                    <div>
                                        <span style={{fontWeight:700,color:T1}}>{n.fromUser?.name}</span>
                                        <span style={{color:T2}}> さんが </span>
                                        <span style={{fontWeight:700,color:'#ef4444',fontSize:10,padding:'1px 6px',background:'#fef2f2',borderRadius:4}}>SIGNAL CAST</span>
                                        <span style={{color:T2}}> の配信を開始しました！</span>
                                    </div>
                                );
                            } else if (n.type === 'new_video') {
                                linkUrl = `/media/videos/${n.contentId}`;
                                bodyContent = (
                                    <div>
                                        <span style={{fontWeight:700,color:T1}}>{n.fromUser?.name}</span>
                                        <span style={{color:T2}}> さんが新しい動画を投稿しました</span>
                                    </div>
                                );
                            } else if (n.type === 'new_podcast') {
                                linkUrl = `/media/podcasts/${n.contentId}`;
                                bodyContent = (
                                    <div>
                                        <span style={{fontWeight:700,color:T1}}>{n.fromUser?.name}</span>
                                        <span style={{color:T2}}> さんが新しい音声を配信しました</span>
                                    </div>
                                );
                            } else if (n.title || n.body) {
                                linkUrl = n.link || '#';
                                bodyContent = (
                                    <div>
                                        {n.title && <div style={{fontWeight:700,color:T1,marginBottom:2}}>{n.title}</div>}
                                        {n.body && <div style={{color:T2,fontSize:12,lineHeight:1.6}}>{n.body}</div>}
                                    </div>
                                );
                            } else {
                                bodyContent = <span style={{color:T2}}>新しい通知があります</span>;
                            }

                            return (
                                <div
                                    key={n.id}
                                    style={{
                                        background: n.isRead ? BG : `rgba(74,124,89,.04)`,
                                        borderRadius: 14,
                                        boxShadow: n.isRead ? NEU_UP : `${NEU_UP}, inset 0 0 0 1.5px rgba(74,124,89,.25)`,
                                        padding: '14px 16px',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 14,
                                        position: 'relative',
                                        transition: 'box-shadow .2s',
                                    }}
                                >
                                    {/* Unread dot */}
                                    {!n.isRead && (
                                        <div style={{
                                            position:'absolute',top:14,right:14,
                                            width:8,height:8,borderRadius:'50%',background:'#ef4444',
                                            boxShadow:'0 0 0 2px '+BG,
                                        }}/>
                                    )}

                                    {/* Avatar + type badge */}
                                    <Link
                                        href={n.fromUid ? `/user?uid=${n.fromUid}` : '#'}
                                        onClick={() => markAsRead(n.id)}
                                        style={{position:'relative',flexShrink:0,display:'block'}}
                                    >
                                        <img
                                            src={n.fromUser?.photoURL || DEFAULT_ICON}
                                            alt=""
                                            style={{
                                                width:46,height:46,borderRadius:'50%',objectFit:'cover',
                                                boxShadow:NEU_SM,border:`2px solid ${BG}`,display:'block',
                                            }}
                                        />
                                        <div style={{
                                            position:'absolute',bottom:-2,right:-2,
                                            width:20,height:20,borderRadius:'50%',
                                            background:iconBg,
                                            display:'flex',alignItems:'center',justifyContent:'center',
                                            border:`2px solid ${BG}`,
                                            boxShadow:'0 2px 6px rgba(0,0,0,.18)',
                                        }}>
                                            <IconComponent size={10} color={iconColor}/>
                                        </div>
                                    </Link>

                                    {/* Body */}
                                    <div style={{flex:1,minWidth:0}}>
                                        <Link
                                            href={linkUrl}
                                            onClick={() => markAsRead(n.id)}
                                            style={{textDecoration:'none',display:'block'}}
                                        >
                                            <div style={{fontSize:13,lineHeight:1.6}}>{bodyContent}</div>
                                        </Link>
                                        <div style={{display:'flex',alignItems:'center',gap:4,marginTop:6,color:TM,fontSize:10}}>
                                            <Clock size={9}/> {dateStr}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}
