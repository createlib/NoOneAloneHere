'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, Heart, Share2, AlignLeft, MessageSquare, Lock, Podcast, CalendarDays, Headphones, Play, Minimize2, X, CheckCircle2 } from 'lucide-react';

interface PodcastData {
    id: string;
    title: string;
    description: string;
    tags: string[];
    authorId: string;
    authorName: string;
    authorIcon: string;
    thumbnailUrl: string;
    audioUrl: string;
    isEmbed: boolean;
    duration: number;
    relatedArticleUrls?: string[];
    relatedArticleUrl?: string; // legacy support
    allowComments: boolean;
    createdAt: string | any;
    updatedAt: string | any;
}

interface CommentData {
    id: string;
    userId: string;
    userName: string;
    userIcon: string;
    text: string;
    isPrivate: boolean;
    createdAt: any;
}

export default function PodcastDetailPage() {
    const searchParams = useSearchParams();
    const id = searchParams?.get('id') || '';
    const { user, loading } = useAuth();
    const router = useRouter();

    const [podcastData, setPodcastData] = useState<PodcastData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    
    const [isAdmin, setIsAdmin] = useState(false);
    const [myProfile, setMyProfile] = useState<any>(null);

    const [comments, setComments] = useState<CommentData[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isPrivateComment, setIsPrivateComment] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    const [likesCount, setLikesCount] = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    
    const [relatedPodcasts, setRelatedPodcasts] = useState<PodcastData[]>([]);
    const [showNotification, setShowNotification] = useState(false);
    
    const [isMiniPlayerActive, setIsMiniPlayerActive] = useState(false);

    useEffect(() => {
        if (loading) return;
        if (!id) {
            const timer = setTimeout(() => {
                setIsLoading(false);
                setNotFound(true);
            }, 800);
            return () => clearTimeout(timer);
        }

        const init = async () => {
            if (user && !user.isAnonymous) {
                try {
                    const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'));
                    if (snap.exists()) {
                        setMyProfile(snap.data());
                        if (snap.data().userId === 'admin') setIsAdmin(true);
                    }
                } catch (e) {
                    console.error("Profile fetch error:", e);
                }
            }

            try {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id));
                if (snap.exists()) {
                    setPodcastData({ id: snap.id, ...snap.data() } as PodcastData);
                } else {
                    setNotFound(true);
                }
            } catch (e) {
                console.error("Podcast fetch error:", e);
                setNotFound(true);
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [id, user, loading]);

    useEffect(() => {
        if (!podcastData) return;

        // Likes
        const likesRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id, 'likes');
        const unsubLikes = onSnapshot(likesRef, (snap) => {
            setLikesCount(snap.size);
            if (user) {
                setIsLiked(!!snap.docs.find(d => d.id === user.uid));
            }
        });

        // Comments
        let unsubComments = () => {};
        if (podcastData.allowComments !== false) {
            const commentsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id, 'comments');
            const q = query(commentsRef, orderBy('createdAt', 'desc'));
            unsubComments = onSnapshot(q, (snap) => {
                const cmts = snap.docs.map(d => ({ id: d.id, ...d.data() } as CommentData));
                setComments(cmts);
            });
        }

        // Related Podcasts
        const fetchRelated = async () => {
            const ref = collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts');
            try {
                const snap = await getDocs(ref);
                const pods: PodcastData[] = [];
                snap.forEach(d => {
                    if (d.id !== id) pods.push({ id: d.id, ...d.data() } as PodcastData);
                });
                pods.sort((a, b) => new Date(b.createdAt || b.updatedAt).getTime() - new Date(a.createdAt || a.updatedAt).getTime());
                setRelatedPodcasts(pods.slice(0, 5));
            } catch (e) {}
        };
        fetchRelated();

        return () => {
            unsubLikes();
            unsubComments();
        };
    }, [podcastData, id, user]);

    const formatText = (text: string) => {
        if (!text) return '';
        let rawHtml = '';
        try {
            rawHtml = marked.parse(text, { breaks: true }) as string;
        } catch (e) {
            rawHtml = text.replace(/\n/g, '<br>');
        }
        return DOMPurify.sanitize(rawHtml);
    };

    const formatDuration = (seconds: number | undefined) => {
        if (!seconds || isNaN(seconds)) return '--:--';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0'+s : s}`;
    };

    const handleLike = async () => {
        if (!user || user.isAnonymous) return alert("いいねするにはログインが必要です");
        try {
            const likeRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id, 'likes', user.uid);
            if (isLiked) {
                await deleteDoc(likeRef);
            } else {
                await setDoc(likeRef, { timestamp: serverTimestamp() });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleShare = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 3000);
        }).catch(err => {
            alert('コピーに失敗しました。\n' + url);
        });
    };

    const handleDelete = async () => {
        if (!confirm("本当にこのエピソードを削除しますか？\n※この操作は元に戻せません。")) return;
        try {
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id));
            alert("エピソードを削除しました");
            router.push('/media/podcasts');
        } catch (e) {
            console.error(e);
            alert("削除に失敗しました");
        }
    };

    const handlePostComment = async () => {
        if (!user || user.isAnonymous) return alert('コメントするにはログインが必要です');
        const text = newComment.trim();
        if (!text) return;

        setIsSubmittingComment(true);
        try {
            let safeName = myProfile?.name || myProfile?.userId || '名無し';
            let safeIcon = myProfile?.photoURL || null;

            const isPublicSetting = myProfile && myProfile.profilePublic === 'true';
            const isPaidMember = myProfile && myProfile.membershipRank !== 'arrival';
            const canPublish = isPaidMember || isAdmin;
            
            if (!(isPublicSetting && canPublish)) {
                safeName = 'listener' + Math.floor(Math.random() * 10000);
                safeIcon = 'https://via.placeholder.com/150/f7f5f0/c8b9a6?text=U';
            }

            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id, 'comments'), {
                userId: user.uid,
                userName: safeName,
                userIcon: safeIcon,
                text: text,
                isPrivate: isPrivateComment,
                createdAt: serverTimestamp()
            });
            setNewComment('');
            setIsPrivateComment(false);
        } catch (e) {
            console.error(e);
            alert("コメントの送信に失敗しました");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (cid: string) => {
        if (!confirm("コメントを削除しますか？")) return;
        try {
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', id, 'comments', cid));
        } catch (e) {
            console.error(e);
            alert("削除に失敗しました");
        }
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-texture"><div className="w-10 h-10 border-4 border-[#b8860b] border-t-transparent rounded-full animate-spin"></div></div>;
    }

    if (notFound || !podcastData) {
        return (
            <div className="min-h-screen bg-texture pt-24 px-4 pb-20">
                <div className="max-w-[1600px] mx-auto text-center py-20 text-brand-500 font-bold tracking-widest bg-[#fffdf9] border border-brand-200 rounded-sm mt-10 shadow-sm">
                    エピソードが存在しないか、削除されました。
                </div>
            </div>
        );
    }

    const date = new Date(podcastData.createdAt || podcastData.updatedAt || Date.now());
    const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    const isOwner = user && user.uid === podcastData.authorId;
    const canManage = isOwner || isAdmin;
    const thumbUrl = podcastData.thumbnailUrl || 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=640&auto=format&fit=crop';

    let relatedUrls: string[] = [];
    if (podcastData.relatedArticleUrls && Array.isArray(podcastData.relatedArticleUrls)) {
        relatedUrls = podcastData.relatedArticleUrls;
    } else if (podcastData.relatedArticleUrl) {
        relatedUrls = [podcastData.relatedArticleUrl];
    }

    return (
        <div className="antialiased min-h-screen bg-texture body-pb-nav lg:pb-0 relative">
            <div className={`transition-all duration-300 ${isMiniPlayerActive ? 'hidden' : ''}`}>
                <nav className="bg-[rgba(255,253,249,0.95)] backdrop-blur border-b border-brand-200 fixed w-full z-40 top-0 h-16 shadow-sm">
                    <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
                        <button onClick={() => router.back()} className="text-brand-500 hover:text-brand-800 transition-colors flex items-center gap-2 text-sm font-bold tracking-widest group">
                            <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                                <ArrowLeft size={16} />
                            </div>
                            <span className="hidden sm:inline">戻る</span>
                        </button>
                        <div className="flex items-center gap-4">
                            <button onClick={() => setIsMiniPlayerActive(true)} className="text-[#a09080] hover:text-brand-800 transition-colors flex items-center gap-1.5 text-xs font-bold tracking-widest bg-brand-50 px-3 py-1.5 rounded-full border border-brand-200 shadow-sm" title="プレーヤーを縮小する">
                                <Minimize2 size={14} /> <span className="hidden sm:inline">ミニプレーヤー</span>
                            </button>
                            {canManage && (
                                <div className="flex gap-2 border-l border-brand-200 pl-4 ml-1">
                                    <Link href={`/media/podcasts/new?pid=${id}`} className="text-xs flex items-center bg-[#fffdf9] text-brand-700 px-3 py-1.5 border border-brand-300 rounded-sm font-bold hover:bg-brand-50 transition-colors shadow-sm tracking-widest">
                                        <Edit size={12} className="mr-1" />編集
                                    </Link>
                                    <button onClick={handleDelete} className="text-xs flex items-center bg-red-50 text-red-600 px-3 py-1.5 border border-red-200 rounded-sm font-bold hover:bg-red-100 transition-colors shadow-sm tracking-widest">
                                        <Trash2 size={12} className="mr-1" />削除
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </nav>

                <main className="w-full max-w-[1600px] mx-auto pt-24 px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-8 lg:gap-10 xl:gap-12 pb-20">
                    <div className="flex-1 min-w-0">
                        <div className="w-full bg-[#1a110f] sm:rounded-md overflow-hidden shadow-2xl border border-brand-300 relative flex flex-col justify-center items-center p-6 sm:p-10 mb-6 group">
                            <img src={thumbUrl} className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl scale-110 pointer-events-none" alt="" />
                            
                            {podcastData.isEmbed ? (
                                <div className="w-full max-w-3xl relative z-10">
                                    <iframe src={podcastData.audioUrl} className="w-full h-40 sm:h-60 rounded-md shadow-xl" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>
                                </div>
                            ) : podcastData.audioUrl ? (
                                <>
                                    <img src={thumbUrl} className="w-40 h-40 sm:w-64 sm:h-64 object-cover rounded-md shadow-2xl border border-[#5c4a3d] mb-8 relative z-10" alt="" />
                                    <audio src={podcastData.audioUrl} controls className="w-full max-w-2xl relative z-10 shadow-lg rounded-full"></audio>
                                </>
                            ) : (
                                <div className="w-full max-w-3xl relative z-10">
                                    <div className="w-full h-40 sm:h-60 rounded-md bg-black/50 border border-[#5c4a3d] flex flex-col items-center justify-center text-[#a09080] font-bold tracking-widest">
                                        <Podcast className="text-3xl w-10 h-10 mb-3" />音声データは準備中です
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                            <div className="flex flex-wrap gap-2 mb-3">
                                {podcastData.tags?.map(tag => (
                                    <span key={tag} className="bg-brand-50 border border-brand-200 text-[#b8860b] px-3 py-1 rounded-sm text-xs font-bold tracking-widest shadow-sm">#{tag}</span>
                                ))}
                            </div>
                            
                            <h1 className="text-2xl sm:text-3xl font-bold text-brand-900 leading-tight mb-5 font-serif tracking-wide">{podcastData.title || 'タイトルなし'}</h1>
                            
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 sm:pb-6 mb-4 sm:mb-6 border-b border-brand-200">
                                <Link href={`/user/${podcastData.authorId}?tab=media`} className="flex items-center gap-3 sm:gap-4 group bg-[#fffdf9] pl-1 pr-4 sm:pl-2 sm:pr-6 py-1 sm:py-1.5 rounded-full border border-brand-200 shadow-sm hover:shadow-md transition-all hover:border-[#b8860b] min-w-0">
                                    <img src={podcastData.authorIcon || 'https://via.placeholder.com/48?text=U'} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-[#fffdf9] shadow-sm object-cover group-hover:scale-105 transition-transform shrink-0 ml-0.5" alt={podcastData.authorName} />
                                    <p className="font-bold text-brand-900 group-hover:text-[#b8860b] transition-colors text-sm sm:text-base flex items-center gap-1.5 truncate tracking-widest font-serif">
                                        {podcastData.authorName || '名無し'} <CheckCircle2 size={12} className="text-[#d4af37]" />
                                    </p>
                                </Link>

                                <div className="flex items-center gap-4 text-xs font-mono text-brand-500 bg-brand-50 px-4 py-2.5 rounded-sm border border-brand-200 shadow-inner shrink-0">
                                    <span className="flex items-center gap-1.5 tracking-wider"><CalendarDays size={14} className="text-[#8b6a4f]" /> {dateStr}</span>
                                    <span className="w-px h-3 bg-brand-300"></span>
                                    <span className="flex items-center gap-1.5 tracking-wider"><Headphones size={14} className="text-[#8b6a4f]" /> {formatDuration(podcastData.duration)}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mb-8">
                                <button onClick={handleLike} className={`flex items-center gap-2 border px-5 py-2.5 rounded-full text-sm font-bold shadow-sm tracking-widest transition-colors ${isLiked ? 'bg-red-50 border-red-200 text-brand-700' : 'bg-[#fffdf9] border-brand-200 text-brand-700 hover:bg-brand-50 hover:border-[#b8860b]'}`}>
                                    <Heart className={isLiked ? 'fill-red-500 text-red-500' : 'text-brand-400'} size={18} /> <span className="min-w-[1rem] text-center">{likesCount}</span>
                                </button>
                                <button onClick={handleShare} className="flex items-center gap-2 bg-[#fffdf9] border border-brand-200 px-5 py-2.5 rounded-full text-sm font-bold text-brand-700 hover:bg-brand-50 hover:border-[#b8860b] shadow-sm tracking-widest transition-colors">
                                    <Share2 size={18} className="text-brand-400" /> シェア
                                </button>
                            </div>

                            <div className="mb-12 bg-[#fffdf9] border border-brand-200 rounded-sm p-6 sm:p-8 shadow-sm relative">
                                <h3 className="text-lg font-bold text-brand-900 mb-6 flex items-center font-serif tracking-widest border-b border-brand-100 pb-4">
                                    <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center border border-brand-200 text-brand-400 shadow-inner mr-3 shrink-0">
                                        <AlignLeft size={14} />
                                    </div>
                                    エピソードの概要
                                </h3>
                                <div className="prose prose-stone max-w-none text-brand-700 leading-relaxed text-sm sm:text-base" dangerouslySetInnerHTML={{ __html: formatText(podcastData.description) }}></div>

                                {relatedUrls.length > 0 && (
                                    <div className="mt-8 pt-6 border-t border-brand-100">
                                        <h3 className="text-base font-bold text-brand-900 mb-4 flex items-center font-serif tracking-widest">
                                            <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center border border-brand-200 text-brand-400 shadow-inner mr-3 shrink-0">
                                                <Share2 size={12} />
                                            </div>
                                            関連記事
                                        </h3>
                                        <div className="space-y-4">
                                            {relatedUrls.map((url, idx) => {
                                                const noteMatch = url.match(/note\.com\/.*?n\/(n[a-zA-Z0-9]+)/) || url.match(/note\.com\/embed\/notes\/(n[a-zA-Z0-9]+)/);
                                                if (noteMatch && noteMatch[1]) {
                                                    return <iframe key={idx} className="w-full max-w-full rounded-sm border border-brand-200 shadow-sm" src={`https://note.com/embed/notes/${noteMatch[1]}`} style={{ border: 0, display: "block", padding: 0, margin: 0, width: "100%", height: "260px" }}></iframe>;
                                                } else {
                                                    return (
                                                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block p-3 bg-brand-50 border border-brand-200 rounded-sm hover:border-[#b8860b] transition-colors text-sm text-brand-700 font-bold truncate shadow-sm">
                                                            <Share2 size={12} className="inline mr-2 text-[#8b6a4f]" />{url}
                                                        </a>
                                                    );
                                                }
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mb-12 bg-[#fffdf9] border border-brand-200 rounded-sm p-6 sm:p-8 shadow-sm">
                                <h3 className="text-xl font-bold text-brand-900 mb-8 flex items-center font-serif tracking-widest border-b border-brand-100 pb-4">
                                    <MessageSquare className="mr-3 text-brand-400 w-6 h-6" />コメント <span className="text-base font-normal text-brand-500 ml-2">({podcastData.allowComments === false ? 0 : comments.length})</span>
                                </h3>

                                {podcastData.allowComments === false ? (
                                    <div className="text-center py-6 text-brand-400 text-sm tracking-widest border border-dashed border-brand-200 bg-brand-50 rounded-sm">
                                        <MessageSquare className="inline mr-2 w-4 h-4" />コメントはオフになっています
                                    </div>
                                ) : (
                                    <>
                                        {!user || user.isAnonymous ? (
                                            <div className="w-full text-center py-4 bg-brand-50 border border-brand-200 rounded-sm text-sm font-bold text-brand-600 tracking-widest mb-10">
                                                コメントを投稿するには<Link href="/login" className="underline hover:text-brand-800 ml-1">ログイン</Link>してください。
                                            </div>
                                        ) : (
                                            <div className="flex gap-4 mb-10 items-start">
                                                <img src={myProfile?.photoURL || 'https://via.placeholder.com/40?text=U'} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-brand-200 shadow-sm object-cover" alt="" />
                                                <div className="flex-1 bg-brand-50 p-1 rounded-sm border border-brand-200 focus-within:border-[#b8860b] focus-within:ring-1 focus-within:ring-[#b8860b] transition-all shadow-inner">
                                                    <textarea value={newComment} onChange={e => setNewComment(e.target.value)} rows={2} className="w-full bg-transparent resize-none text-sm p-3 outline-none transition-colors text-brand-800 placeholder-brand-400" placeholder="エピソードの感想や質問をコメントしてみましょう..."></textarea>
                                                    <div className="flex justify-between items-center p-2 border-t border-brand-200/50 bg-[#fffdf9]">
                                                        <label className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-brand-600 cursor-pointer group px-2 py-1 hover:bg-brand-50 rounded-sm transition-colors">
                                                            <input type="checkbox" checked={isPrivateComment} onChange={e => setIsPrivateComment(e.target.checked)} className="rounded border-brand-300 text-brand-600 focus:ring-brand-500" />
                                                            <Lock size={12} className="text-brand-400 group-hover:text-brand-600 transition-colors" /> 投稿者にのみ公開する
                                                        </label>
                                                        <button onClick={handlePostComment} disabled={isSubmittingComment || !newComment.trim()} className="bg-[#3e2723] hover:bg-[#2a1a17] text-[#d4af37] px-6 py-2 rounded-sm text-xs font-bold transition-colors shadow-md disabled:opacity-50 tracking-widest border border-[#b8860b] flex items-center justify-center">
                                                            {isSubmittingComment ? <div className="w-4 h-4 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin"></div> : '送信'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-6">
                                            {comments.length === 0 ? (
                                                <div className="text-center py-10 text-brand-400 text-sm tracking-widest border border-dashed border-brand-200 bg-brand-50 rounded-sm">まだコメントはありません。<br />最初の感想を伝えてみましょう！</div>
                                            ) : (
                                                comments.map(c => {
                                                    const d = c.createdAt ? new Date(c.createdAt.toMillis()) : new Date();
                                                    const dateString = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                                                    const canDelete = isAdmin || (user && user.uid === c.userId) || isOwner;
                                                    
                                                    let bgClass = "bg-brand-50 border-brand-100";
                                                    let content = <p className="text-sm text-brand-700 leading-relaxed whitespace-pre-wrap">{c.text}</p>;

                                                    if (c.isPrivate) {
                                                        const isCommentOwner = user && user.uid === c.userId;
                                                        if (isAdmin || isCommentOwner || isOwner) {
                                                            bgClass = "bg-[#fffdf9] border-[#b8860b] border-2";
                                                            content = (
                                                                <>
                                                                    <div className="mb-2 text-[10px] sm:text-xs text-[#b8860b] font-bold tracking-widest flex items-center gap-1 border-b border-brand-200 pb-1 w-fit"><Lock size={10} /> 投稿者にのみ公開されています</div>
                                                                    <p className="text-sm text-brand-900 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                                                                </>
                                                            );
                                                        } else {
                                                            content = <div className="py-2 text-xs sm:text-sm text-brand-400 italic flex items-center gap-2 tracking-widest font-bold"><Lock size={12} /> このコメントは投稿者のみ公開されています</div>;
                                                        }
                                                    }

                                                    return (
                                                        <div key={c.id} className="flex gap-4 group">
                                                            <img src={c.userIcon || 'https://via.placeholder.com/40?text=U'} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-brand-200 object-cover shrink-0 shadow-sm mt-1" alt="" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`${bgClass} border p-4 rounded-sm rounded-tl-none shadow-sm relative`}>
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="font-bold text-brand-900 text-sm tracking-widest">{c.userName || '名無し'}</span>
                                                                            <span className="text-[10px] text-brand-400 font-mono">{dateString}</span>
                                                                        </div>
                                                                        {canDelete && <button onClick={() => handleDeleteComment(c.id)} className="text-red-400 hover:text-red-600 text-sm transition-colors ml-4"><Trash2 size={14} /></button>}
                                                                    </div>
                                                                    {content}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Related */}
                    <div className="w-full lg:w-[320px] xl:w-[400px] shrink-0">
                        <h3 className="font-bold text-brand-800 mb-5 tracking-widest text-sm border-b border-brand-200 pb-2 flex items-center"><Podcast size={16} className="mr-2 text-[#b8860b]" />新着のCAST</h3>
                        <div className="flex flex-col gap-4">
                            {relatedPodcasts.map(p => {
                                const pDate = new Date(p.createdAt || p.updatedAt);
                                return (
                                    <Link key={p.id} href={`/media/podcasts/${p.id}`} className="flex gap-3 group cursor-pointer bg-[#fffdf9] p-3 rounded-md border border-brand-200 hover:border-[#b8860b]/50 hover:shadow-md transition-all">
                                        <div className="w-20 h-20 bg-[#1a110f] rounded-md overflow-hidden shrink-0 relative border border-brand-100 shadow-inner">
                                            <img src={p.thumbnailUrl || 'https://via.placeholder.com/150'} className="w-full h-full object-cover opacity-90 transition-transform group-hover:scale-110 duration-500" alt="" />
                                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-center justify-center"><Play size={18} className="text-white/90 fill-white shadow-sm" /></div>
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
                                            <h4 className="text-sm font-bold text-brand-900 leading-snug line-clamp-2 mb-1.5 group-hover:text-[#b8860b] transition-colors font-serif">{p.title || 'タイトルなし'}</h4>
                                            <p className="text-[10px] text-brand-500 truncate mb-1">{p.authorName || '名無し'}</p>
                                            <div className="flex items-center justify-between mt-auto">
                                                <span className="text-[9px] text-brand-400 font-mono tracking-widest">{pDate.getFullYear()}/{pDate.getMonth() + 1}/{pDate.getDate()}</span>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </main>
            </div>

            {/* Mini Player UI */}
            <div className={`fixed bottom-4 right-4 sm:bottom-8 sm:right-8 w-[calc(100%-2rem)] sm:w-80 bg-[#1a110f] rounded-md shadow-2xl border border-[#5c4a3d] z-[8000] p-3 cursor-pointer hover:scale-105 transition-all duration-300 ${!isMiniPlayerActive ? 'hidden' : 'translate-y-0 opacity-100'}`} onClick={() => setIsMiniPlayerActive(false)}>
                <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                    <img src={thumbUrl} className="w-14 h-14 rounded-sm object-cover border border-[#3e2723] shadow-md shrink-0" alt="" />
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-[#d4af37] font-bold tracking-widest mb-0.5 flex items-center gap-1"><Podcast size={10} /> 再生中</p>
                        <p className="text-sm font-bold text-[#f7f5f0] truncate font-serif tracking-wide leading-snug">{podcastData.title}</p>
                        <p className="text-[10px] text-[#a09080] truncate mt-1 tracking-widest font-bold">{podcastData.authorName}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setIsMiniPlayerActive(false); router.back(); }} className="w-8 h-8 rounded-full bg-[#3e2723] hover:bg-red-600 text-white transition-colors flex items-center justify-center border border-[#5c4a3d] shrink-0 shadow-md">
                        <X size={14} />
                    </button>
                </div>
            </div>

            <div className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-[9000] transition-all duration-300 ${showNotification ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0 pointer-events-none'}`}>
                <div className="bg-[#3e2723] text-[#f7f5f0] px-6 py-3 rounded-sm shadow-2xl flex items-center gap-3 backdrop-blur-md bg-opacity-95 border border-[#8b6a4f]">
                    <CheckCircle2 className="text-[#d4af37] w-5 h-5" />
                    <span className="text-sm font-bold tracking-widest font-serif">URLをコピーしました！</span>
                </div>
            </div>
        </div>
    );
}
