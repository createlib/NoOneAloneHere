'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection, query, where, addDoc, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
    ArrowLeft, Heart, MessageSquare, Share2, Bookmark, BookOpen,
    Clock, Eye, Send, X, Copy, Loader2, PenLine, Trash2, ChevronUp,
    CornerDownRight, AlertTriangle
} from 'lucide-react';
import { ArticleRenderer } from '@/components/ArticleRenderer';

/* ── Design tokens ─────────────────────────────────────────────── */
const BG   = '#f8f6f3';
const SB   = '#1a3024';
const SAGE = '#4a7c59';
const LIME = '#8ecfb2';
const T1   = '#2a2520';
const T2   = '#7a7068';
const TM   = '#b0a89e';
const NEU_SM = '3px 3px 10px #dbd7d2,-3px -3px 10px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #dbd7d2,inset -3px -3px 8px #ffffff';

interface ArticleData {
    authorId:string; authorName:string; authorIcon:string;
    title:string; body:string; coverImageUrl?:string;
    tags:string[]; category:string;
    status:string; visibility:string;
    allowedUserIds?:string[]; allowedListIds?:string[];
    allowComments:boolean; likeCount:number; commentCount:number; viewCount:number;
    readingTime:number; wordCount:number;
    createdAt:string; updatedAt:string; publishedAt?:string;
}
interface CommentData {
    id:string; authorId:string; authorName:string; authorIcon:string;
    text:string; createdAt:any;
    parentId?:string; // for replies
}

const fmtDate = (d:any) => {
    try { const dt = new Date(d); return `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日`; }
    catch { return ''; }
};

