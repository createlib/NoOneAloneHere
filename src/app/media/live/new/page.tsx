'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, getDoc, setDoc, getDocs, query, where, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { SatelliteDish, ArrowLeft, Image as ImageIcon, CheckCircle2, AlertTriangle, Crown, Sparkles, Radio, Users, Lock, Globe, Mic, Clock, Disc } from 'lucide-react';

const PRESET_TAGS = ['雑談', 'コラボ', '相談枠', 'ゲーム', '歌枠', '勉強・作業', '弾き語り', '寝落ち'];

export default function LiveStreamSetupPage() {
    return (
        <React.Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="w-12 h-12 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div></div>}>
            <LiveStreamInternalForm />
        </React.Suspense>
    );
}

function LiveStreamInternalForm() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    const [progressText, setProgressText] = useState('');
    
    const [myProfile, setMyProfile] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Form states
    const [title, setTitle] = useState('');
    const [guests, setGuests] = useState('');
    const [description, setDescription] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [customTags, setCustomTags] = useState('');

    const [thumbFile, setThumbFile] = useState<File | null>(null);
    const [thumbPreviewUrl, setThumbPreviewUrl] = useState('');

    const [overrideUserId, setOverrideUserId] = useState('');

    // Live specific
    const [livePrivacy, setLivePrivacy] = useState('public');
    const [liveType, setLiveType] = useState('talk');
    const [liveRecord, setLiveRecord] = useState(false);

    useEffect(() => {
        if (loading) return;
        if (!user || user.isAnonymous) {
            router.push('/login');
            return;
        }

        const init = async () => {
            try {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'));
                if (snap.exists()) {
                    const data = snap.data();
                    setMyProfile(data);
                    if (data.userId === 'admin') setIsAdmin(true);

                    // Check rank for live feature
                    const rank = data.membershipRank || 'arrival';
                    const rankLevels: Record<string, number> = { 'arrival': 0, 'settler': 1, 'builder': 2, 'guardian': 3, 'covenant': 4, 'admin': 99 };
                    const lvl = rankLevels[rank] || 0;
                    
                    if (lvl === 0 && data.userId !== 'admin') {
                        alert("生配信機能はSETTLER以上の会員のみご利用いただけます。");
                        router.push('/upgrade');
                        return;
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };
        init();
    }, [user, loading, router]);


    const handleThumbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert(`画像サイズが大きすぎます (上限5MB)`);
                return;
            }
            setThumbFile(file);
            setThumbPreviewUrl(URL.createObjectURL(file));
        }
    };

    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    const handleStartLive = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user) return;
        if (!title.trim()) return alert('枠のタイトルを入力してください。');

        setIsSaving(true);
        setProgressText('配信準備中...');

        try {
            // Determine Final Author Info
            let finalAuthorId = user.uid;
            let finalAuthorName = myProfile ? (myProfile.name || myProfile.userId) : '配信者';
            let finalAuthorIcon = myProfile ? myProfile.photoURL : null;

            if (isAdmin && overrideUserId.trim()) {
                const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
                const q = query(usersRef, where("userId", "==", overrideUserId.trim()));
                const querySnapshot = await getDocs(q);
                if (querySnapshot.empty) {
                    throw new Error(`エラー: 指定されたユーザーID「@${overrideUserId.trim()}」は見つかりませんでした。`);
                }
                const targetDoc = querySnapshot.docs[0];
                finalAuthorId = targetDoc.id;
                const tData = targetDoc.data();
                finalAuthorName = tData.name || tData.userId;
                finalAuthorIcon = tData.photoURL || null;
            }

            const customTagsArray = customTags.split(',').map(t=>t.trim()).filter(t=>t);
            const tags = Array.from(new Set([...selectedTags, ...customTagsArray]));

            let finalThumbUrl = '';
            if (thumbFile) {
                setProgressText('サムネイル画像をアップロード中...');
                const thumbRef = ref(storage, `live_thumbnails/${finalAuthorId}/${Date.now()}_${thumbFile.name}`);
                const snap = await uploadBytes(thumbRef, thumbFile);
                finalThumbUrl = await getDownloadURL(snap.ref);
            }

            // Clear old room data
            try {
                const oldCommentsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', finalAuthorId, 'comments');
                const oldCommentsSnap = await getDocs(oldCommentsRef);
                await Promise.all(oldCommentsSnap.docs.map(d => deleteDoc(d.ref)));
                
                const oldPartsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', finalAuthorId, 'participants');
                const oldPartsSnap = await getDocs(oldPartsRef);
                await Promise.all(oldPartsSnap.docs.map(d => deleteDoc(d.ref)));
            } catch (e) {
                console.warn("Init old data error:", e);
            }

            const roomData = {
                hostId: finalAuthorId,
                hostName: finalAuthorName,
                hostIcon: finalAuthorIcon,
                title,
                desc: description,
                guestsStr: guests,
                privacy: livePrivacy,
                type: liveType,
                tags,
                isRecord: liveRecord,
                thumbUrl: finalThumbUrl || null,
                status: 'live',
                startedAt: serverTimestamp()
            };

            const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', finalAuthorId);
            await setDoc(roomRef, roomData);

            const partRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', finalAuthorId, 'participants', finalAuthorId);
            await setDoc(partRef, {
                uid: finalAuthorId,
                name: finalAuthorName,
                icon: finalAuthorIcon,
                role: 'host',
                isMuted: false,
                joinedAt: serverTimestamp()
            });

            // Notify followers if public/followers
            if (livePrivacy === 'public' || livePrivacy === 'followers' || livePrivacy === 'community') {
                try {
                    const followersSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', finalAuthorId, 'followers'));
                    const notifyPromises = followersSnap.docs.map(fDoc => {
                        const notifRef = collection(db, 'artifacts', APP_ID, 'users', fDoc.id, 'notifications');
                        return addDoc(notifRef, {
                            type: 'live_start',
                            fromUid: finalAuthorId,
                            contentId: finalAuthorId,
                            createdAt: serverTimestamp(),
                            isRead: false
                        });
                    });
                    await Promise.all(notifyPromises);
                } catch (e) { console.error(e); }
            }

            // Navigate to live room
            router.push(`/media/live_room?roomId=${finalAuthorId}`);

        } catch (e: any) {
            console.error(e);
            alert(`処理中にエラーが発生しました。\n${e.message}`);
            setIsSaving(false);
        }
    };

    return (
        <div className="antialiased min-h-screen bg-[#0a0a0f] text-white pb-24 relative overflow-x-hidden font-sans">
            {/* Ambient Background Effects */}
            <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-600/20 blur-[120px] pointer-events-none"></div>

            <nav className="bg-black/40 backdrop-blur-md border-b border-white/10 fixed w-full z-50 top-0 h-16 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                <div className="max-w-3xl mx-auto px-4 h-full flex justify-between items-center">
                    <button onClick={() => router.back()} className="text-white/70 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold tracking-widest">
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors backdrop-blur-sm">
                            <ArrowLeft size={16} />
                        </div>
                        <span className="hidden sm:inline">キャンセル</span>
                    </button>
                    <h1 className="font-bold text-white tracking-widest flex items-center gap-2 text-base sm:text-lg drop-shadow-md">
                        <SatelliteDish className="text-fuchsia-400 animate-pulse" /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-400">SIGNAL CAST</span>
                    </h1>
                    <div className="w-20"></div>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto pt-24 px-4 sm:px-6 relative z-10">
                
                <div className="mb-8 text-center sm:text-left">
                    <span className="inline-block py-1 px-3 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300 text-[10px] sm:text-xs font-bold tracking-widest mb-3 uppercase backdrop-blur-sm">Live Setup</span>
                    <h2 className="text-2xl sm:text-3xl font-black mb-2 tracking-tight">配信の準備をはじめよう</h2>
                    <p className="text-xs sm:text-sm text-white/50 tracking-wide">
                        タイトルやサムネイルを設定して、リスナーと一緒に最高の時間を。
                    </p>
                </div>

                <form onSubmit={handleStartLive} className="space-y-6">
                    
                    {/* General Settings */}
                    <div className="bg-white/5 backdrop-blur-md p-6 sm:p-8 rounded-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fuchsia-500 to-purple-500 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs sm:text-sm font-bold text-white/90 mb-2 tracking-widest">配信タイトル <span className="text-fuchsia-500">*</span></label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm sm:text-base font-bold text-white placeholder-white/30 focus:bg-black/60 transition-all outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 shadow-inner" placeholder="最高に盛り上がるタイトルをつけよう！" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-white/80 mb-2 tracking-widest flex items-center gap-1.5"><Globe size={14}/> 公開範囲</label>
                                    <select value={livePrivacy} onChange={e => setLivePrivacy(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-sm font-bold text-white focus:border-fuchsia-500 outline-none appearance-none">
                                        <option value="public" className="bg-gray-900">🌍 全体公開</option>
                                        <option value="followers" className="bg-gray-900">👥 フォロワー限定</option>
                                        <option value="invite" className="bg-gray-900">🔒 クローズド(直リンクのみ)</option>
                                        <option value="community" className="bg-gray-900">🏢 コミュニティ限定</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/80 mb-2 tracking-widest flex items-center gap-1.5"><Radio size={14}/> 配信スタイル</label>
                                    <select value={liveType} onChange={e => setLiveType(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3.5 text-sm font-bold text-white focus:border-fuchsia-500 outline-none appearance-none">
                                        <option value="talk" className="bg-gray-900">雑談・トーク</option>
                                        <option value="panel" className="bg-gray-900">ディスカッション</option>
                                        <option value="music" className="bg-gray-900">音楽・作業枠</option>
                                        <option value="interview" className="bg-gray-900">インタビュー</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="block text-xs sm:text-sm font-bold text-white/90 tracking-widest">概要・メモ <span className="text-white/40 text-[10px] font-normal ml-1">(任意)</span></label>
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/60 border border-white/10 tracking-wider">Markdown対応</span>
                                </div>
                                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white placeholder-white/30 focus:bg-black/60 transition-all outline-none focus:border-fuchsia-500 shadow-inner resize-none leading-relaxed" placeholder="今日の配信のテーマや、リスナーへのお知らせ・リンク等"></textarea>
                            </div>
                        </div>
                    </div>

                    {/* Visual & Tags */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Thumbnail */}
                        <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-lg relative overflow-hidden">
                            <label className="block text-xs sm:text-sm font-bold text-white/90 mb-3 tracking-widest flex items-center gap-2">
                                <ImageIcon size={14} className="text-purple-400" />サムネイル画像 <span className="text-white/40 text-[10px] font-normal">(任意)</span>
                            </label>
                            
                            <div className="relative w-full aspect-video bg-black/50 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center text-white/40 hover:bg-white/5 hover:border-purple-500/50 transition-all cursor-pointer overflow-hidden group">
                                <input type="file" accept="image/*" onChange={handleThumbUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                {thumbPreviewUrl ? (
                                    <>
                                        <img src={thumbPreviewUrl} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Thumbnail Preview" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span className="bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold tracking-widest border border-white/20">変更する</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="group-hover:scale-110 transition-transform duration-300 flex flex-col items-center">
                                        <Sparkles className="text-purple-400 mb-2 w-6 h-6 sm:w-8 sm:h-8 opacity-70" />
                                        <span className="text-[10px] sm:text-xs tracking-widest font-bold">画像をアップロード</span>
                                        <span className="text-[9px] mt-1 opacity-60">未設定時はデフォルト背景</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tags & Guests */}
                        <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-lg relative overflow-hidden flex flex-col justify-between">
                            <div>
                                <label className="block text-xs sm:text-sm font-bold text-white/90 mb-3 tracking-widest flex items-center gap-2">
                                    <Users size={14} className="text-purple-400" />ゲストについて <span className="text-white/40 text-[10px] font-normal">(任意)</span>
                                </label>
                                <input type="text" value={guests} onChange={e => setGuests(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/30 focus:border-fuchsia-500 outline-none mb-6" placeholder="例: @Taro, 花子ちゃん" />

                                <label className="block text-xs sm:text-sm font-bold text-white/90 mb-3 tracking-widest flex items-center gap-1.5">🏷 カテゴリータグ</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {PRESET_TAGS.map(tag => (
                                        <label key={tag} className="cursor-pointer">
                                            <input type="checkbox" checked={selectedTags.includes(tag)} onChange={() => toggleTag(tag)} className="hidden" />
                                            <div className={`px-3 py-1.5 border text-[10px] sm:text-xs font-bold rounded-lg tracking-widest transition-all whitespace-nowrap ${selectedTags.includes(tag) ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300 shadow-[0_0_10px_rgba(217,70,239,0.3)]' : 'bg-black/40 border-white/10 text-white/50 hover:bg-white/5'}`}>{tag}</div>
                                        </label>
                                    ))}
                                </div>
                                <input type="text" value={customTags} onChange={e => setCustomTags(e.target.value)} className="w-full bg-black/40 border-b border-white/10 p-2 text-xs sm:text-sm text-white placeholder-white/30 outline-none focus:border-fuchsia-500 transition-colors" placeholder="+ オリジナルタグを追加 (カンマ区切り)" />
                            </div>
                        </div>
                    </div>

                    {/* Archive Feature Area */}
                    <div className="bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-fuchsia-500/20 shadow-lg relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-4">
                            <Disc size={18} className="text-pink-400" />
                            <h3 className="font-bold tracking-widest text-sm text-white/90">アーカイブの保存方法</h3>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <label className={`flex-1 relative cursor-pointer group rounded-xl border p-4 transition-all ${!liveRecord ? 'bg-fuchsia-500/10 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                                <input type="radio" checked={liveRecord === false} onChange={() => setLiveRecord(false)} className="hidden" />
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-sm tracking-widest">録音しない</span>
                                    {!liveRecord && <CheckCircle2 size={16} className="text-fuchsia-400" />}
                                </div>
                                <p className="text-[10px] text-white/50 tracking-wide mt-1">配信終了後、ルームは消滅します。その場限りの熱狂を楽しみたい場合に。</p>
                            </label>

                            <label className={`flex-1 relative cursor-pointer group rounded-xl border p-4 transition-all ${liveRecord ? 'bg-fuchsia-500/10 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                                <input type="radio" checked={liveRecord === true} onChange={() => setLiveRecord(true)} className="hidden" />
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-sm tracking-widest">録音して残す (手動)</span>
                                    {liveRecord && <CheckCircle2 size={16} className="text-fuchsia-400" />}
                                </div>
                                <p className="text-[10px] text-white/50 tracking-wide mt-1">配信後に「ポッドキャスト枠」が作られます。後から自身で録音データをアップロードできます。</p>
                            </label>
                        </div>

                        {liveRecord && (
                            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-[10px] sm:text-xs text-red-200 leading-relaxed flex items-start gap-3 backdrop-blur-sm">
                                <AlertTriangle className="text-red-400 shrink-0 relative top-0.5" size={16} />
                                <div>
                                    <strong className="block text-red-300 mb-1 text-sm tracking-widest">⚠️ 自動録音機能はありません</strong>
                                    <p className="opacity-90">
                                        システム側で通話を録音することはできません。必ずご自身の端末（ボイスレコーダーアプリ等）で別途録音を行ってください。<br/>
                                        配信終了後、「ポッドキャスト枠」から録音データをアップロードしてください。
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {isAdmin && (
                        <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-2xl relative overflow-hidden backdrop-blur-sm">
                            <h3 className="text-xs font-bold text-rose-400 mb-2 tracking-widest flex items-center gap-2"><Crown size={14} />管理者用 : 代理配信</h3>
                            <p className="text-[10px] text-rose-300/70 mb-3">他のユーザーのライブ枠として立ち上げる場合、そのユーザーのID(@以降)を入力。</p>
                            <input type="text" value={overrideUserId} onChange={e => setOverrideUserId(e.target.value)} className="w-full bg-black/50 border border-rose-500/30 rounded-lg p-3 text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all placeholder-rose-500/30" placeholder="例: taro_123" />
                        </div>
                    )}

                    <div className="pt-8 pb-12 sticky bottom-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f] to-transparent z-20">
                        <button type="submit" disabled={isSaving} className="w-full py-4 sm:py-5 rounded-2xl font-bold text-base sm:text-lg tracking-widest shadow-[0_0_30px_rgba(217,70,239,0.3)] transition-all flex items-center justify-center gap-3 relative overflow-hidden group bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white border border-fuchsia-400/50 hover:from-purple-500 hover:to-fuchsia-500 transform hover:-translate-y-1">
                            {isSaving ? (
                                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> 準備中...</>
                            ) : (
                                <>
                                    <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                                    <SatelliteDish className="animate-pulse w-5 h-5 sm:w-6 sm:h-6" /> LIVE を開始する
                                </>
                            )}
                        </button>
                        <p className="text-center text-[10px] text-white/30 tracking-widest mt-4">ルームに入室すると配信がスタートします。</p>
                    </div>

                </form>
            </main>
        </div>
    );
}
