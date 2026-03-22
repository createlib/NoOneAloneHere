'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { Compass, Ship, Hourglass, User, Film, Podcast, Lock, ShieldHalf, Search as SearchIcon, Dna, Users, EyeOff, MapPin, Anchor, House, Hammer, Gavel, Loader2, Menu, X } from 'lucide-react';
import Navbar from '@/components/Navbar';

const appId = 'NOAH_APP_v1';
const PREFECTURES = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県","海外","その他"];

const rankLevels: Record<string, number> = { 'arrival': 0, 'settler': 1, 'builder': 2, 'guardian': 3, 'covenant': 4, 'admin': 99 };
function getRankLevel(rank: string) { return rankLevels[rank] || 0; }

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
};

function SearchContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [myRank, setMyRank] = useState('arrival');
    const [allUsers, setAllUsers] = useState<UserData[]>([]);
    
    const [searchQ, setSearchQ] = useState('');
    const [osQ, setOsQ] = useState(searchParams.get('osNumber') || '');
    const [areaQ, setAreaQ] = useState('');
    
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
                        const mySnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid));
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
                
                const rLevel = getRankLevel(currentRank.toLowerCase());
                
                // Fetch Users
                const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
                const snap = await getDocs(usersRef);
                let usersList: UserData[] = [];
                snap.forEach(d => {
                    const data = d.data() as UserData;
                    if (data.isHidden !== true || adminFlag) {
                        usersList.push({ ...data, id: d.id });
                    }
                });
                
                // Sort by profileScore desc, then name
                usersList.sort((a, b) => {
                    const scoreA = a.profileScore || 0;
                    const scoreB = b.profileScore || 0;
                    if (scoreB !== scoreA) return scoreB - scoreA;
                    const nameA = a.name || a.userId || '';
                    const nameB = b.name || b.userId || '';
                    return nameA.localeCompare(nameB);
                });
                
                setAllUsers(usersList);
            } catch (err) {
                console.error("Failed to fetch users", err);
            } finally {
                setLoading(false);
            }
        }
        
        if (user && !authLoading) {
            fetchData();
        }
    }, [user, authLoading]);

    const filteredUsers = useMemo(() => {
        const query = searchQ.toLowerCase();
        const targetOsStr = osQ.trim();
        
        return allUsers.filter(u => {
            let matchSearch = true;
            if (query) {
                const searchable = [
                    u.name, u.userId, u.jobTitle, 
                    ...(u.skills || []), ...(u.hobbies || []),
                    ...(u.canOffer || []), ...(u.lookingFor || [])
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
            
            return matchSearch && matchArea && matchOs;
        });
    }, [allUsers, searchQ, osQ, areaQ]);

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
    
    if (!user) return null; // Prevent showing anything while redirecting
    
    const rLevel = getRankLevel(myRank.toLowerCase());
    const hasAccess = rLevel >= 1 || isAdmin;

    return (
        <div className="min-h-screen bg-texture pb-20 body-pb-nav lg:pb-0">
            <Navbar />

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto pt-24 lg:pt-20 px-4 sm:px-6 lg:px-8 pb-10">
                    {/* Search Content */}
                    <div>
                        {!hasAccess && (
                            <div className="mb-6 p-4 bg-[#fffdf9] rounded-sm border border-[#e8dfd1] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-[#8b6a4f]"></div>
                                <div>
                                    <h3 className="font-bold text-[#3e2723] text-sm tracking-widest mb-1 flex items-center gap-2"><Lock className="w-4 h-4 text-[#8b6a4f]"/> 検索機能の利用制限</h3>
                                    <p className="text-[10px] sm:text-xs text-[#725b3f] tracking-widest leading-relaxed">絞り込み検索機能は、<span className="font-bold">SETTLER（またはそれ以上）</span>の会員限定です。</p>
                                </div>
                                <Link href={`/user/${user?.uid}?tab=billing`} className="shrink-0 px-4 py-2 bg-[#3e2723] text-[#d4af37] border border-[#b8860b] font-bold rounded-sm shadow-sm hover:bg-[#2a1a17] transition-colors tracking-widest text-[10px] transform hover:-translate-y-0.5 whitespace-nowrap">
                                    アップグレード
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
                                        className="flex-1 sm:w-40 border border-[#e8dfd1] rounded-sm py-3 px-3 text-sm bg-[#f7f5f0] text-[#5c4a3d] shadow-sm focus:ring-[#8b6a4f] font-medium tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">全てのエリア</option>
                                        {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-[#f0ebdd] flex justify-between items-center text-xs text-[#a09080]">
                                <span className="tracking-widest flex items-center"><Users className="w-3 h-3 mr-1"/> <span className="font-bold text-[#5c4a3d] mx-1">{filteredUsers.length}</span> 名の乗客</span>
                                <span className="tracking-widest">※非公開設定のユーザーは表示されません</span>
                            </div>
                        </div>

                        {/* Users Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
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
                                                    
                                                    <div className="absolute -bottom-2 sm:relative sm:bottom-0 z-20">
                                                        {getRankBadge(u.membershipRank)}
                                                    </div>
                                                </div>
                                                
                                                <div className="text-center sm:text-left mt-3 sm:mt-0">
                                                    <h3 className="font-bold text-[#3e2723] text-xs sm:text-lg truncate font-serif tracking-wide group-hover:text-[#8b6a4f] transition-colors">{name}</h3>
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

            {/* Mobile Bottom Navigation Component */}
            <nav className="lg:hidden bottom-nav-fixed shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] bg-[#fffdf9] border-t border-[#e8dfd1] flex items-center">
                <div className="bottom-nav-content w-full flex justify-between px-2 h-full">
                    <Link href="/home" className="flex flex-col items-center justify-center w-full h-full text-[#a09080] hover:text-[#725b3f] transition-colors">
                        <Ship className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium tracking-widest">航海</span>
                    </Link>
                    <Link href="/events" className="flex flex-col items-center justify-center w-full h-full text-[#a09080] hover:text-[#725b3f] transition-colors">
                        <Hourglass className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium tracking-widest">イベント</span>
                    </Link>
                    <Link href="/search" className="flex flex-col items-center justify-center w-full h-full text-[#8b6a4f] border-t-2 border-[#8b6a4f] pt-[2px]">
                        <Compass className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold tracking-widest">さがす</span>
                    </Link>
                    <button className="flex flex-col items-center justify-center w-full h-full text-[#a09080] hover:text-[#725b3f] transition-colors">
                        <Film className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium tracking-widest">メディア</span>
                    </button>
                    <Link href="/user" className="flex flex-col items-center justify-center w-full h-full text-[#a09080] hover:text-[#725b3f] transition-colors">
                        <User className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium tracking-widest">マイページ</span>
                    </Link>
                </div>
            </nav>
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
