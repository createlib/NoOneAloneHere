'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    doc, getDoc, setDoc, deleteDoc, addDoc, getDocs,
    collection, query, where, orderBy, limit, onSnapshot,
    serverTimestamp, Timestamp, increment,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { PostImageGrid } from '@/components/ImageLightbox';
import {
    Heart, MessageCircle, Repeat2, Quote, Send, Image as ImageIcon,
    X, Loader2, MoreHorizontal, Trash2, Hash, Plus, ChevronDown,
} from 'lucide-react';

/* ── Design tokens ─────────────────────────────────────────────── */
const BG   = '#f8f6f3';
const SB   = '#1a3024';
const SAGE = '#4a7c59';
const LIME = '#8ecfb2';
const T1   = '#2a2520';
const T2   = '#7a7068';
const TM   = '#b0a89e';
const NEU  = '6px 6px 16px #dbd7d2,-6px -6px 16px #ffffff';
const NEU_SM = '3px 3px 10px #dbd7d2,-3px -3px 10px #ffffff';
const NEU_IN = 'inset 3px 3px 8px #dbd7d2,inset -3px -3px 8px #ffffff';

const TOPIC_TAGS = ['ビジネス','テクノロジー','ライフスタイル','クリエイティブ','学び','雑談','質問','お知らせ'];

/* ── Types ─────────────────────────────────────────────────────── */
interface PostData {
    id: string;
    authorId: string;
    authorName: string;
    authorIcon: string;
    authorUserId: string;
    text: string;
    images: string[];
    topicTag: string;
    likeCount: number;
    replyCount: number;
    repostCount: number;
    quoteCount: number;
    repostOf: string | null;
    quotedPostId: string | null;
    parentId: string | null;
    createdAt: any;
}

