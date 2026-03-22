'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { Anchor, UserX, ShieldHalf, Gavel, Hammer, Home, Feather, MapPin, Globe, Instagram, Twitter, Check, Search, Quote, ArrowLeft } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const THEME_COLORS: Record<string, { bg: string; main: string; sub: string }> = {
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

const DEFAULT_ICON = 'https://via.placeholder.com/150/f7f5f0/c8b9a6?text=U';

function decodeHtml(html: string) {
    if (!html) return '';
    try {
        const textStr = String(html).replace(/__(.*?)__/g, '<u>$1</u>');
        const rawHtml = marked.parse(textStr, { breaks: true, gfm: true }) as string;
        return DOMPurify.sanitize(rawHtml, { 
            ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'u', 'span', 'blockquote', 'code', 'pre'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
        });
    } catch {
        return DOMPurify.sanitize(html.replace(/\n/g, '<br>'));
    }
}

export default function PublicProfilePage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [profile, setProfile] = useState<any>(null);
    const [osData, setOsData] = useState<any>(null);

    useEffect(() => {
        if (!id) return;

        const loadProfile = async () => {
            try {
                const docRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.isHidden) {
                        setErrorMsg("このプロフィールは非公開に設定されています。");
                        return;
                    }

                    // Check OS Cover
                    if (data.profileScore >= 100 && data.osNumber) {
                        const osRef = doc(db, 'artifacts', APP_ID, 'os_blueprints', String(data.osNumber));
                        const osSnap = await getDoc(osRef);
                        if (osSnap.exists()) {
                            setOsData(osSnap.data());
                        } else if (String(data.osNumber) === '50') {
                            setOsData({ jukkan: "癸", kanji: "玄盤", ruby: "GENBAN" });
                        }
                    }

                    setProfile(data);
                } else {
                    setErrorMsg("ユーザーが見つかりません。IDが間違っているか、データが存在しません。");
                }
            } catch (err) {
                console.error(err);
                setErrorMsg("データの取得に失敗しました。");
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [id]);

    const renderRankBadge = (rank: string) => {
        switch (rank) {
            case 'covenant': return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-widest bg-purple-50 text-purple-700 border-purple-200"><ShieldHalf size={12} className="mr-1"/>COVENANT</span>;
            case 'guardian': return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-widest bg-blue-50 text-blue-700 border-blue-200"><Gavel size={12} className="mr-1"/>GUARDIAN</span>;
            case 'builder': return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-widest bg-amber-50 text-amber-700 border-amber-200"><Hammer size={12} className="mr-1"/>BUILDER</span>;
            case 'settler': return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-widest bg-emerald-50 text-emerald-700 border-emerald-200"><Home size={12} className="mr-1"/>SETTLER</span>;
            default: return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-widest bg-brand-50 text-brand-700 border-brand-200"><Anchor size={12} className="mr-1"/>ARRIVAL</span>;
        }
    };

    let locStr = '-';
    if (profile?.prefecture && profile?.birthplace) locStr = `${profile.prefecture} (出身: ${profile.birthplace})`;
    else if (profile?.prefecture) locStr = profile.prefecture;
    else if (profile?.birthplace) locStr = `出身: ${profile.birthplace}`;

    const canOfferArray = Array.isArray(profile?.canOffer) ? profile.canOffer : [];
    const lookingForArray = Array.isArray(profile?.lookingFor) ? profile.lookingFor : [];
    const skillsArray = Array.isArray(profile?.skills) ? profile.skills : [];
    const hobbiesArray = Array.isArray(profile?.hobbies) ? profile.hobbies : [];
    const careerArray = Array.isArray(profile?.career) ? profile.career : [];

    const osTheme = osData ? THEME_COLORS[osData.jukkan] || THEME_COLORS['癸'] : null;

    return (
        <div className="antialiased pb-20 bg-texture min-h-screen">
            <nav className="bg-[#fffdf9] bg-texture border-b border-brand-200 fixed w-full z-50 top-0 h-16 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-full flex justify-between items-center">
                    <button onClick={() => router.back()} className="text-brand-500 hover:text-brand-800 transition-colors flex items-center gap-2 text-sm font-bold tracking-widest">
                        <ArrowLeft size={16} /> <span className="hidden sm:inline">戻る</span>
                    </button>
                    <div className="text-xl font-black text-brand-900 tracking-[0.3em] font-serif flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
                        <span className="bg-brand-900 text-brand-50 w-8 h-8 flex items-center justify-center rounded-sm text-sm"><Anchor size={14} /></span>
                        <span>NOAH</span>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto pt-24 px-0 sm:px-6 lg:px-8">
                {loading ? (
                    <div className="text-center py-20 text-brand-400">
                        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-sm font-bold tracking-widest">プロフィールを読み込み中...</p>
                    </div>
                ) : errorMsg ? (
                    <div className="text-center py-20 bg-[#fffdf9] rounded-sm border border-brand-200 shadow-sm mt-4 mx-4 sm:mx-0">
                        <UserX className="text-4xl w-12 h-12 text-brand-300 mb-4 mx-auto" />
                        <h3 className="text-lg font-bold text-brand-900 mb-2 font-serif">ユーザーが見つかりません</h3>
                        <p className="text-brand-500 text-sm">{errorMsg}</p>
                    </div>
                ) : profile ? (
                    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 lg:py-8 px-4 sm:px-0">
                        <aside className="w-full lg:w-[360px] flex-shrink-0 animate-fade-in-up">
                            <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-brand-200 overflow-hidden relative">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-brand-500 z-10 m-2 pointer-events-none"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-brand-500 z-10 m-2 pointer-events-none"></div>

                                {osData && osTheme ? (
                                    <div className="h-32 sm:h-40 w-full relative flex items-center justify-center overflow-hidden transition-all duration-500 border-b" style={{ borderColor: osTheme.main }}>
                                        <div className="absolute inset-0 z-0" style={{ backgroundColor: osTheme.bg, backgroundImage: `radial-gradient(circle at center, rgba(255,255,255,0.08) 0%, ${osTheme.bg} 100%)` }}></div>
                                        <div className="absolute inset-0 bg-texture opacity-50 pointer-events-none z-0"></div>
                                        <div className="z-10 flex flex-col items-center justify-center pt-2 sm:pt-4">
                                            <div className="text-[10px] sm:text-xs tracking-[0.4em] font-eng font-bold mb-0.5 drop-shadow-md" style={{ color: osTheme.sub }}>{osData.ruby}</div>
                                            <div className="text-3xl sm:text-4xl font-bold tracking-[0.15em] font-serif pl-2 text-white" style={{ textShadow: `0 0 15px ${osTheme.main}` }}>{osData.kanji}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-32 sm:h-40 cover-gradient w-full border-b border-brand-200 relative"></div>
                                )}

                                <div className="px-6 pb-8 relative">
                                    <div className="-mt-12 flex justify-between items-end mb-4">
                                        <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-sm border-[3px] border-[#fffdf9] bg-[#fffdf9] shadow-sm overflow-hidden relative z-20">
                                            <img src={profile.photoURL || DEFAULT_ICON} className="w-full h-full object-cover" alt="Profile" />
                                        </div>
                                    </div>

                                    <div className="mb-6 relative z-20">
                                        <h1 className="text-2xl sm:text-3xl font-bold text-brand-900 leading-tight font-serif mb-1">{profile.name || profile.userId || '名称未設定'}</h1>
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <p className="text-sm text-brand-500 font-medium tracking-wide font-mono">@{profile.userId || '-'}</p>
                                            {renderRankBadge(profile.membershipRank || 'arrival')}
                                        </div>
                                    </div>

                                    <div className="space-y-3 relative z-20 bg-brand-50 p-4 rounded-sm border border-brand-100 shadow-inner">
                                        <div className="flex items-center gap-3 text-sm text-brand-700">
                                            <div className="w-8 h-8 rounded-full bg-[#fffdf9] flex items-center justify-center text-brand-400 border border-brand-200 flex-shrink-0 shadow-sm"><Feather size={14} /></div>
                                            <span className="font-medium">{profile.jobTitle || '職業未設定'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-brand-700">
                                            <div className="w-8 h-8 rounded-full bg-[#fffdf9] flex items-center justify-center text-brand-400 border border-brand-200 flex-shrink-0 shadow-sm"><MapPin size={14} /></div>
                                            <span className="font-medium">{locStr}</span>
                                        </div>
                                        {(profile.websiteUrl || profile.snsInstagram || profile.snsX) && (
                                            <div className="flex gap-3 pt-2">
                                                {profile.websiteUrl && <a href={profile.websiteUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full border border-brand-200 bg-[#fffdf9] flex items-center justify-center text-brand-500 hover:bg-brand-100 transition-colors shadow-sm"><Globe size={14} /></a>}
                                                {profile.snsInstagram && <a href={profile.snsInstagram.startsWith('http') ? profile.snsInstagram : 'https://instagram.com/'+profile.snsInstagram} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full border border-brand-200 bg-[#fffdf9] flex items-center justify-center text-brand-500 hover:bg-brand-100 transition-colors shadow-sm"><Instagram size={14} /></a>}
                                                {profile.snsX && <a href={profile.snsX.startsWith('http') ? profile.snsX : 'https://twitter.com/'+profile.snsX} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full border border-brand-200 bg-[#fffdf9] flex items-center justify-center text-brand-500 hover:bg-brand-100 transition-colors shadow-sm"><Twitter size={14} /></a>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </aside>

                        <div className="flex-1 min-w-0 space-y-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                            {profile.bio && (
                                <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-brand-200 p-6 sm:p-8 relative">
                                    <h2 className="text-lg font-bold text-brand-900 flex items-center gap-2 font-serif tracking-widest mb-4 border-b border-brand-200 pb-2">自己紹介</h2>
                                    <div className="prose prose-sm max-w-none prose-stone text-brand-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: decodeHtml(profile.bio) }}></div>
                                </div>
                            )}

                            {profile.message && (
                                <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-brand-200 p-6 sm:p-8 relative">
                                    <h2 className="text-lg font-bold text-brand-900 flex items-center gap-2 font-serif tracking-widest mb-4 border-b border-brand-200 pb-2">想い・メッセージ</h2>
                                    <div className="relative mt-4">
                                        <Quote className="text-brand-100 w-10 h-10 absolute -top-4 -left-2 z-0 opacity-50" />
                                        <div className="relative z-10 prose prose-sm max-w-none prose-stone text-brand-700 pl-6" dangerouslySetInnerHTML={{ __html: decodeHtml(profile.message) }}></div>
                                    </div>
                                </div>
                            )}

                            {profile.goals && (
                                <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-brand-200 p-6 sm:p-8 relative">
                                    <h2 className="text-lg font-bold text-brand-900 flex items-center gap-2 font-serif tracking-widest mb-4 border-b border-brand-200 pb-2">目標・ビジョン</h2>
                                    <div className="prose prose-sm max-w-none prose-stone text-brand-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: decodeHtml(profile.goals) }}></div>
                                </div>
                            )}

                            {(canOfferArray.length > 0 || lookingForArray.length > 0) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-[#fffdf9] rounded-sm p-6 border border-brand-200 shadow-md relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-[#f7f5f0] rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110 border-b border-l border-brand-100"></div>
                                        <h3 className="text-sm font-bold text-brand-500 mb-4 tracking-widest font-serif relative z-10 border-b border-brand-100 pb-2">提供できること</h3>
                                        <ul className="space-y-3 relative z-10">
                                            {canOfferArray.length > 0 ? canOfferArray.map((item: string, i: number) => (
                                                <li key={i} className="flex items-start text-sm text-brand-700"><Check size={14} className="text-[#8b6a4f] mr-2 mt-0.5 shrink-0" /><span>{item}</span></li>
                                            )) : <li className="text-brand-300 italic text-sm">未設定</li>}
                                        </ul>
                                    </div>
                                    <div className="bg-[#fffdf9] rounded-sm p-6 border border-brand-200 shadow-md relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-[#eae5d8] rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110 border-b border-l border-brand-200"></div>
                                        <h3 className="text-sm font-bold text-brand-500 mb-4 tracking-widest font-serif relative z-10 border-b border-brand-100 pb-2">求めていること</h3>
                                        <ul className="space-y-3 relative z-10">
                                            {lookingForArray.length > 0 ? lookingForArray.map((item: string, i: number) => (
                                                <li key={i} className="flex items-start text-sm text-brand-700"><Search size={14} className="text-[#8b6a4f] mr-2 mt-0.5 shrink-0" /><span>{item}</span></li>
                                            )) : <li className="text-brand-300 italic text-sm">未設定</li>}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {(skillsArray.length > 0 || hobbiesArray.length > 0) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-[#fffdf9] rounded-sm p-6 border border-brand-200 shadow-md">
                                        <h3 className="text-sm font-bold text-brand-500 mb-4 tracking-widest font-serif border-b border-brand-100 pb-2">スキル</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {skillsArray.length > 0 ? skillsArray.map((tag: string, i: number) => (
                                                <span key={i} className="bg-brand-50 border border-brand-200 text-brand-600 px-3 py-1 rounded-sm text-xs font-bold tracking-widest shadow-sm">#{tag}</span>
                                            )) : <span className="text-sm text-brand-300 italic">未設定</span>}
                                        </div>
                                    </div>
                                    <div className="bg-[#fffdf9] rounded-sm p-6 border border-brand-200 shadow-md">
                                        <h3 className="text-sm font-bold text-brand-500 mb-4 tracking-widest font-serif border-b border-brand-100 pb-2">趣味</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {hobbiesArray.length > 0 ? hobbiesArray.map((tag: string, i: number) => (
                                                <span key={i} className="bg-brand-50 border border-brand-200 text-brand-600 px-3 py-1 rounded-sm text-xs font-bold tracking-widest shadow-sm">#{tag}</span>
                                            )) : <span className="text-sm text-brand-300 italic">未設定</span>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {careerArray.length > 0 && (
                                <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-brand-200 p-6 sm:p-8 relative">
                                    <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-brand-300 m-4 pointer-events-none opacity-50"></div>
                                    <h2 className="text-lg font-bold text-brand-900 mb-6 pb-2 border-b border-brand-200 font-serif tracking-widest">経歴</h2>
                                    <div className="space-y-8 mt-4 relative">
                                        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-brand-200"></div>
                                        {careerArray.map((c: any, i: number) => (
                                            <div key={i} className="relative pl-6 pb-2">
                                                <div className="absolute left-[-5px] top-1.5 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-[#fffdf9] z-10 shadow-sm border border-brand-300"></div>
                                                <h4 className="font-bold text-brand-900 text-base font-serif tracking-widest">{c.company || '会社名不明'}</h4>
                                                <div className="flex items-center gap-2 mb-3 mt-1">
                                                    <span className="text-[10px] font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-sm tracking-widest border border-brand-200">{c.role || '役割'}</span>
                                                    <span className="text-xs text-brand-400 font-medium tracking-widest">{c.start || '?'} 〜 {c.end || '現在'}</span>
                                                </div>
                                                <div className="prose prose-sm max-w-none prose-stone text-brand-700 bg-brand-50 p-4 rounded-sm border border-brand-100 shadow-sm" dangerouslySetInnerHTML={{ __html: decodeHtml(c.description || '') }}></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
