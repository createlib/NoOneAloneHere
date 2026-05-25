'use client';

/**
 * EventsCalendarModal
 * プロフィールページのカレンダーアイコンから開くモーダル。
 * HOME（甲板）ページと同じイベントデータを表示する。
 *   - 参加するイベント (participating_events)
 *   - 主催するイベント (organizer / authorId)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    X, CalendarCheck, Crown, Clock, MapPin,
    ChevronRight, Compass, CalendarDays,
} from 'lucide-react';
import { db, APP_ID } from '@/lib/firebase';
import {
    collection, doc, getDoc, getDocs, onSnapshot, query,
} from 'firebase/firestore';

// ── Design tokens (SettingsModal と同じニューモルフィック系)
const BG    = '#f8f6f3';
const SB    = '#1a3024';
const SAGE  = '#4a7c59';
const LIME  = '#8ecfb2';
const T1    = '#2a2520';
const T2    = '#7a7068';
const TM    = '#b0a89e';
const NEU_UP = '6px 6px 20px #dbd7d2,-6px -6px 20px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #e4e0db,inset -3px -3px 8px #ffffff';

// ── タブスタイル
const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '7px 0',
    borderRadius: 10,
    border: 'none',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '.06em',
    cursor: 'pointer',
    transition: 'all .15s',
    background: active ? SB : 'transparent',
    color: active ? LIME : TM,
    boxShadow: active ? '2px 2px 8px rgba(0,0,0,.18)' : 'none',
});

// ── イベントカード（ミニ版）
function EventCard({ evt, onClick }: { evt: any; onClick: () => void }) {
    const thumb = evt.thumbnailUrl || `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="%231a3024"/><text x="50%" y="54%" text-anchor="middle" fill="%238ecfb2" font-size="10" font-weight="700" font-family="sans-serif">NOAH</text></svg>')}`;
    const dateStr = evt.startDate === evt.endDate
        ? `${evt.startDate || ''} ${evt.startTime || ''}`
        : `${evt.startDate || ''} 〜 ${evt.endDate || ''}`;

    return (
        <button
            onClick={onClick}
            style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center',
                gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,.06)',
                background: 'none', border: 'none', cursor: 'pointer',
            }}
        >
            <img
                src={thumb} alt={evt.title}
                style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(0,0,0,.07)' }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                    {evt.title || '名称未設定'}
                </div>
                <div style={{ fontSize: 10, color: T2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={10} color={TM} />
                    {dateStr}
                </div>
                {evt.locationName && (
                    <div style={{ fontSize: 10, color: T2, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <MapPin size={10} color={TM} />
                        {evt.locationName}
                    </div>
                )}
            </div>
            <ChevronRight size={12} color={TM} style={{ flexShrink: 0 }} />
        </button>
    );
}

// ── Props
interface EventsCalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUid: string;
    /** プロフィール profileData.userId（イベントの organizerId と照合するため） */
    profileUserId?: string;
    /** イベント詳細画面を開くハンドラ（渡せる場合） */
    onOpenEvent?: (evt: any) => void;
}

