import React, { useState, useEffect } from 'react';
import EventComments from '@/components/EventComments';
import Link from 'next/link';
import { X, Calendar, MapPin, User, Share2, CalendarPlus, Loader2, ExternalLink } from 'lucide-react';
import { db, APP_ID } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// ─── Design tokens (同一パレット) ────────────────────────────────
const BG   = '#f8f6f3';
const SB   = '#1a3024';
const SAGE = '#4a7c59';
const LIME = '#8ecfb2';
const T1   = '#2a2520';
const T2   = '#7a7068';
const TM   = '#b0a89e';
const NEU_SM = '4px 4px 12px #dbd7d2,-4px -4px 12px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #e4e0db,inset -3px -3px 8px #ffffff';

// ─── formatText ──────────────────────────────────────────────────
export const formatText = (text: string) => {
    if (!text) return '';
    const rawHtml = marked.parse(text) as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target'] });
    return cleanHtml;
};

// ─── EventParticipantsList ────────────────────────────────────────
export function EventParticipantsList({ eventId, isPublic, isOrganizer, refreshKey }: {
    eventId: string; isPublic: boolean; isOrganizer: boolean; refreshKey?: number;
}) {
    const [uids, setUids] = useState<string[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!eventId) return;
        const fetchParts = async () => {
            try {
                const partsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'events', eventId, 'participants');
                const partsSnap = await getDocs(partsRef);
                const fetchedUids = partsSnap.docs.map(d => d.id);
                setUids(fetchedUids);
                if ((isPublic || isOrganizer) && fetchedUids.length > 0) {
                    const results = await Promise.all(fetchedUids.slice(0, 10).map(async (uid) => {
                        const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', uid));
                        if (snap.exists()) return { uid, ...snap.data() };
                        return null;
                    }));
                    setUsers(results.filter(Boolean));
                }
            } catch (e) { console.error('fetch parts err', e); }
            setLoading(false);
        };
        fetchParts();
    }, [eventId, isPublic, isOrganizer, refreshKey]);

    const pill: React.CSSProperties = {
        fontSize: 10, padding: '3px 10px', borderRadius: 100, fontWeight: 700,
        background: BG, boxShadow: NEU_IN, color: T2, display: 'inline-flex', alignItems: 'center', gap: 4,
    };

    if (loading) return (
        <span style={pill}>
            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />読込中…
        </span>
    );
    if (uids.length === 0) return <span style={pill}>まだ参加予定の人はいません</span>;
    if (!isPublic && !isOrganizer) return <span style={pill}>{uids.length} 人</span>;

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <span style={{ ...pill, background: SB, color: LIME, boxShadow: 'none' }}>{uids.length} 名参加予定</span>
            {users.map((u: any) => (
                <Link key={u.uid} href={`/user?uid=${u.uid}`} title={u.name || 'User'} style={{ display: 'block' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: BG, boxShadow: NEU_SM, border: `2px solid ${BG}`, transition: 'box-shadow .15s' }}>
                        {u.photoURL
                            ? <img src={u.photoURL} alt={u.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={14} color={TM} /></div>
                        }
                    </div>
                </Link>
            ))}
            {uids.length > 10 && (
                <div title={`他 ${uids.length - 10}名`}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: BG, boxShadow: NEU_SM, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: T2, cursor: 'help' }}>
                    +{uids.length - 10}
                </div>
            )}
        </div>
    );
}

// ─── Google Calendar link ─────────────────────────────────────────
function getGoogleCalendarLink(event: any) {
    if (!event) return '#';
    const title = encodeURIComponent(event.title || 'イベント');
    const details = encodeURIComponent(event.description || '');
    const location = encodeURIComponent(event.locationName || '');
    const formatGoogleDate = (dateStr: string, timeStr: string) => {
        if (!dateStr || !timeStr) return '';
        try {
            const d = new Date(`${dateStr}T${timeStr}:00+09:00`);
            return d.toISOString().replace(/-|:/g, '').replace(/\..+Z/, 'Z');
        } catch (e) { return ''; }
    };
    const start = formatGoogleDate(event.startDate, event.startTime);
    const end = formatGoogleDate(event.endDate, event.endTime);
    let dates = '';
    if (start && end) dates = `&dates=${start}/${end}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}${dates}&details=${details}&location=${location}`;
}

