'use client';
import React, { useEffect, useState, useRef } from 'react';
import {
    collection, query, orderBy, getDocs, doc, getDoc,
    updateDoc, writeBatch, Timestamp, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { Bell, BellOff, CheckCheck, UserPlus, Radio, Film, Podcast, Clock, X,
    Anchor, CalendarCheck, CalendarPlus, CalendarX, HeartHandshake, MessageCircle,
    Info, ShieldCheck, PartyPopper, Briefcase, Star } from 'lucide-react';
import Link from 'next/link';

// ── Design tokens ──────────────────────────────────────────────────────────────
const BG    = '#f8f6f3';
const SB    = '#1a3024';
const SAGE  = '#4a7c59';
const LIME  = '#8ecfb2';
const T1    = '#2a2520';
const T2    = '#7a7068';
const TM    = '#ada49c';
const NEU_UP = '6px 6px 14px rgba(0,0,0,.09),-6px -6px 14px rgba(255,255,255,.85)';
const NEU_SM = '3px 3px 8px rgba(0,0,0,.07),-3px -3px 8px rgba(255,255,255,.8)';

// SVGフォールバック（外部URLに依存しない）
function AvatarFallback({ name, size = 46 }: { name?: string; size?: number }) {
    const initials = name ? name.charAt(0).toUpperCase() : '?';
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4a7c59, #1a3024)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.38, fontWeight: 700, color: '#8ecfb2',
            flexShrink: 0, letterSpacing: '-.02em',
            boxShadow: NEU_SM, border: `2px solid ${BG}`,
        }}>{initials}</div>
    );
}

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
    fromUser?: { name: string; photoURL: string };
}

function toMillisafe(val: any): number {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return new Date(val).getTime();
    if (val.seconds !== undefined) return val.seconds * 1000;
    return 0;
}

function getTypeConfig(type: string) {
    switch (type) {
        // ─ ソーシャル ─
        case 'follow':          return { icon: UserPlus,       iconBg: SAGE,      iconColor: '#fff' };
        case 'mutual':          return { icon: HeartHandshake, iconBg: '#ec4899', iconColor: '#fff' };
        // ─ 乗組員・搭乗 ─
        case 'new_member':      return { icon: Anchor,         iconBg: '#1a3024', iconColor: '#8ecfb2' };
        // ─ イベント ─
        case 'event_join':
        case 'event_participate': return { icon: CalendarCheck, iconBg: '#0ea5e9', iconColor: '#fff' };
        case 'event_create':    return { icon: CalendarPlus,   iconBg: '#8b5cf6', iconColor: '#fff' };
        case 'event_cancel':    return { icon: CalendarX,      iconBg: '#ef4444', iconColor: '#fff' };
        // ─ メディア ─
        case 'live_start':
        case 'signal_cast':     return { icon: Radio,          iconBg: '#ef4444', iconColor: '#fff' };
        case 'new_video':       return { icon: Film,           iconBg: '#6366f1', iconColor: '#fff' };
        case 'new_podcast':     return { icon: Podcast,        iconBg: '#d97706', iconColor: '#fff' };
        // ─ コメント・メンション ─
        case 'comment':
        case 'mention':         return { icon: MessageCircle,  iconBg: '#06b6d4', iconColor: '#fff' };
        // ─ 仕事・依頼 ─
        case 'job_post':
        case 'job_apply':       return { icon: Briefcase,      iconBg: '#475569', iconColor: '#fff' };
        // ─ 称賛・スター ─
        case 'star':
        case 'like':            return { icon: Star,           iconBg: '#f59e0b', iconColor: '#fff' };
        // ─ おめでとう ─
        case 'welcome':
        case 'achievement':     return { icon: PartyPopper,    iconBg: '#10b981', iconColor: '#fff' };
        // ─ アップグレード ─
        case 'upgrade':
        case 'rank_up':         return { icon: ShieldCheck,    iconBg: '#7c3aed', iconColor: '#fff' };
        // ─ システム ─
        case 'system':
        case 'announcement':    return { icon: Info,           iconBg: '#64748b', iconColor: '#fff' };
        default:                return { icon: Bell,           iconBg: '#94a3b8', iconColor: '#fff' };
    }
}

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
        } catch (e) { console.error(e); }
    };

    if (isFollowing) return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, fontWeight: 700, color: SAGE, padding: '3px 8px', borderRadius: 6, background: 'rgba(74,124,89,.08)', border: '1px solid rgba(74,124,89,.2)' }}>
            <CheckCheck size={10} /> フォロー中
        </span>
    );
    return (
        <button onClick={handleFollow} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, fontWeight: 700, color: '#fff', padding: '4px 10px', borderRadius: 6, background: SAGE, border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(74,124,89,.3)' }}>
            <UserPlus size={10} /> フォローバック
        </button>
    );
}