/* ══════════════════════════════════════════════════════════════════ */
export default function ArticleViewPage() {
    return (
        <Suspense fallback={<div style={{ minHeight:'100vh',background:BG,display:'flex',alignItems:'center',justifyContent:'center' }}><Loader2 size={24} color={SAGE} style={{ animation:'spin .8s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
            <ArticleViewInner />
        </Suspense>
    );
}

function ArticleViewInner() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const articleId = searchParams.get('id') || '';

    const [article, setArticle] = useState<ArticleData|null>(null);
    const [loading, setLoading] = useState(true);
    const [liked, setLiked] = useState(false);
    const [bookmarked, setBookmarked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [comments, setComments] = useState<CommentData[]>([]);
    const [commentText, setCommentText] = useState('');
    const [replyTo, setReplyTo] = useState<CommentData|null>(null);
    const [replyText, setReplyText] = useState('');
    const [showShare, setShowShare] = useState(false);
    const [toc, setToc] = useState<{id:string; text:string; level:number}[]>([]);
    const [showToc, setShowToc] = useState(false);
    const [authorArticles, setAuthorArticles] = useState<any[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [accessDenied, setAccessDenied] = useState(false);

    /* ── Load article ─────────────────────────────────────────── */
    useEffect(() => {
        if (!articleId) return;
        // Firebase認証セッションの復元が完了するまで待機する
        // （PWA/LINEなど外部アプリ経由で開かれた場合、user=nullのまま
        //   アクセスチェックが走り誤って「限定公開」と判定されるのを防ぐ）
        if (authLoading) return;
        const load = async () => {
            setLoading(true);
            setAccessDenied(false); // 再ロード時にリセット
            try {
                const snap = await getDoc(doc(db,'artifacts',APP_ID,'public','data','articles',articleId));
                if (!snap.exists()) { setLoading(false); return; }
                const d = snap.data() as ArticleData;
                setArticle(d);
                setLikeCount(d.likeCount||0);

                // Increment view count
                try {
                    await setDoc(doc(db,'artifacts',APP_ID,'public','data','articles',articleId),
                        { viewCount: increment(1) }, { merge:true });
                } catch {}

                // Check access permission
                const vis = d.visibility || 'public';
                if (vis !== 'public' && d.authorId !== user?.uid) {
                    if (!user || user.isAnonymous) {
                        setAccessDenied(true); setLoading(false); return;
                    }
                    if (vis === 'followers' || vis === 'mutual') {
                        // Check if current user follows the author
                        try {
                            const folSnap = await getDoc(doc(db,'artifacts',APP_ID,'users',user.uid,'following',d.authorId));
                            if (!folSnap.exists()) { setAccessDenied(true); setLoading(false); return; }
                        } catch { setAccessDenied(true); setLoading(false); return; }
                    }
                    if (vis === 'custom') {
                        // まず allowedUserIds（展開済み個人UID）をチェック
                        let hasAccess = d.allowedUserIds?.includes(user.uid) ?? false;

                        // allowedUserIds に含まれていない場合、allowedListIds のリストメンバーも確認する
                        // （保存後にリストメンバーが変更されたケースや展開漏れに対応）
                        if (!hasAccess && d.allowedListIds && d.allowedListIds.length > 0) {
                            for (const lid of d.allowedListIds) {
                                try {
                                    const lSnap = await getDoc(doc(db,'artifacts',APP_ID,'users',d.authorId,'audience_lists',lid));
                                    if (lSnap.exists() && (lSnap.data().memberIds || []).includes(user.uid)) {
                                        hasAccess = true;
                                        break;
                                    }
                                } catch {}
                            }
                        }

                        if (!hasAccess) { setAccessDenied(true); setLoading(false); return; }
                    }
                }

                // Check liked/bookmarked
                if (user && !user.isAnonymous) {
                    try {
                        const likeSnap = await getDoc(doc(db,'artifacts',APP_ID,'public','data','articles',articleId,'likes',user.uid));
                        setLiked(likeSnap.exists());
                    } catch { setLiked(false); }
                    try {
                        const bmSnap = await getDoc(doc(db,'artifacts',APP_ID,'users',user.uid,'bookmarked_articles',articleId));
                        setBookmarked(bmSnap.exists());
                    } catch { setBookmarked(false); }
                }

                // Load comments
                const cSnap = await getDocs(collection(db,'artifacts',APP_ID,'public','data','articles',articleId,'comments'));
                const cList:CommentData[] = [];
                cSnap.forEach(c => cList.push({ id:c.id, ...c.data() } as CommentData));
                cList.sort((a,b) => {
                    const ta = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime();
                    const tb = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime();
                    return ta-tb;
                });
                setComments(cList);

                // Load author's other articles
                const aSnap = await getDocs(query(
                    collection(db,'artifacts',APP_ID,'public','data','articles'),
                    where('authorId','==',d.authorId),
                    where('status','==','published'),
                ));
                const others:any[] = [];
                aSnap.forEach(a => { if(a.id!==articleId) others.push({ id:a.id, ...a.data() }); });
                others.sort((a,b) => new Date(b.publishedAt||b.createdAt).getTime() - new Date(a.publishedAt||a.createdAt).getTime());
                setAuthorArticles(others.slice(0,4));

            } catch(e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [articleId, user, authLoading]);

    /* ── Build TOC from body HTML ─────────────────────────────── */
    useEffect(() => {
        if (!article?.body) return;
        const parser = new DOMParser();
        const dom = parser.parseFromString(article.body, 'text/html');
        const headings = dom.querySelectorAll('h2, h3');
        const items:{id:string;text:string;level:number}[] = [];
        headings.forEach((h,i) => {
            const id = `heading-${i}`;
            items.push({ id, text:h.textContent||'', level: h.tagName==='H2'?2:3 });
        });
        setToc(items);
    }, [article?.body]);

    /* ── Like (uses articles/{id}/likes/{uid} sub-collection) ─── */
    const handleLike = async () => {
        if (!user || user.isAnonymous || !articleId) return;
        try {
            const likeRef = doc(db,'artifacts',APP_ID,'public','data','articles',articleId,'likes',user.uid);
            const artRef = doc(db,'artifacts',APP_ID,'public','data','articles',articleId);
            if (liked) {
                await deleteDoc(likeRef);
                await setDoc(artRef, { likeCount: increment(-1) }, { merge:true });
                setLiked(false); setLikeCount(c=>c-1);
            } else {
                await setDoc(likeRef, { createdAt: serverTimestamp() });
                await setDoc(artRef, { likeCount: increment(1) }, { merge:true });
                setLiked(true); setLikeCount(c=>c+1);
                if (article?.authorId && article.authorId !== user.uid) {
                    try {
                        await addDoc(collection(db,'artifacts',APP_ID,'users',article.authorId,'notifications'),
                            { type:'article_like', fromUid:user.uid, contentId:articleId, createdAt:serverTimestamp(), isRead:false });
                    } catch {}
                }
            }
        } catch(e) { console.error('Like error:', e); }
    };

    /* ── Bookmark (uses users/{uid}/bookmarked_articles/{id}) ──── */
    const handleBookmark = async () => {
        if (!user || user.isAnonymous || !articleId) return;
        try {
            const bmRef = doc(db,'artifacts',APP_ID,'users',user.uid,'bookmarked_articles',articleId);
            if (bookmarked) { await deleteDoc(bmRef); setBookmarked(false); }
            else { await setDoc(bmRef, { createdAt:serverTimestamp() }); setBookmarked(true); }
        } catch(e) { console.error('Bookmark error:', e); }
    };

    /* ── Comment ──────────────────────────────────────────────── */
    const handleComment = async () => {
        if (!user || user.isAnonymous || !commentText.trim()) return;
        try {
            const uSnap = await getDoc(doc(db,'artifacts',APP_ID,'users',user.uid,'profile','data'));
            const uData = uSnap.exists() ? uSnap.data() : {};
            const c = {
                authorId:user.uid, authorName:uData.name||'名無し', authorIcon:uData.photoURL||'',
                text:commentText.trim(), createdAt:serverTimestamp(),
            };
            const cRef = await addDoc(collection(db,'artifacts',APP_ID,'public','data','articles',articleId,'comments'), c);
            setComments(prev => [...prev, { id:cRef.id, ...c, createdAt:new Date() } as any]);
            setCommentText('');
            await setDoc(doc(db,'artifacts',APP_ID,'public','data','articles',articleId), { commentCount:increment(1) }, { merge:true });
        } catch(e) { console.error('Comment error:', e); }
    };

    /* ── Reply (article author only) ───────────────────────────── */
    const handleReply = async () => {
        if (!user || user.isAnonymous || !replyText.trim() || !replyTo) return;
        try {
            const uSnap = await getDoc(doc(db,'artifacts',APP_ID,'users',user.uid,'profile','data'));
            const uData = uSnap.exists() ? uSnap.data() : {};
            const r = {
                authorId:user.uid, authorName:uData.name||'名無し', authorIcon:uData.photoURL||'',
                text:replyText.trim(), createdAt:serverTimestamp(),
                parentId: replyTo.id,
            };
            const rRef = await addDoc(collection(db,'artifacts',APP_ID,'public','data','articles',articleId,'comments'), r);
            setComments(prev => [...prev, { id:rRef.id, ...r, createdAt:new Date() } as any]);
            setReplyText('');
            setReplyTo(null);
            await setDoc(doc(db,'artifacts',APP_ID,'public','data','articles',articleId), { commentCount:increment(1) }, { merge:true });
        } catch(e) { console.error('Reply error:', e); }
    };

    /* ── Delete comment (own comment or article author) ──────── */
    const handleDeleteComment = async (commentId:string) => {
        if (!user || !articleId) return;
        if (!confirm('このコメントを削除しますか？')) return;
        try {
            await deleteDoc(doc(db,'artifacts',APP_ID,'public','data','articles',articleId,'comments',commentId));
            setComments(prev => prev.filter(c => c.id !== commentId));
            await setDoc(doc(db,'artifacts',APP_ID,'public','data','articles',articleId), { commentCount:increment(-1) }, { merge:true });
        } catch(e) { console.error('Delete comment error:', e); }
    };

    /* ── Delete article (author only) ────────────────────────── */
    const handleDeleteArticle = async () => {
        if (!user || !articleId) return;
        setDeleting(true);
        try {
            // Delete all sub-collections (comments, likes)
            const commentsSnap = await getDocs(collection(db,'artifacts',APP_ID,'public','data','articles',articleId,'comments'));
            for (const d of commentsSnap.docs) { await deleteDoc(d.ref); }
            const likesSnap = await getDocs(collection(db,'artifacts',APP_ID,'public','data','articles',articleId,'likes'));
            for (const d of likesSnap.docs) { await deleteDoc(d.ref); }
            // Delete the article
            await deleteDoc(doc(db,'artifacts',APP_ID,'public','data','articles',articleId));
            router.push('/media/podcasts?tab=article');
        } catch(e) {
            console.error('Delete article error:', e);
            setDeleting(false);
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setShowShare(false);
    };

    /* ── Inject heading IDs into body HTML ────────────────────── */
    const processedBody = (() => {
        if (!article?.body) return '';
        let i = 0;
        return article.body.replace(/<(h[23])>/g, (_, tag) => `<${tag} id="heading-${i++}">`);
    })();

    if (loading) return (
        <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Loader2 size={24} color={SAGE} style={{ animation:'spin .8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (!article) return (
        <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
            <BookOpen size={32} color={TM} />
            <div style={{ fontSize:14, fontWeight:700, color:T2 }}>記事が見つかりません</div>
            <button onClick={() => router.back()} style={{ padding:'8px 20px', borderRadius:10, border:'none', background:SB, color:LIME, fontSize:11, fontWeight:700, cursor:'pointer' }}>メディアに戻る</button>
        </div>
    );

    if (accessDenied) return (
        <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, padding:20 }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(74,124,89,.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Eye size={24} color={SAGE} />
            </div>
            <div style={{ fontSize:16, fontWeight:800, color:T1, textAlign:'center' }}>限定公開の記事です</div>
            <div style={{ fontSize:12, color:T2, textAlign:'center', lineHeight:1.6, maxWidth:280 }}>
                この記事は投稿者が公開範囲を限定しています。<br/>閲覧するには投稿者のフォローまたは招待が必要です。
            </div>
            <button onClick={() => router.back()} style={{ padding:'10px 24px', borderRadius:10, border:'none', background:SB, color:LIME, fontSize:12, fontWeight:700, cursor:'pointer' }}>戻る</button>
        </div>
    );

    const isAuthor = user?.uid === article.authorId;
    const isAdmin = user?.uid === 'xY3yxCV3GGWAbKr58Q4W7J3EQqG2';

    // Separate top-level comments and replies
    const topComments = comments.filter(c => !c.parentId);
    const getReplies = (parentId:string) => comments.filter(c => c.parentId === parentId);

    return (
        <div style={{ minHeight:'100vh', background:BG, paddingBottom:100 }}>
            {/* Header */}
            <div style={{
                position:'sticky', top:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'10px 16px', background:`${BG}ee`, backdropFilter:'blur(10px)',
                borderBottom:'1px solid rgba(0,0,0,.06)',
            }}>
                <button onClick={() => router.back()}
                    style={{ display:'flex', alignItems:'center', gap:6, border:'none', background:'transparent', cursor:'pointer', color:T2, fontSize:12, fontWeight:600 }}>
                    <ArrowLeft size={16} /> 戻る
                </button>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {isAuthor && (
                        <>
                            <Link href={`/media/articles/edit?id=${articleId}`}
                                style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 12px', borderRadius:8, border:'none', background:BG, boxShadow:NEU_SM, fontSize:10, fontWeight:700, color:SAGE, textDecoration:'none' }}>
                                <PenLine size={11} /> 編集
                            </Link>
                            <button onClick={() => setShowDeleteConfirm(true)}
                                style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 12px', borderRadius:8, border:'none', background:BG, boxShadow:NEU_SM, fontSize:10, fontWeight:700, color:'#dc3c3c', cursor:'pointer' }}>
                                <Trash2 size={11} /> 削除
                            </button>
                        </>
                    )}
                    <button onClick={() => setShowShare(!showShare)} style={{ position:'relative', width:32, height:32, borderRadius:'50%', border:'none', background:BG, boxShadow:NEU_SM, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T2 }}>
                        <Share2 size={13} />
                    </button>
                </div>
            </div>

            {/* Delete confirmation modal */}
            {showDeleteConfirm && (
                <div style={{ position:'fixed', inset:0, zIndex:9000, background:'rgba(0,0,0,.45)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center' }}
                    onClick={e => { if(e.target===e.currentTarget) setShowDeleteConfirm(false); }}>
                    <div style={{ background:BG, borderRadius:20, padding:28, maxWidth:360, width:'90%', boxShadow:'0 16px 48px rgba(0,0,0,.2)', textAlign:'center' }}>
                        <AlertTriangle size={36} color="#dc3c3c" style={{ margin:'0 auto 12px' }} />
                        <div style={{ fontSize:16, fontWeight:800, color:T1, marginBottom:8 }}>記事を削除しますか？</div>
                        <div style={{ fontSize:12, color:T2, marginBottom:20, lineHeight:1.6 }}>
                            この操作は取り消せません。<br/>記事に付いたコメントやいいねもすべて削除されます。
                        </div>
                        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                            <button onClick={() => setShowDeleteConfirm(false)}
                                style={{ padding:'10px 24px', borderRadius:10, border:'none', background:BG, boxShadow:NEU_SM, fontSize:12, fontWeight:700, color:T2, cursor:'pointer' }}>
                                キャンセル
                            </button>
                            <button onClick={handleDeleteArticle} disabled={deleting}
                                style={{ padding:'10px 24px', borderRadius:10, border:'none', background:'#dc3c3c', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', opacity:deleting?.5:1 }}>
                                {deleting ? '削除中...' : '削除する'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Share modal */}
            {showShare && (
                <div style={{ position:'fixed', inset:0, zIndex:8000, background:'rgba(0,0,0,.35)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center' }}
                    onClick={e => { if(e.target===e.currentTarget) setShowShare(false); }}>
                    <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 12px 40px rgba(0,0,0,.2)', padding:20, minWidth:260, maxWidth:320 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:T1, marginBottom:14, textAlign:'center' }}>シェア</div>
                        <button onClick={copyLink} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', borderRadius:10, border:'none', background:BG, boxShadow:NEU_SM, cursor:'pointer', fontSize:12, fontWeight:600, color:T1, marginBottom:8 }}>
                            <Copy size={14} /> URLをコピー
                        </button>
                        <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(typeof window!=='undefined'?window.location.href:'')}&text=${encodeURIComponent(article.title)}`} target="_blank" rel="noopener noreferrer"
                            style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', borderRadius:10, border:'none', background:BG, boxShadow:NEU_SM, fontSize:12, fontWeight:600, color:T1, textDecoration:'none', marginBottom:8 }}>
                            𝕏 Xでシェア
                        </a>
                        <a href={`https://line.me/R/msg/text/?${encodeURIComponent(article.title + '\n' + (typeof window!=='undefined'?window.location.href:''))}`} target="_blank" rel="noopener noreferrer"
                            style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', borderRadius:10, border:'none', background:BG, boxShadow:NEU_SM, fontSize:12, fontWeight:600, color:'#06C755', textDecoration:'none' }}>
                            LINE でシェア
                        </a>
                    </div>
                </div>
            )}

            <div style={{ maxWidth:720, margin:'0 auto', padding:'0 20px', ['--article-px' as any]: '20px' }} className="article-container">
                {/* Cover */}
                {article.coverImageUrl && (
                    <div className="article-cover" style={{ overflow:'hidden', margin:'0 0 24px' }}>
                        <img src={article.coverImageUrl} alt="" style={{ width:'100%', aspectRatio:'1280/670', objectFit:'cover', display:'block' }} />
                    </div>
                )}

                {/* Title */}
                <h1 style={{ fontSize:26, fontWeight:800, color:T1, lineHeight:1.4, margin:'24px 0 16px', letterSpacing:'.01em' }}>
                    {article.title}
                </h1>

                {/* Author + meta */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <img src={article.authorIcon||'/default_avatar.png'} alt=""
                        style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:`2px solid ${BG}`, boxShadow:NEU_SM }}
                        onError={e => { (e.target as HTMLImageElement).src='/default_avatar.png'; }} />
                    <div>
                        <div style={{ fontSize:13, fontWeight:700, color:T1 }}>{article.authorName}</div>
                        <div style={{ fontSize:10, color:TM, display:'flex', alignItems:'center', gap:8 }}>
                            <span>{fmtDate(article.publishedAt||article.createdAt)}</span>
                            <span style={{ display:'flex', alignItems:'center', gap:3 }}><Clock size={9} /> {article.readingTime}分で読める</span>
                            <span style={{ display:'flex', alignItems:'center', gap:3 }}><Eye size={9} /> {article.viewCount||0}</span>
                        </div>
                    </div>
                </div>

                {/* Tags */}
                {article.tags?.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:20 }}>
                        {article.tags.map(t => (
                            <span key={t} style={{ padding:'3px 10px', borderRadius:100, background:BG, boxShadow:NEU_SM, fontSize:10, fontWeight:600, color:SAGE }}>
                                #{t}
                            </span>
                        ))}
                    </div>
                )}

                {/* TOC */}
                {toc.length > 0 && (
                    <div style={{ marginBottom:24, borderRadius:14, background:BG, boxShadow:NEU_SM, overflow:'hidden' }}>
                        <button onClick={() => setShowToc(!showToc)}
                            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', border:'none', background:'transparent', cursor:'pointer' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, color:T1 }}>
                                <BookOpen size={13} color={SAGE} /> 目次
                            </div>
                            <ChevronUp size={13} color={TM} style={{ transform:showToc?'none':'rotate(180deg)', transition:'transform .2s' }} />
                        </button>
                        {showToc && (
                            <div style={{ padding:'0 16px 14px' }}>
                                {toc.map((h,i) => (
                                    <a key={i} href={`#${h.id}`} onClick={e => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({behavior:'smooth',block:'start'}); }}
                                        style={{ display:'block', padding:'5px 0', paddingLeft:h.level===3?16:0, fontSize:12, fontWeight:h.level===2?700:400, color:SAGE, textDecoration:'none', borderBottom:'1px solid rgba(0,0,0,.04)' }}>
                                        {h.text}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Article body */}
                <ArticleRenderer html={processedBody} />

                {/* Action bar */}
                <div style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:12,
                    padding:'16px 0', borderTop:'1px solid rgba(0,0,0,.06)', borderBottom:'1px solid rgba(0,0,0,.06)',
                    marginBottom:32,
                }}>
                    <button onClick={handleLike}
                        style={{
                            display:'flex', alignItems:'center', gap:5, padding:'8px 18px', borderRadius:100,
                            border:'none', background:liked?'rgba(220,60,60,.08)':BG, boxShadow:NEU_SM,
                            fontSize:12, fontWeight:700, color:liked?'#dc3c3c':T2, cursor:'pointer',
                        }}>
                        <Heart size={14} fill={liked?'#dc3c3c':'none'} /> {likeCount}
                    </button>
                    <a href="#comments"
                        style={{
                            display:'flex', alignItems:'center', gap:5, padding:'8px 18px', borderRadius:100,
                            border:'none', background:BG, boxShadow:NEU_SM,
                            fontSize:12, fontWeight:700, color:T2, textDecoration:'none',
                        }}>
                        <MessageSquare size={14} /> {comments.length}
                    </a>
                    <button onClick={handleBookmark}
                        style={{
                            display:'flex', alignItems:'center', gap:5, padding:'8px 18px', borderRadius:100,
                            border:'none', background:bookmarked?'rgba(74,124,89,.08)':BG, boxShadow:NEU_SM,
                            fontSize:12, fontWeight:700, color:bookmarked?SAGE:T2, cursor:'pointer',
                        }}>
                        <Bookmark size={14} fill={bookmarked?SAGE:'none'} /> 保存
                    </button>
                    <button onClick={() => setShowShare(!showShare)}
                        style={{
                            display:'flex', alignItems:'center', gap:5, padding:'8px 18px', borderRadius:100,
                            border:'none', background:BG, boxShadow:NEU_SM,
                            fontSize:12, fontWeight:700, color:T2, cursor:'pointer', position:'relative',
                        }}>
                        <Share2 size={14} /> シェア
                    </button>
                </div>

                {/* Comments section */}
                <div id="comments" style={{ marginBottom:40 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:16 }}>
                        <MessageSquare size={14} color={SAGE} />
                        <span style={{ fontSize:14, fontWeight:700, color:T1 }}>コメント ({comments.length})</span>
                    </div>

                    {/* Top-level comments */}
                    {topComments.map(c => {
                        const canDelete = user && (user.uid === c.authorId || isAuthor || isAdmin);
                        const canReply = isAuthor && user && user.uid !== c.authorId;
                        const replies = getReplies(c.id);
                        return (
                            <div key={c.id} style={{ marginBottom:16 }}>
                                {/* Comment card */}
                                <div style={{ display:'flex', gap:10, padding:12, borderRadius:12, background:BG, boxShadow:NEU_SM }}>
                                    <img src={c.authorIcon||'/default_avatar.png'} alt=""
                                        style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}
                                        onError={e => { (e.target as HTMLImageElement).src='/default_avatar.png'; }} />
                                    <div style={{ flex:1, minWidth:0 }}>
                                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                            <div style={{ fontSize:11, fontWeight:700, color:T1 }}>{c.authorName}</div>
                                            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                                                {canReply && (
                                                    <button onClick={() => { setReplyTo(replyTo?.id===c.id?null:c); setReplyText(''); }}
                                                        style={{ border:'none', background:'transparent', cursor:'pointer', color:SAGE, fontSize:10, fontWeight:600, display:'flex', alignItems:'center', gap:3 }}>
                                                        <CornerDownRight size={10} /> 返信
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button onClick={() => handleDeleteComment(c.id)}
                                                        style={{ border:'none', background:'transparent', cursor:'pointer', color:TM, padding:2 }}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ fontSize:13, color:T1, lineHeight:1.6, marginTop:2 }}>{c.text}</div>
                                    </div>
                                </div>

                                {/* Replies */}
                                {replies.length > 0 && (
                                    <div style={{ marginLeft:38, marginTop:8, display:'flex', flexDirection:'column', gap:8 }}>
                                        {replies.map(r => {
                                            const canDeleteReply = user && (user.uid === r.authorId || isAuthor || isAdmin);
                                            return (
                                                <div key={r.id} style={{ display:'flex', gap:8, padding:10, borderRadius:10, background:BG, boxShadow:NEU_SM, borderLeft:`3px solid ${SAGE}` }}>
                                                    <img src={r.authorIcon||'/default_avatar.png'} alt=""
                                                        style={{ width:24, height:24, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}
                                                        onError={e => { (e.target as HTMLImageElement).src='/default_avatar.png'; }} />
                                                    <div style={{ flex:1, minWidth:0 }}>
                                                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                                            <div style={{ fontSize:10, fontWeight:700, color:SAGE }}>{r.authorName}
                                                                {r.authorId === article.authorId && <span style={{ marginLeft:4, fontSize:8, background:SAGE, color:'#fff', padding:'1px 5px', borderRadius:4, fontWeight:600 }}>著者</span>}
                                                            </div>
                                                            {canDeleteReply && (
                                                                <button onClick={() => handleDeleteComment(r.id)}
                                                                    style={{ border:'none', background:'transparent', cursor:'pointer', color:TM, padding:2 }}>
                                                                    <Trash2 size={10} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize:12, color:T1, lineHeight:1.5, marginTop:2 }}>{r.text}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Reply input (for article author) */}
                                {replyTo?.id === c.id && (
                                    <div style={{ marginLeft:38, marginTop:8, display:'flex', gap:6 }}>
                                        <input value={replyText} onChange={e => setReplyText(e.target.value)}
                                            onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                                            placeholder={`${c.authorName}に返信...`}
                                            autoFocus
                                            style={{ flex:1, padding:'8px 12px', border:'none', borderRadius:10, background:BG, boxShadow:NEU_IN, fontSize:11, color:T1, outline:'none' }} />
                                        <button onClick={handleReply}
                                            style={{ padding:'8px 12px', borderRadius:10, border:'none', background:SB, color:LIME, cursor:'pointer', display:'flex', alignItems:'center' }}>
                                            <Send size={11} />
                                        </button>
                                        <button onClick={() => setReplyTo(null)}
                                            style={{ padding:'8px', borderRadius:10, border:'none', background:BG, boxShadow:NEU_SM, cursor:'pointer', display:'flex', alignItems:'center', color:TM }}>
                                            <X size={11} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* New comment input */}
                    {user && !user.isAnonymous && (
                        <div style={{ display:'flex', gap:8, marginTop:16 }}>
                            <input value={commentText} onChange={e => setCommentText(e.target.value)}
                                onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                                placeholder="コメントを入力..."
                                style={{ flex:1, padding:'10px 14px', border:'none', borderRadius:12, background:BG, boxShadow:NEU_IN, fontSize:12, color:T1, outline:'none' }} />
                            <button onClick={handleComment}
                                style={{ padding:'10px 16px', borderRadius:12, border:'none', background:SB, color:LIME, cursor:'pointer', display:'flex', alignItems:'center' }}>
                                <Send size={13} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Author's other articles */}
                {authorArticles.length > 0 && (
                    <div>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:14 }}>
                            <PenLine size={13} color={SAGE} />
                            <span style={{ fontSize:13, fontWeight:700, color:T1 }}>{article.authorName}の他の記事</span>
                        </div>
                        <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8, scrollbarWidth:'none' }}>
                            {authorArticles.map(a => (
                                <Link key={a.id} href={`/media/articles/view?id=${a.id}`}
                                    style={{ flexShrink:0, width:200, borderRadius:12, overflow:'hidden', background:BG, boxShadow:NEU_SM, textDecoration:'none', color:T1 }}>
                                    {a.coverImageUrl && (
                                        <img src={a.coverImageUrl} alt="" style={{ width:'100%', height:100, objectFit:'cover' }} />
                                    )}
                                    <div style={{ padding:10 }}>
                                        <div style={{ fontSize:12, fontWeight:700, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{a.title}</div>
                                        <div style={{ fontSize:9, color:TM, marginTop:4 }}>{fmtDate(a.publishedAt||a.createdAt)}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Article body styles */}
            <style>{`
                                @keyframes spin{to{transform:rotate(360deg)}}
                .article-body { margin-bottom: 40px; }
                .article-body h2 { font-size: 22px; font-weight: 800; margin: 32px 0 12px; color: ${T1}; border-bottom: 2px solid rgba(0,0,0,.06); padding-bottom: 8px; }
                .article-body h3 { font-size: 17px; font-weight: 700; margin: 24px 0 8px; color: ${T1}; }
                .article-body p { margin: 0 0 12px; }
                .article-body ul, .article-body ol { padding-left: 24px !important; margin: 8px 0 !important; }
                .article-body ul { list-style-type: disc !important; }
                .article-body ol { list-style-type: decimal !important; }
                .article-body li { margin: 4px 0 !important; display: list-item !important; }
                .article-body blockquote { border-left: 3px solid ${SAGE}; padding: 8px 16px; margin: 16px 0; background: rgba(74,124,89,.04); border-radius: 0 8px 8px 0; color: ${T2}; font-style: italic; }
                .article-body pre { background: #1e1e2e; color: #cdd6f4; padding: 16px; border-radius: 10px; margin: 16px 0; overflow-x: auto; font-size: 13px; line-height: 1.6; }
                .article-body code { background: rgba(0,0,0,.06); padding: 2px 6px; border-radius: 4px; font-size: 13px; }
                .article-body pre code { background: transparent; padding: 0; }
                .article-body img { max-width: 100%; border-radius: 10px; margin: 16px 0; display: block; }
                .article-body a { color: ${SAGE}; text-decoration: underline; }
                .article-body mark { background: #fef08a; padding: 1px 4px; border-radius: 3px; }
                .article-body hr { border: none; border-top: 2px solid rgba(0,0,0,.06); margin: 24px 0; }
                /* テーブル：横スクロール対応 */
                .article-body table { border-collapse: collapse; margin: 16px 0; width: max-content; min-width: 100%; }
                .article-body .table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 16px 0; border-radius: 8px; border: 1px solid rgba(0,0,0,.08); }
                .article-body .table-wrapper table { margin: 0; border-radius: 0; }
                .article-body th, .article-body td { border: 1px solid rgba(0,0,0,.1); padding: 8px 12px; font-size: 13px; white-space: nowrap; }
                .article-body th { background: rgba(74,124,89,.06); font-weight: 700; }
                .article-body s { text-decoration: line-through; color: ${TM}; }
                .article-body iframe { border-radius: 10px; margin: 16px 0; max-width: 100%; }
                /* タブヘッダースクロールバー非表示（Webkit） */
                .noah-tabs-header::-webkit-scrollbar { display: none; }
                /* カバー画像：モバイルで全幅・角なし */
                @media (max-width: 767px) {
                    .article-container { padding: 0 !important; }
                    .article-cover { margin: 0 !important; border-radius: 0 !important; }
                    .article-container > *:not(.article-cover) { padding-left: 16px; padding-right: 16px; }
                    .article-body { padding: 0 16px; }
                }
            `}</style>
        </div>
    );
}
