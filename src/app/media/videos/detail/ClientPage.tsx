'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, ThumbsUp, Share2, AlignLeft, MessageSquare, Lock, Play, Film, CheckCircle2, Loader2, ChevronDown, ChevronUp, Send } from 'lucide-react';

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
const FALLBACK_AVATAR = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#dbd7d2"/><circle cx="16" cy="12" r="5" fill="#b0a89e"/><ellipse cx="16" cy="26" rx="9" ry="7" fill="#b0a89e"/></svg>');

interface VideoData {
    id: string; title: string; description: string; tags: string[];
    authorId: string; authorName: string; authorIcon: string;
    thumbnailUrl: string; embedUrl: string; sourceUrl: string;
    allowComments: boolean; createdAt: string | any;
}
interface CommentData {
    id: string; userId: string; userName: string; userIcon: string;
    text: string; isPrivate: boolean; createdAt: any;
}

export default function VideoDetailPage() {
    const searchParams = useSearchParams();
    const id = searchParams?.get('id') || '';
    const { user, loading } = useAuth();
    const router = useRouter();

    const [videoData, setVideoData]   = useState<VideoData | null>(null);
    const [isLoading, setIsLoading]   = useState(true);
    const [notFound, setNotFound]     = useState(false);
    const [isAdmin, setIsAdmin]       = useState(false);
    const [myProfile, setMyProfile]   = useState<any>(null);
    const [comments, setComments]     = useState<CommentData[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isPrivateComment, setIsPrivateComment] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [isLiked, setIsLiked]       = useState(false);
    const [relatedVideos, setRelatedVideos] = useState<VideoData[]>([]);
    const [showNotification, setShowNotification] = useState(false);
    const [isDescExpanded, setIsDescExpanded] = useState(false);

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
                const vidSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id));
                if (vidSnap.exists()) setVideoData({ id: vidSnap.id, ...vidSnap.data() } as VideoData);
                else setNotFound(true);
            } catch { setNotFound(true); }
            finally { setIsLoading(false); }
        };
        init();
    }, [id, user, loading]);

    useEffect(() => {
        if (!videoData) return;
        const likesRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id, 'likes');
        const unsubLikes = onSnapshot(likesRef, (snap) => {
            setLikesCount(snap.size);
            if (user) setIsLiked(!!snap.docs.find(d => d.id === user.uid));
        });
        let unsubComments = () => {};
        if (videoData.allowComments !== false) {
            const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id, 'comments'), orderBy('createdAt', 'desc'));
            unsubComments = onSnapshot(q, (snap) => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommentData))));
        }
        const fetchRelated = async () => {
            try {
                const snap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos'));
                const vids: VideoData[] = [];
                snap.forEach(d => { if (d.id !== id) vids.push({ id: d.id, ...d.data() } as VideoData); });
                vids.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setRelatedVideos(vids.slice(0, 6));
            } catch {}
        };
        fetchRelated();
        return () => { unsubLikes(); unsubComments(); };
    }, [videoData, id, user]);

    const formatText = (text: string) => {
        if (!text) return '';
        try { return DOMPurify.sanitize(marked.parse(text, { breaks: true }) as string); }
        catch { return text.replace(/\n/g, '<br>'); }
    };

    const handleLike = async () => {
        if (!user || user.isAnonymous) return alert('いいねするにはログインが必要です');
        try {
            const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id, 'likes', user.uid);
            if (isLiked) await deleteDoc(ref); else await setDoc(ref, { timestamp: serverTimestamp() });
        } catch {}
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setShowNotification(true); setTimeout(() => setShowNotification(false), 3000);
        }).catch(() => alert('コピーに失敗しました。\n' + window.location.href));
    };

    const handleDeleteVideo = async () => {
        if (!confirm('本当にこの動画を削除しますか？\n※この操作は元に戻せません。')) return;
        try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id)); router.push('/media/videos'); }
        catch { alert('削除に失敗しました'); }
    };

    const handlePostComment = async () => {
        if (!user || user.isAnonymous) return alert('コメントするにはログインが必要です');
        const text = newComment.trim(); if (!text) return;
        setIsSubmittingComment(true);
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id, 'comments'), {
                userId: user.uid, userName: myProfile?.name || myProfile?.userId || '名無し',
                userIcon: myProfile?.photoURL || null, text, isPrivate: isPrivateComment, createdAt: serverTimestamp(),
            });
            setNewComment(''); setIsPrivateComment(false);
        } catch { alert('コメントの送信に失敗しました'); }
        finally { setIsSubmittingComment(false); }
    };

    const handleDeleteComment = async (cid: string) => {
        if (!confirm('コメントを削除しますか？')) return;
        try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id, 'comments', cid)); }
        catch { alert('削除に失敗しました'); }
    };

    /* ── Loading ─────────────────────────────────────────────────── */
    if (isLoading) return (
        <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Loader2 size={32} color={SAGE} style={{ animation:'spin .8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (notFound || !videoData) return (
        <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <div style={{ textAlign:'center', padding:'40px 32px', borderRadius:20, background:BG, boxShadow:NEU }}>
                <Film size={36} color={TM} style={{ margin:'0 auto 12px' }} />
                <div style={{ fontSize:14, fontWeight:700, color:T2 }}>動画が見つかりませんでした</div>
                <button onClick={() => router.back()} style={{ marginTop:16, padding:'8px 20px', borderRadius:10, border:'none', background:SB, color:LIME, fontSize:12, fontWeight:700, cursor:'pointer' }}>戻る</button>
            </div>
        </div>
    );

    const videoDate = (() => { try { return new Date(videoData.createdAt?.toDate ? videoData.createdAt.toDate() : videoData.createdAt).toLocaleDateString('ja-JP'); } catch { return ''; } })();
    const isOwner = user && user.uid === videoData.authorId;
    const canManage = isOwner || isAdmin;

    /* ══════════════════════════════════════════════════════════════ */
    return (
        <div style={{ minHeight:'100vh', background:BG, paddingBottom:100 }}>
            {/* ── URLコピー通知 (glassmorphism) ─────────────────── */}
            <div style={{
                position:'fixed', top:20, left:'50%', transform:`translateX(-50%) translateY(${showNotification ? 0 : -80}px)`,
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

            <div style={{ maxWidth:1400, margin:'0 auto', padding:'24px 16px 40px' }}>

                {/* ── 戻るボタン ────────────────────────────────── */}
                <button onClick={() => router.back()} style={{
                    display:'flex', alignItems:'center', gap:6,
                    padding:'8px 16px', borderRadius:12, border:'none',
                    background:BG, boxShadow:NEU_SM, cursor:'pointer',
                    fontSize:11, fontWeight:700, color:T2, marginBottom:20,
                }}>
                    <ArrowLeft size={14} /> 戻る
                </button>

                {/* ── メインレイアウト ───────────────────────────── */}
                <div style={{ display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap' }}>

                    {/* ── 左カラム: 動画 + 情報 ─────────────────── */}
                    <div style={{ flex:'1 1 480px', minWidth:0 }}>

                        {/* 動画プレーヤー (glassmorphism container) */}
                        <div style={{
                            width:'100%', aspectRatio:'16/9',
                            borderRadius:20, overflow:'hidden',
                            background:'#0d1a14',
                            boxShadow:'0 12px 48px rgba(0,0,0,.4), 0 0 0 1px rgba(74,124,89,.2)',
                            marginBottom:20, position:'relative',
                        }}>
                            {videoData.embedUrl ? (
                                <iframe
                                    src={videoData.embedUrl}
                                    style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:'none' }}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            ) : videoData.sourceUrl ? (
                                <video
                                    src={videoData.sourceUrl} controls
                                    style={{ position:'absolute', inset:0, width:'100%', height:'100%', background:'#000' }}
                                />
                            ) : (
                                <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                    <Play size={40} color={SAGE} />
                                </div>
                            )}
                        </div>

                        {/* タグ */}
                        {videoData.tags?.length > 0 && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                                {videoData.tags.map(tag => (
                                    <span key={tag} style={{
                                        padding:'4px 10px', borderRadius:8,
                                        background:BG, boxShadow:NEU_SM,
                                        fontSize:9, fontWeight:700, color:SAGE, letterSpacing:'.06em',
                                    }}>#{tag}</span>
                                ))}
                            </div>
                        )}

                        {/* タイトル + 管理ボタン */}
                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:16 }}>
                            <h1 style={{ fontSize:20, fontWeight:800, color:T1, lineHeight:1.4, flex:1, margin:0 }}>
                                {videoData.title || 'タイトルなし'}
                            </h1>
                            {canManage && (
                                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                                    <Link href={`/media/videos/new?vid=${id}`} style={{
                                        display:'flex', alignItems:'center', gap:4,
                                        padding:'6px 12px', borderRadius:8, border:'none',
                                        background:BG, boxShadow:NEU_SM,
                                        fontSize:10, fontWeight:700, color:SAGE,
                                        textDecoration:'none',
                                    }}>
                                        <Edit size={11} /> 編集
                                    </Link>
                                    <button onClick={handleDeleteVideo} style={{
                                        display:'flex', alignItems:'center', gap:4,
                                        padding:'6px 12px', borderRadius:8, border:'none',
                                        background:BG, boxShadow:NEU_SM,
                                        fontSize:10, fontWeight:700, color:RED, cursor:'pointer',
                                    }}>
                                        <Trash2 size={11} /> 削除
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 投稿者 + いいね/シェア */}
                        <div style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            flexWrap:'wrap', gap:10,
                            paddingBottom:20, marginBottom:20,
                            borderBottom:`1px solid rgba(0,0,0,.06)`,
                        }}>
                            <Link href={`/user?uid=${videoData.authorId}&tab=media`} style={{
                                display:'flex', alignItems:'center', gap:10,
                                padding:'8px 16px 8px 8px', borderRadius:100,
                                background:BG, boxShadow:NEU_SM,
                                textDecoration:'none',
                            }}>
                                <img
                                    src={videoData.authorIcon || FALLBACK_AVATAR}
                                    alt={videoData.authorName}
                                    style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:`2px solid ${SAGE}` }}
                                    onError={e => { const i = e.target as HTMLImageElement; i.onerror = null; i.src = FALLBACK_AVATAR; }}
                                />
                                <div>
                                    <div style={{ fontSize:12, fontWeight:700, color:T1 }}>{videoData.authorName || '名無し'}</div>
                                    <div style={{ fontSize:9, color:TM }}>{videoDate}</div>
                                </div>
                            </Link>

                            <div style={{ display:'flex', gap:8 }}>
                                <button onClick={handleLike} style={{
                                    display:'flex', alignItems:'center', gap:6,
                                    padding:'8px 16px', borderRadius:12, border:'none', cursor:'pointer',
                                    background: isLiked ? 'rgba(217,112,112,.12)' : BG,
                                    boxShadow: isLiked ? `inset 0 0 0 2px ${RED}` : NEU_SM,
                                    fontSize:12, fontWeight:700,
                                    color: isLiked ? RED : T2,
                                    transition:'all .2s',
                                }}>
                                    <ThumbsUp size={14} style={{ fill: isLiked ? RED : 'none' }} />
                                    {likesCount}
                                </button>
                                <button onClick={handleShare} style={{
                                    display:'flex', alignItems:'center', gap:6,
                                    padding:'8px 16px', borderRadius:12, border:'none', cursor:'pointer',
                                    background:BG, boxShadow:NEU_SM,
                                    fontSize:12, fontWeight:700, color:T2,
                                }}>
                                    <Share2 size={14} /> シェア
                                </button>
                            </div>
                        </div>

                        {/* ── 概要 ───────────────────────────────── */}
                        <div style={{ background:BG, boxShadow:NEU, borderRadius:18, padding:'20px 22px', marginBottom:16 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, paddingBottom:12, borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                                <div style={{
                                    width:32, height:32, borderRadius:'50%',
                                    background:BG, boxShadow:NEU_SM,
                                    display:'flex', alignItems:'center', justifyContent:'center',
                                }}>
                                    <AlignLeft size={14} color={SAGE} />
                                </div>
                                <span style={{ fontSize:13, fontWeight:800, color:T1 }}>概要</span>
                            </div>

                            <div style={{ position:'relative', overflow: isDescExpanded ? 'visible' : 'hidden', maxHeight: isDescExpanded ? 'none' : 160 }}>
                                <div
                                    style={{ fontSize:13, color:T2, lineHeight:1.8 }}
                                    dangerouslySetInnerHTML={{ __html: formatText(videoData.description) || '<span style="color:#b0a89e">概要はありません</span>' }}
                                />
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

                        {/* ── コメント ────────────────────────────── */}
                        <div style={{ background:BG, boxShadow:NEU, borderRadius:18, padding:'20px 22px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, paddingBottom:12, borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                                <div style={{
                                    width:32, height:32, borderRadius:'50%',
                                    background:BG, boxShadow:NEU_SM,
                                    display:'flex', alignItems:'center', justifyContent:'center',
                                }}>
                                    <MessageSquare size={14} color={SAGE} />
                                </div>
                                <span style={{ fontSize:13, fontWeight:800, color:T1 }}>
                                    コメント
                                </span>
                                <span style={{ fontSize:11, color:TM }}>
                                    {videoData.allowComments === false ? '' : `(${comments.length})`}
                                </span>
                            </div>

                            {videoData.allowComments === false ? (
                                <div style={{ textAlign:'center', padding:'24px', color:TM, fontSize:12 }}>
                                    <MessageSquare size={20} style={{ margin:'0 auto 8px', opacity:.5 }} />
                                    コメントはオフになっています
                                </div>
                            ) : (
                                <>
                                    {/* コメント入力 */}
                                    {!user || user.isAnonymous ? (
                                        <div style={{
                                            textAlign:'center', padding:'14px',
                                            borderRadius:12, background:BG, boxShadow:NEU_IN,
                                            fontSize:12, color:TM, marginBottom:16,
                                        }}>
                                            <Link href="/login" style={{ color:SAGE, fontWeight:700, textDecoration:'none' }}>ログイン</Link>してコメントを投稿
                                        </div>
                                    ) : (
                                        <div style={{ display:'flex', gap:10, marginBottom:20, alignItems:'flex-start' }}>
                                            <img
                                                src={myProfile?.photoURL || FALLBACK_AVATAR}
                                                alt=""
                                                style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:`2px solid ${SAGE}` }}
                                                onError={e => { const i = e.target as HTMLImageElement; i.onerror = null; i.src = FALLBACK_AVATAR; }}
                                            />
                                            <div style={{ flex:1, background:BG, boxShadow:NEU_IN, borderRadius:14, overflow:'hidden' }}>
                                                <textarea
                                                    value={newComment}
                                                    onChange={e => setNewComment(e.target.value)}
                                                    rows={2}
                                                    placeholder="感想や質問を書いてみましょう..."
                                                    style={{
                                                        width:'100%', padding:'10px 14px', border:'none',
                                                        background:'transparent', resize:'none',
                                                        fontSize:12, color:T1, outline:'none',
                                                        fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box',
                                                    }}
                                                />
                                                <div style={{
                                                    display:'flex', alignItems:'center', justifyContent:'space-between',
                                                    padding:'8px 12px', borderTop:'1px solid rgba(0,0,0,.06)',
                                                }}>
                                                    <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, fontWeight:700, color:TM, cursor:'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isPrivateComment}
                                                            onChange={e => setIsPrivateComment(e.target.checked)}
                                                            style={{ accentColor: SAGE }}
                                                        />
                                                        <Lock size={9} /> 投稿者のみ
                                                    </label>
                                                    <button
                                                        onClick={handlePostComment}
                                                        disabled={isSubmittingComment || !newComment.trim()}
                                                        style={{
                                                            display:'flex', alignItems:'center', gap:5,
                                                            padding:'6px 14px', borderRadius:10, border:'none',
                                                            background: newComment.trim() ? SB : BG,
                                                            color: newComment.trim() ? LIME : TM,
                                                            boxShadow: newComment.trim() ? 'none' : NEU_SM,
                                                            fontSize:10, fontWeight:700, cursor: newComment.trim() ? 'pointer' : 'default',
                                                            opacity: isSubmittingComment ? .6 : 1,
                                                            transition:'all .2s',
                                                        }}
                                                    >
                                                        {isSubmittingComment ? <Loader2 size={11} style={{ animation:'spin .8s linear infinite' }} /> : <Send size={11} />}
                                                        送信
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* コメントリスト */}
                                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                                        {comments.length === 0 ? (
                                            <div style={{
                                                textAlign:'center', padding:'24px',
                                                borderRadius:12, background:BG, boxShadow:NEU_IN,
                                                fontSize:11, color:TM,
                                            }}>
                                                まだコメントはありません。最初の感想を書いてみましょう！
                                            </div>
                                        ) : comments.map(c => {
                                            const d = c.createdAt ? new Date(c.createdAt.toMillis ? c.createdAt.toMillis() : c.createdAt) : new Date();
                                            const dateStr = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                                            const canDelete = isAdmin || (user && user.uid === c.userId) || isOwner;
                                            const isPrivate = c.isPrivate;
                                            const canSeePrivate = isAdmin || (user && (user.uid === c.userId)) || isOwner;

                                            if (isPrivate && !canSeePrivate) return (
                                                <div key={c.id} style={{
                                                    display:'flex', alignItems:'center', gap:6,
                                                    padding:'10px 14px', borderRadius:12,
                                                    background:BG, boxShadow:NEU_SM,
                                                    fontSize:10, color:TM, fontStyle:'italic',
                                                }}>
                                                    <Lock size={10} /> このコメントは投稿者のみ公開されています
                                                </div>
                                            );

                                            return (
                                                <div key={c.id} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                                                    <img
                                                        src={c.userIcon || FALLBACK_AVATAR} alt=""
                                                        style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0, marginTop:2, border:`2px solid ${BG}`, boxShadow:NEU_SM }}
                                                        onError={e => { const i = e.target as HTMLImageElement; i.onerror = null; i.src = FALLBACK_AVATAR; }}
                                                    />
                                                    <div style={{ flex:1, minWidth:0 }}>
                                                        <div style={{
                                                            padding:'10px 14px', borderRadius:14,
                                                            background:BG,
                                                            boxShadow: isPrivate ? `inset 0 0 0 1.5px ${RED}` : NEU_SM,
                                                            position:'relative',
                                                        }}>
                                                            {isPrivate && (
                                                                <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:RED, fontWeight:700, marginBottom:6 }}>
                                                                    <Lock size={8} /> 投稿者のみ公開
                                                                </div>
                                                            )}
                                                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                                                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                                                    <span style={{ fontSize:12, fontWeight:700, color:T1 }}>{c.userName || '名無し'}</span>
                                                                    <span style={{ fontSize:9, color:TM }}>{dateStr}</span>
                                                                </div>
                                                                {canDelete && (
                                                                    <button onClick={() => handleDeleteComment(c.id)} style={{
                                                                        border:'none', background:'transparent', cursor:'pointer', color:TM, padding:2, display:'flex',
                                                                    }}>
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                )}
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

                    {/* ── 右サイドバー: 関連動画 ────────────────── */}
                    <div style={{ width:'100%', maxWidth:320, flexShrink:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                            <Film size={14} color={SAGE} />
                            <span style={{ fontSize:12, fontWeight:800, color:T1 }}>新着の動画</span>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                            {relatedVideos.map(v => {
                                const date = (() => { try { return new Date(v.createdAt?.toDate ? v.createdAt.toDate() : v.createdAt).toLocaleDateString('ja-JP'); } catch { return ''; } })();
                                return (
                                    <Link key={v.id} href={`/media/videos/detail?id=${v.id}`} style={{ textDecoration:'none' }}>
                                        <div style={{
                                            display:'flex', gap:10,
                                            padding:10, borderRadius:14,
                                            background:BG, boxShadow:NEU_SM,
                                            transition:'box-shadow .2s',
                                        }}
                                            onMouseEnter={e => (e.currentTarget.style.boxShadow = NEU)}
                                            onMouseLeave={e => (e.currentTarget.style.boxShadow = NEU_SM)}
                                        >
                                            <div style={{
                                                width:110, aspectRatio:'16/9', flexShrink:0,
                                                borderRadius:10, overflow:'hidden', background:'#111',
                                                position:'relative',
                                            }}>
                                                <img
                                                    src={v.thumbnailUrl || 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 18"><rect width="32" height="18" fill="#2a2520"/><polygon points="12,4 12,14 22,9" fill="#4a7c59"/></svg>')}
                                                    alt={v.title}
                                                    style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                                    onError={e => { const i = e.target as HTMLImageElement; i.onerror = null; i.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 18"><rect width="32" height="18" fill="#2a2520"/><polygon points="12,4 12,14 22,9" fill="#4a7c59"/></svg>'); }}
                                                />
                                                <div style={{
                                                    position:'absolute', inset:0,
                                                    display:'flex', alignItems:'center', justifyContent:'center',
                                                    background:'rgba(0,0,0,.2)',
                                                }}>
                                                    <Play size={14} color="#fff" fill="#fff" />
                                                </div>
                                            </div>
                                            <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', justifyContent:'center' }}>
                                                <div style={{
                                                    fontSize:11, fontWeight:700, color:T1, lineHeight:1.4,
                                                    display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
                                                    marginBottom:4,
                                                }}>{v.title}</div>
                                                <div style={{ fontSize:9, color:TM }}>{v.authorName || '名無し'}</div>
                                                <div style={{ fontSize:9, color:TM }}>{date}</div>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                            {relatedVideos.length === 0 && (
                                <div style={{ textAlign:'center', padding:20, fontSize:11, color:TM }}>他の動画はありません</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @media (max-width: 768px) {
                    /* サイドバーを下に表示 */
                }
            `}</style>
        </div>
    );
}