// ─── Main Component ───────────────────────────────────────────────
export default function EventDetailSheet({
    event, onClose, adjustMode, setFullImageUrl, userData,
    refreshPartsKey, currentUserId, isJoined, toggleParticipate,
    openEditModal, onDelete, onShare, hideEventLink
}: {
    event: any | null;
    onClose: () => void;
    adjustMode?: boolean;
    setFullImageUrl: (url: string) => void;
    userData: any;
    refreshPartsKey?: number;
    currentUserId?: string;
    isJoined?: boolean;
    toggleParticipate?: (evt: any) => void;
    openEditModal?: (id: string) => void;
    onDelete?: (evt: any) => void;
    onShare?: (evt: any) => void;
    hideEventLink?: boolean;
}) {
    if (!event) return null;

    const isOrganizerOrAdmin = userData?.userId === 'admin' || currentUserId === event.organizerId;
    const isFree = Number(event.price) === 0;

    // 外枠: 角丸クリップ層（スクロールしない）
    const sheetStyle: React.CSSProperties = {
        position: 'fixed',
        bottom: adjustMode ? '-100%' : 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 600,
        zIndex: 80,
        background: BG,
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,.18)',
        overflow: 'hidden',               // スクロールバーを角丸でクリップ
        maxHeight: '92dvh',
        transition: 'bottom .3s cubic-bezier(.4,0,.2,1)',
        display: 'flex',
        flexDirection: 'column',
    };
    // 内側: スクロール層
    const scrollStyle: React.CSSProperties = {
        overflowY: 'auto',
        flex: 1,
        minHeight: 0,
    };

    const infoRow: React.CSSProperties = {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,.07)',
    };
    const infoLabel: React.CSSProperties = {
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 11, fontWeight: 700, color: T2, letterSpacing: '.06em', flexShrink: 0, marginTop: 1,
    };
    const infoValue: React.CSSProperties = {
        fontSize: 13, fontWeight: 600, color: T1, textAlign: 'right', maxWidth: '62%',
    };
    const btn = (primary: boolean): React.CSSProperties => ({
        width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: 700, letterSpacing: '.04em', transition: 'all .15s',
        background: primary ? SB : BG,
        color: primary ? LIME : T2,
        boxShadow: primary ? '0 4px 16px rgba(26,48,36,.3)' : NEU_SM,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    });

    return (
        <>
            {/* backdrop */}
            <div onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 79, backdropFilter: 'blur(2px)' }} />

            <div style={sheetStyle}>
                {/* ─ Header ─ 展主層（stickyは内側コンテナ内で動作） */}
                <div style={{
                    flexShrink: 0,
                    background: 'rgba(248,246,243,.97)',
                    borderBottom: '1px solid rgba(0,0,0,.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px',
                    position: 'relative',
                }}>
                    {/* drag handle */}
                    <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 36, height: 4, borderRadius: 100, background: 'rgba(0,0,0,.12)' }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: T2, letterSpacing: '.12em' }}>イベント詳細</span>
                    <button onClick={onClose} aria-label="閉じる"
                        style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: BG, boxShadow: NEU_SM, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={15} color={T2} />
                    </button>
                </div>

                {/* ─ Scrollable Body ─ */}
                <div style={scrollStyle}>
                <div style={{ padding: '0 20px 100px' }}>

                    {/* ─ Markdown styles (scoped) ─ */}
                    <style>{`
                      .eds-md h1,.eds-md h2,.eds-md h3,.eds-md h4,.eds-md h5,.eds-md h6{
                        color:${T1};font-weight:800;line-height:1.35;margin:18px 0 8px;letter-spacing:.02em;
                      }
                      .eds-md h1{font-size:18px;padding-bottom:6px;border-bottom:2px solid ${LIME};}
                      .eds-md h2{font-size:15px;padding-bottom:4px;border-bottom:1px solid rgba(142,207,178,.4);}
                      .eds-md h3{font-size:13px;color:${SAGE};}
                      .eds-md h4,.eds-md h5,.eds-md h6{font-size:12px;color:${T2};}
                      .eds-md p{font-size:13px;color:${T1};line-height:1.75;margin:8px 0;}
                      .eds-md ul,.eds-md ol{padding-left:20px;margin:8px 0;}
                      .eds-md li{font-size:13px;color:${T1};line-height:1.7;margin:3px 0;}
                      .eds-md ul li::marker{color:${LIME};}
                      .eds-md ol li::marker{color:${SAGE};font-weight:700;}
                      .eds-md blockquote{
                        margin:12px 0;padding:10px 14px;
                        border-left:3px solid ${LIME};
                        background:rgba(142,207,178,.08);border-radius:0 8px 8px 0;
                        color:${T2};font-style:italic;font-size:13px;
                      }
                      .eds-md code{
                        font-size:11px;padding:2px 6px;
                        background:rgba(26,48,36,.07);border-radius:4px;
                        color:${SAGE};font-family:monospace;
                      }
                      .eds-md pre{
                        background:${SB};border-radius:10px;padding:14px 16px;
                        overflow-x:auto;margin:12px 0;
                      }
                      .eds-md pre code{
                        background:none;color:#d4efdf;font-size:11px;padding:0;
                      }
                      .eds-md hr{border:none;border-top:1px solid rgba(0,0,0,.1);margin:16px 0;}
                      .eds-md strong{font-weight:800;color:${T1};}
                      .eds-md em{color:${SAGE};}
                      .eds-md a{color:${SAGE};text-decoration:underline;text-underline-offset:2px;}
                      .eds-md table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px;}
                      .eds-md th{background:${SB};color:${LIME};padding:6px 10px;font-weight:700;text-align:left;}
                      .eds-md td{padding:6px 10px;border-bottom:1px solid rgba(0,0,0,.07);color:${T1};}
                    `}</style>

                    {/* Images */}
                    {event.imageUrls && event.imageUrls.length > 0 ? (
                        // 負マージンで親パディングを突き抜けて端から端まで横スクロール可能に
                        <div style={{
                            display: 'flex', gap: 10,
                            overflowX: 'auto',
                            padding: '20px 20px 12px',
                            margin: '0 -20px',
                            scrollSnapType: 'x mandatory',
                            WebkitOverflowScrolling: 'touch' as any,
                        }}>
                            {event.imageUrls.map((url: string, idx: number) => (
                                <img key={idx} src={url} onClick={() => setFullImageUrl(url)}
                                    style={{ width: 240, height: 155, objectFit: 'cover', borderRadius: 14, flexShrink: 0, scrollSnapAlign: 'start', cursor: 'pointer', boxShadow: NEU_SM }} />
                            ))}
                        </div>
                    ) : event.thumbnailUrl ? (
                        <img src={event.thumbnailUrl} onClick={() => setFullImageUrl(event.thumbnailUrl!)}
                            style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 16, marginTop: 20, marginBottom: 4, cursor: 'pointer', boxShadow: NEU_SM }} />
                    ) : (
                        <div style={{ height: 16 }} />
                    )}

                    {/* Badges */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '16px 0 10px' }}>
                        {event.isOnline && (
                            <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 100, fontWeight: 700, background: SB, color: LIME, letterSpacing: '.06em' }}>オンライン</span>
                        )}
                        <span style={{
                            fontSize: 10, padding: '3px 10px', borderRadius: 100, fontWeight: 700, letterSpacing: '.06em',
                            background: isFree ? 'rgba(142,207,178,.2)' : BG,
                            color: isFree ? SAGE : T2,
                            boxShadow: isFree ? 'none' : NEU_SM,
                            border: isFree ? `1px solid ${LIME}` : 'none',
                        }}>
                            {isFree ? '無料' : `¥${Number(event.price).toLocaleString()}`}
                        </span>
                    </div>

                    {/* Title */}
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: T1, lineHeight: 1.35, margin: '4px 0 20px', letterSpacing: '.02em' }}>
                        {event.title}
                    </h2>

                    {/* Info block */}
                    <div style={{ background: BG, borderRadius: 16, boxShadow: NEU_IN, padding: '4px 16px', marginBottom: 24 }}>
                        <div style={{ ...infoRow }}>
                            <span style={infoLabel}><Calendar size={13} color={LIME} />日時</span>
                            <div style={infoValue}>
                                <div>{event.startDate} {event.startTime}</div>
                                <div style={{ fontSize: 11, color: TM, marginTop: 2 }}>〜 {event.endDate} {event.endTime}</div>
                            </div>
                        </div>
                        <div style={{ ...infoRow }}>
                            <span style={infoLabel}><MapPin size={13} color={LIME} />場所</span>
                            <div style={infoValue}>{event.locationName || '未設定'}</div>
                        </div>
                        <div style={{ ...infoRow }}>
                            <span style={infoLabel}><User size={13} color={LIME} />主催者</span>
                            <Link href={`/user?uid=${event.organizerId}`}
                                style={{ fontSize: 13, fontWeight: 700, color: SAGE, textDecoration: 'none' }}>
                                {event.organizerName}
                            </Link>
                        </div>
                        <div style={{ padding: '14px 0 10px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: T2, letterSpacing: '.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <User size={11} color={TM} />参加予定の乗船者
                            </div>
                            <EventParticipantsList
                                eventId={event.id}
                                isPublic={event.isParticipantsPublic}
                                isOrganizer={isOrganizerOrAdmin}
                                refreshKey={refreshPartsKey}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    {event.description && (
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: T2, letterSpacing: '.12em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 3, height: 14, borderRadius: 100, background: LIME, display: 'inline-block' }} />
                                イベント詳細
                            </div>
                            <div style={{ fontSize: 13, color: T1, lineHeight: 1.7 }}
                                className="eds-md"
                                dangerouslySetInnerHTML={{ __html: formatText(event.description) }} />
                        </div>
                    )}

                    {/* Tags */}
                    {event.tags?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
                            {event.tags.map((t: string) => (
                                <span key={t} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 100, fontWeight: 700, background: BG, color: T2, boxShadow: NEU_SM }}>
                                    #{t}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* 参加ボタン */}
                        {currentUserId && event.organizerId !== currentUserId && toggleParticipate && (
                            <button onClick={() => toggleParticipate(event)} style={btn(!isJoined)}>
                                {isJoined ? '参加をキャンセル' : '参加を申し込む'}
                            </button>
                        )}

                        {/* Google Calendar */}
                        {isJoined && (
                            <a href={getGoogleCalendarLink(event)} target="_blank" rel="noopener noreferrer"
                                style={{ ...btn(false), textDecoration: 'none', color: '#4285F4', border: '1px solid rgba(66,133,244,.3)' }}>
                                <CalendarPlus size={14} /> Googleカレンダーに追加
                            </a>
                        )}

                        {/* Share */}
                        {onShare && (
                            <button onClick={() => onShare(event)} style={btn(false)}>
                                <Share2 size={14} /> 友達に共有する
                            </button>
                        )}

                        {/* 編集 / 削除 */}
                        {isOrganizerOrAdmin && openEditModal && (
                            <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid rgba(0,0,0,.07)', marginTop: 4 }}>
                                <button onClick={() => { onClose(); openEditModal(event.id); }}
                                    style={{ ...btn(false), flex: 1 }}>
                                    編集
                                </button>
                                {onDelete && (
                                    <button onClick={() => { if (window.confirm('本当にこのイベントを削除しますか？')) { onDelete(event); onClose(); } }}
                                        style={{ ...btn(false), flex: 1, color: '#d97070', border: '1px solid rgba(217,112,112,.3)' }}>
                                        削除
                                    </button>
                                )}
                            </div>
                        )}

                        {/* 詳細ページへ */}
                        {!hideEventLink && (
                            <Link href={`/events?eventId=${event.id}`}
                                style={{ ...btn(false) as any, textDecoration: 'none', color: T2, marginTop: 4, border: `1px solid rgba(0,0,0,.08)` }}>
                                <ExternalLink size={13} /> イベントの詳細ページを開く
                            </Link>
                        )}
                    </div>{/* /actions */}

                    {/* ── Comments section ── */}
                    {currentUserId && (
                        <EventComments
                            eventId={event.id}
                            currentUserId={currentUserId}
                            currentUserName={userData?.name || '匿名'}
                            currentUserPhoto={userData?.photoURL}
                            organizerId={event.organizerId || ''}
                            isOrganizer={isOrganizerOrAdmin}
                        />
                    )}
                </div>{/* /padding body */}
                </div>{/* /scrollable body */}
            </div>{/* /sheet */}
        </>
    );
}
