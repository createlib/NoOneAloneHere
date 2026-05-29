'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import {
    doc, getDoc, setDoc, deleteDoc, addDoc, getDocs,
    collection, query, where, orderBy, serverTimestamp,
    Timestamp, increment,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import {
    Heart, MessageCircle, Repeat2, Quote, ArrowLeft, Send,
    Image as ImageIcon, X, Loader2, MoreHorizontal, Trash2, Hash,
} from 'lucide-react';

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

interface PostData {
    id: string;
    authorId: string; authorName: string; authorIcon: string; authorUserId: string;
    text: string; images: string[]; topicTag: string;
    likeCount: number; replyCount: number; repostCount: number; quoteCount: number;
    repostOf: string | null; quotedPostId: string | null; parentId: string | null;
    createdAt: any;
}

const ago = (ts: any): string => {
    if (!ts) return '';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}秒前`;
    if (s < 3600) return `${Math.floor(s/60)}分前`;
    if (s < 86400) return `${Math.floor(s/3600)}時間前`;
    return d.toLocaleDateString('ja-JP', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
};

const fullDate = (ts: any): string => {
    if (!ts) return '';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });
};

/* ══════════════════════════════════════════════════════════════════ */
export default function PostDetailWrapper() {
    return <Suspense fallback={<div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}><Loader2 size={24} color={SAGE} style={{ animation:'spin .8s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}><PostDetailPage /></Suspense>;
}

function PostDetailPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const postId = searchParams.get('id');

    const [post, setPost] = useState<PostData | null>(null);
    const [replies, setReplies] = useState<PostData[]>([]);
    const [myProfile, setMyProfile] = useState<any>(null);
    const [dataLoaded, setDataLoaded] = useState(false);

    const [liked, setLiked] = useState(false);
    const [reposted, setReposted] = useState(false);
    const [quotedPost, setQuotedPost] = useState<PostData | null>(null);

    // Reply composer
    const [replyText, setReplyText] = useState('');
    const [replyImages, setReplyImages] = useState<File[]>([]);
    const [replyImagePreviews, setReplyImagePreviews] = useState<string[]>([]);
    const [replying, setReplying] = useState(false);
    const imgInputRef = useRef<HTMLInputElement>(null);

    const [menuPostId, setMenuPostId] = useState<string | null>(null);

    useEffect(() => {
        if (loading || !postId) return;
        const load = async () => {
            // Profile
            if (user && !user.isAnonymous) {
                const pSnap = await getDoc(doc(db,'artifacts',APP_ID,'users',user.uid,'profile','data'));
                if (pSnap.exists()) setMyProfile(pSnap.data());
            }

            // Main post
            const pDoc = await getDoc(doc(db,'artifacts',APP_ID,'public','data','posts',postId));
            if (!pDoc.exists()) { setDataLoaded(true); return; }
            const mainPost = { id: pDoc.id, ...pDoc.data() } as PostData;
            setPost(mainPost);

            // Check like/repost
            if (user) {
                try {
                    const lSnap = await getDoc(doc(db,'artifacts',APP_ID,'public','data','posts',postId,'likes',user.uid));
                    setLiked(lSnap.exists());
                } catch {}
                try {
                    const rSnap = await getDoc(doc(db,'artifacts',APP_ID,'public','data','posts',postId,'reposts',user.uid));
                    setReposted(rSnap.exists());
                } catch {}
            }

            // Quoted post
            if (mainPost.quotedPostId) {
                try {
                    const qSnap = await getDoc(doc(db,'artifacts',APP_ID,'public','data','posts',mainPost.quotedPostId));
                    if (qSnap.exists()) setQuotedPost({ id: qSnap.id, ...qSnap.data() } as PostData);
                } catch {}
            }

            // Replies — fetch all posts, filter client-side (no composite index needed)
            try {
                const allSnap = await getDocs(collection(db,'artifacts',APP_ID,'public','data','posts'));
                const rList: PostData[] = [];
                allSnap.forEach(d => {
                    const data = d.data();
                    if (data.parentId === postId) {
                        rList.push({ id: d.id, ...data } as PostData);
                    }
                });
                rList.sort((a, b) => {
                    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
                    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
                    return tA - tB;
                });
                setReplies(rList);
            } catch (e) { console.error('Replies fetch error:', e); }
            setDataLoaded(true);
        };
        load();
    }, [postId, user, loading]);

    /* ── Like ───────────────────────────────────────────────────── */
    const toggleLike = async () => {
        if (!user || !postId) return;
        const likeRef = doc(db,'artifacts',APP_ID,'public','data','posts',postId,'likes',user.uid);
        const postRef = doc(db,'artifacts',APP_ID,'public','data','posts',postId);
        try {
            if (liked) {
                await deleteDoc(likeRef);
                await setDoc(postRef, { likeCount: increment(-1) }, { merge: true });
                setLiked(false);
                setPost(prev => prev ? { ...prev, likeCount: Math.max(0, prev.likeCount - 1) } : prev);
            } else {
                await setDoc(likeRef, { createdAt: serverTimestamp() });
                await setDoc(postRef, { likeCount: increment(1) }, { merge: true });
                setLiked(true);
                setPost(prev => prev ? { ...prev, likeCount: prev.likeCount + 1 } : prev);
            }
        } catch (e) { console.error(e); }
    };

    /* ── Repost ─────────────────────────────────────────────────── */
    const toggleRepost = async () => {
        if (!user || !postId) return;
        const rpRef = doc(db,'artifacts',APP_ID,'public','data','posts',postId,'reposts',user.uid);
        const postRef = doc(db,'artifacts',APP_ID,'public','data','posts',postId);
        try {
            if (reposted) {
                await deleteDoc(rpRef);
                await setDoc(postRef, { repostCount: increment(-1) }, { merge: true });
                setReposted(false);
                setPost(prev => prev ? { ...prev, repostCount: Math.max(0, prev.repostCount - 1) } : prev);
            } else {
                await setDoc(rpRef, { createdAt: serverTimestamp() });
                await setDoc(postRef, { repostCount: increment(1) }, { merge: true });
                setReposted(true);
                setPost(prev => prev ? { ...prev, repostCount: prev.repostCount + 1 } : prev);
            }
        } catch (e) { console.error(e); }
    };

    /* ── Delete ──────────────────────────────────────────────────── */
    const deletePost = async (id: string) => {
        if (!confirm('削除しますか？')) return;
        try {
            await deleteDoc(doc(db,'artifacts',APP_ID,'public','data','posts',id));
            if (id === postId) { router.back(); }
            else { setReplies(prev => prev.filter(r => r.id !== id)); }
        } catch { alert('削除に失敗しました'); }
        setMenuPostId(null);
    };

    /* ── Reply images ────────────────────────────────────────────── */
    const handleReplyImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files; if (!files) return;
        const f = Array.from(files).slice(0, 4 - replyImages.length);
        setReplyImages(prev => [...prev, ...f]);
        f.forEach(file => {
            const r = new FileReader();
            r.onload = () => setReplyImagePreviews(prev => [...prev, r.result as string]);
            r.readAsDataURL(file);
        });
        e.target.value = '';
    };

    /* ── Submit reply ────────────────────────────────────────────── */
    const submitReply = async () => {
        if (!user || !myProfile || !postId || (!replyText.trim() && replyImages.length === 0)) return;
        setReplying(true);
        try {
            const imageUrls: string[] = [];
            for (const f of replyImages) {
                const iRef = ref(storage, `posts/${user.uid}/${Date.now()}_${f.name}`);
                const snap = await uploadBytes(iRef, f);
                imageUrls.push(await getDownloadURL(snap.ref));
            }

            const replyData = {
                authorId: user.uid,
                authorName: myProfile.name || myProfile.userId || '名無し',
                authorIcon: myProfile.photoURL || '',
                authorUserId: myProfile.userId || '',
                text: replyText.trim().slice(0, 500),
                images: imageUrls,
                topicTag: '',
                likeCount: 0, replyCount: 0, repostCount: 0, quoteCount: 0,
                repostOf: null, quotedPostId: null,
                parentId: postId,
                createdAt: serverTimestamp(),
                updatedAt: new Date().toISOString(),
            };

            const docRef = await addDoc(collection(db,'artifacts',APP_ID,'public','data','posts'), replyData);
            setReplies(prev => [...prev, { id: docRef.id, ...replyData, createdAt: Timestamp.now() }]);
            setReplyText(''); setReplyImages([]); setReplyImagePreviews([]);

            // Bump replyCount
            await setDoc(doc(db,'artifacts',APP_ID,'public','data','posts',postId), { replyCount: increment(1) }, { merge: true });
            setPost(prev => prev ? { ...prev, replyCount: prev.replyCount + 1 } : prev);
        } catch (e) { console.error(e); alert('リプライに失敗しました'); }
        finally { setReplying(false); }
    };

    if (loading || !dataLoaded) return (
        <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Loader2 size={24} color={SAGE} style={{ animation:'spin .8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (!post) return (
        <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:14, fontWeight:700, color:T2 }}>投稿が見つかりません</div>
            <button onClick={() => router.push('/home')} style={{ padding:'8px 20px', borderRadius:100, border:'none', background:SB, color:LIME, fontSize:12, fontWeight:700, cursor:'pointer' }}>甲板に戻る</button>
        </div>
    );

    return (
        <AppShell
            activeHref="/home"
            currentUid={user?.uid || ''}
            userName={myProfile?.name || user?.displayName || ''}
            userIdStr={myProfile?.userId || user?.email || ''}
            photoURL={myProfile?.photoURL || user?.photoURL || ''}
            hideTopbarOnMobile
            onLogout={async () => {
                const { auth: fireAuth } = await import('@/lib/firebase');
                const { signOut } = await import('firebase/auth');
                try { await signOut(fireAuth); router.push('/login'); } catch {}
            }}
        >
            <div style={{ minHeight:'100vh', background:BG }}>
                {/* ── Header ────────────────────────────────────── */}
                <div style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'12px 16px', background:BG,
                    borderBottom:'1px solid rgba(0,0,0,.06)',
                    position:'sticky', top:0, zIndex:50,
                }}>
                    <button onClick={() => router.back()}
                        style={{ border:'none', background:'transparent', cursor:'pointer', color:T1, display:'flex' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <span style={{ fontSize:15, fontWeight:800, color:T1 }}>スレッド</span>
                </div>

                {/* ── Main Post ──────────────────────────────────── */}
                <div style={{ padding:'16px 18px', borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                    <div style={{ display:'flex', gap:12, marginBottom:12 }}>
                        <Link href={`/user?uid=${post.authorId}`} style={{ flexShrink:0 }}>
                            <div style={{ width:44, height:44, borderRadius:'50%', overflow:'hidden', background:SAGE, boxShadow:NEU_SM }}>
                                {post.authorIcon
                                    ? <img src={post.authorIcon} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                        onError={e => { (e.target as HTMLImageElement).src='/default_avatar.png'; }} />
                                    : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:18, fontWeight:700 }}>{(post.authorName||'?')[0]}</div>
                                }
                            </div>
                        </Link>
                        <div>
                            <Link href={`/user?uid=${post.authorId}`} style={{ textDecoration:'none' }}>
                                <div style={{ fontSize:14, fontWeight:700, color:T1 }}>{post.authorName}</div>
                            </Link>
                            <div style={{ fontSize:12, color:TM }}>@{post.authorUserId}</div>
                        </div>
                        <div style={{ flex:1 }} />
                        {user?.uid === post.authorId && (
                            <div style={{ position:'relative' }}>
                                <button onClick={() => setMenuPostId(menuPostId===post.id?null:post.id)}
                                    style={{ border:'none', background:'transparent', cursor:'pointer', color:TM }}>
                                    <MoreHorizontal size={18} />
                                </button>
                                {menuPostId === post.id && (
                                    <div style={{ position:'absolute', right:0, top:24, background:BG, borderRadius:10, boxShadow:'0 4px 20px rgba(0,0,0,.15)', padding:4, zIndex:10 }}>
                                        <button onClick={() => deletePost(post.id)}
                                            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', border:'none', background:'transparent', cursor:'pointer', fontSize:12, fontWeight:600, color:'#ef4444', borderRadius:8, whiteSpace:'nowrap' }}>
                                            <Trash2 size={12} /> 削除
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Topic tag */}
                    {post.topicTag && (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:100, fontSize:10, fontWeight:600, background:'rgba(74,124,89,.08)', color:SAGE, marginBottom:8 }}>
                            <Hash size={9} /> {post.topicTag}
                        </span>
                    )}

                    {/* Text */}
                    <p style={{ fontSize:16, lineHeight:1.8, color:T1, whiteSpace:'pre-wrap', wordBreak:'break-word', margin:'8px 0' }}>
                        {post.text}
                    </p>

                    {/* Images */}
                    {post.images?.length > 0 && (
                        <div style={{
                            display:'grid',
                            gridTemplateColumns: post.images.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                            gap:4, marginTop:12, borderRadius:14, overflow:'hidden',
                        }}>
                            {post.images.map((url, i) => (
                                <div key={i} style={{ aspectRatio: post.images.length===1?'16/9':'1', overflow:'hidden' }}>
                                    <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Quoted post */}
                    {quotedPost && (
                        <Link href={`/home/post?id=${quotedPost.id}`} style={{ textDecoration:'none' }}>
                            <div style={{ marginTop:12, padding:'10px 14px', borderRadius:12, border:'1px solid rgba(0,0,0,.08)', background:'rgba(0,0,0,.02)' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                                    <div style={{ width:16, height:16, borderRadius:'50%', overflow:'hidden', background:SAGE }}>
                                        {quotedPost.authorIcon
                                            ? <img src={quotedPost.authorIcon} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:8, fontWeight:700 }}>{(quotedPost.authorName||'?')[0]}</div>}
                                    </div>
                                    <span style={{ fontSize:11, fontWeight:600, color:T1 }}>{quotedPost.authorName}</span>
                                </div>
                                <p style={{ fontSize:12, color:T2, lineHeight:1.5 }}>{quotedPost.text}</p>
                            </div>
                        </Link>
                    )}

                    {/* Date */}
                    <div style={{ fontSize:12, color:TM, marginTop:16, paddingBottom:12, borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                        {fullDate(post.createdAt)}
                    </div>

                    {/* Stats bar */}
                    <div style={{ display:'flex', gap:20, padding:'12px 0', borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                        <StatItem label="リプライ" count={post.replyCount} />
                        <StatItem label="リポスト" count={post.repostCount} />
                        <StatItem label="いいね" count={post.likeCount} />
                        <StatItem label="引用" count={post.quoteCount} />
                    </div>

                    {/* Actions */}
                    <div style={{ display:'flex', justifyContent:'space-around', padding:'8px 0' }}>
                        <ActionLg icon={<MessageCircle size={20} />} color={TM} label="リプライ" onClick={() => document.getElementById('reply-input')?.focus()} />
                        <ActionLg icon={<Repeat2 size={20} />} color={reposted?'#22c55e':TM} label="リポスト" active={reposted} onClick={toggleRepost} />
                        <ActionLg icon={<Heart size={20} fill={liked?'#ef4444':'none'} />} color={liked?'#ef4444':TM} label="いいね" active={liked} onClick={toggleLike} />
                        <ActionLg icon={<Quote size={20} />} color={TM} label="引用" onClick={() => { router.push(`/home?quote=${post.id}`); }} />
                    </div>
                </div>

                {/* ── Replies ────────────────────────────────────── */}
                {replies.map(r => (
                    <div key={r.id} style={{ padding:'14px 18px', borderBottom:'1px solid rgba(0,0,0,.05)' }}>
                        <div style={{ display:'flex', gap:10 }}>
                            <Link href={`/user?uid=${r.authorId}`} style={{ flexShrink:0 }}>
                                <div style={{ width:32, height:32, borderRadius:'50%', overflow:'hidden', background:SAGE }}>
                                    {r.authorIcon
                                        ? <img src={r.authorIcon} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                        : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:13, fontWeight:700 }}>{(r.authorName||'?')[0]}</div>}
                                </div>
                            </Link>
                            <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                                    <span style={{ fontSize:12, fontWeight:700, color:T1 }}>{r.authorName}</span>
                                    <span style={{ fontSize:10, color:TM }}>@{r.authorUserId} · {ago(r.createdAt)}</span>
                                    <div style={{ flex:1 }} />
                                    {user?.uid === r.authorId && (
                                        <div style={{ position:'relative' }}>
                                            <button onClick={() => setMenuPostId(menuPostId===r.id?null:r.id)}
                                                style={{ border:'none', background:'transparent', cursor:'pointer', color:TM, padding:2 }}>
                                                <MoreHorizontal size={14} />
                                            </button>
                                            {menuPostId === r.id && (
                                                <div style={{ position:'absolute', right:0, top:20, background:BG, borderRadius:10, boxShadow:'0 4px 20px rgba(0,0,0,.15)', padding:4, zIndex:10 }}>
                                                    <button onClick={() => deletePost(r.id)}
                                                        style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', border:'none', background:'transparent', cursor:'pointer', fontSize:12, fontWeight:600, color:'#ef4444', borderRadius:8, whiteSpace:'nowrap' }}>
                                                        <Trash2 size={12} /> 削除
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <p style={{ fontSize:13, lineHeight:1.6, color:T1, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{r.text}</p>
                                {r.images?.length > 0 && (
                                    <div style={{ display:'flex', gap:4, marginTop:8, borderRadius:10, overflow:'hidden', flexWrap:'wrap' }}>
                                        {r.images.map((url, i) => (
                                            <img key={i} src={url} alt="" style={{ width:120, height:90, objectFit:'cover', borderRadius:8 }} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* ── Reply Composer (bottom) ────────────────────── */}
                <div style={{
                    position:'sticky', bottom:0, background:BG,
                    borderTop:'1px solid rgba(0,0,0,.08)',
                    padding:'10px 16px calc(10px + env(safe-area-inset-bottom))',
                    zIndex:40,
                }} className="reply-bar">
                    {replyImagePreviews.length > 0 && (
                        <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                            {replyImagePreviews.map((src, i) => (
                                <div key={i} style={{ position:'relative', width:48, height:48, borderRadius:8, overflow:'hidden' }}>
                                    <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                    <button onClick={() => { setReplyImages(prev => prev.filter((_,j)=>j!==i)); setReplyImagePreviews(prev => prev.filter((_,j)=>j!==i)); }}
                                        style={{ position:'absolute', top:1, right:1, width:14, height:14, borderRadius:'50%', border:'none', background:'rgba(0,0,0,.6)', color:'#fff', cursor:'pointer', fontSize:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                        <X size={8} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', overflow:'hidden', background:SAGE, flexShrink:0 }}>
                            {myProfile?.photoURL
                                ? <img src={myProfile.photoURL} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700 }}>{(myProfile?.name||'?')[0]}</div>}
                        </div>
                        <input ref={imgInputRef} type="file" accept="image/*" multiple hidden onChange={handleReplyImageAdd} />
                        <button onClick={() => imgInputRef.current?.click()}
                            style={{ border:'none', background:'transparent', cursor:'pointer', color:SAGE, padding:4 }}>
                            <ImageIcon size={16} />
                        </button>
                        <input
                            id="reply-input"
                            type="text"
                            value={replyText}
                            onChange={e => setReplyText(e.target.value.slice(0, 500))}
                            placeholder="リプライを入力..."
                            style={{
                                flex:1, padding:'9px 14px', borderRadius:100, border:'none',
                                background:BG, boxShadow:NEU_IN, fontSize:13, color:T1, outline:'none',
                            }}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(); } }}
                        />
                        <button onClick={submitReply} disabled={replying || (!replyText.trim() && replyImages.length === 0)}
                            style={{
                                width:34, height:34, borderRadius:'50%', border:'none',
                                background:(!replyText.trim() && replyImages.length === 0) ? TM : SB,
                                color:LIME, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                                opacity:(!replyText.trim() && replyImages.length === 0) ? .4 : 1,
                            }}>
                            {replying ? <Loader2 size={14} style={{ animation:'spin .8s linear infinite' }} /> : <Send size={14} />}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin{to{transform:rotate(360deg)}}
                @media(max-width:1023px) {
                    .reply-bar { padding-bottom: calc(10px + 76px + env(safe-area-inset-bottom)) !important; }
                }
            `}</style>
        </AppShell>
    );
}

/* ── Sub-components ───────────────────────────────────────────── */
function StatItem({ label, count }: { label: string; count: number }) {
    return (
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ fontSize:14, fontWeight:700, color:'#2a2520' }}>{count || 0}</span>
            <span style={{ fontSize:11, color:'#b0a89e' }}>{label}</span>
        </div>
    );
}

function ActionLg({ icon, color, label, active, onClick }: { icon: React.ReactNode; color: string; label: string; active?: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick}
            style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                border:'none', background:'transparent', cursor:'pointer', color,
                padding:'6px 12px', borderRadius:12, transition:'all .15s',
            }}>
            {icon}
            <span style={{ fontSize:9, fontWeight:600 }}>{label}</span>
        </button>
    );
}