/* ── helpers ───────────────────────────────────────────────────── */
const ago = (ts: any): string => {
    if (!ts) return '';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}秒`;
    if (s < 3600) return `${Math.floor(s/60)}分`;
    if (s < 86400) return `${Math.floor(s/3600)}時間`;
    if (s < 604800) return `${Math.floor(s/86400)}日`;
    return d.toLocaleDateString('ja-JP', { month:'short', day:'numeric' });
};

/* ══════════════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ══════════════════════════════════════════════════════════════════ */
export default function DeckPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [myProfile, setMyProfile] = useState<any>(null);
    const [tab, setTab] = useState<'following'|'recommended'>('following');
    const [posts, setPosts] = useState<PostData[]>([]);
    const [followingIds, setFollowingIds] = useState<string[]>([]);
    const [dataLoaded, setDataLoaded] = useState(false);

    // Composer
    const [showComposer, setShowComposer] = useState(false);
    const [compText, setCompText] = useState('');
    const [compImages, setCompImages] = useState<File[]>([]);
    const [compImagePreviews, setCompImagePreviews] = useState<string[]>([]);
    const [compTag, setCompTag] = useState('');
    const [compQuotePost, setCompQuotePost] = useState<PostData|null>(null);
    const [posting, setPosting] = useState(false);
    const imgInputRef = useRef<HTMLInputElement>(null);

    // Likes/reposts cache
    const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
    const [repostedPosts, setRepostedPosts] = useState<Set<string>>(new Set());
    // Quoted post cache for inline display
    const [quotedPostCache, setQuotedPostCache] = useState<Record<string, PostData>>({});

    // Menu
    const [menuPostId, setMenuPostId] = useState<string|null>(null);

    /* ── Load data ─────────────────────────────────────────────── */
    useEffect(() => {
        if (loading) return;
        if (!user || user.isAnonymous) { router.push('/login'); return; }

        const init = async () => {
            // Profile
            const pSnap = await getDoc(doc(db,'artifacts',APP_ID,'users',user.uid,'profile','data'));
            if (pSnap.exists()) setMyProfile(pSnap.data());

            // Following
            const fSnap = await getDocs(collection(db,'artifacts',APP_ID,'users',user.uid,'following'));
            const fIds = fSnap.docs.map(d => d.id);
            setFollowingIds(fIds);

            try {
                // All posts — fetch all, filter & sort client-side (no composite index needed)
                const postSnap = await getDocs(collection(db,'artifacts',APP_ID,'public','data','posts'));
                const allPosts: PostData[] = [];
                postSnap.forEach(d => {
                    const data = d.data();
                    if (data.parentId === null || data.parentId === undefined) {
                        allPosts.push({ id: d.id, ...data } as PostData);
                    }
                });
                allPosts.sort((a, b) => {
                    const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
                    const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
                    return tB - tA;
                });
                setPosts(allPosts.slice(0, 100));

                // Check liked/reposted
                const likedSet = new Set<string>();
                const repostedSet = new Set<string>();
                for (const p of allPosts.slice(0, 50)) {
                    try {
                        const lSnap = await getDoc(doc(db,'artifacts',APP_ID,'public','data','posts',p.id,'likes',user.uid));
                        if (lSnap.exists()) likedSet.add(p.id);
                    } catch {}
                    try {
                        const rSnap = await getDoc(doc(db,'artifacts',APP_ID,'public','data','posts',p.id,'reposts',user.uid));
                        if (rSnap.exists()) repostedSet.add(p.id);
                    } catch {}
                }
                setLikedPosts(likedSet);
                setRepostedPosts(repostedSet);

                // Load quoted posts
                const quotedIds = allPosts.filter(p => p.quotedPostId).map(p => p.quotedPostId!);
                const cache: Record<string, PostData> = {};
                for (const qid of [...new Set(quotedIds)]) {
                    try {
                        const qSnap = await getDoc(doc(db,'artifacts',APP_ID,'public','data','posts',qid));
                        if (qSnap.exists()) cache[qid] = { id: qSnap.id, ...qSnap.data() } as PostData;
                    } catch {}
                }
                setQuotedPostCache(cache);
            } catch (e) { console.error('Posts fetch error (Firestore rules may need updating):', e); }

            setDataLoaded(true);
        };
        init();
    }, [user, loading, router]);

    /* ── Filtered posts ────────────────────────────────────────── */
    const filteredPosts = tab === 'following'
        ? posts.filter(p => followingIds.includes(p.authorId) || p.authorId === user?.uid)
        : posts;

    /* ── Like toggle ───────────────────────────────────────────── */
    const toggleLike = async (postId: string) => {
        if (!user) return;
        const liked = likedPosts.has(postId);
        const likeRef = doc(db,'artifacts',APP_ID,'public','data','posts',postId,'likes',user.uid);
        const postRef = doc(db,'artifacts',APP_ID,'public','data','posts',postId);
        try {
            if (liked) {
                await deleteDoc(likeRef);
                await setDoc(postRef, { likeCount: increment(-1) }, { merge: true });
                setLikedPosts(prev => { const s = new Set(prev); s.delete(postId); return s; });
                setPosts(prev => prev.map(p => p.id === postId ? { ...p, likeCount: Math.max(0, p.likeCount - 1) } : p));
            } else {
                await setDoc(likeRef, { createdAt: serverTimestamp() });
                await setDoc(postRef, { likeCount: increment(1) }, { merge: true });
                setLikedPosts(prev => new Set(prev).add(postId));
                setPosts(prev => prev.map(p => p.id === postId ? { ...p, likeCount: p.likeCount + 1 } : p));
            }
        } catch (e) { console.error(e); }
    };

    /* ── Repost toggle ─────────────────────────────────────────── */
    const toggleRepost = async (postId: string) => {
        if (!user) return;
        const reposted = repostedPosts.has(postId);
        const repostRef = doc(db,'artifacts',APP_ID,'public','data','posts',postId,'reposts',user.uid);
        const postRef = doc(db,'artifacts',APP_ID,'public','data','posts',postId);
        try {
            if (reposted) {
                await deleteDoc(repostRef);
                await setDoc(postRef, { repostCount: increment(-1) }, { merge: true });
                setRepostedPosts(prev => { const s = new Set(prev); s.delete(postId); return s; });
                setPosts(prev => prev.map(p => p.id === postId ? { ...p, repostCount: Math.max(0, p.repostCount - 1) } : p));
            } else {
                await setDoc(repostRef, { createdAt: serverTimestamp() });
                await setDoc(postRef, { repostCount: increment(1) }, { merge: true });
                setRepostedPosts(prev => new Set(prev).add(postId));
                setPosts(prev => prev.map(p => p.id === postId ? { ...p, repostCount: p.repostCount + 1 } : p));
            }
        } catch (e) { console.error(e); }
    };

    /* ── Delete post ───────────────────────────────────────────── */
    const deletePost = async (postId: string) => {
        if (!confirm('この投稿を削除しますか？')) return;
        try {
            await deleteDoc(doc(db,'artifacts',APP_ID,'public','data','posts',postId));
            setPosts(prev => prev.filter(p => p.id !== postId));
        } catch { alert('削除に失敗しました'); }
        setMenuPostId(null);
    };

    /* ── Composer: add images ──────────────────────────────────── */
    const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const newFiles = Array.from(files).slice(0, 4 - compImages.length);
        setCompImages(prev => [...prev, ...newFiles]);
        newFiles.forEach(f => {
            const r = new FileReader();
            r.onload = () => setCompImagePreviews(prev => [...prev, r.result as string]);
            r.readAsDataURL(f);
        });
        e.target.value = '';
    };

    const removeImage = (idx: number) => {
        setCompImages(prev => prev.filter((_, i) => i !== idx));
        setCompImagePreviews(prev => prev.filter((_, i) => i !== idx));
    };

    /* ── Submit post ───────────────────────────────────────────── */
    const submitPost = async () => {
        if (!user || !myProfile || (!compText.trim() && compImages.length === 0)) return;
        setPosting(true);
        try {
            // Upload images
            const imageUrls: string[] = [];
            for (const f of compImages) {
                const iRef = ref(storage, `posts/${user.uid}/${Date.now()}_${f.name}`);
                const snap = await uploadBytes(iRef, f);
                imageUrls.push(await getDownloadURL(snap.ref));
            }

            const postData = {
                authorId: user.uid,
                authorName: myProfile.name || myProfile.userId || '名無し',
                authorIcon: myProfile.photoURL || '',
                authorUserId: myProfile.userId || '',
                text: compText.trim().slice(0, 500),
                images: imageUrls,
                topicTag: compTag || '',
                likeCount: 0,
                replyCount: 0,
                repostCount: 0,
                quoteCount: 0,
                repostOf: null,
                quotedPostId: compQuotePost?.id || null,
                parentId: null,
                createdAt: serverTimestamp(),
                updatedAt: new Date().toISOString(),
            };

            const docRef = await addDoc(collection(db,'artifacts',APP_ID,'public','data','posts'), postData);
            const newPost: PostData = { id: docRef.id, ...postData, createdAt: Timestamp.now() };
            setPosts(prev => [newPost, ...prev]);

            // If quoting, bump quoteCount
            if (compQuotePost) {
                await setDoc(doc(db,'artifacts',APP_ID,'public','data','posts',compQuotePost.id), { quoteCount: increment(1) }, { merge: true });
                setQuotedPostCache(prev => ({ ...prev, [compQuotePost.id]: compQuotePost }));
            }

            // Reset
            setCompText(''); setCompImages([]); setCompImagePreviews([]); setCompTag(''); setCompQuotePost(null);
            setShowComposer(false);
        } catch (e) { console.error(e); alert('投稿に失敗しました'); }
        finally { setPosting(false); }
    };

    /* ── Open quote composer ───────────────────────────────────── */
    const openQuote = (post: PostData) => {
        setCompQuotePost(post);
        setShowComposer(true);
    };

    /* ══════════════════════════════════════════════════════════════
     *  PostCard sub-component
     * ══════════════════════════════════════════════════════════════ */
    const PostCard = ({ p }: { p: PostData }) => {
        const isOwn = user?.uid === p.authorId;
        const liked = likedPosts.has(p.id);
        const reposted = repostedPosts.has(p.id);
        const quotedPost = p.quotedPostId ? quotedPostCache[p.quotedPostId] : null;

        return (
            <div style={{
                padding: '16px 18px', borderBottom: '1px solid rgba(0,0,0,.05)',
                background: BG, transition: 'background .15s',
            }}>
                <div style={{ display: 'flex', gap: 12 }}>
                    {/* Avatar */}
                    <Link href={`/user?uid=${p.authorId}`} style={{ flexShrink: 0 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
                            background: SAGE, boxShadow: NEU_SM,
                        }}>
                            {p.authorIcon
                                ? <img src={p.authorIcon} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                    onError={e => { (e.target as HTMLImageElement).src = '/default_avatar.png'; }} />
                                : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:16, fontWeight:700 }}>{(p.authorName||'?')[0]}</div>
                            }
                        </div>
                    </Link>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Link href={`/user?uid=${p.authorId}`} style={{ textDecoration:'none' }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{p.authorName || '名無し'}</span>
                            </Link>
                            <span style={{ fontSize: 11, color: TM }}>@{p.authorUserId || '...'}</span>
                            <span style={{ fontSize: 10, color: TM }}>· {ago(p.createdAt)}</span>
                            <div style={{ flex: 1 }} />
                            {isOwn && (
                                <div style={{ position: 'relative' }}>
                                    <button onClick={() => setMenuPostId(menuPostId === p.id ? null : p.id)}
                                        style={{ border:'none', background:'transparent', cursor:'pointer', color:TM, padding:2 }}>
                                        <MoreHorizontal size={16} />
                                    </button>
                                    {menuPostId === p.id && (
                                        <div style={{
                                            position:'absolute', right:0, top:22, background:BG,
                                            borderRadius:10, boxShadow:'0 4px 20px rgba(0,0,0,.15)',
                                            padding:4, zIndex:10, minWidth:100,
                                        }}>
                                            <button onClick={() => deletePost(p.id)}
                                                style={{
                                                    display:'flex', alignItems:'center', gap:6, width:'100%',
                                                    padding:'8px 12px', border:'none', background:'transparent',
                                                    cursor:'pointer', fontSize:12, fontWeight:600, color:'#ef4444', borderRadius:8,
                                                }}>
                                                <Trash2 size={12} /> 削除
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Topic tag */}
                        {p.topicTag && (
                            <span style={{
                                display:'inline-flex', alignItems:'center', gap:3,
                                padding:'2px 8px', borderRadius:100, fontSize:10, fontWeight:600,
                                background:'rgba(74,124,89,.08)', color:SAGE, marginBottom:6,
                            }}>
                                <Hash size={9} /> {p.topicTag}
                            </span>
                        )}

                        {/* Text */}
                        <Link href={`/home/post?id=${p.id}`} style={{ textDecoration:'none', color:'inherit' }}>
                            {p.text && (
                                <p style={{ fontSize: 14, lineHeight: 1.7, color: T1, margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {p.text}
                                </p>
                            )}

                            {/* Images */}
                            <PostImageGrid images={p.images || []} />
                        </Link>

                        {/* Quoted post preview */}
                        {quotedPost && (
                            <Link href={`/home/post?id=${quotedPost.id}`} style={{ textDecoration:'none' }}>
                                <div style={{
                                    marginTop:10, padding:'10px 14px', borderRadius:12,
                                    border:'1px solid rgba(0,0,0,.08)', background:'rgba(0,0,0,.02)',
                                }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                                        <div style={{ width:16, height:16, borderRadius:'50%', overflow:'hidden', background:SAGE }}>
                                            {quotedPost.authorIcon
                                                ? <img src={quotedPost.authorIcon} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                                : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:8, fontWeight:700 }}>{(quotedPost.authorName||'?')[0]}</div>
                                            }
                                        </div>
                                        <span style={{ fontSize:11, fontWeight:600, color:T1 }}>{quotedPost.authorName}</span>
                                        <span style={{ fontSize:10, color:TM }}>@{quotedPost.authorUserId}</span>
                                    </div>
                                    <p style={{ fontSize:12, color:T2, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                                        {quotedPost.text}
                                    </p>
                                </div>
                            </Link>
                        )}

                        {/* Actions */}
                        <div style={{ display:'flex', alignItems:'center', gap:0, marginTop:10 }}>
                            {/* Reply */}
                            <Link href={`/home/post?id=${p.id}`} style={{ textDecoration:'none' }}>
                                <ActionBtn icon={<MessageCircle size={15} />} count={p.replyCount} color={TM} />
                            </Link>
                            {/* Repost */}
                            <button onClick={() => toggleRepost(p.id)} style={{ border:'none', background:'transparent', cursor:'pointer', padding:0 }}>
                                <ActionBtn icon={<Repeat2 size={15} />} count={p.repostCount} active={reposted} color={reposted ? '#22c55e' : TM} />
                            </button>
                            {/* Like */}
                            <button onClick={() => toggleLike(p.id)} style={{ border:'none', background:'transparent', cursor:'pointer', padding:0 }}>
                                <ActionBtn icon={<Heart size={15} fill={liked ? '#ef4444' : 'none'} />} count={p.likeCount} active={liked} color={liked ? '#ef4444' : TM} />
                            </button>
                            {/* Quote */}
                            <button onClick={() => openQuote(p)} style={{ border:'none', background:'transparent', cursor:'pointer', padding:0 }}>
                                <ActionBtn icon={<Quote size={15} />} count={p.quoteCount} color={TM} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    /* ── Loading / Auth ─────────────────────────────────────────── */
    if (loading || !dataLoaded) return (
        <div style={{ minHeight:'100vh', background:BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Loader2 size={24} color={SAGE} style={{ animation:'spin .8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    /* ══════════════════════════════════════════════════════════════
     *  RENDER
     * ══════════════════════════════════════════════════════════════ */
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
                {/* ── Mobile Header ────────────────────────────── */}
                <div className="deck-mob-header" style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'12px 16px', background:SB,
                    position:'sticky', top:0, zIndex:50,
                }}>
                    <div style={{ fontSize:16, fontWeight:800, letterSpacing:'.18em', color:'#fff' }}>甲板</div>
                    <button onClick={() => setShowComposer(true)}
                        style={{
                            display:'flex', alignItems:'center', gap:5,
                            padding:'7px 14px', borderRadius:100, border:'none',
                            background:LIME, color:SB, fontSize:11, fontWeight:800,
                            cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,.2)',
                        }}>
                        <Plus size={14} /> 投稿する
                    </button>
                </div>

                {/* ── Tabs ─────────────────────────────────────── */}
                <div style={{
                    display:'flex', borderBottom:'1px solid rgba(0,0,0,.06)',
                    position:'sticky', top:0, zIndex:40, background:BG,
                }}
                    className="deck-tabs"
                >
                    {([
                        { key:'following' as const, label:'フォロー中' },
                        { key:'recommended' as const, label:'おすすめ' },
                    ]).map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            style={{
                                flex:1, padding:'14px 0', border:'none', background:'transparent',
                                fontSize:13, fontWeight:tab===t.key ? 800 : 500,
                                color:tab===t.key ? T1 : TM, cursor:'pointer',
                                borderBottom:tab===t.key ? `2px solid ${SAGE}` : '2px solid transparent',
                                transition:'all .2s',
                            }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── Inline compose (PC only) ────────────────── */}
                <div className="deck-pc-compose" style={{
                    padding:'16px 18px', borderBottom:'1px solid rgba(0,0,0,.06)',
                    display:'none',
                }}>
                    <div style={{ display:'flex', gap:12 }}>
                        <div style={{ width:40, height:40, borderRadius:'50%', overflow:'hidden', background:SAGE, flexShrink:0, boxShadow:NEU_SM }}>
                            {myProfile?.photoURL
                                ? <img src={myProfile.photoURL} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:16, fontWeight:700 }}>{(myProfile?.name||'?')[0]}</div>
                            }
                        </div>
                        <button onClick={() => setShowComposer(true)}
                            style={{
                                flex:1, textAlign:'left', padding:'10px 16px', borderRadius:16,
                                border:'none', background:BG, boxShadow:NEU_IN,
                                fontSize:13, color:TM, cursor:'pointer',
                            }}>
                            いまどうしてる？
                        </button>
                    </div>
                </div>

                {/* ── Timeline ─────────────────────────────────── */}
                {filteredPosts.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'60px 20px' }}>
                        <MessageCircle size={32} color={TM} style={{ margin:'0 auto 12px' }} />
                        <div style={{ fontSize:14, fontWeight:700, color:T2 }}>
                            {tab === 'following' ? 'フォロー中の投稿はありません' : 'まだ投稿がありません'}
                        </div>
                        <div style={{ fontSize:11, color:TM, marginTop:4 }}>
                            {tab === 'following' ? '乗組員をフォローして甲板を賑やかにしましょう' : '最初の投稿をしてみましょう'}
                        </div>
                    </div>
                ) : (
                    filteredPosts.map(p => <PostCard key={p.id} p={p} />)
                )}

                {/* ── FAB (mobile) ─────────────────────────────── */}
                <button
                    className="deck-fab"
                    onClick={() => setShowComposer(true)}
                    style={{
                        position:'fixed', bottom:90, right:16, width:56, height:56,
                        borderRadius:'50%', border:'none', background:SB, color:LIME,
                        boxShadow:'0 4px 20px rgba(0,0,0,.3)', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        zIndex:100,
                    }}>
                    <Plus size={24} />
                </button>
            </div>

            {/* ══════════════════════════════════════════════════════
             *  Composer Modal
             * ══════════════════════════════════════════════════════ */}
            {showComposer && (
                <div style={{
                    position:'fixed', inset:0, zIndex:6000,
                    background:'rgba(26,48,36,.5)', backdropFilter:'blur(6px)',
                    display:'flex', alignItems:'flex-start', justifyContent:'center',
                    paddingTop:60,
                }}
                    onClick={e => { if(e.target===e.currentTarget) { setShowComposer(false); setCompQuotePost(null); } }}
                >
                    <div style={{
                        width:'90%', maxWidth:520, background:BG, borderRadius:20,
                        boxShadow:'0 16px 60px rgba(0,0,0,.25)', overflow:'hidden',
                    }}>
                        {/* Composer header */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                            <button onClick={() => { setShowComposer(false); setCompQuotePost(null); }}
                                style={{ border:'none', background:'transparent', cursor:'pointer', color:T2, fontSize:13, fontWeight:600 }}>
                                キャンセル
                            </button>
                            <button onClick={submitPost} disabled={posting || (!compText.trim() && compImages.length === 0)}
                                style={{
                                    padding:'7px 20px', borderRadius:100, border:'none',
                                    background:(!compText.trim() && compImages.length === 0) ? TM : SB,
                                    color:LIME, fontSize:12, fontWeight:800, cursor:'pointer',
                                    opacity:(!compText.trim() && compImages.length === 0) ? .5 : 1,
                                }}>
                                {posting ? <Loader2 size={14} style={{ animation:'spin .8s linear infinite' }} /> : '投稿する'}
                            </button>
                        </div>

                        {/* Composer body */}
                        <div style={{ padding:'16px 18px', maxHeight:'60vh', overflowY:'auto' }}>
                            <div style={{ display:'flex', gap:12 }}>
                                <div style={{ width:36, height:36, borderRadius:'50%', overflow:'hidden', background:SAGE, flexShrink:0 }}>
                                    {myProfile?.photoURL
                                        ? <img src={myProfile.photoURL} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                        : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14, fontWeight:700 }}>{(myProfile?.name||'?')[0]}</div>
                                    }
                                </div>
                                <div style={{ flex:1 }}>
                                    <textarea
                                        value={compText}
                                        onChange={e => setCompText(e.target.value.slice(0, 500))}
                                        placeholder="いまどうしてる？"
                                        style={{
                                            width:'100%', minHeight:100, border:'none', background:'transparent',
                                            fontSize:15, lineHeight:1.7, color:T1, outline:'none', resize:'none',
                                            fontFamily:"'Inter','Noto Sans JP',system-ui,sans-serif",
                                        }}
                                        autoFocus
                                    />
                                    <div style={{ fontSize:10, color:TM, textAlign:'right' }}>{compText.length}/500</div>

                                    {/* Image previews */}
                                    {compImagePreviews.length > 0 && (
                                        <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                                            {compImagePreviews.map((src, i) => (
                                                <div key={i} style={{ position:'relative', width:72, height:72, borderRadius:10, overflow:'hidden' }}>
                                                    <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                                    <button onClick={() => removeImage(i)}
                                                        style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:'50%', border:'none', background:'rgba(0,0,0,.6)', color:'#fff', cursor:'pointer', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Quoted post preview in composer */}
                                    {compQuotePost && (
                                        <div style={{
                                            marginTop:10, padding:'10px 14px', borderRadius:12,
                                            border:'1px solid rgba(0,0,0,.08)', background:'rgba(0,0,0,.02)',
                                            position:'relative',
                                        }}>
                                            <button onClick={() => setCompQuotePost(null)}
                                                style={{ position:'absolute', top:4, right:4, border:'none', background:'transparent', cursor:'pointer', color:TM }}>
                                                <X size={12} />
                                            </button>
                                            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                                                <span style={{ fontSize:11, fontWeight:600, color:T1 }}>{compQuotePost.authorName}</span>
                                                <span style={{ fontSize:10, color:TM }}>@{compQuotePost.authorUserId}</span>
                                            </div>
                                            <p style={{ fontSize:12, color:T2, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                                                {compQuotePost.text}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Composer toolbar */}
                        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 18px', borderTop:'1px solid rgba(0,0,0,.06)' }}>
                            <input ref={imgInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageAdd} />
                            <button onClick={() => imgInputRef.current?.click()} disabled={compImages.length >= 4}
                                style={{ border:'none', background:'transparent', cursor:'pointer', color:compImages.length>=4?TM:SAGE, padding:6 }}>
                                <ImageIcon size={18} />
                            </button>

                            {/* Topic tag selector */}
                            <div style={{ flex:1, display:'flex', gap:4, overflowX:'auto', scrollbarWidth:'none' }}>
                                {TOPIC_TAGS.map(t => (
                                    <button key={t} onClick={() => setCompTag(compTag===t?'':t)}
                                        style={{
                                            flexShrink:0, padding:'4px 10px', borderRadius:100,
                                            border:'none', fontSize:10, fontWeight:600, cursor:'pointer',
                                            background:compTag===t?'rgba(74,124,89,.15)':'rgba(0,0,0,.04)',
                                            color:compTag===t?SAGE:TM,
                                        }}>
                                        #{t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Styles ──────────────────────────────────────── */}
            <style>{`
                @keyframes spin{to{transform:rotate(360deg)}}
                /* Mobile: show header + FAB, hide PC compose */
                .deck-mob-header { display: flex; }
                .deck-pc-compose { display: none !important; }
                .deck-fab { display: flex; }
                .deck-tabs { top: 0; }
                @media(min-width:1024px) {
                    .deck-mob-header { display: none !important; }
                    .deck-pc-compose { display: block !important; }
                    .deck-fab { display: none !important; }
                    .deck-tabs { top: 0; }
                }
            `}</style>
        </AppShell>
    );
}

/* ── ActionBtn sub-component ──────────────────────────────────── */
function ActionBtn({ icon, count, active, color }: { icon: React.ReactNode; count: number; active?: boolean; color: string }) {
    return (
        <div style={{
            display:'flex', alignItems:'center', gap:4,
            padding:'6px 12px', borderRadius:100, cursor:'pointer',
            color, transition:'all .15s',
        }}>
            {icon}
            {count > 0 && <span style={{ fontSize:11, fontWeight:600 }}>{count}</span>}
        </div>
    );
}
