'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, Heart, Share2, AlignLeft, MessageSquare, Lock, Mic, CalendarDays, Clock, Minimize2, X, CheckCircle2, Loader2, ChevronDown, ChevronUp, Send, ExternalLink } from 'lucide-react';

/* ── Design tokens ─────────────────────────────────────────────── */
const BG     = '#f8f6f3';
const SB     = '#1a3024';
const SAGE   = '#4a7c59';
const LIME   = '#8ecfb2';
const T1     = '#2a2520';
const T2     = '#7a7068';
const TM     = '#b0a89e';
const RED    = '#d97070';
const NEU    = '6px 6px 16px #dbd7d2,-6px -6px 16px #ffffff';
const NEU_SM = '3px 3px 10px #dbd7d2,-3px -3px 10px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #dbd7d2,inset -3px -3px 8px #ffffff';
const FALLBACK_AVATAR  = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#dbd7d2"/><circle cx="16" cy="12" r="5" fill="#b0a89e"/><ellipse cx="16" cy="26" rx="9" ry="7" fill="#b0a89e"/></svg>');
const FALLBACK_PODCAST = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#4a7c59"/><rect x="13" y="6" width="6" height="11" rx="3" fill="#f8f6f3"/><path d="M9 17 Q9 25 16 25 Q23 25 23 17" stroke="#f8f6f3" stroke-width="2" fill="none"/><rect x="15" y="25" width="2" height="4" fill="#f8f6f3"/></svg>');

interface PodcastData {
    id: string; title: string; description: string; tags: string[];
    authorId: string; authorName: string; authorIcon: string;
    thumbnailUrl: string; audioUrl: string; isEmbed: boolean; duration: number;
    relatedArticleUrls?: string[]; relatedArticleUrl?: string;
    allowComments: boolean; createdAt: string | any; updatedAt: string | any;
}
interface CommentData {
    id: string; userId: string; userName: string; userIcon: string;
    text: string; isPrivate: boolean; createdAt: any;
}

