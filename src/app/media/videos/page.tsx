'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Film, Search, ChevronRight, X, Play, CheckCircle2, Users, Sparkles, Plus } from 'lucide-react';
import Link from 'next/link';

interface VideoData {
    id: string;
    title: string;
    description: string;
    tags: string[];
    authorId: string;
    authorName: string;
    authorIcon: string;
    thumbnailUrl: string;
    createdAt: string;
}

export default function VideosPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [allVideos, setAllVideos] = useState<VideoData[]>([]);
    const [followingIds, setFollowingIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentTag, setCurrentTag] = useState('');
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [canPost, setCanPost] = useState(false);

    const [modalData, setModalData] = useState<{ isOpen: boolean; title: React.ReactNode; videos: VideoData[] }>({
        isOpen: false,
        title: null,
        videos: []
    });

    useEffect(() => {
        if (loading) return;

        const fetchData = async () => {
            try {
                if (user && !user.isAnonymous) {
                    const mySnap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'));
                    if (mySnap.exists()) {
                        const rank = mySnap.data().membershipRank || 'arrival';
                        if (rank !== 'arrival' || mySnap.data().userId === 'admin') {
                            setCanPost(true);
                        }
                    }

                    const followSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'following'));
                    setFollowingIds(followSnap.docs.map(d => d.id));
                }

                const videosRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos');
                const snap = await getDocs(videosRef);

                const videos: VideoData[] = [];
                snap.forEach(d => {
                    videos.push({ id: d.id, ...d.data() } as VideoData);
                });

                videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setAllVideos(videos);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, [user, loading]);

    const isFiltering = searchQuery !== '' || currentTag !== '';

    const filteredVideos = allVideos.filter(v => {
        const matchTag = currentTag === '' || (v.tags && v.tags.includes(currentTag));
        const matchSearch = searchQuery === '' || 
            (v.title && v.title.toLowerCase().includes(searchQuery.toLowerCase())) || 
            (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchTag && matchSearch;
    });

    const followingVideos = allVideos.filter(v => followingIds.includes(v.authorId));
    let recommendedVideos = allVideos.filter(v => !followingIds.includes(v.authorId));
    if (recommendedVideos.length === 0) recommendedVideos = [...allVideos];

    const VideoCard = ({ v, isScrollMode }: { v: VideoData, isScrollMode: boolean }) => {
        const date = new Date(v.createdAt);
        const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
        const widthClass = isScrollMode ? "w-full h-full snap-start" : "w-full h-full";

        return (
            <Link href={`/media/videos/${v.id}`} className={`video-card flex flex-col group cursor-pointer bg-[#fffdf9] rounded-sm overflow-hidden border border-brand-100 shadow-sm hover:shadow-xl ${widthClass}`}>
                <div className="relative w-full aspect-video bg-[#000] overflow-hidden">
                    <img src={v.thumbnailUrl || 'https://via.placeholder.com/640x360?text=No+Image'} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={v.title} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 flex items-center justify-center group-hover:opacity-100">
                        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/50 transition-transform duration-300">
                            <Play className="text-white text-xl ml-1 fill-white" />
                        </div>
                    </div>
                </div>
                <div className="p-4 flex gap-3 flex-1">
                    <img src={v.authorIcon || 'https://via.placeholder.com/40?text=U'} className="w-10 h-10 rounded-full border border-brand-200 object-cover flex-shrink-0 shadow-sm" alt={v.authorName} />
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-brand-900 leading-snug line-clamp-2 mb-1.5 group-hover:text-brand-600 transition-colors font-serif tracking-wide">{v.title}</h3>
                            <div className="flex items-center text-xs text-brand-500 mb-1">
                                <span className="truncate hover:text-brand-800 transition-colors">{v.authorName || '名無し'}</span>
                                <CheckCircle2 size={10} className="ml-1 text-[#d4af37]" />
                            </div>
                        </div>
                        <p className="text-[10px] text-brand-400 font-mono">{dateStr}</p>
                    </div>
                </div>
            </Link>
        );
    };

    const openModal = (type: 'following' | 'recommended') => {
        if (type === 'following') {
            setModalData({
                isOpen: true,
                title: <><Users className="text-brand-400 mr-2 w-5 text-center" /> フォロー中の新着</>,
                videos: followingVideos
            });
        } else {
            setModalData({
                isOpen: true,
                title: <><Sparkles className="text-[#b8860b] mr-2 w-5 text-center" /> おすすめ</>,
                videos: recommendedVideos
            });
        }
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        setModalData({ ...modalData, isOpen: false });
        document.body.style.overflow = '';
    };

    const tags = ['', 'ピッチ・資金調達', 'ビジネスパートナー募集', 'PR・宣伝', '活動記録', 'ノウハウ共有'];
    const tagLabels: Record<string, string> = { '': 'すべて', 'ビジネスパートナー募集': 'パートナー募集' };

    return (
        <div className="antialiased min-h-screen bg-texture body-pb-nav lg:pb-0">
            <main className="w-full max-w-[1600px] mx-auto pt-24 px-4 sm:px-6 lg:px-8 pb-20">
                <div className="flex justify-between items-center mb-8 relative z-10">
                    <h1 className="text-3xl font-bold font-serif text-brand-900 tracking-widest flex items-center gap-3">
                        <Film className="text-brand-300" size={32} /> NOAH THEATER
                    </h1>
                    {canPost && (
                        <Link href="/media/videos/new" className="inline-flex items-center px-4 py-2 bg-[#8b6a4f] text-[#fffdf9] text-xs font-bold rounded-sm shadow-md hover:bg-[#725b3f] transition-colors border border-[#725b3f] tracking-widest">
                            <Plus size={14} className="mr-1" /> 動画を投稿
                        </Link>
                    )}
                </div>

                <div className="mb-8 sticky top-16 z-30 glass-bar py-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:border-none">
                    <div className="flex flex-col xl:flex-row gap-4 mb-4 items-center justify-between">
                        <div className="relative w-full xl:w-96 group shrink-0">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-brand-400 group-focus-within:text-brand-600 transition-colors w-4 h-4" />
                            <input type="text" placeholder="タイトルや概要で検索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 rounded-full border border-brand-200 shadow-sm text-sm focus:ring-brand-500 focus:border-brand-500 bg-[#fffdf9] transition-shadow hover:shadow-md" />
                        </div>

                        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 w-full pb-2">
                            {tags.map(t => (
                                <button key={t} onClick={() => setCurrentTag(t)}
                                    className={`whitespace-nowrap px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm transform hover:scale-105 ${currentTag === t ? 'bg-[#3e2723] text-[#f7f5f0] border border-[#3e2723] scale-105' : 'bg-[#fffdf9] text-brand-600 border border-brand-200 hover:bg-brand-50 hover:border-brand-300'}`}>
                                    {tagLabels[t] || t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {isLoadingData ? (
                    <div className="w-full text-center py-12 text-brand-400"><div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>動画を読み込み中...</div>
                ) : isFiltering ? (
                    <div className="pb-12">
                        <h2 className="font-bold text-brand-900 text-lg md:text-xl font-serif tracking-widest mb-6 flex items-center border-b border-brand-200 pb-2">
                            <Search className="text-brand-400 mr-3 w-5" /> 検索結果
                        </h2>
                        {filteredVideos.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center text-brand-400 py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200">
                                <Film className="text-4xl mb-3 text-brand-200 w-10 h-10" />
                                <p>該当する動画がありません。</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
                                {filteredVideos.map(v => <VideoCard key={v.id} v={v} isScrollMode={false} />)}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="pb-12 space-y-12">
                        {followingVideos.length > 0 && (
                            <div className="relative">
                                <div className="flex justify-between items-end mb-4 border-b border-brand-200 pb-2">
                                    <h2 className="font-bold text-brand-900 text-lg md:text-xl font-serif tracking-widest flex items-center">
                                        <Users className="text-brand-400 mr-3 w-5" /> フォロー中の新着
                                    </h2>
                                    <button onClick={() => openModal('following')} className="text-[10px] sm:text-xs font-bold text-brand-500 hover:text-brand-800 transition-colors tracking-widest flex items-center bg-brand-50 px-3 py-1.5 rounded-sm border border-brand-200 shadow-sm">
                                        すべて見る <ChevronRight size={14} className="ml-1" />
                                    </button>
                                </div>
                                <div className="grid grid-rows-[repeat(3,max-content)] grid-flow-col auto-cols-[280px] sm:auto-cols-[320px] overflow-x-auto gap-4 sm:gap-6 pb-4 no-scrollbar snap-x snap-mandatory px-1">
                                    {followingVideos.slice(0, 15).map(v => <VideoCard key={v.id} v={v} isScrollMode={true} />)}
                                </div>
                            </div>
                        )}

                        <div className="relative">
                            <div className="flex justify-between items-end mb-4 border-b border-brand-200 pb-2">
                                <h2 className="font-bold text-brand-900 text-lg md:text-xl font-serif tracking-widest flex items-center">
                                    <Sparkles className="text-[#b8860b] mr-3 w-5" /> おすすめ
                                </h2>
                                <button onClick={() => openModal('recommended')} className="text-[10px] sm:text-xs font-bold text-brand-500 hover:text-brand-800 transition-colors tracking-widest flex items-center bg-brand-50 px-3 py-1.5 rounded-sm border border-brand-200 shadow-sm">
                                    すべて見る <ChevronRight size={14} className="ml-1" />
                                </button>
                            </div>
                            {recommendedVideos.length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center text-brand-400 py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200 w-full">
                                    <Film className="w-10 h-10 mb-3 text-brand-200" />
                                    <p>まだ動画がありません。</p>
                                </div>
                            ) : (
                                <div className="grid grid-rows-[repeat(3,max-content)] grid-flow-col auto-cols-[280px] sm:auto-cols-[320px] overflow-x-auto gap-4 sm:gap-6 pb-4 no-scrollbar snap-x snap-mandatory px-1">
                                    {recommendedVideos.slice(0, 15).map(v => <VideoCard key={v.id} v={v} isScrollMode={true} />)}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Modal */}
            {modalData.isOpen && (
                <div className="fixed inset-0 z-[6000] bg-[#2a1a17]/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
                    <div className="bg-[#fffdf9] bg-texture w-full sm:max-w-7xl h-[90vh] sm:h-[85vh] rounded-t-xl sm:rounded-md shadow-2xl flex flex-col border border-brand-300 animate-fade-in-up">
                        <div className="p-4 sm:p-6 border-b border-brand-200 flex justify-between items-center bg-[#fffdf9] shrink-0 rounded-t-md">
                            <h3 className="font-bold text-brand-900 font-serif tracking-widest flex items-center text-base sm:text-lg">
                                {modalData.title}
                            </h3>
                            <button onClick={closeModal} className="text-brand-400 hover:text-brand-700 bg-brand-50 rounded-sm w-8 h-8 flex items-center justify-center transition-colors border border-brand-200 shadow-sm">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar bg-texture">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                                {modalData.videos.map(v => <VideoCard key={v.id} v={v} isScrollMode={false} />)}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
