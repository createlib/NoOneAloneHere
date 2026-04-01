'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, onSnapshot, query, where, orderBy, getDoc, doc } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Podcast, Search, Users, Sparkles, X, ChevronRight, Radio, Mic, Play, Plus } from 'lucide-react';

interface PodcastData {
    id: string;
    title: string;
    description: string;
    tags: string[];
    authorId: string;
    authorName: string;
    authorIcon: string;
    thumbnailUrl: string;
    duration: number; // in seconds
    createdAt: string | any;
    updatedAt: string | any;
}

interface LiveRoomData {
    id: string;
    hostName: string;
    hostIcon: string;
    title: string;
    status: string;
    startedAt: any;
}

const presetTags = [
    { label: 'すべて', value: '' },
    { label: '対談・インタビュー', value: '対談・インタビュー' },
    { label: 'ひとり語り', value: 'ひとり語り' },
    { label: 'ノウハウ共有', value: 'ノウハウ共有' },
    { label: '活動報告', value: '活動報告' }
];

export default function PodcastsPage() {
    const { user, loading } = useAuth();
    
    const [allPodcasts, setAllPodcasts] = useState<PodcastData[]>([]);
    const [followingIds, setFollowingIds] = useState<string[]>([]);
    const [liveRooms, setLiveRooms] = useState<LiveRoomData[]>([]);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [currentTag, setCurrentTag] = useState('');
    
    const [showMoreModal, setShowMoreModal] = useState<{ isOpen: boolean; type: 'following' | 'recommended' | null }>({ isOpen: false, type: null });

    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [canPost, setCanPost] = useState(false);

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

                    const followsSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'following'));
                    setFollowingIds(followsSnap.docs.map(d => d.id));
                }

                const podRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts');
                const pSnap = await getDocs(podRef);
                const pods: PodcastData[] = [];
                pSnap.forEach(d => {
                    pods.push({ id: d.id, ...d.data() } as PodcastData);
                });
                
                pods.sort((a, b) => {
                    const tA = new Date(a.createdAt || a.updatedAt || 0).getTime();
                    const tB = new Date(b.createdAt || b.updatedAt || 0).getTime();
                    return tB - tA;
                });
                
                setAllPodcasts(pods);
            } catch (e) {
                console.error(e);
            } finally {
                setIsDataLoaded(true);
            }
        };

        fetchData();
        
        // Live rooms listener
        const liveRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms');
        const q = query(liveRef, where('status', '==', 'live'));
        const unsubscribeLive = onSnapshot(q, (snap) => {
            const rooms: LiveRoomData[] = [];
            snap.forEach(d => rooms.push({ id: d.id, ...d.data() } as LiveRoomData));
            rooms.sort((a, b) => {
                const tA = a.startedAt?.toMillis ? a.startedAt.toMillis() : 0;
                const tB = b.startedAt?.toMillis ? b.startedAt.toMillis() : 0;
                return tB - tA;
            });
            setLiveRooms(rooms);
        });

        return () => unsubscribeLive();
    }, [user, loading]);

    const formatDuration = (sec: number | undefined) => {
        if (!sec || isNaN(sec) || !isFinite(sec)) return "";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0'+s : s}`;
    };

    const isFiltering = searchQuery !== '' || currentTag !== '';

    let filteredPodcasts = allPodcasts;
    if (isFiltering) {
        filteredPodcasts = allPodcasts.filter(p => {
            const matchTag = currentTag === '' || (p.tags && p.tags.includes(currentTag));
            const matchSearch = searchQuery === '' ||
                (p.title && p.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchTag && matchSearch;
        });
    }

    const followingPodcasts = allPodcasts.filter(p => followingIds.includes(p.authorId));
    let recommendedPodcasts = allPodcasts.filter(p => !followingIds.includes(p.authorId));
    if (recommendedPodcasts.length === 0 && allPodcasts.length > 0) {
        recommendedPodcasts = [...allPodcasts];
    }
    
    // shuffle recommended for default view (simple randomization)
    const shuffledRecommended = isDataLoaded ? [...recommendedPodcasts].sort(() => 0.5 - Math.random()) : [];

    const getDisplayPodcasts = () => {
        if (showMoreModal.type === 'following') return followingPodcasts;
        if (showMoreModal.type === 'recommended') return recommendedPodcasts;
        return [];
    };

    const PodcastCard = ({ p, isScrollMode = false }: { p: PodcastData, isScrollMode?: boolean }) => {
        const durationStr = formatDuration(p.duration);

        return (
            <Link href={`/media/podcasts/detail?id=${p.id}`} className={`flex flex-col group block transition-all ${isScrollMode ? 'w-36 sm:w-44 shrink-0 snap-start' : 'w-full'}`}>
                <div className="w-full aspect-square rounded-xl bg-[#e8dfd1] overflow-hidden relative shadow-sm mb-3">
                    <img src={p.thumbnailUrl || 'https://via.placeholder.com/300x300?text=CAST'} className="w-full h-full object-cover opacity-95 group-hover:scale-105 group-hover:opacity-100 transition-transform duration-500" alt={p.title} />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Play className="text-white w-10 h-10 sm:w-12 sm:h-12 opacity-0 group-hover:opacity-100 transition-transform duration-300 drop-shadow-lg fill-white transform scale-90 group-hover:scale-100" />
                    </div>
                    {durationStr && (
                        <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-sans font-bold px-1.5 py-0.5 rounded tracking-widest leading-none shadow-sm">{durationStr}</div>
                    )}
                </div>
                <div className="px-0.5">
                    <h3 className="text-sm sm:text-[15px] font-bold text-brand-900 leading-tight line-clamp-2 font-serif group-hover:text-[#b8860b] transition-colors mb-1">{p.title || 'タイトルなし'}</h3>
                    <p className="text-[11px] sm:text-xs text-brand-500 line-clamp-1 truncate tracking-wide font-medium">{p.authorName || '名無し'}</p>
                </div>
            </Link>
        );
    };

    return (
        <div className="antialiased min-h-screen bg-texture body-pb-nav lg:pb-0 pt-16">
            <Navbar />
            <main className="w-full max-w-[1600px] mx-auto pt-4 px-4 sm:px-6 lg:px-8">
                
                {/* Hero Header */}
                <div className="flex justify-between items-center mb-8 relative z-10 pt-4">
                    <h1 className="text-3xl font-bold font-serif text-brand-900 tracking-widest flex items-center gap-3">
                        <Podcast className="text-brand-300" size={32} /> NOAH CAST
                    </h1>
                    {canPost && (
                        <Link href="/media/podcasts/new" className="inline-flex items-center px-4 py-2 bg-[#8b6a4f] text-[#fffdf9] text-xs font-bold rounded-sm shadow-md hover:bg-[#725b3f] transition-colors border border-[#725b3f] tracking-widest">
                            <Plus size={14} className="mr-1" /> 音声を投稿
                        </Link>
                    )}
                </div>
                
                <div className="pb-8 md:pb-12 flex flex-col items-center text-center relative max-w-4xl mx-auto">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.05)_0%,transparent_70%)] pointer-events-none"></div>

                </div>

                {/* Search & Tags */}
                <div className="mb-8 sticky top-16 z-30 glass-bar py-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:border-none">
                    <div className="flex flex-col xl:flex-row gap-4 mb-4 items-center justify-between">
                        <div className="relative w-full xl:w-96 group shrink-0">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-brand-400 group-focus-within:text-brand-600 transition-colors" size={16} />
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="タイトルや内容で検索..." 
                                className="w-full pl-11 pr-4 py-3 rounded-full border border-brand-200 shadow-sm text-sm focus:ring-brand-500 focus:border-brand-500 bg-[#fffdf9] transition-shadow hover:shadow-md outline-none" 
                            />
                        </div>
                        
                        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 w-full pb-2">
                            {presetTags.map(tag => (
                                <button 
                                    key={tag.value}
                                    onClick={() => setCurrentTag(tag.value)} 
                                    className={`whitespace-nowrap px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm transform hover:scale-105 shrink-0
                                        ${currentTag === tag.value ? 'bg-[#3e2723] text-[#d4af37] border border-[#b8860b] scale-105' : 'bg-[#fffdf9] text-brand-600 border border-brand-200 hover:bg-brand-50 hover:border-[#b8860b]'}
                                    `}
                                >
                                    {tag.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Live Now Section */}
                {!isFiltering && liveRooms.length > 0 && (
                    <div className="mb-8 border-b border-brand-200 pb-8">
                        <h2 className="font-bold text-red-600 text-sm md:text-base font-serif tracking-widest mb-5 flex items-center px-1 sm:px-0">
                            <Radio className="animate-pulse mr-2 w-5 h-5" />配信中の SIGNAL CAST
                        </h2>
                        <div className="flex overflow-x-auto gap-4 sm:gap-6 pb-4 pt-1 no-scrollbar snap-x px-1 sm:px-0">
                            {liveRooms.map(r => (
                                <Link key={r.id} href={`/media/live_room?roomId=${r.id}`} className="flex flex-col items-center gap-2 group w-[72px] sm:w-[88px] shrink-0 snap-start">
                                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full p-[2px] bg-gradient-to-tr from-red-500 via-orange-400 to-[#b8860b] shadow-md group-hover:scale-105 transition-transform">
                                        <div className="w-full h-full bg-[#fffdf9] rounded-full p-[2px]">
                                            <img src={r.hostIcon || 'https://via.placeholder.com/150?text=U'} className="w-full h-full rounded-full object-cover" alt={r.hostName} />
                                        </div>
                                        <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-sm tracking-widest border border-red-800 shadow-sm whitespace-nowrap z-10">LIVE</div>
                                    </div>
                                    <div className="text-center w-full mt-1 px-1">
                                        <p className="text-xs sm:text-sm font-bold text-brand-900 truncate group-hover:text-red-600 transition-colors tracking-wide">{r.hostName || '名無し'}</p>
                                        <p className="text-[9px] sm:text-[10px] text-brand-500 truncate mt-0.5">{r.title}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                <div className="pb-12">
                    {isFiltering ? (
                        <div>
                            <h2 className="font-bold text-brand-900 text-lg md:text-xl font-serif tracking-widest mb-6 flex items-center border-b border-brand-200 pb-2">
                                <Search className="text-brand-400 mr-3" />検索結果
                            </h2>
                            {filteredPodcasts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-brand-400 py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200">
                                    <Mic className="text-4xl w-12 h-12 mb-3 text-brand-200" />
                                    <p>該当する配信がありません。</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                                    {filteredPodcasts.map(p => <PodcastCard key={p.id} p={p} />)}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {/* Following Section */}
                            {followingPodcasts.length > 0 && (
                                <div>
                                    <div className="flex justify-between items-end mb-4 border-b border-brand-200 pb-2">
                                        <h2 className="font-bold text-brand-900 text-lg md:text-xl font-serif tracking-widest flex items-center">
                                            <Users className="text-brand-400 mr-3" />フォロー中の新着
                                        </h2>
                                        <button onClick={() => setShowMoreModal({ isOpen: true, type: 'following' })} className="text-[10px] sm:text-xs font-bold text-brand-500 hover:text-brand-800 transition-colors tracking-widest flex items-center bg-brand-50 px-3 py-1.5 rounded-sm border border-brand-200 shadow-sm">
                                            すべて見る <ChevronRight size={14} className="ml-1" />
                                        </button>
                                    </div>
                                    <div className="flex overflow-x-auto gap-4 sm:gap-6 pb-6 pt-2 no-scrollbar snap-x snap-mandatory px-1">
                                        {followingPodcasts.slice(0, 25).map(p => <PodcastCard key={p.id} p={p} isScrollMode={true} />)}
                                    </div>
                                </div>
                            )}

                            {/* Recommended Section */}
                            <div>
                                <div className="flex justify-between items-end mb-4 border-b border-brand-200 pb-2">
                                    <h2 className="font-bold text-brand-900 text-lg md:text-xl font-serif tracking-widest flex items-center">
                                        <Sparkles className="text-[#b8860b] mr-3" />おすすめ
                                    </h2>
                                    <button onClick={() => setShowMoreModal({ isOpen: true, type: 'recommended' })} className="text-[10px] sm:text-xs font-bold text-brand-500 hover:text-brand-800 transition-colors tracking-widest flex items-center bg-brand-50 px-3 py-1.5 rounded-sm border border-brand-200 shadow-sm">
                                        すべて見る <ChevronRight size={14} className="ml-1" />
                                    </button>
                                </div>
                                <div className="flex overflow-x-auto gap-4 sm:gap-6 pb-6 pt-2 no-scrollbar snap-x snap-mandatory px-1">
                                    {!isDataLoaded ? (
                                        <div className="w-full flex-col flex items-center justify-center text-center py-12 text-brand-400">音声を読み込み中...</div>
                                    ) : shuffledRecommended.length === 0 ? (
                                        <div className="w-full flex flex-col items-center justify-center text-brand-400 py-20 bg-[#fffdf9] rounded-sm border border-dashed border-brand-200">
                                            <Mic className="text-4xl w-12 h-12 mb-3 text-brand-200" />
                                            <p>まだ配信がありません。</p>
                                        </div>
                                    ) : (
                                        shuffledRecommended.slice(0, 25).map(p => <PodcastCard key={p.id} p={p} isScrollMode={true} />)
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* "See All" Modal */}
            {showMoreModal.isOpen && (
                <div className="fixed inset-0 z-[6000] bg-[#2a1a17]/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 p-0">
                    <div className="bg-[#fffdf9] bg-texture w-full sm:max-w-5xl h-[90vh] sm:h-[85vh] rounded-t-xl sm:rounded-md shadow-2xl flex flex-col border border-brand-300">
                        <div className="p-4 sm:p-6 border-b border-brand-200 flex justify-between items-center bg-[#fffdf9] shrink-0 rounded-t-md">
                            <h3 className="font-bold text-brand-900 font-serif tracking-widest flex items-center text-base sm:text-lg">
                                {showMoreModal.type === 'following' ? <><Users className="text-brand-400 mr-2" />フォロー中の新着</> : <><Sparkles className="text-[#b8860b] mr-2" />おすすめ</>}
                            </h3>
                            <button onClick={() => setShowMoreModal({ isOpen: false, type: null })} className="text-brand-400 hover:text-brand-700 bg-brand-50 rounded-sm w-8 h-8 flex items-center justify-center transition-colors border border-brand-200 shadow-sm"><X size={16} /></button>
                        </div>
                        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar bg-texture">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                                {getDisplayPodcasts().map(p => <PodcastCard key={p.id} p={p} />)}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