export default function PodcastDetailPage() {
    const searchParams = useSearchParams();
    const id = searchParams?.get('id') || '';
    const { user, loading } = useAuth();
    const router = useRouter();

    const [podcastData, setPodcastData]   = useState<PodcastData | null>(null);
    const [isLoading, setIsLoading]       = useState(true);
    const [notFound, setNotFound]         = useState(false);
    const [isAdmin, setIsAdmin]           = useState(false);
    const [myProfile, setMyProfile]       = useState<any>(null);
    const [comments, setComments]         = useState<CommentData[]>([]);
    const [newComment, setNewComment]     = useState('');
    const [isPrivateComment, setIsPrivateComment] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [likesCount, setLikesCount]     = useState(0);
    const [isLiked, setIsLiked]           = useState(false);
    const [relatedPodcasts, setRelatedPodcasts] = useState<PodcastData[]>([]);
    const [showNotification, setShowNotification] = useState(false);
    const [isDescExpanded, setIsDescExpanded] = useState(false);
    const [isMiniPlayerActive, setIsMiniPlayerActive] = useState(false);

    useEffect(() => {
        if (loading) return;
        if (!id) { setTimeout(() => { setIsLoading(false); setNotFound(true); }, 800); return; }
        const init = async () => {
            if (user && !user.isAnonymous) {
                try {
                    const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'));
                    if (snap.exists()) { setMyProfile(snap.data()); if (snap.data().userId === 'admin') setIsAdmin(true); }
                } catch {}
            }
            try {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id));
                if (snap.exists()) setPodcastData({ id: snap.id, ...snap.data() } as PodcastData);
                else setNotFound(true);
            } catch { setNotFound(true); }
            finally { setIsLoading(false); }
        };
        init();
    }, [id, user, loading]);

    useEffect(() => {
        if (!podcastData) return;
        const unsubLikes = onSnapshot(collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id, 'likes'), (snap) => {
            setLikesCount(snap.size);
            if (user) setIsLiked(!!snap.docs.find(d => d.id === user.uid));
        });
        let unsubComments = () => {};
        if (podcastData.allowComments !== false) {
            const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id, 'comments'), orderBy('createdAt', 'desc'));
            unsubComments = onSnapshot(q, (snap) => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommentData))));
        }
        const fetchRelated = async () => {
            try {
                const snap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts'));
                const pods: PodcastData[] = [];
                snap.forEach(d => { if (d.id !== id) pods.push({ id: d.id, ...d.data() } as PodcastData); });
                pods.sort((a, b) => new Date(b.createdAt || b.updatedAt).getTime() - new Date(a.createdAt || a.updatedAt).getTime());
                setRelatedPodcasts(pods.slice(0, 6));
            } catch {}
        };
        fetchRelated();
        return () => { unsubLikes(); unsubComments(); };
    }, [podcastData, id, user]);

    const formatText = (text: string) => {
        if (!text) return '';
        try { return DOMPurify.sanitize(marked.parse(text, { breaks: true }) as string); }
        catch { return text.replace(/\n/g, '<br>'); }
    };
    const formatDuration = (sec: number | undefined) => {
        if (!sec || isNaN(sec)) return '--:--';
        const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' + s : s}`;
    };

    const handleLike = async () => {
        if (!user || user.isAnonymous) return alert('いいねするにはログインが必要です');
        try {
            const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id, 'likes', user.uid);
            if (isLiked) await deleteDoc(ref); else await setDoc(ref, { timestamp: serverTimestamp() });
        } catch {}
    };
    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href)
            .then(() => { setShowNotification(true); setTimeout(() => setShowNotification(false), 3000); })
            .catch(() => alert('コピーに失敗しました。\n' + window.location.href));
    };
    const handleDelete = async () => {
        if (!confirm('本当にこのエピソードを削除しますか？\n※この操作は元に戻せません。')) return;
        try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id)); router.push('/media/podcasts'); }
        catch { alert('削除に失敗しました'); }
    };
    const handlePostComment = async () => {
        if (!user || user.isAnonymous) return alert('コメントするにはログインが必要です');
        const text = newComment.trim(); if (!text) return;
        setIsSubmittingComment(true);
        try {
            const isPublicSetting = myProfile?.profilePublic === 'true';
            const isPaidMember = myProfile?.membershipRank !== 'arrival';
            const canPublish = isPaidMember || isAdmin;
            const safeName = (isPublicSetting && canPublish) ? (myProfile?.name || myProfile?.userId || '名無し') : 'listener' + Math.floor(Math.random() * 10000);
            const safeIcon = (isPublicSetting && canPublish) ? (myProfile?.photoURL || null) : null;
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id, 'comments'), {
                userId: user.uid, userName: safeName, userIcon: safeIcon,
                text, isPrivate: isPrivateComment, createdAt: serverTimestamp(),
            });
            setNewComment(''); setIsPrivateComment(false);
        } catch { alert('コメントの送信に失敗しました'); }
        finally { setIsSubmittingComment(false); }
    };
    const handleDeleteComment = async (cid: string) => {
        if (!confirm('コメントを削除しますか？')) return;
        try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id, 'comments', cid)); }
        catch { alert('削除に失敗しました'); }
    };

    /* ── Loading / Not found ───────────────────────────────────── */
    if (isLoading) return (
        <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Loader2 size={32} color={SAGE} style={{ animation:'spin .8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
    if (notFound || !podcastData) return (
        <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <div style={{ textAlign:'center', padding:'40px 32px', borderRadius:20, background:BG, boxShadow:NEU }}>
                <Mic size={36} color={TM} style={{ margin:'0 auto 12px' }} />
                <div style={{ fontSize:14, fontWeight:700, color:T2 }}>エピソードが見つかりませんでした</div>
                <button onClick={() => router.back()} style={{ marginTop:16, padding:'8px 20px', borderRadius:10, border:'none', background:SB, color:LIME, fontSize:12, fontWeight:700, cursor:'pointer' }}>戻る</button>
            </div>
        </div>
    );

    const isOwner = user && user.uid === podcastData.authorId;
    const canManage = isOwner || isAdmin;
    const thumbUrl = podcastData.thumbnailUrl || FALLBACK_PODCAST;
    const dateStr = (() => {
        try { const d = new Date(podcastData.createdAt?.toDate ? podcastData.createdAt.toDate() : podcastData.createdAt || podcastData.updatedAt); return d.toLocaleDateString('ja-JP'); } catch { return ''; }
    })();
    let relatedUrls: string[] = [];
    if (Array.isArray(podcastData.relatedArticleUrls)) relatedUrls = podcastData.relatedArticleUrls;
    else if (podcastData.relatedArticleUrl) relatedUrls = [podcastData.relatedArticleUrl];

    /* ══════════════════════════════════════════════════════════════ */
    return (
        <div style={{ minHeight:'100vh', background:BG, paddingBottom:100 }}>

            {/* ── URLコピー通知 (glassmorphism toast) ──────────── */}
            <div style={{
                position:'fixed', top:20, left:'50%',
                transform:`translateX(-50%) translateY(${showNotification ? 0 : -80}px)`,
                zIndex:9000, transition:'transform .3s, opacity .3s',
                opacity: showNotification ? 1 : 0, pointerEvents: showNotification ? 'auto' : 'none',
            }}>
                <div style={{
                    display:'flex', alignItems:'center', gap:8,
                    padding:'10px 20px', borderRadius:100,
                    background:'rgba(26,48,36,.85)', backdropFilter:'blur(16px)',
                    border:'1px solid rgba(142,207,178,.3)',
                    boxShadow:'0 8px 32px rgba(0,0,0,.3)',
                    color:LIME, fontSize:12, fontWeight:700,
                }}>
                    <CheckCircle2 size={14} /> URLをコピーしました
                </div>
            </div>

            {/* ── ミニプレーヤー (glassmorphism) ───────────────── */}
            {isMiniPlayerActive && (
                <div
                    style={{
                        position:'fixed', bottom:80, right:16, zIndex:8000,
                        width:300, padding:14, borderRadius:18, cursor:'pointer',
                        background:'rgba(13,26,20,.88)', backdropFilter:'blur(20px)',
                        border:'1px solid rgba(142,207,178,.2)',
                        boxShadow:'0 12px 40px rgba(0,0,0,.5)',
                        transition:'transform .2s',
                    }}
                    onClick={() => setIsMiniPlayerActive(false)}
                >
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <img
                            src={thumbUrl} alt=""
                            style={{ width:48, height:48, borderRadius:10, objectFit:'cover', flexShrink:0 }}
                            onError={e => { const i = e.target as HTMLImageElement; i.onerror = null; i.src = FALLBACK_PODCAST; }}
                        />
                        <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:9, color:LIME, fontWeight:700, marginBottom:3, display:'flex', alignItems:'center', gap:4 }}>
                                <Mic size={8} /> 再生中
                            </div>
                            <div style={{ fontSize:12, fontWeight:700, color:'#f8f6f3', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{podcastData.title}</div>
                            <div style={{ fontSize:10, color:TM, marginTop:2 }}>{podcastData.authorName}</div>
                        </div>
                        <button
                            onClick={e => { e.stopPropagation(); setIsMiniPlayerActive(false); router.back(); }}
                            style={{ width:28, height:28, borderRadius:'50%', border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.1)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#f8f6f3', flexShrink:0 }}
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>
            )}

            <div style={{ maxWidth:1400, margin:'0 auto', padding:'24px 16px 40px' }}>

                {/* ── ヘッダー行 ────────────────────────────────── */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
                    <button onClick={() => router.back()} style={{
                        display:'flex', alignItems:'center', gap:6,
                        padding:'8px 16px', borderRadius:12, border:'none',
                        background:BG, boxShadow:NEU_SM, cursor:'pointer',
                        fontSize:11, fontWeight:700, color:T2,
                    }}>
                        <ArrowLeft size={14} /> 戻る
                    </button>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <button onClick={() => setIsMiniPlayerActive(true)} style={{
                            display:'flex', alignItems:'center', gap:5,
                            padding:'7px 14px', borderRadius:12, border:'none',
                            background:BG, boxShadow:NEU_SM, cursor:'pointer',
                            fontSize:10, fontWeight:700, color:T2,
                        }}>
                            <Minimize2 size={11} /> ミニプレーヤー
                        </button>
                        {canManage && (
                            <>
                                <Link href={`/media/podcasts/new?pid=${id}`} style={{
                                    display:'flex', alignItems:'center', gap:5,
                                    padding:'7px 14px', borderRadius:12, border:'none',
                                    background:BG, boxShadow:NEU_SM,
                                    fontSize:10, fontWeight:700, color:SAGE, textDecoration:'none',
                                }}>
                                    <Edit size={11} /> 編集
                                </Link>
                                <button onClick={handleDelete} style={{
                                    display:'flex', alignItems:'center', gap:5,
                                    padding:'7px 14px', borderRadius:12, border:'none',
                                    background:BG, boxShadow:NEU_SM, cursor:'pointer',
                                    fontSize:10, fontWeight:700, color:RED,
                                }}>
                                    <Trash2 size={11} /> 削除
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ── メインレイアウト ───────────────────────────── */}
                <div style={{ display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap' }}>

                    {/* ── 左カラム ──────────────────────────────── */}
                    <div style={{ flex:'1 1 480px', minWidth:0 }}>

                        {/* ─ プレーヤーヒーロー (glassmorphism dark) ─ */}
                        <div style={{
                            borderRadius:20, overflow:'hidden', marginBottom:20,
                            background:'linear-gradient(135deg, #0d1a14 0%, #1a3024 100%)',
                            boxShadow:'0 12px 48px rgba(0,0,0,.4), 0 0 0 1px rgba(74,124,89,.2)',
                            position:'relative', padding:'32px 24px',
                            display:'flex', flexDirection:'column', alignItems:'center', gap:24,
                        }}>
                            {/* Blurred background art */}
                            <img
                                src={thumbUrl} alt=""
                                style={{
                                    position:'absolute', inset:0, width:'100%', height:'100%',
                                    objectFit:'cover', opacity:.12, filter:'blur(24px)', transform:'scale(1.15)',
                                    pointerEvents:'none',
                                }}
                                onError={e => { const i = e.target as HTMLImageElement; i.onerror = null; i.src = FALLBACK_PODCAST; }}
                            />

                            {/* Album artwork */}
                            {!podcastData.isEmbed && (
                                <div style={{
                                    position:'relative', zIndex:1,
                                    width:160, height:160, borderRadius:16, overflow:'hidden',
                                    boxShadow:'0 8px 40px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08)',
                                }}>
                                    <img
                                        src={thumbUrl} alt={podcastData.title}
                                        style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                        onError={e => { const i = e.target as HTMLImageElement; i.onerror = null; i.src = FALLBACK_PODCAST; }}
                                    />
                                </div>
                            )}

                            {/* Player */}
                            <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:560 }}>
                                {podcastData.isEmbed ? (
                                    <iframe
                                        src={podcastData.audioUrl}
                                        style={{ width:'100%', height:160, borderRadius:14, border:'none' }}
                                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                    />
                                ) : podcastData.audioUrl ? (
                                    <audio
                                        src={podcastData.audioUrl} controls
                                        style={{ width:'100%', borderRadius:50, background:'rgba(255,255,255,.08)' }}
                                    />
                                ) : (
                                    <div style={{
                                        height:80, borderRadius:14,
                                        border:'1px solid rgba(142,207,178,.2)',
                                        background:'rgba(255,255,255,.05)',
                                        display:'flex', alignItems:'center', justifyContent:'center',
                                        gap:8, color:TM, fontSize:12, fontWeight:700,
                                    }}>
                                        <Mic size={16} /> 音声データは準備中です
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ─ タグ ───────────────────────────────── */}
                        {podcastData.tags?.length > 0 && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                                {podcastData.tags.map(tag => (
                                    <span key={tag} style={{
                                        padding:'4px 10px', borderRadius:8,
                                        background:BG, boxShadow:NEU_SM,
                                        fontSize:9, fontWeight:700, color:SAGE, letterSpacing:'.06em',
                                    }}>#{tag}</span>
                                ))}
                            </div>
                        )}

                        {/* ─ タイトル ───────────────────────────── */}
                        <h1 style={{ fontSize:20, fontWeight:800, color:T1, lineHeight:1.4, margin:'0 0 16px' }}>
                            {podcastData.title || 'タイトルなし'}
                        </h1>

                        {/* ─ 投稿者 + メタ情報 + アクション ────── */}
                        <div style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            flexWrap:'wrap', gap:10,
                            paddingBottom:20, marginBottom:20,
                            borderBottom:'1px solid rgba(0,0,0,.06)',
                        }}>
                            <Link href={`/user?uid=${podcastData.authorId}&tab=media`} style={{
                                display:'flex', alignItems:'center', gap:10,
                                padding:'8px 16px 8px 8px', borderRadius:100,
                                background:BG, boxShadow:NEU_SM, textDecoration:'none',
                            }}>
                                <img
                                    src={podcastData.authorIcon || FALLBACK_AVATAR} alt={podcastData.authorName}
                                    style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:`2px solid ${SAGE}` }}
                                    onError={e => { const i = e.target as HTMLImageElement; i.onerror = null; i.src = FALLBACK_AVATAR; }}
                                />
                                <div>
                                    <div style={{ fontSize:12, fontWeight:700, color:T1 }}>{podcastData.authorName || '名無し'}</div>
                                    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
                                        <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:TM }}>
                                            <CalendarDays size={9} /> {dateStr}
                                        </span>
                                        {podcastData.duration ? (
                                            <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:TM }}>
                                                <Clock size={9} /> {formatDuration(podcastData.duration)}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </Link>

                            <div style={{ display:'flex', gap:8 }}>
                                <button onClick={handleLike} style={{
                                    display:'flex', alignItems:'center', gap:6,
                                    padding:'8px 16px', borderRadius:12, border:'none', cursor:'pointer',
                                    background: isLiked ? 'rgba(217,112,112,.12)' : BG,
                                    boxShadow: isLiked ? `inset 0 0 0 2px ${RED}` : NEU_SM,
                                    fontSize:12, fontWeight:700, color: isLiked ? RED : T2, transition:'all .2s',
                                }}>
                                    <Heart size={14} style={{ fill: isLiked ? RED : 'none', stroke: isLiked ? RED : T2 }} />
                                    {likesCount}
                                </button>
                                <button onClick={handleShare} style={{
                                    display:'flex', alignItems:'center', gap:6,
                                    padding:'8px 16px', borderRadius:12, border:'none', cursor:'pointer',
                                    background:BG, boxShadow:NEU_SM, fontSize:12, fontWeight:700, color:T2,
                                }}>
                                    <Share2 size={14} /> シェア
                                </button>
                            </div>
                        </div>

                        {/* ─ 概要 ───────────────────────────────── */}
                        <div style={{ background:BG, boxShadow:NEU, borderRadius:18, padding:'20px 22px', marginBottom:16 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, paddingBottom:12, borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                                <div style={{ width:32, height:32, borderRadius:'50%', background:BG, boxShadow:NEU_SM, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                    <AlignLeft size={14} color={SAGE} />
                                </div>
                                <span style={{ fontSize:13, fontWeight:800, color:T1 }}>エピソードの概要</span>
                            </div>

                            <div style={{ position:'relative', overflow: isDescExpanded ? 'visible' : 'hidden', maxHeight: isDescExpanded ? 'none' : 180 }}>
                                <div style={{ fontSize:13, color:T2, lineHeight:1.8 }}
                                    dangerouslySetInnerHTML={{ __html: formatText(podcastData.description) || '<span style="color:#b0a89e">概要はありません</span>' }}
                                />

                                {/* 関連記事 */}
                                {relatedUrls.length > 0 && (
                                    <div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid rgba(0,0,0,.06)' }}>
                                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, fontSize:11, fontWeight:700, color:T1 }}>
                                            <ExternalLink size={12} color={SAGE} /> 関連記事
                                        </div>
                                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                            {relatedUrls.map((url, idx) => {
                                                const noteMatch = url.match(/note\.com\/.*?n\/(n[a-zA-Z0-9]+)/) || url.match(/note\.com\/embed\/notes\/(n[a-zA-Z0-9]+)/);
                                                if (noteMatch?.[1]) {
                                                    return <iframe key={idx} src={`https://note.com/embed/notes/${noteMatch[1]}`} style={{ width:'100%', height:260, border:'none', borderRadius:10, display:'block' }} />;
                                                }
                                                return (
                                                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" style={{
                                                        display:'flex', alignItems:'center', gap:8,
                                                        padding:'8px 12px', borderRadius:10,
                                                        background:BG, boxShadow:NEU_SM,
                                                        fontSize:11, color:SAGE, fontWeight:700, textDecoration:'none',
                                                        overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                                                    }}>
                                                        <ExternalLink size={11} /> {url}
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {!isDescExpanded && (
                                    <div style={{ position:'absolute', bottom:0, left:0, right:0, height:60, background:`linear-gradient(to top, ${BG}, transparent)` }} />
                                )}
                            </div>

                            <button onClick={() => setIsDescExpanded(!isDescExpanded)} style={{
                                display:'flex', alignItems:'center', gap:4,
                                marginTop:12, padding:'6px 14px', borderRadius:10, border:'none',
                                background:BG, boxShadow:NEU_SM, cursor:'pointer',
                                fontSize:10, fontWeight:700, color:SAGE,
                            }}>
                                {isDescExpanded ? <><ChevronUp size={11} /> 閉じる</> : <><ChevronDown size={11} /> もっと見る</>}
                            </button>
                        </div>

                        {/* ─ コメント ───────────────────────────── */}
                        <div style={{ background:BG, boxShadow:NEU, borderRadius:18, padding:'20px 22px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, paddingBottom:12, borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                                <div style={{ width:32, height:32, borderRadius:'50%', background:BG, boxShadow:NEU_SM, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                    <MessageSquare size={14} color={SAGE} />
                                </div>
                                <span style={{ fontSize:13, fontWeight:800, color:T1 }}>コメント</span>
                                {podcastData.allowComments !== false && (
                                    <span style={{ fontSize:11, color:TM }}>({comments.length})</span>
                                )}
                            </div>

                            {podcastData.allowComments === false ? (
                                <div style={{ textAlign:'center', padding:24, color:TM, fontSize:12 }}>
                                    <MessageSquare size={20} style={{ margin:'0 auto 8px', opacity:.5 }} />
                                    コメントはオフになっています
                                </div>
                            ) : (
                                <>
                                    {!user || user.isAnonymous ? (
                                        <div style={{ textAlign:'center', padding:'14px', borderRadius:12, background:BG, boxShadow:NEU_IN, fontSize:12, color:TM, marginBottom:16 }}>
                                            <Link href="/login" style={{ color:SAGE, fontWeight:700, textDecoration:'none' }}>ログイン</Link>してコメントを投稿
                                        </div>
                                    ) : (
                                        <div style={{ display:'flex', gap:10, marginBottom:20, alignItems:'flex-start' }}>
                                            <img
                                                src={myProfile?.photoURL || FALLBACK_AVATAR} alt=""
                                                style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:`2px solid ${SAGE}` }}
                                                onError={e => { const i = e.target as HTMLImageElement; i.onerror = null; i.src = FALLBACK_AVATAR; }}
                                            />
                                            <div style={{ flex:1, background:BG, boxShadow:NEU_IN, borderRadius:14, overflow:'hidden' }}>
                                                <textarea
                                                    value={newComment} onChange={e => setNewComment(e.target.value)} rows={2}
                                                    placeholder="エピソードの感想や質問を..."
                                                    style={{ width:'100%', padding:'10px 14px', border:'none', background:'transparent', resize:'none', fontSize:12, color:T1, outline:'none', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box' }}
                                                />
                                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderTop:'1px solid rgba(0,0,0,.06)' }}>
                                                    <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, fontWeight:700, color:TM, cursor:'pointer' }}>
                                                        <input type="checkbox" checked={isPrivateComment} onChange={e => setIsPrivateComment(e.target.checked)} style={{ accentColor: SAGE }} />
                                                        <Lock size={9} /> 投稿者のみ
                                                    </label>
                                                    <button onClick={handlePostComment} disabled={isSubmittingComment || !newComment.trim()}
                                                        style={{
                                                            display:'flex', alignItems:'center', gap:5,
                                                            padding:'6px 14px', borderRadius:10, border:'none',
                                                            background: newComment.trim() ? SB : BG,
                                                            color: newComment.trim() ? LIME : TM,
                                                            boxShadow: newComment.trim() ? 'none' : NEU_SM,
                                                            fontSize:10, fontWeight:700,
                                                            cursor: newComment.trim() ? 'pointer' : 'default',
                                                            opacity: isSubmittingComment ? .6 : 1, transition:'all .2s',
                                                        }}>
                                                        {isSubmittingComment ? <Loader2 size={11} style={{ animation:'spin .8s linear infinite' }} /> : <Send size={11} />} 送信
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                                        {comments.length === 0 ? (
                                            <div style={{ textAlign:'center', padding:24, borderRadius:12, background:BG, boxShadow:NEU_IN, fontSize:11, color:TM }}>
                                                まだコメントはありません。最初の感想を書いてみましょう！
                                            </div>
                                        ) : comments.map(c => {
                                            const d = c.createdAt ? new Date(c.createdAt.toMillis ? c.createdAt.toMillis() : c.createdAt) : new Date();
                                            const ds = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                                            const canDelete = isAdmin || (user && user.uid === c.userId) || isOwner;
                                            const canSeePrivate = isAdmin || (user && user.uid === c.userId) || isOwner;
                                            if (c.isPrivate && !canSeePrivate) return (
                                                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 14px', borderRadius:12, background:BG, boxShadow:NEU_SM, fontSize:10, color:TM, fontStyle:'italic' }}>
                                                    <Lock size={10} /> このコメントは投稿者のみ公開されています
                                                </div>
                                            );
                                            return (
                                                <div key={c.id} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                                                    <img src={c.userIcon || FALLBACK_AVATAR} alt=""
                                                        style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0, marginTop:2, border:`2px solid ${BG}`, boxShadow:NEU_SM }}
                                                        onError={e => { const i = e.target as HTMLImageElement; i.onerror = null; i.src = FALLBACK_AVATAR; }}
                                                    />
                                                    <div style={{ flex:1, minWidth:0 }}>
                                                        <div style={{ padding:'10px 14px', borderRadius:14, background:BG, boxShadow: c.isPrivate ? `inset 0 0 0 1.5px ${RED}` : NEU_SM }}>
                                                            {c.isPrivate && <div style={{ fontSize:9, color:RED, fontWeight:700, marginBottom:6, display:'flex', alignItems:'center', gap:4 }}><Lock size={8} /> 投稿者のみ公開</div>}
                                                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                                                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                                                    <span style={{ fontSize:12, fontWeight:700, color:T1 }}>{c.userName || '名無し'}</span>
                                                                    <span style={{ fontSize:9, color:TM }}>{ds}</span>
                                                                </div>
                                                                {canDelete && <button onClick={() => handleDeleteComment(c.id)} style={{ border:'none', background:'transparent', cursor:'pointer', color:TM, padding:2, display:'flex' }}><Trash2 size={12} /></button>}
                                                            </div>
                                                            <p style={{ fontSize:12, color:T2, lineHeight:1.7, margin:0, whiteSpace:'pre-wrap' }}>{c.text}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── 右サイドバー: 関連CAST ────────────────── */}
                    <div style={{ width:'100%', maxWidth:320, flexShrink:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                            <Mic size={14} color={SAGE} />
                            <span style={{ fontSize:12, fontWeight:800, color:T1 }}>新着のCAST</span>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                            {relatedPodcasts.map(p => {
                                const dur = p.duration ? `${Math.floor(p.duration/60)}:${String(Math.floor(p.duration%60)).padStart(2,'0')}` : '';
                                return (
                                    <Link key={p.id} href={`/media/podcasts/detail?id=${p.id}`} style={{ textDecoration:'none' }}>
                                        <div style={{ background:BG, boxShadow:NEU_SM, borderRadius:14, overflow:'hidden', transition:'box-shadow .2s' }}
                                            onMouseEnter={e => (e.currentTarget.style.boxShadow = NEU)}
                                            onMouseLeave={e => (e.currentTarget.style.boxShadow = NEU_SM)}
                                        >
                                            <div style={{ width:'100%', aspectRatio:'1', position:'relative', overflow:'hidden' }}>
                                                <img src={p.thumbnailUrl || FALLBACK_PODCAST} alt={p.title}
                                                    style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                                    onError={e => { const i = e.target as HTMLImageElement; i.onerror = null; i.src = FALLBACK_PODCAST; }}
                                                />
                                                {dur && (
                                                    <span style={{ position:'absolute', bottom:6, right:6, background:'rgba(0,0,0,.7)', color:'#fff', fontSize:8, fontWeight:700, padding:'2px 5px', borderRadius:5, fontFamily:'monospace' }}>{dur}</span>
                                                )}
                                            </div>
                                            <div style={{ padding:'8px 10px 10px' }}>
                                                <div style={{ fontSize:11, fontWeight:700, color:T1, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.title || 'タイトルなし'}</div>
                                                <div style={{ fontSize:9, color:TM, marginTop:3 }}>{p.authorName || '名無し'}</div>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                            {relatedPodcasts.length === 0 && (
                                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:20, fontSize:11, color:TM }}>他のCAST配信はありません</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );
}
