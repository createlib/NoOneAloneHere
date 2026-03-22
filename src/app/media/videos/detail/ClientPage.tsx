'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, ThumbsUp, Share, AlignLeft, MessageSquare, Lock, Play, Film, CheckCircle2 } from 'lucide-react';

interface VideoData {
    id: string;
    title: string;
    description: string;
    tags: string[];
    authorId: string;
    authorName: string;
    authorIcon: string;
    thumbnailUrl: string;
    embedUrl: string;
    sourceUrl: string;
    allowComments: boolean;
    createdAt: string | any;
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

export default function VideoDetailPage() {
    const searchParams = useSearchParams();
    const id = searchParams?.get('id') || '';
    const { user, loading } = useAuth();
    const router = useRouter();

    const [videoData, setVideoData] = useState<VideoData | null>(null);
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
    
    const [relatedVideos, setRelatedVideos] = useState<VideoData[]>([]);
    const [showNotification, setShowNotification] = useState(false);

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
                const vidSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id));
                if (vidSnap.exists()) {
                    setVideoData({ id: vidSnap.id, ...vidSnap.data() } as VideoData);
                } else {
                    setNotFound(true);
                }
            } catch (e) {
                console.error("Video fetch error:", e);
                setNotFound(true);
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [id, user, loading]);

    // Subscriptions
    useEffect(() => {
        if (!videoData) return;

        // Likes
        const likesRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id, 'likes');
        const unsubLikes = onSnapshot(likesRef, (snap) => {
            setLikesCount(snap.size);
            if (user) {
                setIsLiked(!!snap.docs.find(d => d.id === user.uid));
            }
        });

        // Comments
        let unsubComments = () => {};
        if (videoData.allowComments !== false) {
            const commentsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id, 'comments');
            const q = query(commentsRef, orderBy('createdAt', 'desc'));
            unsubComments = onSnapshot(q, (snap) => {
                const cmts = snap.docs.map(d => ({ id: d.id, ...d.data() } as CommentData));
                setComments(cmts);
            });
        }

        // Related Videos
        const fetchRelated = async () => {
            const vRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos');
            try {
                const snap = await getDocs(vRef);
                const vids: VideoData[] = [];
                snap.forEach(d => {
                    if (d.id !== id) vids.push({ id: d.id, ...d.data() } as VideoData);
                });
                vids.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setRelatedVideos(vids.slice(0, 5));
            } catch (e) {}
        };
        fetchRelated();

        return () => {
            unsubLikes();
            unsubComments();
        };
    }, [videoData, id, user]);

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

    const handleLike = async () => {
        if (!user || user.isAnonymous) return alert("いいねするにはログインが必要です");
        try {
            const likeRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id, 'likes', user.uid);
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

    const handleDeleteVideo = async () => {
        if (!confirm("本当にこの動画を削除しますか？\n※この操作は元に戻せません。")) return;
        try {
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id));
            alert("動画を削除しました");
            router.push('/media/videos');
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
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id, 'comments'), {
                userId: user.uid,
                userName: myProfile?.name || myProfile?.userId || '名無し',
                userIcon: myProfile?.photoURL || null,
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
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', id, 'comments', cid));
        } catch (e) {
            console.error(e);
            alert("削除に失敗しました");
        }
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-texture"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin"></div></div>;
    }

    if (notFound || !videoData) {
        return (
            <div className="min-h-screen bg-texture pt-24 px-4 pb-20">
                <div className="max-w-[1600px] mx-auto text-center py-20 text-brand-500 font-bold tracking-widest bg-[#fffdf9] border border-brand-200 rounded-sm mt-10">
                    動画が存在しないか、削除されました。
                </div>
            </div>
        );
    }

    const videoDate = new Date(videoData.createdAt).toLocaleDateString();
    const isOwner = user && user.uid === videoData.authorId;
    const canManageVideo = isOwner || isAdmin;

    return (
        <div className="antialiased min-h-screen bg-texture body-pb-nav lg:pb-0">
            {/* Notification */}
            <div className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-[3000] transition-all duration-300 ${showNotification ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0 pointer-events-none'}`}>
                <div className="bg-[#3e2723] text-[#f7f5f0] px-6 py-3 rounded-sm shadow-2xl flex items-center gap-3 backdrop-blur-md bg-opacity-95 border border-[#8b6a4f]">
                    <CheckCircle2 className="text-[#d4af37] w-5 h-5" />
                    <span className="text-sm font-bold tracking-widest font-serif">URLをコピーしました！</span>
                </div>
            </div>

            <main className="w-full max-w-[1600px] mx-auto pt-24 px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-8 lg:gap-10 xl:gap-12 pb-20">
                <div className="flex-1 min-w-0">
                    <div className="mb-4">
                        <button onClick={() => router.back()} className="text-brand-500 hover:text-brand-800 transition-colors flex items-center gap-2 text-sm font-bold tracking-widest group">
                            <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                                <ArrowLeft size={16} />
                            </div>
                            <span className="hidden sm:inline">戻る</span>
                        </button>
                    </div>

                    <div className="w-full aspect-video bg-black sm:rounded-sm overflow-hidden shadow-xl border border-brand-300 relative group">
                        <iframe src={videoData.embedUrl || videoData.sourceUrl} className="absolute inset-0 w-full h-full" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                    </div>

                    <div className="pt-6">
                        <div className="flex flex-wrap gap-2 mb-3">
                            {videoData.tags?.map(tag => (
                                <span key={tag} className="bg-brand-50 border border-brand-200 text-brand-600 px-3 py-1 rounded-sm text-xs font-bold tracking-widest shadow-sm">#{tag}</span>
                            ))}
                        </div>

                        <div className="flex justify-between items-start gap-4 mb-4">
                            <h1 className="text-2xl sm:text-3xl font-bold text-brand-900 leading-tight font-serif tracking-wide">{videoData.title || 'タイトルなし'}</h1>
                            {canManageVideo && (
                                <div className="flex gap-2 border-l border-brand-200 pl-4 ml-2 flex-shrink-0">
                                    <Link href={`/media/videos/new?vid=${id}`} className="text-xs flex items-center bg-[#fffdf9] text-brand-700 px-3 py-1.5 border border-brand-300 rounded-sm font-bold hover:bg-brand-50 transition-colors shadow-sm tracking-widest">
                                        <Edit size={12} className="mr-1" />編集
                                    </Link>
                                    <button onClick={handleDeleteVideo} className="text-xs flex items-center bg-red-50 text-red-600 px-3 py-1.5 border border-red-200 rounded-sm font-bold hover:bg-red-100 transition-colors shadow-sm tracking-widest">
                                        <Trash2 size={12} className="mr-1" />削除
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-row justify-between items-center gap-2 sm:gap-6 pb-4 sm:pb-6 mb-4 sm:mb-6 border-b border-brand-200">
                            <Link href={`/user?uid=${videoData.authorId}&tab=media`} className="flex items-center gap-2 sm:gap-4 group cursor-pointer bg-[#fffdf9] pl-1 pr-3 sm:pl-2 sm:pr-6 py-1 sm:py-2 rounded-full border border-brand-100 shadow-sm hover:shadow-md transition-all hover:border-brand-300 min-w-0">
                                <img src={videoData.authorIcon || 'https://via.placeholder.com/48?text=U'} className="w-9 h-9 sm:w-12 sm:h-12 rounded-full border-2 border-[#fffdf9] shadow-sm object-cover group-hover:scale-105 transition-transform flex-shrink-0 ml-0.5" alt={videoData.authorName} />
                                <div className="min-w-0">
                                    <p className="font-bold text-brand-900 group-hover:text-brand-600 transition-colors text-xs sm:text-base flex items-center gap-1 truncate">
                                        {videoData.authorName || '名無し'} <CheckCircle2 size={12} className="text-[#d4af37]" />
                                    </p>
                                    <p className="text-[9px] sm:text-[10px] text-brand-400 font-mono tracking-wider truncate">{videoDate}</p>
                                </div>
                            </Link>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button onClick={handleLike} className={`action-btn flex items-center gap-1.5 sm:gap-2 border px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-sm transition-colors ${isLiked ? 'bg-red-50 border-red-200 text-brand-700' : 'bg-[#fffdf9] border-brand-200 text-brand-700 hover:bg-brand-50 hover:border-brand-400'}`}>
                                    <ThumbsUp className={`w-4 h-4 sm:w-5 sm:h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-brand-400'}`} />
                                    <span className="min-w-[1rem] text-center">{likesCount}</span>
                                </button>
                                <button onClick={handleShare} className="action-btn flex items-center gap-1.5 sm:gap-2 bg-[#fffdf9] border border-brand-200 px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold text-brand-700 hover:bg-brand-50 hover:border-brand-400 shadow-sm">
                                    <Share className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">シェア</span>
                                </button>
                            </div>
                        </div>

                        <div className="mb-12 bg-[#fffdf9] border border-brand-200 rounded-sm p-6 sm:p-8 shadow-sm relative">
                            <h3 className="text-lg font-bold text-brand-900 mb-6 flex items-center font-serif tracking-widest border-b border-brand-100 pb-4">
                                <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center border border-brand-200 text-brand-400 shadow-inner mr-3 flex-shrink-0">
                                    <AlignLeft size={16} />
                                </div>
                                概要
                            </h3>
                            <div className="prose prose-stone max-w-none text-brand-700 leading-relaxed text-sm sm:text-base" dangerouslySetInnerHTML={{ __html: formatText(videoData.description) }}></div>
                        </div>

                        <div className="mb-12 bg-[#fffdf9] border border-brand-200 rounded-sm p-6 sm:p-8 shadow-sm">
                            <h3 className="text-xl font-bold text-brand-900 mb-8 flex items-center font-serif tracking-widest border-b border-brand-100 pb-4">
                                <MessageSquare className="mr-3 text-brand-400" size={24} />コメント <span className="text-base font-normal text-brand-500 ml-2">({videoData.allowComments === false ? 0 : comments.length})</span>
                            </h3>

                            {videoData.allowComments === false ? (
                                <div className="text-center py-6 text-brand-400 text-sm tracking-widest">
                                    <MessageSquare className="inline mr-2" />コメントはオフになっています
                                </div>
                            ) : (
                                <>
                                    {!user || user.isAnonymous ? (
                                        <div className="w-full text-center py-4 bg-brand-50 border border-brand-200 rounded-sm text-sm font-bold text-brand-600 tracking-widest mb-10">
                                            コメントを投稿するには<Link href="/login" className="underline hover:text-brand-800 ml-1">ログイン</Link>してください。
                                        </div>
                                    ) : (
                                        <div className="flex gap-4 mb-10 items-start">
                                            <img src={myProfile?.photoURL || 'https://via.placeholder.com/40?text=U'} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-brand-200 shadow-sm object-cover" alt="My Profile" />
                                            <div className="flex-1 bg-brand-50 p-1 rounded-sm border border-brand-200 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all shadow-inner">
                                                <textarea value={newComment} onChange={e => setNewComment(e.target.value)} rows={2} className="w-full bg-transparent resize-none text-sm p-3 outline-none transition-colors text-brand-800 placeholder-brand-400" placeholder="感想や質問をコメントしてみましょう..."></textarea>
                                                <div className="flex justify-between items-center p-2 border-t border-brand-200/50 bg-[#fffdf9]">
                                                    <label className="flex items-center gap-2 text-xs font-bold text-brand-600 cursor-pointer group px-2 py-1 hover:bg-brand-50 rounded-sm transition-colors">
                                                        <input type="checkbox" checked={isPrivateComment} onChange={e => setIsPrivateComment(e.target.checked)} className="rounded border-brand-300 text-brand-600 focus:ring-brand-500" />
                                                        <Lock size={12} className="text-brand-400 group-hover:text-brand-600 transition-colors" /> 投稿者にのみ公開する
                                                    </label>
                                                    <button onClick={handlePostComment} disabled={isSubmittingComment || !newComment.trim()} className="flex items-center justify-center bg-[#3e2723] hover:bg-[#2a1a17] text-[#d4af37] px-6 py-2 rounded-sm text-xs font-bold transition-colors shadow-md disabled:opacity-50 tracking-widest border border-[#b8860b]">
                                                        {isSubmittingComment ? <div className="w-4 h-4 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin"></div> : 'コメント送信'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-6">
                                        {comments.length === 0 ? (
                                            <div className="text-center py-10 text-brand-400 text-sm tracking-widest border border-dashed border-brand-200 bg-brand-50 rounded-sm">
                                                まだコメントはありません。<br />最初の感想を伝えてみましょう！
                                            </div>
                                        ) : (
                                            comments.map(c => {
                                                const d = c.createdAt ? new Date(c.createdAt.toMillis()) : new Date();
                                                const dateStr = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                                                
                                                const canDelete = isAdmin || (user && user.uid === c.userId) || isOwner;
                                                
                                                let bgClass = "bg-brand-50 border-brand-100";
                                                let content = <p className="text-sm text-brand-700 leading-relaxed whitespace-pre-wrap">{c.text}</p>;

                                                if (c.isPrivate) {
                                                    const isCommentOwner = user && user.uid === c.userId;
                                                    if (isAdmin || isCommentOwner || isOwner) {
                                                        bgClass = "bg-red-50 border-red-200";
                                                        content = (
                                                            <>
                                                                <div className="mb-2 text-[10px] sm:text-xs text-red-500 font-bold tracking-widest flex items-center gap-1 border-b border-red-200 pb-1 w-fit"><Lock size={10} /> 投稿者にのみ公開されています</div>
                                                                <p className="text-sm text-brand-900 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                                                            </>
                                                        );
                                                    } else {
                                                        content = <div className="py-2 text-xs sm:text-sm text-brand-400 italic flex items-center gap-2 tracking-widest font-bold"><Lock size={12} /> このコメントは投稿者のみ公開されています</div>;
                                                    }
                                                }

                                                return (
                                                    <div key={c.id} className="flex gap-4 group">
                                                        <img src={c.userIcon || 'https://via.placeholder.com/40?text=U'} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-brand-200 object-cover flex-shrink-0 shadow-sm mt-1" alt={c.userName} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className={`${bgClass} border p-4 rounded-sm rounded-tl-none shadow-sm relative`}>
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="font-bold text-brand-900 text-sm tracking-widest">{c.userName || '名無し'}</span>
                                                                        <span className="text-[10px] text-brand-400 font-mono">{dateStr}</span>
                                                                    </div>
                                                                    {canDelete && (
                                                                        <button onClick={() => handleDeleteComment(c.id)} className="text-red-400 hover:text-red-600 text-sm transition-colors ml-4"><Trash2 size={14} /></button>
                                                                    )}
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

                {/* Related Videos */}
                <div className="w-full lg:w-[320px] xl:w-[400px] flex-shrink-0">
                    <h3 className="font-bold text-brand-800 mb-5 tracking-widest text-sm border-b border-brand-200 pb-2 flex items-center"><Film className="mr-2 text-brand-400" size={16} />新着の動画</h3>
                    <div className="flex flex-col gap-4">
                        {relatedVideos.map(v => {
                            const date = new Date(v.createdAt).toLocaleDateString();
                            return (
                                <Link key={v.id} href={`/media/videos/detail?id=${v.id}`} className="flex gap-3 group cursor-pointer bg-[#fffdf9] p-2 sm:p-3 rounded-sm border border-brand-100 hover:border-brand-300 hover:shadow-md transition-all">
                                    <div className="w-36 sm:w-40 aspect-video bg-black rounded-sm overflow-hidden flex-shrink-0 relative border border-brand-200">
                                        <img src={v.thumbnailUrl || 'https://via.placeholder.com/320x180?text=NOAH'} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" alt={v.title} />
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Play className="text-white text-xl fill-white" /></div>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                                        <h4 className="text-xs sm:text-sm font-bold text-brand-900 leading-snug line-clamp-2 mb-1 group-hover:text-brand-600 transition-colors font-serif">{v.title}</h4>
                                        <p className="text-[10px] text-brand-500 truncate mb-0.5">{v.authorName || '名無し'}</p>
                                        <p className="text-[9px] text-brand-400 font-mono">{date}</p>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
}
