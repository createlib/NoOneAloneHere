import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Calendar, MapPin, User, Share2, CalendarPlus, Loader2 } from 'lucide-react';
import { db, APP_ID } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const formatText = (text: string) => {
    if (!text) return '';
    const rawHtml = marked.parse(text) as string;
    const cleanHtml = DOMPurify.sanitize(rawHtml, { ADD_ATTR: ['target'] });
    return cleanHtml;
};

// Extracted EventParticipantsList
export function EventParticipantsList({ eventId, isPublic, isOrganizer, refreshKey }: { eventId: string, isPublic: boolean, isOrganizer: boolean, refreshKey?: number }) {
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
            } catch(e) { console.error('fetch parts err', e); }
            setLoading(false);
        };
        fetchParts();
    }, [eventId, isPublic, isOrganizer, refreshKey]);

    if (loading) return <span className="text-[10px] text-brand-500 ml-2 py-0.5 px-2 bg-brand-50 border border-brand-200 rounded-sm italic tracking-widest flex items-center shadow-sm"><Loader2 className="w-3 h-3 mr-1 animate-spin text-brand-400"/>読込中...</span>;
    if (uids.length === 0) return <span className="text-[10px] bg-[#f7f5f0] border border-brand-200 px-2 py-0.5 rounded-sm font-bold text-brand-500 shadow-sm ml-2">まだ参加予定の人はいません</span>;

    if (!isPublic && !isOrganizer) {
        return <span className="text-sm font-bold text-brand-900 ml-2 bg-[#f7f5f0] border border-brand-200 px-3 py-0.5 rounded-sm shadow-sm">{uids.length} 人</span>;
    }

    return (
        <div className="flex flex-col items-end gap-1.5 ml-2 mt-1 w-full relative group">
            <span className="text-xs font-bold text-brand-900 bg-[#f7f5f0] border border-brand-200 px-2 py-0.5 rounded-sm shadow-sm absolute right-0 -top-7 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">{uids.length} 名の参加予定</span>
            <div className="flex flex-wrap gap-1.5 justify-end w-full pl-6">
                {users.map((u: any) => (
                    <Link key={u.uid} href={`/user/${u.uid}`} title={u.name || 'User'} className="relative group/avatar cursor-pointer">
                        {u.photoURL ? (
                            <img src={u.photoURL} alt={u.name || 'User'} className="w-8 h-8 rounded-sm border border-brand-300 object-cover shadow-sm bg-white group-hover/avatar:border-[#b8860b] group-hover/avatar:shadow-md transition-all z-0" />
                        ) : (
                            <div className="w-8 h-8 rounded-sm border border-brand-200 bg-[#f7f5f0] flex items-center justify-center text-[#c8b9a6] shadow-sm group-hover/avatar:border-[#b8860b] group-hover/avatar:shadow-md transition-all z-0">
                                <User size={16} />
                            </div>
                        )}
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-black/80 text-white text-[9px] font-bold rounded-sm whitespace-nowrap opacity-0 group-hover/avatar:opacity-100 transition-opacity z-20 shadow-md">
                            {u.name || 'User'}
                        </span>
                    </Link>
                ))}
                {uids.length > 10 && <div className="w-8 h-8 rounded-sm bg-brand-50 border border-brand-300 flex items-center justify-center text-[9px] font-bold text-brand-600 shadow-sm cursor-help hover:bg-brand-100 transition-colors tooltip" title={`他 ${uids.length - 10}名`}>+{uids.length - 10}</div>}
            </div>
        </div>
    );
}