interface NotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUid: string;
}

export default function NotificationModal({ isOpen, onClose, currentUid }: NotificationModalProps) {
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [loading, setLoading] = useState(false);
    const [appear, setAppear] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    // mount animation
    useEffect(() => {
        if (isOpen) {
            setAppear(false);
            setTimeout(() => setAppear(true), 10);
            loadNotifications();
        } else {
            setAppear(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const loadNotifications = async () => {
        if (!currentUid) return;
        setLoading(true);
        try {
            const notifRef = collection(db, 'artifacts', APP_ID, 'users', currentUid, 'notifications');
            const snap = await getDocs(query(notifRef, orderBy('createdAt', 'desc')));
            if (snap.empty) { setNotifications([]); setLoading(false); return; }

            const notifs: NotificationData[] = [];
            const userCache: Record<string, any> = {};

            await Promise.all(snap.docs.map(async (d) => {
                const data = d.data() as Partial<NotificationData>;
                let fromUser = { name: '退会したユーザー', photoURL: '' };
                if (data.fromUid) {
                    if (!userCache[data.fromUid]) {
                        try {
                            const uSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', data.fromUid));
                            if (uSnap.exists()) userCache[data.fromUid] = uSnap.data();
                        } catch (_) {}
                    }
                    if (userCache[data.fromUid]) {
                        fromUser = {
                            name: userCache[data.fromUid].name || '名無し',
                            photoURL: userCache[data.fromUid].photoURL || '',
                        };
                    }
                }
                notifs.push({
                    id: d.id, fromUser,
                    createdAt: (data.createdAt || Timestamp.now()) as Timestamp,
                    fromUid: data.fromUid,
                    isRead: data.isRead || false,
                    type: data.type || 'unknown',
                    contentId: data.contentId,
                    title: data.title, body: data.body, link: data.link,
                });
            }));

            notifs.sort((a, b) => toMillisafe(b.createdAt) - toMillisafe(a.createdAt));
            setNotifications(notifs);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const markAsRead = async (notifId: string) => {
        if (!currentUid) return;
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'users', currentUid, 'notifications', notifId), { isRead: true });
            setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
        } catch (e) { console.error(e); }
    };

    const markAllAsRead = async () => {
        if (!currentUid || notifications.length === 0) return;
        try {
            const batch = writeBatch(db);
            let hasUnread = false;
            const updated = notifications.map(n => {
                if (!n.isRead) {
                    batch.update(doc(db, 'artifacts', APP_ID, 'users', currentUid, 'notifications', n.id), { isRead: true });
                    hasUnread = true;
                    return { ...n, isRead: true };
                }
                return n;
            });
            if (hasUnread) { await batch.commit(); setNotifications(updated); }
        } catch (e) { console.error(e); }
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) onClose();
    };

    if (!isOpen) return null;

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <>
            {/* Overlay */}
            <div
                ref={overlayRef}
                onClick={handleOverlayClick}
                style={{
                    position: 'fixed', inset: 0, zIndex: 4000,
                    background: appear ? 'rgba(26,48,36,.45)' : 'rgba(26,48,36,0)',
                    backdropFilter: appear ? 'blur(8px)' : 'none',
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    transition: 'background .3s, backdrop-filter .3s',
                }}
            >
                {/* Bottom sheet */}
                <div style={{
                    width: '100%', maxWidth: 600,
                    maxHeight: '88vh',
                    background: BG,
                    borderRadius: '22px 22px 0 0',
                    boxShadow: '0 -8px 40px rgba(0,0,0,.22)',
                    display: 'flex', flexDirection: 'column',
                    transform: appear ? 'translateY(0)' : 'translateY(100%)',
                    transition: 'transform .35s cubic-bezier(.32,0,.15,1)',
                    overflow: 'hidden',
                }}>

                    {/* Drag handle */}
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,.12)' }} />
                    </div>

                    {/* Header */}
                    <div style={{
                        padding: '12px 18px 12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(0,0,0,.06)',
                        flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '5px 13px', borderRadius: 100,
                                background: SB, color: LIME,
                                fontSize: 11, fontWeight: 800, letterSpacing: '.1em',
                                boxShadow: NEU_SM,
                            }}>
                                <Bell size={11} /> 通知
                                {unreadCount > 0 && (
                                    <span style={{ background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 8, padding: '1px 5px', letterSpacing: 0 }}>
                                        {unreadCount}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(74,124,89,.08)', border: '1px solid rgba(74,124,89,.2)', color: SAGE, cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: '.06em', padding: '5px 10px', borderRadius: 8 }}
                                >
                                    <CheckCheck size={11} /> 全既読
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T2, cursor: 'pointer' }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Body: scrollable */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px', scrollbarWidth: 'thin', scrollbarColor: '#c8c4bf transparent' }}>
                        {loading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0' }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid rgba(74,124,89,.15)`, borderTopColor: SAGE, animation: 'spin .8s linear infinite' }} />
                                <div style={{ fontSize: 11, color: TM, letterSpacing: '.1em' }}>読み込み中...</div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '56px 20px' }}>
                                <div style={{ width: 64, height: 64, borderRadius: '50%', background: BG, boxShadow: NEU_SM, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: TM }}>
                                    <BellOff size={24} />
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: T2, marginBottom: 6 }}>新しい通知はありません</div>
                                <div style={{ fontSize: 11, color: TM }}>フォローすると活動通知が届きます</div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {notifications.map(n => {
                                    const date = new Date(toMillisafe(n.createdAt) || Date.now());
                                    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                                    const { icon: IconComponent, iconBg, iconColor } = getTypeConfig(n.type || '');

                                    let linkUrl = '#';
                                    let bodyContent: React.ReactNode = null;

                                    if (n.type === 'follow') {
                                        linkUrl = `/user?uid=${n.fromUid}`;
                                        bodyContent = (
                                            <div>
                                                <span style={{ fontWeight: 700, color: T1 }}>{n.fromUser?.name}</span>
                                                <span style={{ color: T2 }}> さんがあなたをフォローしました</span>
                                                {n.fromUid && currentUid && <div><FollowBackButton targetUid={n.fromUid} currentUid={currentUid} /></div>}
                                            </div>
                                        );
                                    } else if (n.type === 'live_start') {
                                        linkUrl = `/live?roomId=${n.contentId}`;
                                        bodyContent = (
                                            <div>
                                                <span style={{ fontWeight: 700, color: T1 }}>{n.fromUser?.name}</span>
                                                <span style={{ color: T2 }}> さんが </span>
                                                <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 10, padding: '1px 6px', background: '#fef2f2', borderRadius: 4 }}>SIGNAL CAST</span>
                                                <span style={{ color: T2 }}> の配信を開始しました！</span>
                                            </div>
                                        );
                                    } else if (n.type === 'new_video') {
                                        linkUrl = `/media/videos/${n.contentId}`;
                                        bodyContent = (
                                            <div>
                                                <span style={{ fontWeight: 700, color: T1 }}>{n.fromUser?.name}</span>
                                                <span style={{ color: T2 }}> さんが新しい動画を投稿しました</span>
                                            </div>
                                        );
                                    } else if (n.type === 'new_podcast') {
                                        linkUrl = `/media/podcasts/${n.contentId}`;
                                        bodyContent = (
                                            <div>
                                                <span style={{ fontWeight: 700, color: T1 }}>{n.fromUser?.name}</span>
                                                <span style={{ color: T2 }}> さんが新しい音声を配信しました</span>
                                            </div>
                                        );
                                    } else if (n.type === 'new_member') {
                                        // /p?uid=... → /user?uid=... に書き換え（フォロー可能な画面へ）
                                        const rawLink = n.link || '';
                                        const newMemberUid = n.fromUid || n.contentId
                                            || rawLink.match(/uid=([^&]+)/)?.[1];
                                        linkUrl = newMemberUid
                                            ? `/user?uid=${newMemberUid}`
                                            : (rawLink ? rawLink.replace('/p?uid=', '/user?uid=') : '#');
                                        bodyContent = (
                                            <div>
                                                <span style={{ fontWeight: 700, color: T1 }}>{n.fromUser?.name || n.title || '新しいメンバー'}</span>
                                                <span style={{ color: T2 }}> さんがNOAHに搭乗しました ⚓</span>
                                            </div>
                                        );
                                    } else if (n.type === 'mutual') {
                                        linkUrl = `/user?uid=${n.fromUid}`;
                                        bodyContent = (
                                            <div>
                                                <span style={{ fontWeight: 700, color: T1 }}>{n.fromUser?.name}</span>
                                                <span style={{ color: T2 }}> さんと相互フォローになりました！</span>
                                            </div>
                                        );
                                    } else if (n.type === 'event_join' || n.type === 'event_participate') {
                                        linkUrl = n.link || '#';
                                        bodyContent = (
                                            <div>
                                                <span style={{ fontWeight: 700, color: T1 }}>{n.fromUser?.name || 'メンバー'}</span>
                                                <span style={{ color: T2 }}> さんがイベントに参加しました</span>
                                                {n.title && <div style={{ fontSize: 11, color: TM, marginTop: 2 }}>📅 {n.title}</div>}
                                            </div>
                                        );
                                    } else if (n.type === 'event_create') {
                                        linkUrl = n.link || '#';
                                        bodyContent = (
                                            <div>
                                                <span style={{ fontWeight: 700, color: T1 }}>{n.fromUser?.name}</span>
                                                <span style={{ color: T2 }}> さんが新しいイベントを作成しました</span>
                                                {n.title && <div style={{ fontSize: 11, color: TM, marginTop: 2 }}>📅 {n.title}</div>}
                                            </div>
                                        );
                                    } else if (n.type === 'event_cancel') {
                                        linkUrl = n.link || '#';
                                        bodyContent = (
                                            <div>
                                                <span style={{ color: '#ef4444', fontWeight: 700 }}>イベントがキャンセルされました</span>
                                                {n.title && <div style={{ fontSize: 11, color: TM, marginTop: 2 }}>📅 {n.title}</div>}
                                            </div>
                                        );
                                    } else if (n.type === 'comment' || n.type === 'mention') {
                                        linkUrl = n.link || '#';
                                        bodyContent = (
                                            <div>
                                                <span style={{ fontWeight: 700, color: T1 }}>{n.fromUser?.name}</span>
                                                <span style={{ color: T2 }}>{n.type === 'mention' ? ' さんがあなたをメンションしました' : ' さんがコメントしました'}</span>
                                                {n.body && <div style={{ fontSize: 11, color: TM, marginTop: 2, fontStyle: 'italic' }}>「{n.body}」</div>}
                                            </div>
                                        );
                                    } else if (n.type === 'rank_up' || n.type === 'upgrade') {
                                        linkUrl = '/upgrade';
                                        bodyContent = (
                                            <div>
                                                {n.title && <div style={{ fontWeight: 700, color: T1, marginBottom: 2 }}>{n.title}</div>}
                                                <span style={{ color: T2 }}>{n.body || 'ランクがアップしました！'}</span>
                                            </div>
                                        );
                                    } else if (n.title || n.body) {
                                        // /p?uid=... は公開プロフィール（フォローボタンなし）なので
                                        // /user?uid=... に書き換えてインタラクティブな画面へ誘導
                                        const rawL = n.link || '#';
                                        linkUrl = rawL.replace(/^\/p(\?uid=)/, '/user$1');
                                        bodyContent = (
                                            <div>
                                                {n.title && <div style={{ fontWeight: 700, color: T1, marginBottom: 2 }}>{n.title}</div>}
                                                {n.body && <div style={{ color: T2, fontSize: 12, lineHeight: 1.6 }}>{n.body}</div>}
                                            </div>
                                        );
                                    } else {
                                        bodyContent = <span style={{ color: T2 }}>新しい通知があります</span>;
                                    }

                                    return (
                                        <div
                                            key={n.id}
                                            onClick={() => markAsRead(n.id)}
                                            style={{
                                                background: n.isRead ? BG : 'rgba(74,124,89,.04)',
                                                borderRadius: 14,
                                                boxShadow: n.isRead ? NEU_UP : `${NEU_UP}, inset 0 0 0 1.5px rgba(74,124,89,.25)`,
                                                padding: '14px 16px',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: 14,
                                                position: 'relative',
                                                cursor: 'pointer',
                                                transition: 'box-shadow .2s',
                                            }}
                                        >
                                            {/* Unread dot */}
                                            {!n.isRead && (
                                                <div style={{ position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 0 2px ' + BG }} />
                                            )}

                                            {/* Avatar + type badge */}
                                            <Link
                                                href={n.fromUid ? `/user?uid=${n.fromUid}` : '#'}
                                                onClick={e => { e.stopPropagation(); markAsRead(n.id); onClose(); }}
                                                style={{ position: 'relative', flexShrink: 0, display: 'block' }}
                                            >
                                                {/* ユーザーアバター or タイプアイコン */}
                                                {n.fromUid && n.fromUser?.photoURL ? (
                                                    <img
                                                        src={n.fromUser.photoURL}
                                                        alt=""
                                                        onError={e => {
                                                            // 画像エラー時はimg非表示にしてreact再レンダリングはさせず
                                                            // 代わりにsrcをリセット (hidden替わり)
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                            const parent = (e.target as HTMLImageElement).parentElement;
                                                            if (parent) {
                                                                const fallback = parent.querySelector('.avatar-fallback') as HTMLElement;
                                                                if (fallback) fallback.style.display = 'flex';
                                                            }
                                                        }}
                                                        style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', boxShadow: NEU_SM, border: `2px solid ${BG}`, display: 'block' }}
                                                    />
                                                ) : null}
                                                {/* JSフォールバック（画像なし or エラー時） */}
                                                {n.fromUid ? (
                                                    <div className="avatar-fallback" style={{
                                                        width: 46, height: 46, borderRadius: '50%',
                                                        background: 'linear-gradient(135deg,#4a7c59,#1a3024)',
                                                        display: n.fromUser?.photoURL ? 'none' : 'flex',
                                                        alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 18, fontWeight: 700, color: '#8ecfb2',
                                                        flexShrink: 0,
                                                        boxShadow: NEU_SM, border: `2px solid ${BG}`,
                                                    }}>
                                                        {(n.fromUser?.name || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                ) : (
                                                    /* fromUidなし（システム/イベント系）→ タイプアイコンを大 */
                                                    <div style={{
                                                        width: 46, height: 46, borderRadius: '50%',
                                                        background: iconBg,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        flexShrink: 0,
                                                        boxShadow: NEU_SM, border: `2px solid ${BG}`,
                                                    }}>
                                                        <IconComponent size={20} color={iconColor} />
                                                    </div>
                                                )}
                                                {/* タイプバッジ（アバターがある場合のみ小バッジを表示） */}
                                                {n.fromUid && (
                                                    <div style={{
                                                        position: 'absolute', bottom: -2, right: -2,
                                                        width: 20, height: 20, borderRadius: '50%',
                                                        background: iconBg,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        border: `2px solid ${BG}`,
                                                        boxShadow: '0 2px 6px rgba(0,0,0,.18)',
                                                    }}>
                                                        <IconComponent size={10} color={iconColor} />
                                                    </div>
                                                )}
                                            </Link>

                                            {/* Body */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <Link
                                                    href={linkUrl}
                                                    onClick={e => { e.stopPropagation(); markAsRead(n.id); onClose(); }}
                                                    style={{ textDecoration: 'none', display: 'block' }}
                                                >
                                                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>{bodyContent}</div>
                                                </Link>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, color: TM, fontSize: 10 }}>
                                                    <Clock size={9} /> {dateStr}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </>
    );
}
