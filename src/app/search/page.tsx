'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db, APP_ID as appId } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { Compass, Ship, Hourglass, User, Film, Podcast, Lock, ShieldHalf, Search as SearchIcon, Dna, Users, EyeOff, MapPin, Anchor, House, Hammer, Gavel, Loader2, Menu, X } from 'lucide-react';
import Navbar from '@/components/Navbar';

const PREFECTURES = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県","海外","その他"];

const rankLevels: Record<string, number> = { 'arrival': 0, 'settler': 1, 'builder': 2, 'guardian': 3, 'covenant': 4, 'admin': 99 };
function getRankLevel(rank: string) { return rankLevels[rank] || 0; }

function getMbtiBadge(mbti?: string | null) {
    if (!mbti || mbti === '未設定') return null;
    const analysts = ['INTJ', 'INTP', 'ENTJ', 'ENTP'];
    const diplomats = ['INFJ', 'INFP', 'ENFJ', 'ENFP'];
    const sentinels = ['ISTJ', 'ISFJ', 'ESTJ', 'ESFJ'];
    const explorers = ['ISTP', 'ISFP', 'ESTP', 'ESFP'];
    
    let colorClass = 'bg-[#f7f5f0] text-[#725b3f] border-[#e8dfd1]';
    if (analysts.includes(mbti)) colorClass = 'bg-purple-50 text-purple-700 border-purple-200';
    if (diplomats.includes(mbti)) colorClass = 'bg-green-50 text-green-700 border-green-200';
    if (sentinels.includes(mbti)) colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
    if (explorers.includes(mbti)) colorClass = 'bg-yellow-50 text-yellow-700 border-yellow-200';

    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border tracking-widest font-mono shadow-sm ${colorClass}`}>{mbti}</span>;
}

type UserData = {
    id: string;
    userId: string;
    name?: string;
    jobTitle?: string;
    prefecture?: string;
    birthplace?: string;
    profileScore?: number;
    isHidden?: boolean;
    osNumber?: string | number;
    skills?: string[];
    hobbies?: string[];
    canOffer?: string[];
    lookingFor?: string[];
    photoURL?: string;
    membershipRank?: string;
    mbti?: string;
};

function SearchContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [myRank, setMyRank] = useState('arrival');
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [allUsers, setAllUsers] = useState<UserData[]>([]);
    
    const [searchQ, setSearchQ] = useState('');
    const [osQ, setOsQ] = useState(searchParams.get('osNumber') || '');
    const [areaQ, setAreaQ] = useState('');
    const [mbtiQ, setMbtiQ] = useState(searchParams.get('mbti') || '');
    
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        async function fetchData() {
            if (!user) return;
            
            try {
                // Check permissions
                let currentRank = 'arrival';
                let adminFlag = false;
                
                if (user.uid === "Zm7FWRopJKVfyzbp8KXXokMFjNC3") { // Admin bypass
                    adminFlag = true;
                    currentRank = 'covenant';
                } else {
                    try {
                        const mySnap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));
                        if (mySnap.exists()) {
                            const data = mySnap.data();
                            currentRank = data.membershipRank || 'arrival';
                            if (data.userId === 'admin') adminFlag = true;
                        }
                    } catch (e) {
                        console.error("Rank fetch failed", e);
                    }
                }
                
                setIsAdmin(adminFlag);
                setMyRank(currentRank);
                
                // Fetch Users (unconditionally for all visitors)
                const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
                const snap = await getDocs(usersRef);
                let usersList: UserData[] = [];
                snap.forEach(d => {
                    const data = d.data() as UserData;
                    // Only exclude users explicitly marked as hidden, unless current user is admin
                    if (data.isHidden !== true || adminFlag) {
                        usersList.push({ ...data, id: d.id });
                    }
                });
                
                // Sort by profileScore desc, then name
                usersList.sort((a, b) => {
                    const scoreA = Number(a.profileScore) || 0;
                    const scoreB = Number(b.profileScore) || 0;
                    if (scoreB !== scoreA) return scoreB - scoreA;
                    const nameA = String(a.name || a.userId || '');
                    const nameB = String(b.name || b.userId || '');
                    return nameA.localeCompare(nameB);
                });
                
                setAllUsers(usersList);
            } catch (err: any) {
                console.error("Failed to fetch users", err);
                setFetchError(err.message || String(err));
            } finally {
                setLoading(false);
            }
        }
        
        // Fetch data regardless of user login status, but user-specific data (rank) depends on `user`
        if (!authLoading) {
            fetchData();
        }
    }, [user, authLoading]);

    const filteredUsers = useMemo(() => {
        const query = searchQ.toLowerCase();
        const targetOsStr = osQ.trim();
        
        return allUsers.filter(u => {
            let matchSearch = true;
            if (query) {
                const safeArray = (val: any) => Array.isArray(val) ? val : (typeof val === 'string' ? [val] : []);
                const searchable = [
                    u.name, u.userId, u.jobTitle, 
                    ...safeArray(u.skills), ...safeArray(u.hobbies),
                    ...safeArray(u.canOffer), ...safeArray(u.lookingFor)
                ].join(' ').toLowerCase();
                matchSearch = searchable.includes(query);
            }

            let matchArea = true;
            if (areaQ) {
                matchArea = u.prefecture === areaQ || u.birthplace === areaQ;
            }

            let matchOs = true;
            if (targetOsStr) {
                matchOs = String(u.osNumber) === targetOsStr;
            }
            
            let matchMbti = true;
            if (mbtiQ) {
                matchMbti = u.mbti === mbtiQ;
            }
            
            return matchSearch && matchArea && matchOs && matchMbti;
        });
    }, [allUsers, searchQ, osQ, areaQ, mbtiQ]);

    const getRankBadge = (rank?: string) => {
        if (!rank || rank === 'arrival') return null;
        const baseClasses = "text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-sm font-bold tracking-widest shadow-sm whitespace-nowrap flex items-center";
        
        if (rank === 'settler') return <span className={`bg-[#f0ebdd] text-[#725b3f] border border-[#dcd4c6] ${baseClasses}`}><House className="w-3 h-3 sm:mr-1 text-[#725b3f]"/><span className="hidden sm:inline">SETTLER</span></span>;
        if (rank === 'builder') return <span className={`bg-[#e8dfd1] text-[#5c4a3d] border border-[#c8b9a6] ${baseClasses}`}><Hammer className="w-3 h-3 sm:mr-1 text-[#5c4a3d]"/><span className="hidden sm:inline">BUILDER</span></span>;
        if (rank === 'guardian') return <span className={`bg-[#8b6a4f] text-[#fffdf9] border border-[#5c4a3d] ${baseClasses}`}><Gavel className="w-3 h-3 sm:mr-1"/><span className="hidden sm:inline">GUARDIAN</span></span>;
        if (rank === 'covenant' || rank === 'admin') return <span className={`bg-[#3e2723] text-[#d4af37] border border-[#b8860b] ${baseClasses}`}><ShieldHalf className="w-3 h-3 sm:mr-1"/><span className="hidden sm:inline">COVENANT</span></span>;
        return null;
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-texture pb-20 flex flex-col">
                <Navbar />
                <div className="flex-1 flex items-center justify-center pt-20">
                    <Loader2 className="w-10 h-10 animate-spin text-[#a09080]" />
                </div>
            </div>
        );
    }
    
    // If user is not logged in, myRank will be 'arrival' and hasAccess will be false.
    // If user is logged in, myRank will be their actual rank.
    const rLevel = getRankLevel(myRank.toLowerCase());
    const hasAccess = rLevel >= 1 || isAdmin;

    return (
        <div className="min-h-screen bg-texture pb-20 body-pb-nav lg:pb-0">
            <Navbar />

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto pt-24 lg:pt-20 px-4 sm:px-6 lg:px-8 pb-10">
                {fetchError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 shadow-sm text-sm break-all font-mono">
                        <strong className="font-bold">Error loading directory: </strong>
                        <span className="block sm:inline">{fetchError}</span>
                    </div>
                )}
                
                {/* Always Show Content, but lock inputs if !hasAccess */}
                <div id="search-content">
                    {!hasAccess && (
                        <div className="mb-6 p-4 bg-[#fffdf9] rounded-sm border border-[#e8dfd1] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#8b6a4f]"></div>
                            <div>
                                <h3 className="font-bold text-[#3e2723] text-sm tracking-widest mb-1 flex items-center gap-2"><Lock className="w-4 h-4 text-[#8b6a4f]"/> 検索機能の利用制限</h3>
                                <p className="text-[10px] sm:text-xs text-[#725b3f] tracking-widest leading-relaxed">絞り込み機能およびフリー検索は、<span className="font-bold">SETTLER（またはそれ以上）</span>の会員限定です。</p>
                            </div>
                            <Link href={`/user/${user?.uid}?tab=billing`} className="shrink-0 px-4 py-2 bg-[#3e2723] text-[#d4af37] border border-[#b8860b] font-bold rounded-sm shadow-sm hover:bg-[#2a1a17] transition-colors tracking-widest text-[10px] transform hover:-translate-y-0.5 whitespace-nowrap">
                                <ShieldHalf className="mr-2 w-4 h-4" /> アップグレード
                            </Link>
                        </div>
                    )}
                    
                    {/* Search & Filter Header */}
                        <div className="mb-8 bg-[#fffdf9] p-4 sm:p-6 rounded-sm shadow-md border border-[#e8dfd1] relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-[#8b6a4f] z-10 m-2 opacity-50"></div>
                            
                            <div className="flex flex-col lg:flex-row gap-4 relative z-10">
                                {/* Free Word Search */}
                                <div className="flex-1 relative">
                                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#a09080] w-5 h-5" />
                                    <input 
                                        type="text" 
                                        placeholder="名前、職業、スキルで検索..." 
                                        value={searchQ}
                                        onChange={e => setSearchQ(e.target.value)}
                                        disabled={!hasAccess}
                                        className="w-full pl-10 pr-4 py-3 rounded-sm border border-[#e8dfd1] shadow-sm text-sm focus:ring-[#8b6a4f] focus:border-[#8b6a4f] bg-[#f7f5f0] disabled:opacity-50 disabled:cursor-not-allowed" 
                                    />
                                </div>
                                
                                {/* Filters */}
                                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                                    {/* OS Number Filter */}
                                    <div className="relative flex-1 sm:w-36">
                                        <Dna className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#a09080] w-4 h-4" />
                                        <input 
                                            type="number" 
                                            placeholder="OS No." 
                                            min="1" max="60" 
                                            value={osQ}
                                            onChange={e => setOsQ(e.target.value)}
                                            disabled={!hasAccess}
                                            className="w-full border border-[#e8dfd1] rounded-sm py-3 pl-9 pr-3 text-sm bg-[#f7f5f0] text-[#5c4a3d] shadow-sm focus:ring-[#8b6a4f] focus:border-[#8b6a4f] font-medium tracking-widest disabled:opacity-50 disabled:cursor-not-allowed" 
                                        />
                                    </div>
                                    
                                    <select 
                                        value={areaQ}
                                        onChange={e => setAreaQ(e.target.value)}
                                        disabled={!hasAccess}
                                        className="flex-1 sm:w-36 border border-[#e8dfd1] rounded-sm py-3 px-3 text-sm bg-[#f7f5f0] text-[#5c4a3d] shadow-sm focus:ring-[#8b6a4f] font-medium tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">全てのエリア</option>
                                        {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    
                                    <select 
                                        value={mbtiQ}
                                        onChange={e => setMbtiQ(e.target.value)}
                                        disabled={!hasAccess}
                                        className="flex-1 sm:w-36 border border-[#e8dfd1] rounded-sm py-3 px-3 text-sm bg-[#f7f5f0] text-[#5c4a3d] shadow-sm focus:ring-[#8b6a4f] font-medium font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">MBTI</option>
                                        <optgroup label="分析家 (紫)">
                                            <option value="INTJ">INTJ (建築家)</option>
                                            <option value="INTP">INTP (論理学者)</option>
                                            <option value="ENTJ">ENTJ (指揮官)</option>
                                            <option value="ENTP">ENTP (討論者)</option>
                                        </optgroup>
                                        <optgroup label="外交官 (緑)">
                                            <option value="INFJ">INFJ (提唱者)</option>
                                            <option value="INFP">INFP (仲介者)</option>
                                            <option value="ENFJ">ENFJ (主人公)</option>
                                            <option value="ENFP">ENFP (運動家)</option>
                                        </optgroup>
                                        <optgroup label="番人 (青)">
                                            <option value="ISTJ">ISTJ (管理者)</option>
                                            <option value="ISFJ">ISFJ (擁護者)</option>
                                            <option value="ESTJ">ESTJ (幹部)</option>
                                            <option value="ESFJ">ESFJ (領事)</option>
                                        </optgroup>
                                        <optgroup label="探検家 (黄)">
                                            <option value="ISTP">ISTP (巨匠)</option>
                                            <option value="ISFP">ISFP (冒険家)</option>
                                            <option value="ESTP">ESTP (起業家)</option>
                                            <option value="ESFP">ESFP (エンターテイナー)</option>
                                        </optgroup>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-[#f0ebdd] flex justify-between items-center text-xs text-[#a09080]">
                                <span className="tracking-widest flex items-center"><Users className="w-3 h-3 mr-1"/> <span className="font-bold text-[#5c4a3d] mx-1">{filteredUsers.length}</span> 名の乗客</span>
                                <span className="tracking-widest">※非公開設定のユーザーは表示されません</span>
                            </div>
                        </div>

                        {/* Users Grid */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-6">
                            {filteredUsers.length === 0 ? (
                                <div className="col-span-full text-center text-[#a09080] py-12 bg-[#fffdf9] rounded-sm border border-[#e8dfd1] border-dashed">
                                    該当する乗客が見つかりません。条件を変えてみてください。
                                </div>
                            ) : (
                                filteredUsers.map(u => {
                                    const name = u.name || u.userId || '名無し';
                                    const job = u.jobTitle || '職業未設定';
                                    const loc = u.prefecture || '拠点未設定';
                                    const imgKey = u.photoURL ? u.photoURL : 'default';

                                    return (
                                        <Link href={`/user?uid=${u.id || u.userId}`} key={u.id || u.userId} className="block bg-[#fffdf9] rounded-sm shadow-sm border border-[#e8dfd1] hover:shadow-md transition-shadow hover:border-[#8b6a4f] group relative overflow-hidden">
                                            {u.isHidden && (
                                                <div className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-red-600 text-white text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-sm font-bold z-10 flex items-center">
                                                    <EyeOff className="w-3 h-3 sm:mr-1" />
                                                    <span className="hidden sm:inline">非公開</span>
                                                </div>
                                            )}
                                            
                                            <div className="h-10 sm:h-16 bg-gradient-to-r from-[#dcd4c6] to-[#eae5d8] w-full border-b border-[#e8dfd1]"></div>
                                            
                                            <div className="px-2 sm:px-5 pb-3 sm:pb-5">
                                                <div className="-mt-8 mb-2 sm:mb-3 flex flex-col sm:flex-row justify-between items-center sm:items-end relative">
                                                    {u.photoURL ? (
                                                        <img src={u.photoURL} className="w-16 h-16 rounded-full sm:rounded-sm border-2 border-[#fffdf9] bg-[#fffdf9] object-cover shadow-sm group-hover:scale-105 transition-transform relative z-10" alt={name} />
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-full sm:rounded-sm border-2 border-[#fffdf9] bg-[#f7f5f0] flex items-center justify-center shadow-sm text-[#c8b9a6] group-hover:scale-105 transition-transform relative z-10">
                                                            <Anchor className="w-8 h-8" />
                                                        </div>
                                                    )}
                                                    
                                                    <div className="absolute -bottom-2 sm:relative sm:bottom-0 z-20 flex flex-col gap-1 items-center sm:items-end w-[calc(100%-80px)] sm:w-auto">
                                                        <div className="flex gap-1 flex-wrap justify-center sm:justify-end">
                                                            {getRankBadge(u.membershipRank)}
                                                            {getMbtiBadge(u.mbti)}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="text-center sm:text-left mt-3 sm:mt-0">
                                                    <h3 className="font-bold text-[#3e2723] text-xs sm:text-lg truncate font-serif tracking-wide group-hover:text-[#8b6a4f] transition-colors">{name}</h3>
                                                    <div className="flex flex-wrap items-center justify-center sm:justify-start mt-1 gap-1 mb-1 sm:mb-0">
                                                        <span className="text-[10px] text-[#8b6a4f] font-mono tracking-widest">@{u.userId || 'unknown'}</span>
                                                    </div>
                                                    <p className="text-[9px] sm:text-xs text-[#725b3f] truncate mb-0 sm:mb-3 tracking-widest">{job}</p>
                                                    
                                                    <div className="hidden sm:block">
                                                        <div className="flex items-center gap-2 text-xs text-[#725b3f] mb-3">
                                                            <MapPin className="text-[#a09080] w-3 h-3" />
                                                            <span className="truncate">{loc}</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5 h-[48px] overflow-hidden">
                                                            {(u.skills || []).slice(0, 3).map(t => (
                                                                <span key={t} className="bg-[#f7f5f0] border border-[#e8dfd1] text-[#725b3f] px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-widest truncate max-w-full">
                                                                    #{t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })
                            )}
                        </div>
                    </div>
            </main>

        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-texture pb-20 flex flex-col">
                <Navbar />
                <div className="flex-1 flex items-center justify-center pt-20">
                    <Loader2 className="w-10 h-10 animate-spin text-[#a09080]" />
                </div>
            </div>
        }>
            <SearchContent />
        </Suspense>
    );
}