function getGoogleCalendarLink(event: any) {
    if (!event) return '#';
    const title = encodeURIComponent(event.title || 'イベント');
    const details = encodeURIComponent(event.description || '');
    const location = encodeURIComponent(event.locationName || '');
    
    // Convert NOAH format date/time into standard UTC ISO formatted YYYYMMDDTHHmmssZ
    const formatGoogleDate = (dateStr: string, timeStr: string) => {
        if (!dateStr || !timeStr) return '';
        try {
            const d = new Date(`${dateStr}T${timeStr}:00+09:00`); // Assuming JST as standard locale
            return d.toISOString().replace(/-|:/g, '').replace(/\..+Z/, 'Z');
        } catch(e) {
            return '';
        }
    };
    const start = formatGoogleDate(event.startDate, event.startTime);
    const end = formatGoogleDate(event.endDate, event.endTime);
    let dates = '';
    if (start && end) dates = `&dates=${start}/${end}`;
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}${dates}&details=${details}&location=${location}`;
}

export default function EventDetailSheet({ 
    event, 
    onClose, 
    adjustMode, 
    setFullImageUrl, 
    userData, 
    refreshPartsKey,
    currentUserId,
    isJoined,
    toggleParticipate,
    openEditModal,
    onDelete,
    onShare
}: { 
    event: any | null, 
    onClose: () => void, 
    adjustMode?: boolean,
    setFullImageUrl: (url: string) => void,
    userData: any,
    refreshPartsKey?: number,
    currentUserId?: string,
    isJoined?: boolean,
    toggleParticipate?: (evt: any) => void,
    openEditModal?: (id: string) => void,
    onDelete?: (evt: any) => void,
    onShare?: (evt: any) => void
}) {

    if (!event) return null;

    const isOrganizerOrAdmin = userData?.userId === 'admin' || userData?.uid === event.organizerId;

    return (
        <div className={`detail-sheet fixed bottom-0 left-0 w-full z-[80] bg-[#fffdf9] border-t border-brand-300 rounded-t-xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] pb-safe-bottom max-h-[90vh] overflow-y-auto lg:top-16 lg:bottom-auto lg:left-auto lg:right-0 lg:w-[450px] lg:h-[calc(100vh-64px)] lg:max-h-none lg:rounded-none lg:border-t-0 lg:border-l lg:pb-0 bg-texture transition-transform duration-300 ${!adjustMode ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-x-full'}`}>
            <div className="sticky top-0 bg-[#fffdf9]/95 backdrop-blur z-20 pt-3 pb-2 flex justify-center border-b border-brand-100 lg:pt-4 lg:pb-4 cursor-pointer" onClick={onClose}>
                <div className="w-12 h-1 bg-brand-300 rounded-full lg:hidden"></div>
                <div className="hidden lg:flex w-full justify-between items-center px-5">
                    <span className="text-xs font-bold text-brand-500 tracking-widest">イベント詳細</span>
                    <X className="w-5 h-5 text-brand-400 hover:text-brand-700" />
                </div>
            </div>
            <div className="px-5 pb-20 lg:pb-8 pt-4">
                <div>
                    {event.imageUrls && event.imageUrls.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 snap-x">
                            {event.imageUrls.map((url: string, idx: number) => (
                                <img key={idx} src={url} onClick={() => setFullImageUrl(url)} className="w-48 h-32 sm:w-64 sm:h-40 object-cover rounded-sm border border-brand-200 shadow-sm shrink-0 snap-center cursor-pointer hover:opacity-90 transition-opacity" />
                            ))}
                        </div>
                    ) : event.thumbnailUrl && (
                        <img src={event.thumbnailUrl} onClick={() => setFullImageUrl(event.thumbnailUrl!)} className="w-full h-48 sm:h-64 object-cover rounded-sm border border-brand-200 mb-5 shadow-sm cursor-pointer hover:opacity-90 transition-opacity" />
                    )}
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                        {event.isOnline && <span className="bg-brand-800 text-white text-xs px-2.5 py-1 rounded-sm font-bold tracking-widest shadow-sm">オンライン</span>}
                        {Number(event.price) === 0 ? <span className="bg-[#b8860b] text-[#fffdf9] text-xs px-2.5 py-1 rounded-sm font-bold tracking-widest shadow-sm">無料</span> : <span className="border border-[#b8860b] text-[#b8860b] bg-white text-xs px-2.5 py-1 rounded-sm font-bold tracking-widest shadow-sm">¥{event.price}</span>}
                    </div>
                    
                    <h2 className="text-xl sm:text-2xl font-bold text-brand-900 font-serif mb-4 tracking-widest leading-tight">{event.title}</h2>
                    
                    <div className="bg-brand-50 border border-brand-100 p-4 rounded-sm space-y-3 mb-6">
                        <div className="flex justify-between items-start border-b border-brand-200 pb-2">
                            <span className="text-xs font-bold text-brand-500 tracking-widest mt-0.5"><Calendar className="w-4 h-4 inline mr-1 text-brand-400"/>日時</span>
                            <div className="text-sm font-bold text-brand-900 text-right">
                                {event.startDate} {event.startTime}<br/>
                                <span className="text-brand-400 font-normal text-xs">〜 {event.endDate} {event.endTime}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-start border-b border-brand-200 pb-2">
                            <span className="text-xs font-bold text-brand-500 tracking-widest mt-0.5"><MapPin className="w-4 h-4 inline mr-1 text-brand-400"/>場所</span>
                            <div className="text-sm font-bold text-brand-900 text-right">
                                {event.locationName || '未設定'}
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-brand-500 tracking-widest"><User className="w-4 h-4 inline mr-1 text-brand-400"/>主催者</span>
                            <Link href={`/user?uid=${event.organizerId}`} className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline">{event.organizerName}</Link>
                        </div>
                        <div className="flex flex-col items-start border-t border-brand-200 pt-4 pb-1">
                            <span className="text-xs font-bold text-brand-500 tracking-widest mt-0.5 opacity-80 flex items-center gap-1 mb-2"><User className="w-3.5 h-3.5 text-brand-400"/> 参加予定の乗船者</span>
                            <EventParticipantsList eventId={event.id} isPublic={event.isParticipantsPublic} isOrganizer={isOrganizerOrAdmin} refreshKey={refreshPartsKey} />
                        </div>
                    </div>
                    
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-brand-800 mb-2 tracking-widest border-l-2 border-[#b8860b] pl-2 font-serif">イベント詳細</h3>
                        <div className="text-brand-700 text-sm leading-relaxed whitespace-pre-wrap markdown-body" dangerouslySetInnerHTML={{ __html: formatText(event.description) }} />
                    </div>
                    
                    {event.tags?.length > 0 && (
                        <div className="mb-6 flex flex-wrap gap-2">
                            {event.tags.map((t: string) => <span key={t} className="text-xs bg-white text-brand-600 border border-brand-200 px-2 py-1 rounded-sm shadow-sm font-bold tracking-widest">#{t}</span>)}
                        </div>
                    )}

                    <div className="mt-6 flex flex-col gap-3">
                        {currentUserId && event.organizerId !== currentUserId && toggleParticipate && (
                            <button onClick={() => toggleParticipate(event)} className={`w-full py-3.5 rounded-sm text-sm font-bold tracking-widest transition-colors shadow-md border ${isJoined ? 'bg-[#fffdf9] text-brand-700 border-brand-300 hover:bg-brand-50 text-center hover:-translate-y-0.5' : 'bg-[#3e2723] text-[#f7f5f0] hover:bg-[#2a1a17] border-[#b8860b] text-center hover:-translate-y-0.5'}`}>
                                {isJoined ? '参加をキャンセル' : '参加を申し込む'}
                            </button>
                        )}
                        {isJoined && (
                            <a href={getGoogleCalendarLink(event)} target="_blank" rel="noopener noreferrer" className="w-full mt-1 py-2.5 bg-white border border-[#4285F4] text-[#4285F4] rounded-sm text-xs font-bold tracking-widest hover:bg-[#e8f0fe] transition-colors shadow-sm flex justify-center items-center gap-2">
                                <CalendarPlus className="w-4 h-4" /> Googleカレンダーに追加
                            </a>
                        )}

                        {onShare && (
                            <button onClick={() => onShare(event)} className="w-full mt-1 py-2.5 bg-brand-50 border border-brand-200 text-brand-600 rounded-sm text-xs font-bold tracking-widest hover:bg-brand-100 transition-colors shadow-sm flex justify-center items-center gap-2"><Share2 className="w-4 h-4" />友達に共有する (リンクコピー)</button>
                        )}
                        
                        {isOrganizerOrAdmin && openEditModal && (
                            <div className="flex gap-2 mt-2 border-t border-brand-200 pt-3">
                                <button onClick={() => { onClose(); openEditModal(event.id); }} className="flex-1 py-2.5 bg-[#f7f5f0] border border-brand-300 text-brand-700 rounded-sm text-xs font-bold tracking-widest hover:bg-white transition-colors shadow-sm">編集</button>
                                {onDelete && (
                                    <button onClick={() => { if(window.confirm('本当にこのイベントを削除しますか？')){ onDelete(event); onClose(); } } } className="flex-1 py-2.5 bg-[#fffdf9] border border-red-300 text-red-600 rounded-sm text-xs font-bold tracking-widest hover:bg-red-50 transition-colors shadow-sm">削除</button>
                                )}
                            </div>
                        )}

                        <Link href={`/events?eventId=${event.id}`} className="w-full mt-3 py-3 bg-[#e8dfd1] text-[#3e2723] rounded-sm text-center text-xs font-bold tracking-widest block hover:bg-[#dcd4c6] transition-colors shadow-sm relative group overflow-hidden">
                            イベントの詳細ページを開く
                            <div className="absolute top-0 left-0 w-2 h-full bg-[#b8860b] group-hover:w-full opacity-10 transition-all duration-300"></div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
