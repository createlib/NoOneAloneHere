'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db, APP_ID } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Anchor, User as UserIcon, ShieldHalf, Globe, Instagram, Twitter, Check, ArrowLeft } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const OS_THEMES: Record<string, { bg: string, main: string, sub: string }> = {
  '甲': { bg: '#041208', main: '#10B981', sub: '#34D399' },
  '乙': { bg: '#08140B', main: '#34D399', sub: '#6EE7B7' },
  '丙': { bg: '#1A0808', main: '#EF4444', sub: '#FCA5A5' },
  '丁': { bg: '#180B05', main: '#F97316', sub: '#FDBA74' },
  '戊': { bg: '#171105', main: '#D97706', sub: '#FCD34D' },
  '己': { bg: '#141208', main: '#B45309', sub: '#FDE047' },
  '庚': { bg: '#080A0F', main: '#94A3B8', sub: '#CBD5E1' },
  '辛': { bg: '#0B0D14', main: '#CBD5E1', sub: '#F1F5F9' },
  '壬': { bg: '#050A14', main: '#3B82F6', sub: '#93C5FD' },
  '癸': { bg: '#060913', main: '#C5A880', sub: '#3B82F6' }
};

function formatText(text: string | undefined | null) {
    if (!text) return '';
    try {
        const textStr = String(text).replace(/__(.*?)__/g, '<u>$1</u>');
        const rawHtml = marked.parse(textStr, { breaks: true, gfm: true }) as string;
        return DOMPurify.sanitize(rawHtml, { 
            ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'u', 'span', 'blockquote', 'code', 'pre'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style']
        });
    } catch {
        return DOMPurify.sanitize(text.replace(/\n/g, '<br>'));
    }
}

function PublicProfileContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const targetUid = searchParams?.get('uid');

    const [userData, setUserData] = useState<any>(null);
    const [osData, setOsData] = useState<any>(null);
    const [userVideos, setUserVideos] = useState<any[]>([]);
    const [userPodcasts, setUserPodcasts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!targetUid) {
            // During Next.js static export hydration, useSearchParams might be null initially.
            // Wait a brief moment before assuming the URL is genuinely missing the uid param.
            const hydrationTimer = setTimeout(() => {
                setLoading(false);
            }, 800);
            return () => clearTimeout(hydrationTimer);
        }

        const loadData = async () => {
            setLoading(true); // Re-assert loading state when targetUid resolves
            try {
                console.log("Loading public profile for UID:", targetUid);
                // Fetch User Profile Source Truth from PUBLIC subcollection
                const userRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', targetUid);
                let userSnap = await getDoc(userRef);

                if (!userSnap.exists()) {
                    // Fallback to basic users collection
                    console.log("Not found in public/data/users, falling back to users/");
                    const fallbackRef = doc(db, 'artifacts', APP_ID, 'users', targetUid);
                    userSnap = await getDoc(fallbackRef);
                    if (!userSnap.exists()) {
                        setUserData(null);
                        setLoading(false);
                        return;
                    }
                }

                const loadedData = userSnap.data();
                setUserData(loadedData);

                // Fetch OS Background Truth
                if (loadedData?.osNumber) {
                    const osRef = doc(db, 'artifacts', APP_ID, 'os_blueprints', String(loadedData.osNumber));
                    const osSnap = await getDoc(osRef);
                    if (osSnap.exists()) {
                        setOsData(osSnap.data());
                    }
                }

                try {
                    const vQ = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos'), where('authorId', '==', targetUid));
                    const vSnap = await getDocs(vQ);
                    const vMap = vSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    vMap.sort((a:any,b:any) => new Date(b.createdAt||b.updatedAt||0).getTime() - new Date(a.createdAt||a.updatedAt||0).getTime());
                    setUserVideos(vMap);

                    const pQ = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts'), where('authorId', '==', targetUid));
                    const pSnap = await getDocs(pQ);
                    const pMap = pSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    pMap.sort((a:any,b:any) => new Date(b.createdAt||b.updatedAt||0).getTime() - new Date(a.createdAt||a.updatedAt||0).getTime());
                    setUserPodcasts(pMap);
                } catch(e) { console.error("Media fetch error", e); }
            } catch (error) {
                console.error("Error loading public profile:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [targetUid]);

    if (loading) {
        return <div className="text-center py-20 text-[#a09080] font-bold tracking-widest min-h-screen flex items-center justify-center bg-texture">Loading...</div>;
    }

    if (!userData) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-texture p-4">
                <div className="bg-[#fffdf9] p-8 rounded-sm shadow-md border border-[#e8dfd1] text-center max-w-sm mx-auto w-full">
                    <UserIcon className="w-12 h-12 text-[#c8b9a6] mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-[#3e2723] mb-2 font-serif tracking-widest">ユーザーが見つかりません</h3>
                    <p className="text-[#a09080] text-sm mb-6">IDが間違っているか、存在しないページです。</p>
                </div>
            </div>
        );
    }

    const isProfileComplete = (userData.profileScore || 0) >= 100;
    const showOSCover = isProfileComplete && userData.osNumber;
    const osTheme = showOSCover && osData?.jukkan ? OS_THEMES[osData.jukkan] : (userData.osJukkan ? OS_THEMES[userData.osJukkan] : OS_THEMES['癸']);

    const rank = userData.membershipRank || 'arrival';

    return (
        <div className="min-h-screen bg-texture antialiased text-[#3e2723] font-serif break-words">
            {/* Minimal Header (No system menus, no back jumps to generic routes if directly accessed) */}
            <header className="bg-[#fffdf9] border-b border-[#e8dfd1] h-14 flex items-center px-4 fixed w-full top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      {window.history.length > 1 && (
                          <button onClick={() => router.back()} className="text-[#a09080] hover:text-[#725b3f] transition-colors flex items-center gap-1.5 text-xs font-bold tracking-widest">
                              <ArrowLeft size={14} /> 戻る
                          </button>
                      )}
                    </div>
                    <div className="text-sm font-black text-[#3e2723] tracking-[0.2em] flex items-center justify-center pointer-events-none opacity-50">
                        PUBLIC PROFILE
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto pt-20 px-4 sm:px-6 lg:px-8 pb-20">
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 justify-center">
                    
                    {/* Sidebar Area */}
                    <aside className="w-full lg:w-[360px] flex-shrink-0 animate-fade-in-up">
                        <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-[#e8dfd1] overflow-hidden relative">
                            {/* Decorative corners */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-[#c8b9a6] z-10 m-2"></div>
                            <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-[#c8b9a6] z-10 m-2"></div>

                            <div className={`h-32 sm:h-40 w-full border-b border-[#e8dfd1] relative flex items-center justify-center overflow-hidden bg-gradient-to-tr from-[#f0ebdd] to-[#f8f5ed] ${showOSCover ? '' : ''}`}
                                 style={showOSCover ? { borderColor: osTheme.main } : {}}
                            >
                                {showOSCover && (
                                    <>
                                        <div className="absolute inset-0 z-0" style={{ backgroundColor: osTheme.bg, backgroundImage: `radial-gradient(circle at center, rgba(255,255,255,0.08) 0%, ${osTheme.bg} 100%)` }}></div>
                                        <div className="z-10 flex flex-col items-center justify-center pt-2 sm:pt-4">
                                            <div className="text-[10px] sm:text-xs tracking-[0.4em] font-eng font-bold mb-0.5 drop-shadow-md" style={{ color: osTheme.sub }}>{osData?.ruby || userData.osRuby || 'GENBAN'}</div>
                                            <div className="text-3xl sm:text-4xl font-bold tracking-[0.15em] font-serif pl-2 text-white" style={{ textShadow: `0 0 15px ${osTheme.main}` }}>{osData?.kanji || userData.osKanji || '玄盤'}</div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="px-6 relative pb-6 border-b border-[#e8dfd1]">
                                <div className="-mt-12 flex justify-between items-end mb-4">
                                    <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-sm border-[3px] border-[#fffdf9] bg-[#fffdf9] shadow-sm overflow-hidden relative z-20 flex items-center justify-center text-[#c8b9a6]">
                                        {userData.photoURL ? (
                                            <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <Anchor size={40} />
                                        )}
                                    </div>
                                </div>

                                <div className="mb-2 relative z-20">
                                    <h1 className="text-2xl font-bold text-[#3e2723] leading-tight font-serif flex items-center flex-wrap gap-3">
                                        <span>{userData.name || userData.userId || '名無し'}</span>
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <p className="text-sm text-[#8b6a4f] font-mono font-medium tracking-wide">@{userData.userId || 'unknown'}</p>
                                        {rank === 'covenant' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d4af37]/20 text-[#8b6508] border border-[#d4af37]/50 tracking-widest"><ShieldHalf size={10} className="mr-1"/>COVENANT</span>}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="px-6 py-4 border-b border-[#e8dfd1] bg-[#fdfbf6]">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm text-[#725b3f] tracking-wide">
                                        <span className="font-bold w-12 text-[#a09080]">職業</span>
                                        <span className="font-medium">{userData.jobTitle || '未設定'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-[#725b3f] tracking-wide">
                                        <span className="font-bold w-12 text-[#a09080]">出身</span>
                                        <span className="font-medium">{userData.birthplace || '未設定'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-[#725b3f] tracking-wide">
                                        <span className="font-bold w-12 text-[#a09080]">拠点</span>
                                        <span className="font-medium">{userData.prefecture || '未設定'}</span>
                                    </div>
                                    
                                    {(userData.websiteUrl || userData.snsInstagram || userData.snsX) && (
                                        <div className="flex gap-3 pt-4 pb-2 border-t border-[#e8dfd1] mt-4">
                                            {userData.websiteUrl && <a href={userData.websiteUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full border border-[#e8dfd1] bg-[#fffdf9] flex items-center justify-center text-[#c8b9a6] hover:text-[#b8860b] hover:border-[#b8860b] hover:bg-[#fffdf9] transition-all shadow-sm"><Globe size={14} /></a>}
                                            {userData.snsInstagram && <a href={userData.snsInstagram.startsWith('http') ? userData.snsInstagram : 'https://instagram.com/'+userData.snsInstagram} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full border border-[#e8dfd1] bg-[#fffdf9] flex items-center justify-center text-[#c8b9a6] hover:text-[#b8860b] hover:border-[#b8860b] hover:bg-[#fffdf9] transition-all shadow-sm"><Instagram size={14} /></a>}
                                            {userData.snsX && <a href={userData.snsX.startsWith('http') ? userData.snsX : 'https://twitter.com/'+userData.snsX} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full border border-[#e8dfd1] bg-[#fffdf9] flex items-center justify-center text-[#c8b9a6] hover:text-[#b8860b] hover:border-[#b8860b] hover:bg-[#fffdf9] transition-all shadow-sm"><Twitter size={14} /></a>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <div className="flex-1 min-w-0 max-w-3xl space-y-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                        
                        {/* Bio Section */}
                        {userData.bio && (
                            <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-[#e8dfd1] p-6 sm:p-8 relative">
                                <h2 className="text-lg font-bold text-[#3e2723] mb-4 pb-2 border-b border-[#e8dfd1] font-serif tracking-widest">自己紹介</h2>
                                <div className="prose prose-sm max-w-none text-[#5c4a3d] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatText(userData.bio) }}></div>
                            </div>
                        )}

                        {/* Objectives / Goals */}
                        {userData.goals && (
                            <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-[#e8dfd1] p-6 sm:p-8 relative">
                                <h2 className="text-lg font-bold text-[#3e2723] mb-4 pb-2 border-b border-[#e8dfd1] font-serif tracking-widest">目標・ビジョン</h2>
                                <div className="prose prose-sm max-w-none text-[#5c4a3d] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatText(userData.goals) }}></div>
                            </div>
                        )}

                        {/* Message */}
                        {userData.message && (
                            <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-[#e8dfd1] p-6 sm:p-8 relative">
                                <h2 className="text-lg font-bold text-[#3e2723] mb-4 pb-2 border-b border-[#e8dfd1] font-serif tracking-widest">想い・メッセージ</h2>
                                <div className="prose prose-sm max-w-none text-[#5c4a3d] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatText(userData.message) }}></div>
                            </div>
                        )}

                        {/* Offering & Looking For */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-[#fffdf9] rounded-sm p-6 border border-[#e8dfd1] shadow-md relative overflow-hidden group">
                                <h3 className="text-sm font-bold text-[#725b3f] mb-4 tracking-widest font-serif relative z-10 border-b border-[#e8dfd1] pb-2">提供できること</h3>
                                <ul className="space-y-3 relative z-10">
                                    {userData.canOffer?.length > 0 ? (
                                        userData.canOffer.map((item: string, idx: number) => (
                                            <li key={idx} className="text-[#5c4a3d] text-sm flex items-start gap-2"><Check className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0"/>{item}</li>
                                        ))
                                    ) : <li className="text-[#c8b9a6] italic text-sm">未設定</li>}
                                </ul>
                            </div>
                            <div className="bg-[#fffdf9] rounded-sm p-6 border border-[#e8dfd1] shadow-md relative overflow-hidden group">
                                <h3 className="text-sm font-bold text-[#725b3f] mb-4 tracking-widest font-serif relative z-10 border-b border-[#e8dfd1] pb-2">求めていること</h3>
                                <ul className="space-y-3 relative z-10">
                                    {userData.lookingFor?.length > 0 ? (
                                        userData.lookingFor.map((item: string, idx: number) => (
                                            <li key={idx} className="text-[#5c4a3d] text-sm flex items-start gap-2"><Check className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0"/>{item}</li>
                                        ))
                                    ) : <li className="text-[#c8b9a6] italic text-sm">未設定</li>}
                                </ul>
                            </div>
                        </div>

                        {/* Skills and Hobbies */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-[#fffdf9] rounded-sm p-6 border border-[#e8dfd1] shadow-md">
                                <h3 className="text-sm font-bold text-[#725b3f] mb-4 tracking-widest font-serif border-b border-[#e8dfd1] pb-2">スキル</h3>
                                <div className="flex flex-wrap gap-2">
                                    {userData.skills?.length > 0 ? userData.skills.map((tag: string, i: number) => (
                                        <span key={i} className="bg-[#f7f5f0] border border-[#e8dfd1] text-[#725b3f] px-3 py-1.5 rounded-sm text-xs font-bold tracking-widest shadow-sm">#{tag}</span>
                                    )) : <span className="text-sm text-[#c8b9a6] italic">未設定</span>}
                                </div>
                            </div>
                            <div className="bg-[#fffdf9] rounded-sm p-6 border border-[#e8dfd1] shadow-md">
                                <h3 className="text-sm font-bold text-[#725b3f] mb-4 tracking-widest font-serif border-b border-[#e8dfd1] pb-2">趣味</h3>
                                <div className="flex flex-wrap gap-2">
                                    {userData.hobbies?.length > 0 ? userData.hobbies.map((tag: string, i: number) => (
                                        <span key={i} className="bg-[#f7f5f0] border border-[#e8dfd1] text-[#725b3f] px-3 py-1.5 rounded-sm text-xs font-bold tracking-widest shadow-sm">#{tag}</span>
                                    )) : <span className="text-sm text-[#c8b9a6] italic">未設定</span>}
                                </div>
                            </div>
                        </div>

                        {/* Career Section */}
                        {userData.career?.length > 0 && (
                            <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-[#e8dfd1] p-6 sm:p-8 relative mt-6">
                                <h2 className="text-lg font-bold text-[#3e2723] mb-6 pb-2 border-b border-[#e8dfd1] font-serif tracking-widest">主な経歴・活動史</h2>
                                <div className="space-y-6 mt-4 relative">
                                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#e8dfd1]"></div>
                                    {userData.career.map((c: any, i: number) => (
                                        <div key={i} className="relative pl-6 pb-2">
                                            <div className="absolute left-[-5px] top-1.5 h-3 w-3 rounded-full bg-[#b8860b] ring-4 ring-[#fffdf9] z-10 shadow-sm border border-[#e8dfd1]"></div>
                                            <h4 className="font-bold text-[#3e2723] text-base font-serif tracking-widest">{c.company || '会社名不明'}</h4>
                                            <div className="flex items-center gap-2 mb-3 mt-1">
                                                <span className="text-[10px] font-bold text-[#725b3f] bg-[#f7f5f0] px-2 py-0.5 rounded-sm tracking-widest border border-[#e8dfd1]">{c.role || '役割'}</span>
                                                <span className="text-xs text-[#8b6a4f] font-medium tracking-widest">{c.start || '?'} 〜 {c.end || '現在'}</span>
                                            </div>
                                            <div className="prose prose-sm max-w-none text-[#5c4a3d] bg-[#fdfaf5] p-4 rounded-sm border border-[#e8dfd1] shadow-sm" dangerouslySetInnerHTML={{ __html: formatText(c.description || '') }}></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Media Section */}
                        {(userVideos.length > 0 || userPodcasts.length > 0) && (
                            <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-[#e8dfd1] p-6 sm:p-8 relative mt-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                                <h2 className="text-lg font-bold text-[#3e2723] mb-6 pb-2 border-b border-[#e8dfd1] font-serif tracking-widest flex justify-between items-center">
                                    <span>メディア・発信録</span>
                                </h2>
                                
                                {userVideos.length > 0 && (
                                    <div className="mb-6">
                                        <h3 className="text-sm font-bold text-[#725b3f] mb-4 tracking-widest border-b border-[#e8dfd1] pb-1">公開動画 ({userVideos.length})</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {userVideos.map((v, i) => (
                                                <a key={i} href={`/media/videos/detail?id=${v.id}`} target="_blank" rel="noreferrer" className="flex gap-3 bg-[#fdfaf5] p-2 border border-[#e8dfd1] rounded-sm hover:-translate-y-0.5 hover:shadow-md transition-all group">
                                                    <div className="w-20 h-14 bg-black rounded-sm overflow-hidden relative flex-shrink-0 border border-[#e8dfd1]">
                                                        <img src={v.thumbnailUrl || 'https://via.placeholder.com/120x80?text=VIDEO'} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform" alt=""/>
                                                    </div>
                                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                        <div className="text-xs font-bold text-[#3e2723] line-clamp-2 leading-tight group-hover:text-[#b8860b] transition-colors">{v.title}</div>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {userPodcasts.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-bold text-[#725b3f] mb-4 tracking-widest border-b border-[#e8dfd1] pb-1">公開ラジオ ({userPodcasts.length})</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {userPodcasts.map((p, i) => (
                                                <a key={i} href={`/media/podcasts/detail?id=${p.id}`} target="_blank" rel="noreferrer" className="flex gap-3 bg-[#fdfaf5] p-3 border border-[#e8dfd1] rounded-sm hover:-translate-y-0.5 hover:shadow-md transition-all group">
                                                    <div className="w-10 h-10 bg-[#1a110f] rounded-sm flex items-center justify-center flex-shrink-0 border border-brand-100 shadow-inner">
                                                        <img src={p.thumbnailUrl || 'https://via.placeholder.com/100x100?text=AUDIO'} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                        <div className="text-xs font-bold text-[#3e2723] line-clamp-2 leading-tight group-hover:text-[#b8860b] transition-colors">{p.title}</div>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PublicProfilePageWrapper() {
    return (
        <Suspense fallback={<div className="text-center py-20 text-[#a09080] font-bold tracking-widest min-h-screen flex items-center justify-center bg-texture">Loading...</div>}>
            <PublicProfileContent />
        </Suspense>
    );
}
