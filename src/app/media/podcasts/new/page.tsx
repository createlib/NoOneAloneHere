'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, doc, getDoc, setDoc, getDocs, query, where, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Podcast, ArrowLeft, CloudUpload, Image as ImageIcon, Music, SatelliteDish, Crown, CheckCircle2, AlertTriangle, Link as LinkIcon, Edit, Lock, Globe, Users, Shield, Radio, Mic, Video, Copy } from 'lucide-react';
import VisibilityPicker, { VisibilityMode } from '@/components/VisibilityPicker';

const PRESET_TAGS = ['対談・インタビュー', 'ひとり語り', 'ノウハウ共有', '活動報告', 'ビジネス', '恋愛'];

export default function PodcastPostPage() {
    return (
        <React.Suspense fallback={<div className="min-h-screen bg-texture flex items-center justify-center"><div className="w-10 h-10 border-4 border-[#b8860b] border-t-transparent rounded-full animate-spin"></div></div>}>
            <PodcastPostInternalForm />
        </React.Suspense>
    );
}

function PodcastPostInternalForm() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const editPid = searchParams.get('pid');

    const [isSaving, setIsSaving] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    
    const [myProfile, setMyProfile] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Form states
    const [audioType, setAudioType] = useState<'upload' | 'url'>('upload');
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [audioUrlInput, setAudioUrlInput] = useState('');
    const [duration, setDuration] = useState(0);
    const [parsedAudioUrl, setParsedAudioUrl] = useState('');
    const [isEmbedMode, setIsEmbedMode] = useState(false);

    const [thumbFile, setThumbFile] = useState<File | null>(null);
    const [thumbPreviewUrl, setThumbPreviewUrl] = useState('');

    const [title, setTitle] = useState('');
    const [guests, setGuests] = useState('');
    const [description, setDescription] = useState('');
    const [relatedArticleUrls, setRelatedArticleUrls] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [customTags, setCustomTags] = useState('');
    const [allowComments, setAllowComments] = useState(true);
    const [visibility, setVisibility] = useState<VisibilityMode>('public');
    const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
    const [allowedListIds, setAllowedListIds] = useState<string[]>([]);

    const [overrideUserId, setOverrideUserId] = useState('');

    
    const audioRef = useRef<HTMLAudioElement>(null);

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
                        alert("音声の配信はSETTLER以上の会員のみ可能です。");
                        router.push('/settings'); // Or upgrade page
                        return;
                    }
                }
                
                if (editPid) {
                    const podSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', editPid));
                    if (podSnap.exists()) {
                        const pData = podSnap.data();
                        if (pData.authorId !== user.uid && myProfile?.userId !== 'admin') {
                            alert('編集権限がありません');
                            router.push('/media/podcasts');
                            return;
                        }
                        setTitle(pData.title || '');
                        setDescription(pData.description || '');
                        setGuests(pData.guests ? pData.guests.join(', ') : '');
                        
                        let urls = '';
                        if (pData.relatedArticleUrls && Array.isArray(pData.relatedArticleUrls)) {
                            urls = pData.relatedArticleUrls.join(', ');
                        } else if (pData.relatedArticleUrl) {
                            urls = pData.relatedArticleUrl;
                        }
                        setRelatedArticleUrls(urls);
                        
                        setDuration(pData.duration || 0);
                        
                        if (pData.sourceType === 'url') {
                            setAudioType('url');
                            setAudioUrlInput(pData.audioUrl || '');
                            handleAudioUrlParse(pData.audioUrl || '');
                        } else {
                            setAudioType('upload');
                            setParsedAudioUrl(pData.audioUrl || '');
                            setIsEmbedMode(false);
                        }
                        
                        if (pData.thumbnailUrl) {
                            setThumbPreviewUrl(pData.thumbnailUrl);
                        }

                        if (pData.allowComments === false) setAllowComments(false);
                        setVisibility(pData.visibility || 'public');
                        setAllowedUserIds(pData.allowedUserIds || []);
                        setAllowedListIds(pData.allowedListIds || []);

                        const allTags = pData.tags || [];
                        const preset = allTags.filter((t: string) => PRESET_TAGS.includes(t));
                        const custom = allTags.filter((t: string) => !PRESET_TAGS.includes(t));
                        setSelectedTags(preset);
                        setCustomTags(custom.join(', '));
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };
        init();
    }, [user, loading, editPid, router]);

    const handleAudioUrlParse = (url: string) => {
        let embedUrl = null;
        let isEmbed = false;

        if (!url) {
            setParsedAudioUrl('');
            setIsEmbedMode(false);
            return;
        }

        if (url.includes('open.spotify.com/episode/')) {
            const match = url.match(/episode\/([a-zA-Z0-9]+)/);
            if (match) { embedUrl = `https://open.spotify.com/embed/episode/${match[1]}?utm_source=generator`; isEmbed = true; }
        } else if (url.includes('open.spotify.com/show/')) {
            const match = url.match(/show\/([a-zA-Z0-9]+)/);
            if (match) { embedUrl = `https://open.spotify.com/embed/show/${match[1]}?utm_source=generator`; isEmbed = true; }
        } else if (url.includes('podcasts.apple.com')) {
            embedUrl = url.replace('podcasts.apple.com', 'embed.podcasts.apple.com');
            isEmbed = true;
        } else if (url.includes('drive.google.com/file/d/')) {
            const match = url.match(/d\/([a-zA-Z0-9_-]+)/);
            if (match) { embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`; isEmbed = true; }
        }

        setParsedAudioUrl(isEmbed ? (embedUrl || '') : url);
        setIsEmbedMode(isEmbed);
        setDuration(0);
    };

    const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAudioFile(file);
            const url = URL.createObjectURL(file);
            setParsedAudioUrl(url);
            setIsEmbedMode(false);
            if (audioRef.current) {
                audioRef.current.src = url;
            }
        }
    };

    const handleAudioLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleThumbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user) return;
        if (!title.trim()) return alert('タイトルを入力してください。');

        let finalAudioUrl = '';
        let finalThumbUrl = '';

        if (!editPid) {
            if (audioType === 'upload' && !audioFile) return alert('音声ファイルを選択してください');
            if (audioType === 'url' && !audioUrlInput.trim()) return alert('音声のURLを入力してください');
        }

        if (audioType === 'upload' && audioFile && audioFile.size > 30 * 1024 * 1024) {
             return alert(`音声ファイルが大きすぎます (上限30MB)`);
        }
        if (thumbFile && thumbFile.size > 5 * 1024 * 1024) {
             return alert(`画像サイズが大きすぎます (上限5MB)`);
        }

        setIsSaving(true);
        setProgress(5);
        setProgressText('アップロードの準備中...');

        try {
            // Determine Final Author Info
            let finalAuthorId = user.uid;
            let finalAuthorName = myProfile ? (myProfile.name || myProfile.userId) : '名無し';
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
            const guestsArray = guests ? guests.split(',').map(s=>s.trim()).filter(s=>s) : [];
            const relatedUrlsArray = relatedArticleUrls ? relatedArticleUrls.split(',').map(s=>s.trim()).filter(s=>s) : [];

            // Thumb upload helper
            const uploadThumb = async () => {
                if (!thumbFile) return;
                setProgressText('画像をアップロード中...');
                const thumbRef = ref(storage, `podcasts/thumbnails/${user.uid}/${Date.now()}_${thumbFile.name}`);
                const snap = await uploadBytes(thumbRef, thumbFile);
                finalThumbUrl = await getDownloadURL(snap.ref);
            };

            // ---- PODCAST ----
            if (audioType === 'upload' && audioFile) {
                const storageRef = ref(storage, `podcasts/audio/${user.uid}/${Date.now()}_${audioFile.name}`);
                const uploadTask = uploadBytesResumable(storageRef, audioFile);
                
                await new Promise<void>((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        (snapshot) => {
                            const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 75; 
                            setProgress(5 + p);
                            setProgressText(`音声をアップロード中... (${Math.floor(5 + p)}%)`);
                        }, 
                        (error) => reject(error), 
                        async () => {
                            try {
                                finalAudioUrl = await getDownloadURL(uploadTask.snapshot.ref);
                                resolve();
                            } catch(err) {
                                reject(err);
                            }
                        }
                    );
                });
            } else if (audioType === 'url') {
                finalAudioUrl = parsedAudioUrl; // we parsed it during input change
            }

            await uploadThumb();

            let finalIsEmbedMode = isEmbedMode;
            if (editPid) {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', editPid));
                if (snap.exists()) {
                    const oldData = snap.data();
                    if (!finalAudioUrl) {
                        finalAudioUrl = oldData.audioUrl;
                        finalIsEmbedMode = oldData.isEmbed || false;
                    }
                    if (!finalThumbUrl) finalThumbUrl = oldData.thumbnailUrl;
                }
            }

            setProgress(100);
            setProgressText('データを保存しています...');

            // カスタム公開: リストメンバー + 個別指定を展開
            let resolvedAllowedUserIds: string[] = [];
            if (visibility === 'custom') {
                const uidSet = new Set(allowedUserIds);
                for (const lid of allowedListIds) {
                    try {
                        const lSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'audience_lists', lid));
                        if (lSnap.exists()) (lSnap.data().memberIds || []).forEach((uid: string) => uidSet.add(uid));
                    } catch {}
                }
                uidSet.delete(user.uid);
                resolvedAllowedUserIds = Array.from(uidSet);
            }

            const docId = editPid || Date.now().toString();
            const payload = {
                authorId: finalAuthorId,
                authorName: finalAuthorName,
                authorIcon: finalAuthorIcon,
                sourceType: audioType,
                audioUrl: finalAudioUrl || '',
                isEmbed: finalIsEmbedMode,
                thumbnailUrl: finalThumbUrl || null,
                title,
                description,
                relatedArticleUrls: relatedUrlsArray,
                guests: guestsArray,
                tags,
                allowComments,
                visibility,
                allowedUserIds: visibility === 'custom' ? resolvedAllowedUserIds : [],
                allowedListIds: visibility === 'custom' ? allowedListIds : [],
                duration,
                updatedAt: new Date().toISOString(),
                createdAt: editPid ? undefined : new Date().toISOString()
            };

            // Remove undefined createdAt for edit
            if (!payload.createdAt) delete payload.createdAt;

            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', docId), payload, { merge: true });
            
            if (!editPid) {
                try {
                    let notifyUids: string[] = [];
                    if (visibility === 'public' || visibility === 'followers') {
                        const fSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', finalAuthorId, 'followers'));
                        notifyUids = fSnap.docs.map(f => f.id);
                    } else if (visibility === 'mutual') {
                        const fSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', finalAuthorId, 'followers'));
                        const followingSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', finalAuthorId, 'following'));
                        const followingIds = new Set(followingSnap.docs.map(d => d.id));
                        notifyUids = fSnap.docs.filter(f => followingIds.has(f.id)).map(f => f.id);
                    } else if (visibility === 'custom') {
                        notifyUids = resolvedAllowedUserIds;
                    }
                    await Promise.all(notifyUids.map(uid =>
                        addDoc(collection(db, 'artifacts', APP_ID, 'users', uid, 'notifications'), {
                            type: 'new_podcast',
                            fromUid: finalAuthorId,
                            contentId: docId,
                            createdAt: serverTimestamp(),
                            isRead: false
                        })
                    ));
                } catch (e) {}
            }

            router.replace(`/media/podcasts/detail?id=${docId}`);

        } catch (e: any) {
            console.error(e);
            alert(`処理中にエラーが発生しました。\n${e.message}`);
            setIsSaving(false);
        }
    };

    const rankLevel = myProfile ? ({ 'arrival': 0, 'settler': 1, 'builder': 2, 'guardian': 3, 'covenant': 4, 'admin': 99 }[myProfile.membershipRank as string] || 0) : 0;

    return (
        <div className="antialiased min-h-screen pb-28" style={{ background: 'linear-gradient(135deg, #f0ede8 0%, #e8e4df 100%)' }}>
            {/* Header */}
            <nav className="fixed w-full z-50 top-0 h-14"
                 style={{ background: 'rgba(240,237,232,0.88)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 2px 20px rgba(120,110,100,0.08)' }}>
                <div className="max-w-3xl mx-auto px-4 h-full flex items-center justify-between">
                    <button onClick={() => router.back()}
                            className="flex items-center gap-2 text-sm font-bold tracking-widest"
                            style={{ color: '#6b6560' }}>
                        <span className="w-8 h-8 rounded-full flex items-center justify-center"
                              style={{ background: '#eae8e4', boxShadow: '3px 3px 8px #cbc8c3, -3px -3px 8px #ffffff' }}>
                            <ArrowLeft size={15} />
                        </span>
                        <span className="hidden sm:inline">キャンセル</span>
                    </button>
                    <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl flex items-center justify-center"
                              style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 4px 12px rgba(124,58,237,0.35)' }}>
                            <Podcast size={15} color="white" />
                        </span>
                        <h1 className="font-bold tracking-widest text-base" style={{ color: '#2a2520' }}>
                            音声の配信・編集
                        </h1>
                    </div>
                    <div className="w-20" />
                </div>
            </nav>

            <main className="max-w-3xl mx-auto pt-24 px-4 sm:px-6">
                <div className="mb-8 text-center">
                    <p className="text-sm tracking-widest leading-relaxed" style={{ color: '#6b6560' }}>
                        あなたの声で、深い考えや対話を届けましょう。
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#9c9590' }}>
                        ※ 音声ファイルのアップロード・各種サービスURL指定が可能です
                    </p>
                </div>

                <form onSubmit={handleSave} className="space-y-6">

                    {/* Section: 音声データ */}
                    <section className="rounded-2xl p-6 sm:p-8"
                             style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '10px 10px 30px #c2bfba, -10px -10px 30px #ffffff' }}>
                        <div className="flex items-center gap-2.5 mb-5">
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 3px 10px rgba(124,58,237,0.3)' }}>
                                <Music size={13} color="white" />
                            </span>
                            <span className="text-sm font-bold tracking-widest" style={{ color: '#2a2520' }}>
                                音声データ・配信方法 <span className="text-red-500">*</span>
                            </span>
                        </div>

                        {/* Tab switcher */}
                        <div className="flex gap-1 mb-5 p-1 rounded-xl overflow-x-auto"
                             style={{ background: '#eae8e4', boxShadow: 'inset 3px 3px 8px #cbc8c3, inset -3px -3px 8px #ffffff' }}>
                            {(['upload', 'url'] as const).map(t => (
                                <button key={t} type="button" onClick={() => setAudioType(t)}
                                        className="flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-all whitespace-nowrap min-w-max px-3"
                                        style={audioType === t
                                            ? { background: 'rgba(255,255,255,0.9)', boxShadow: '3px 3px 8px #cbc8c3, -3px -3px 8px #ffffff', color: '#2a2520' }
                                            : { color: '#9c9590' }}>
                                    {t === 'upload' ? 'ファイルをアップロード' : 'URLを指定'}
                                </button>
                            ))}
                        </div>

                        {audioType === 'upload' && (
                            <div>
                                <p className="text-xs mb-3" style={{ color: '#9c9590' }}>MP3形式などの音声ファイルを選択してください（上限: 30MB）</p>
                                <input type="file" accept="audio/mp3, audio/mpeg, audio/mp4, audio/m4a" onChange={handleAudioUpload}
                                       className="block w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:cursor-pointer transition-colors rounded-xl p-2"
                                       style={{ background: '#eae8e4', color: '#6b6560' }} />
                            </div>
                        )}

                        {audioType === 'url' && (
                            <div>
                                <p className="text-xs mb-3 leading-relaxed" style={{ color: '#9c9590' }}>
                                    <b style={{ color: '#6b6560' }}>Spotify</b>, <b style={{ color: '#6b6560' }}>Apple Podcasts</b>, <b style={{ color: '#6b6560' }}>Google Drive</b> のURLを貼り付けてください
                                </p>
                                <input type="url" value={audioUrlInput}
                                       onChange={e => { setAudioUrlInput(e.target.value); handleAudioUrlParse(e.target.value); }}
                                       className="w-full rounded-xl p-4 text-sm outline-none transition-all"
                                       style={{ background: '#eae8e4', boxShadow: 'inset 3px 3px 8px #cbc8c3, inset -3px -3px 8px #ffffff', border: 'none', color: '#2a2520' }}
                                       placeholder="https://open.spotify.com/episode/..." />
                            </div>
                        )}

                        {parsedAudioUrl && (
                            <div className="mt-5 rounded-xl overflow-hidden"
                                 style={{ boxShadow: '3px 3px 10px #cbc8c3, -3px -3px 10px #ffffff' }}>
                                <div className="flex items-center justify-between px-4 py-2"
                                     style={{ background: 'rgba(234,232,228,0.8)' }}>
                                    <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#9c9590' }}>Preview</span>
                                    <CheckCircle2 size={13} className="text-green-500" />
                                </div>
                                {!isEmbedMode ? (
                                    <audio ref={audioRef} controls src={parsedAudioUrl} onLoadedMetadata={handleAudioLoadedMetadata}
                                           className="w-full h-12 bg-white" />
                                ) : (
                                    <iframe src={parsedAudioUrl} className="w-full bg-white min-h-[160px]" frameBorder="0"
                                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />
                                )}
                            </div>
                        )}
                    </section>

                    {/* Section: サムネイル */}
                    <section className="rounded-2xl p-6 sm:p-8"
                             style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '10px 10px 30px #c2bfba, -10px -10px 30px #ffffff' }}>
                        <div className="flex items-center gap-2.5 mb-2">
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 3px 10px rgba(124,58,237,0.3)' }}>
                                <ImageIcon size={13} color="white" />
                            </span>
                            <span className="text-sm font-bold tracking-widest" style={{ color: '#2a2520' }}>
                                サムネイル画像 <span className="text-xs font-normal ml-1" style={{ color: '#9c9590' }}>(任意)</span>
                            </span>
                        </div>
                        <p className="text-xs mb-5" style={{ color: '#9c9590' }}>
                            設定しない場合は NOAH CAST のデフォルト背景が適用されます。<br />Spotify等の埋め込みリンクを使用する場合は設定不要です。
                        </p>
                        <label className="relative flex w-full sm:w-64 aspect-square rounded-xl cursor-pointer overflow-hidden group transition-all"
                               style={{ background: '#eae8e4', boxShadow: 'inset 3px 3px 8px #cbc8c3, inset -3px -3px 8px #ffffff' }}>
                            <input type="file" accept="image/*" onChange={handleThumbUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                            {thumbPreviewUrl ? (
                                <img src={thumbPreviewUrl} className="absolute inset-0 w-full h-full object-contain" alt="" />
                            ) : (
                                <div className="flex flex-col items-center justify-center w-full gap-2 group-hover:scale-105 transition-transform">
                                    <ImageIcon size={28} style={{ color: '#9c9590' }} />
                                    <span className="text-xs font-bold tracking-widest" style={{ color: '#9c9590' }}>クリックして画像を選択</span>
                                    <span className="text-[10px]" style={{ color: '#9c9590' }}>推奨: 正方形</span>
                                </div>
                            )}
                        </label>
                    </section>

                    {/* Section: エピソード情報 */}
                    <section className="rounded-2xl p-6 sm:p-8 space-y-6"
                             style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '10px 10px 30px #c2bfba, -10px -10px 30px #ffffff' }}>
                        <div>
                            <label className="block text-sm font-bold mb-3 tracking-widest" style={{ color: '#2a2520' }}>
                                配信タイトル <span className="text-red-500">*</span>
                            </label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                                   className="w-full rounded-xl p-4 text-sm font-bold outline-none"
                                   style={{ background: '#eae8e4', boxShadow: 'inset 3px 3px 8px #cbc8c3, inset -3px -3px 8px #ffffff', border: 'none', color: '#2a2520' }}
                                   placeholder="エピソードのタイトルを入力" />
                        </div>

                        <div>
                            <label className="block text-sm font-bold mb-3 tracking-widest" style={{ color: '#2a2520' }}>
                                ゲスト <span className="text-xs font-normal ml-1" style={{ color: '#9c9590' }}>(任意)</span>
                            </label>
                            <input type="text" value={guests} onChange={e => setGuests(e.target.value)}
                                   className="w-full rounded-xl p-4 text-sm outline-none"
                                   style={{ background: '#eae8e4', boxShadow: 'inset 3px 3px 8px #cbc8c3, inset -3px -3px 8px #ffffff', border: 'none', color: '#2a2520' }}
                                   placeholder="ゲスト名（複数の場合はカンマ区切り）" />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-sm font-bold tracking-widest" style={{ color: '#2a2520' }}>概要欄・エピソードメモ</label>
                                <span className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-lg"
                                      style={{ background: '#eae8e4', color: '#9c9590', boxShadow: '2px 2px 5px #cbc8c3, -2px -2px 5px #ffffff' }}>
                                    Markdown 対応
                                </span>
                            </div>
                            <p className="text-xs mb-3" style={{ color: '#9c9590' }}>このエピソードで話している内容や、関連リンクなどを記述してください。</p>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={6}
                                      className="w-full rounded-xl p-4 text-sm leading-relaxed outline-none resize-none"
                                      style={{ background: '#eae8e4', boxShadow: 'inset 3px 3px 8px #cbc8c3, inset -3px -3px 8px #ffffff', border: 'none', color: '#2a2520' }}
                                      placeholder={"・オープニング\n・今回のテーマについて\n・ゲストからのお知らせ"} />
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <LinkIcon size={13} style={{ color: '#9c9590' }} />
                                <label className="text-sm font-bold tracking-widest" style={{ color: '#2a2520' }}>
                                    関連記事 <span className="text-xs font-normal ml-1" style={{ color: '#9c9590' }}>(任意)</span>
                                </label>
                            </div>
                            <p className="text-xs mb-3" style={{ color: '#9c9590' }}>noteの記事URL等を貼り付けます。複数ある場合はカンマ区切りで。</p>
                            <input type="text" value={relatedArticleUrls} onChange={e => setRelatedArticleUrls(e.target.value)}
                                   className="w-full rounded-xl p-4 text-sm outline-none"
                                   style={{ background: '#eae8e4', boxShadow: 'inset 3px 3px 8px #cbc8c3, inset -3px -3px 8px #ffffff', border: 'none', color: '#2a2520' }}
                                   placeholder="https://note.com/..., https://..." />
                        </div>
                    </section>

                    {/* Section: タグ・設定 */}
                    <section className="rounded-2xl p-6 sm:p-8 space-y-7"
                             style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '10px 10px 30px #c2bfba, -10px -10px 30px #ffffff' }}>
                        {/* Tags */}
                        <div>
                            <label className="block text-sm font-bold mb-4 tracking-widest" style={{ color: '#2a2520' }}>カテゴリー・タグ</label>
                            <p className="text-xs mb-4" style={{ color: '#9c9590' }}>配信内容に合うものを選択してください。</p>
                            <div className="flex flex-wrap gap-2.5 mb-4">
                                {PRESET_TAGS.map(tag => (
                                    <label key={tag} className="cursor-pointer">
                                        <input type="checkbox" checked={selectedTags.includes(tag)} onChange={() => toggleTag(tag)} className="hidden" />
                                        <div className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest transition-all whitespace-nowrap"
                                             style={selectedTags.includes(tag)
                                                 ? { background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.35)' }
                                                 : { background: '#eae8e4', color: '#6b6560', boxShadow: '3px 3px 8px #cbc8c3, -3px -3px 8px #ffffff' }}>
                                            {tag}
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <input type="text" value={customTags} onChange={e => setCustomTags(e.target.value)}
                                   className="w-full rounded-xl p-3.5 text-sm outline-none"
                                   style={{ background: '#eae8e4', boxShadow: 'inset 3px 3px 8px #cbc8c3, inset -3px -3px 8px #ffffff', border: 'none', color: '#2a2520' }}
                                   placeholder="その他のタグ（カンマ区切りで入力）" />
                        </div>

                        {/* Comments */}
                        <div className="pt-5" style={{ borderTop: '1px solid rgba(203,200,195,0.5)' }}>
                            <label className="block text-sm font-bold mb-4 tracking-widest" style={{ color: '#2a2520' }}>コメント設定</label>
                            <div className="flex gap-3">
                                {[{ v: true, label: '許可する' }, { v: false, label: '許可しない' }].map(opt => (
                                    <label key={String(opt.v)} className="flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl text-sm font-bold tracking-widest transition-all"
                                           style={allowComments === opt.v
                                               ? { background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.35)' }
                                               : { background: '#eae8e4', color: '#6b6560', boxShadow: '3px 3px 8px #cbc8c3, -3px -3px 8px #ffffff' }}>
                                        <input type="radio" checked={allowComments === opt.v} onChange={() => setAllowComments(opt.v)} className="hidden" />
                                        {opt.label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Visibility */}
                        <div className="pt-5" style={{ borderTop: '1px solid rgba(203,200,195,0.5)' }}>
                            <div className="flex items-center gap-2.5 mb-4">
                                <Globe size={14} style={{ color: '#9c9590' }} />
                                <span className="text-sm font-bold tracking-widest" style={{ color: '#2a2520' }}>公開設定</span>
                            </div>
                            <VisibilityPicker
                                currentUid={user?.uid || ''}
                                visibility={visibility}
                                onVisibilityChange={setVisibility}
                                selectedListIds={allowedListIds}
                                onSelectedListIdsChange={setAllowedListIds}
                                selectedUserIds={allowedUserIds}
                                onSelectedUserIdsChange={setAllowedUserIds}
                            />
                        </div>
                    </section>

                    {/* Admin */}
                    {isAdmin && (
                        <section className="rounded-2xl p-6 relative overflow-hidden"
                                 style={{ background: 'rgba(254,242,242,0.7)', border: '1px solid rgba(252,165,165,0.4)', boxShadow: '10px 10px 30px #c2bfba, -10px -10px 30px #ffffff' }}>
                            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                                 style={{ background: 'linear-gradient(180deg, #ef4444, #c0392b)' }} />
                            <div className="flex items-center gap-2 mb-1">
                                <Crown size={14} className="text-red-500" />
                                <h3 className="text-sm font-bold tracking-widest text-red-600">【管理者機能】 代理投稿</h3>
                            </div>
                            <p className="text-xs mb-3" style={{ color: '#6b6560' }}>他ユーザーとして投稿する場合、ユーザーID（@以降）を入力してください。</p>
                            <input type="text" value={overrideUserId} onChange={e => setOverrideUserId(e.target.value)}
                                   className="w-full rounded-xl p-4 text-sm outline-none"
                                   style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(252,165,165,0.5)', color: '#2a2520' }}
                                   placeholder="例: taro_123" />
                        </section>
                    )}

                    {/* Submit */}
                    <div className="pb-8 pt-2">
                        <button type="submit" disabled={isSaving}
                                className="w-full py-4 font-bold text-base rounded-2xl transition-all tracking-widest flex items-center justify-center gap-3 disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)', color: '#fff', boxShadow: '0 8px 30px rgba(124,58,237,0.4), 6px 6px 18px #cbc8c3, -6px -6px 18px #ffffff' }}>
                            {editPid ? (
                                <><CloudUpload size={20} /> 編集を保存する</>
                            ) : (
                                <><Podcast size={20} /> 音声を配信する</>
                            )}
                        </button>
                    </div>
                </form>
            </main>

            {/* Upload overlay */}
            {isSaving && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center px-4"
                     style={{ background: 'rgba(42,37,32,0.6)', backdropFilter: 'blur(16px)' }}>
                    <div className="text-center max-w-sm w-full p-8 rounded-3xl"
                         style={{ background: 'rgba(240,237,232,0.97)', boxShadow: '0 24px 60px rgba(42,37,32,0.25)', border: '1px solid rgba(255,255,255,0.7)' }}>
                        <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center animate-bounce"
                             style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}>
                            <CloudUpload size={28} color="white" />
                        </div>
                        <h3 className="text-base font-bold tracking-widest mb-2" style={{ color: '#2a2520' }}>アップロード中...</h3>
                        <p className="text-xs mb-5 tracking-widest" style={{ color: '#9c9590' }}>{progressText}</p>
                        <div className="w-full rounded-full h-2 overflow-hidden"
                             style={{ background: 'rgba(203,200,195,0.5)', boxShadow: 'inset 2px 2px 5px #cbc8c3' }}>
                            <div className="h-2 rounded-full transition-all duration-300"
                                 style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7c3aed, #a855f7)' }} />
                        </div>
                        <p className="text-xs mt-2 font-bold" style={{ color: '#7c3aed' }}>{progress}%</p>
                    </div>
                </div>
            )}
        </div>
    );
}