export default function EventsCalendarModal({
    isOpen,
    onClose,
    currentUid,
    profileUserId,
    onOpenEvent,
}: EventsCalendarModalProps) {
    const [appear, setAppear] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    const [tab, setTab] = useState<'join' | 'host'>('join');

    const [participating, setParticipating] = useState<any[]>([]);
    const [hosting,       setHosting]       = useState<any[]>([]);
    const [loading,       setLoading]       = useState(false);
    const [loaded,        setLoaded]        = useState(false);

    // ── アニメーション
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => setAppear(true), 10);
            if (!loaded) fetchEvents();
        } else {
            setAppear(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // ── データ取得（ホームページと同ロジック）
    const fetchEvents = async () => {
        if (!currentUid) return;
        setLoading(true);
        try {
            const now = new Date().toISOString();
            const profId = profileUserId || currentUid;

            // 参加イベント
            const myJoinColl = collection(db, 'artifacts', APP_ID, 'users', currentUid, 'participating_events');
            const joinSnap = await getDocs(myJoinColl);
            const joinPromises = joinSnap.docs.map(async (jDoc) => {
                try {
                    const evtSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', jDoc.id));
                    if (evtSnap.exists()) return { id: evtSnap.id, ...evtSnap.data() };
                } catch { /* skip */ }
                return null;
            });
            const rawJoined = (await Promise.all(joinPromises)).filter(Boolean) as any[];
            let joined: any[] = rawJoined.filter((e: any) => !e.endTimestamp || e.endTimestamp >= now);

            joined.sort((a, b) => (new Date(a.startDate).getTime()) - (new Date(b.startDate).getTime()));
            setParticipating(joined);

            // 主催イベント
            const eventsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'events');
            const evSnap = await getDocs(eventsRef);
            let hosts: any[] = [];
            evSnap.forEach(d => {
                const evt = d.data();
                if (!evt.endTimestamp || evt.endTimestamp >= now) {
                    const isHost = evt.organizerId === currentUid || evt.organizerId === profId || evt.authorId === currentUid;
                    if (isHost) hosts.push({ id: d.id, ...evt });
                }
            });
            hosts.sort((a, b) => {
                const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return tB - tA;
            });
            setHosting(hosts);

            setLoaded(true);
        } catch (e) {
            console.error('EventsCalendarModal fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === overlayRef.current) onClose();
    };

    if (!isOpen && !appear) return null;

    const list = tab === 'join' ? participating : hosting;

    return (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            style={{
                position: 'fixed', inset: 0, zIndex: 2100,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                background: `rgba(0,0,0,${appear ? '.45' : '0'})`,
                backdropFilter: appear ? 'blur(6px)' : 'none',
                transition: 'background .25s, backdrop-filter .25s',
            }}
        >
            {/* Drawer */}
            <div
                style={{
                    width: '100%', maxWidth: 520,
                    background: BG,
                    borderRadius: '20px 20px 0 0',
                    boxShadow: '0 -8px 40px rgba(0,0,0,.22)',
                    transform: appear ? 'translateY(0)' : 'translateY(100%)',
                    transition: 'transform .3s cubic-bezier(.4,0,.2,1)',
                    display: 'flex', flexDirection: 'column',
                    maxHeight: '85vh',
                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '16px 20px 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: SB,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <CalendarDays size={16} color={LIME} />
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: T1, letterSpacing: '.04em' }}>イベント</div>
                            <div style={{ fontSize: 10, color: TM, marginTop: 1 }}>参加・主催するイベント</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 30, height: 30, borderRadius: '50%',
                            border: '1px solid rgba(0,0,0,.08)',
                            background: BG, boxShadow: NEU_UP,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: TM,
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Tab bar */}
                <div style={{ margin: '12px 20px 0', padding: 4, background: BG, boxShadow: NEU_IN, borderRadius: 14, display: 'flex', gap: 4 }}>
                    <button style={TAB_STYLE(tab === 'join')} onClick={() => setTab('join')}>
                        <CalendarCheck size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                        参加予定
                        {participating.length > 0 && (
                            <span style={{
                                marginLeft: 5, fontSize: 9, fontWeight: 700,
                                background: tab === 'join' ? LIME : TM,
                                color: tab === 'join' ? SB : '#fff',
                                borderRadius: 10, padding: '1px 5px',
                            }}>{participating.length}</span>
                        )}
                    </button>
                    <button style={TAB_STYLE(tab === 'host')} onClick={() => setTab('host')}>
                        <Crown size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                        主催
                        {hosting.length > 0 && (
                            <span style={{
                                marginLeft: 5, fontSize: 9, fontWeight: 700,
                                background: tab === 'host' ? LIME : TM,
                                color: tab === 'host' ? SB : '#fff',
                                borderRadius: 10, padding: '1px 5px',
                            }}>{hosting.length}</span>
                        )}
                    </button>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(0,0,0,.05)', margin: '12px 20px 0' }} />

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 28px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 10 }}>
                            <Compass size={28} color={SAGE} style={{ animation: 'spin .9s linear infinite' }} />
                            <div style={{ fontSize: 11, color: TM, fontWeight: 700 }}>読み込み中…</div>
                        </div>
                    ) : list.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 0' }}>
                            <CalendarCheck size={28} color={TM} style={{ margin: '0 auto 8px' }} />
                            <div style={{ fontSize: 12, color: TM }}>
                                {tab === 'join' ? '参加予定のイベントはありません' : '主催する予定のイベントはありません'}
                            </div>
                        </div>
                    ) : (
                        list.map(evt => (
                            <EventCard
                                key={evt.id}
                                evt={evt}
                                onClick={() => {
                                    if (onOpenEvent) onOpenEvent(evt);
                                    else window.location.href = `/events?eventId=${evt.id}`;
                                }}
                            />
                        ))
                    )}
                </div>

                {/* spin keyframes */}
                <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
            </div>
        </div>
    );
}
