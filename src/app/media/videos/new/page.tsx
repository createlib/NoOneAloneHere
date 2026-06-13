'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { ArrowLeft, Film, Video, Image as ImageIcon, Tags, MessageSquare, Crown, CloudUpload, Globe } from 'lucide-react';
import VisibilityPicker, { VisibilityMode } from '@/components/VisibilityPicker';

function VideoPostContent() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const editVid = searchParams.get('vid');

    const [isAdmin, setIsAdmin] = useState(false);
    const [myData, setMyData] = useState<any>(null);

    const [videoInputType, setVideoInputType] = useState<'url' | 'upload'>('url');
    const [videoUrl, setVideoUrl] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
    const [isEmbedMode, setIsEmbedMode] = useState(false);

    const [thumbFile, setThumbFile] = useState<File | null>(null);
    const [thumbPreviewUrl, setThumbPreviewUrl] = useState('');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [customTags, setCustomTags] = useState('');

    const [allowComments, setAllowComments] = useState(true);
    const [visibility, setVisibility] = useState<VisibilityMode>('public');
    const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
    const [allowedListIds, setAllowedListIds] = useState<string[]>([]);
    const [overrideUserId, setOverrideUserId] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [progressText, setProgressText] = useState('');

    const presetTags = [
        { label: 'ピッチ・資金調達', value: 'ピッチ・資金調達' },
        { label: 'パートナー募集', value: 'ビジネスパートナー募集' },
        { label: 'PR・宣伝', value: 'PR・宣伝' },
        { label: '活動記録', value: '活動記録' },
        { label: 'ノウハウ共有', value: 'ノウハウ共有' }
    ];

    useEffect(() => {
        if (loading) return;

        if (user && !user.isAnonymous) {
            getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'))
                .then(snap => {
                    if (snap.exists()) {
                        const data = snap.data();
                        setMyData(data);
                        if (data.userId === 'admin') setIsAdmin(true);
                        
                        const rank = data.membershipRank || 'arrival';
                        if (rank === 'arrival' && data.userId !== 'admin') {
                            alert("動画の投稿はSETTLER以上の会員のみ可能です。");
                            router.push('/');
                        }
                    }
                });

            if (editVid) loadEditData();
        } else {
            router.push('/login');
        }
    }, [user, loading, editVid, router]);

    const loadEditData = async () => {
        if (!user || !editVid) return;
        try {
            const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', editVid));
            if (snap.exists()) {
                const data = snap.data();
                if (data.authorId !== user.uid && !isAdmin) {
                    alert("編集権限がありません");
                    router.push('/media/videos');
                    return;
                }

                setTitle(data.title || '');
                setDescription(data.description || '');

                if (data.sourceType === 'url' || data.embedUrl) {
                    setVideoInputType('url');
                    setVideoUrl(data.sourceUrl || data.embedUrl || '');
                    handleUrlPreview(data.sourceUrl || data.embedUrl || '');
                } else {
                    setVideoInputType('upload');
                    setVideoPreviewUrl(data.sourceUrl || '');
                    setIsEmbedMode(false);
                }

                if (data.thumbnailUrl) {
                    setThumbPreviewUrl(data.thumbnailUrl);
                }

                setAllowComments(data.allowComments !== false);
                setVisibility(data.visibility || 'public');
                setAllowedUserIds(data.allowedUserIds || []);
                setAllowedListIds(data.allowedListIds || []);

                const tags = data.tags || [];
                const presetValues = presetTags.map(p => p.value);
                setSelectedTags(tags.filter((t: string) => presetValues.includes(t)));
                setCustomTags(tags.filter((t: string) => !presetValues.includes(t)).join(', '));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const parseVideoUrl = (url: string) => {
        let embedUrl = null;
        let isEmbed = false;
        let tUrl = null;

        if (!url) return { isEmbed: false, url: '', thumbUrl: null };

        const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
        if (ytMatch && ytMatch[1]) {
            embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
            tUrl = `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
            isEmbed = true;
        } else if (url.includes('vimeo.com')) {
            const vimeoMatch = url.match(/(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:[a-zA-Z0-9_\-]+)?/i);
            if (vimeoMatch && vimeoMatch[1]) {
                embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
                isEmbed = true;
            }
        } else if (url.includes('drive.google.com/file/d/')) {
            const match = url.match(/d\/([a-zA-Z0-9_-]+)/);
            if (match) {
                embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
                isEmbed = true;
            }
        }

        return { isEmbed, url: isEmbed ? embedUrl : url, thumbUrl: tUrl };
    };

    const handleUrlPreview = (url: string) => {
        setVideoUrl(url);
        if (url) {
            const parsed = parseVideoUrl(url);
            setVideoPreviewUrl(parsed.url || '');
            setIsEmbedMode(parsed.isEmbed);
            if (parsed.thumbUrl && !thumbFile && !thumbPreviewUrl) {
                setThumbPreviewUrl(parsed.thumbUrl);
            }
        } else {
            setVideoPreviewUrl('');
            setIsEmbedMode(false);
        }
    };

    const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setVideoFile(file);
            setVideoPreviewUrl(URL.createObjectURL(file));
            setIsEmbedMode(false);
        }
    };

    const handleThumbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setThumbFile(file);
            setThumbPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleTagToggle = (tagValue: string) => {
        if (selectedTags.includes(tagValue)) {
            setSelectedTags(selectedTags.filter(t => t !== tagValue));
        } else {
            setSelectedTags([...selectedTags, tagValue]);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        let finalVideoUrl = '';
        let finalThumbUrl = '';
        let finalEmbedUrl = '';

        if (!editVid) {
            if (videoInputType === 'upload' && !videoFile) return alert('動画ファイルを選択してください');
            if (videoInputType === 'url' && !videoUrl.trim()) return alert('動画のURLを入力してください');
        }

        if (videoInputType === 'upload' && videoFile) {
            if (videoFile.size > 100 * 1024 * 1024) return alert('動画ファイルが大きすぎます (上限100MB)');
        }
        if (thumbFile) {
            if (thumbFile.size > 5 * 1024 * 1024) return alert('画像サイズが大きすぎます (上限5MB)');
        }

        setIsSaving(true);
        setUploadProgress(5);
        setProgressText('アップロードの準備中...');

        try {
            if (videoInputType === 'upload' && videoFile) {
                const storageRef = ref(storage, `videos/video/${user.uid}/${Date.now()}_${videoFile.name}`);
                const uploadTask = uploadBytesResumable(storageRef, videoFile);

                await new Promise<void>((resolve, reject) => {
                    uploadTask.on('state_changed',
                        (snapshot) => {
                            const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 75;
                            setUploadProgress(5 + p);
                            setProgressText(`動画をアップロード中... (${Math.floor(5 + p)}%)`);
                        },
                        (error) => reject(new Error(`動画のアップロードに失敗: ${error.message}`)),
                        async () => {
                            try {
                                finalVideoUrl = await getDownloadURL(uploadTask.snapshot.ref);
                                resolve();
                            } catch (err) {
                                reject(new Error("動画URLの取得に失敗しました"));
                            }
                        }
                    );
                });
            } else if (videoInputType === 'url') {
                const rawUrl = videoUrl.trim();
                const parsed = parseVideoUrl(rawUrl);
                finalVideoUrl = rawUrl;
                finalEmbedUrl = parsed.url || '';
                setIsEmbedMode(parsed.isEmbed);
                if (!thumbFile && parsed.thumbUrl) {
                    finalThumbUrl = parsed.thumbUrl;
                }
            }

            if (thumbFile) {
                setUploadProgress(80);
                setProgressText('画像をアップロード中...');
                const thumbRef = ref(storage, `videos/thumbnails/${user.uid}/${Date.now()}_${thumbFile.name}`);
                const snap = await uploadBytes(thumbRef, thumbFile);
                finalThumbUrl = await getDownloadURL(snap.ref);
                setUploadProgress(95);
            }

            if (editVid) {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', editVid));
                if (snap.exists()) {
                    const oldData = snap.data();
                    if (!finalVideoUrl && !finalEmbedUrl) {
                        finalVideoUrl = oldData.sourceUrl || '';
                        finalEmbedUrl = oldData.embedUrl || '';
                        setIsEmbedMode(!!oldData.embedUrl);
                    }
                    if (!finalThumbUrl) finalThumbUrl = oldData.thumbnailUrl || '';
                }
            }

            setUploadProgress(100);
            setProgressText('データを保存しています...');

            let finalAuthorId = user.uid;
            let finalAuthorName = myData ? (myData.name || myData.userId) : '名無し';
            let finalAuthorIcon = myData?.photoURL || null;

            if (isAdmin && overrideUserId) {
                const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
                const q = query(usersRef, where("userId", "==", overrideUserId.trim()));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    setIsSaving(false);
                    return alert(`エラー: 指定されたユーザーID「@${overrideUserId}」は見つかりませんでした。`);
                }

                const targetDoc = querySnapshot.docs[0];
                finalAuthorId = targetDoc.id;
                const tData = targetDoc.data();
                finalAuthorName = tData.name || tData.userId;
                finalAuthorIcon = tData.photoURL || null;
            }

            const cTags = customTags.split(',').map(t => t.trim()).filter(Boolean);
            const tags = Array.from(new Set([...selectedTags, ...cTags]));

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

            const docId = editVid || Date.now().toString();
            const videoDataPayload = {
                authorId: finalAuthorId,
                authorName: finalAuthorName,
                authorIcon: finalAuthorIcon,
                sourceType: videoInputType,
                sourceUrl: finalVideoUrl,
                embedUrl: isEmbedMode ? finalEmbedUrl : '',
                thumbnailUrl: finalThumbUrl || null,
                title,
                description,
                tags,
                allowComments,
                visibility,
                allowedUserIds: visibility === 'custom' ? resolvedAllowedUserIds : [],
                allowedListIds: visibility === 'custom' ? allowedListIds : [],
                updatedAt: new Date().toISOString(),
                ...(!editVid && { createdAt: new Date().toISOString() })
            };

            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', docId), videoDataPayload, { merge: true });

            if (!editVid) {
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
                            type: 'new_video',
                            fromUid: finalAuthorId,
                            contentId: docId,
                            createdAt: serverTimestamp(),
                            isRead: false
                        })
                    ));
                } catch (err) {
                    console.error('Notifications err:', err);
                }
            }

            router.replace(`/media/videos/detail?id=${docId}`);

        } catch (error: any) {
            console.error(error);
            alert(`保存中にエラーが発生しました。\n${error.message}`);
            setIsSaving(false);
        }
    };

    return (
        <div className="antialiased min-h-screen pb-28" style={{ background: 'linear-gradient(135deg, #f0ede8 0%, #e8e4df 100%)' }}>
            {/* Header */}
            <nav className="fixed w-full z-50 top-0 h-14"
                 style={{ background: 'rgba(240,237,232,0.88)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 2px 20px rgba(120,110,100,0.08)' }}>
                <div className="max-w-3xl mx-auto px-4 h-full flex items-center justify-between">
                    <button onClick={() => router.back()}
                            className="flex items-center gap-2 text-sm font-bold tracking-widest transition-all group"
                            style={{ color: '#6b6560' }}>
                        <span className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                              style={{ background: '#eae8e4', boxShadow: '3px 3px 8px #cbc8c3, -3px -3px 8px #ffffff' }}>
                            <ArrowLeft size={15} />
                        </span>
                        <span className="hidden sm:inline">キャンセル</span>
                    </button>
                    <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl flex items-center justify-center"
                              style={{ background: 'linear-gradient(135deg, #c0392b, #922b21)', boxShadow: '0 4px 12px rgba(192,57,43,0.35)' }}>
                            <Film size={15} color="white" />
                        </span>
                        <h1 className="font-bold tracking-widest text-base" style={{ color: '#2a2520' }}>
                            動画の投稿・編集
                        </h1>
                    </div>
                    <div className="w-20" />
                </div>
            </nav>

            <main className="max-w-3xl mx-auto pt-24 px-4 sm:px-6">
                <div className="mb-8 text-center">
                    <p className="text-sm tracking-widest leading-relaxed" style={{ color: '#6b6560' }}>
                        あなたの活動やPRを動画で届けましょう。
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#9c9590' }}>
                        ※ YouTube URL指定またはファイルアップロードが可能です
                    </p>
                </div>

                <form onSubmit={handleSave} className="space-y-6">

                    {/* Section: 動画データ */}
                    <section className="rounded-2xl p-6 sm:p-8"
                             style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '10px 10px 30px #c2bfba, -10px -10px 30px #ffffff' }}>
                        <div className="flex items-center gap-2.5 mb-5">
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={{ background: 'linear-gradient(135deg, #c0392b, #922b21)', boxShadow: '0 3px 10px rgba(192,57,43,0.3)' }}>
                                <Video size={13} color="white" />
                            </span>
                            <span className="text-sm font-bold tracking-widest" style={{ color: '#2a2520' }}>
                                動画データ <span className="text-red-500">*</span>
                            </span>
                        </div>

                        {/* Tab switcher */}
                        <div className="flex gap-1 mb-5 p-1 rounded-xl"
                             style={{ background: '#eae8e4', boxShadow: 'inset 3px 3px 8px #cbc8c3, inset -3px -3px 8px #ffffff' }}>
                            {(['url', 'upload'] as const).map(t => (
                                <button key={t} type="button" onClick={() => setVideoInputType(t)}
                                        className="flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-all"
                                        style={videoInputType === t
                                            ? { background: 'rgba(255,255,255,0.9)', boxShadow: '3px 3px 8px #cbc8c3, -3px -3px 8px #ffffff', color: '#2a2520' }
                                            : { color: '#9c9590' }}>
                                    {t === 'url' ? 'URL を指定' : (
                                        <>ファイルをアップロード {!isAdmin && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-1">準備中</span>}</>
                                    )}
                                </button>
                            ))}
                        </div>

                        {videoInputType === 'url' ? (
                            <div>
                                <p className="text-xs mb-3 leading-relaxed" style={{ color: '#9c9590' }}>
                                    <b style={{ color: '#6b6560' }}>YouTube</b>, <b style={{ color: '#6b6560' }}>Vimeo</b>, <b style={{ color: '#6b6560' }}>Google Drive</b> のURLを貼り付けてください
                                </p>
                                <input type="url" value={videoUrl} onChange={e => handleUrlPreview(e.target.value)}
                                       className="w-full rounded-xl p-4 text-sm outline-none transition-all"
                                       style={{ background: '#eae8e4', boxShadow: 'inset 3px 3px 8px #cbc8c3, inset -3px -3px 8px #ffffff', border: 'none', color: '#2a2520' }}
                                       placeholder="https://www.youtube.com/watch?v=..." />
                            </div>
                        ) : (
                            <div>
                                <p className="text-xs mb-3" style={{ color: '#9c9590' }}>MP4形式などの動画ファイルを選択してください（上限: 100MB）</p>
                                <input type="file" accept="video/mp4, video/webm, video/quicktime" onChange={handleVideoFileUpload}
                                       className="block w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:cursor-pointer transition-colors rounded-xl p-2"
                                       style={{ background: '#eae8e4', color: '#6b6560' }} />
                            </div>
                        )}

                        {videoPreviewUrl && (
                            <div className="mt-5 rounded-xl overflow-hidden"
                                 style={{ boxShadow: '3px 3px 10px #cbc8c3, -3px -3px 10px #ffffff' }}>
                                <div className="px-4 py-2 text-[10px] font-bold tracking-widest uppercase"
                                     style={{ background: 'rgba(234,232,228,0.8)', color: '#9c9590' }}>Preview</div>
                                {isEmbedMode ? (
                                    <iframe src={videoPreviewUrl} className="w-full bg-black aspect-video" frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                                ) : (
                                    <video src={videoPreviewUrl} controls className="w-full bg-black max-h-64" />
                                )}
                            </div>
                        )}
                    </section>

                    {/* Section: サムネイル */}
                    <section className="rounded-2xl p-6 sm:p-8"
                             style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '10px 10px 30px #c2bfba, -10px -10px 30px #ffffff' }}>
                        <div className="flex items-center gap-2.5 mb-2">
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={{ background: 'linear-gradient(135deg, #c0392b, #922b21)', boxShadow: '0 3px 10px rgba(192,57,43,0.3)' }}>
                                <ImageIcon size={13} color="white" />
                            </span>
                            <span className="text-sm font-bold tracking-widest" style={{ color: '#2a2520' }}>
                                サムネイル画像 <span className="text-xs font-normal ml-1" style={{ color: '#9c9590' }}>(任意)</span>
                            </span>
                        </div>
                        <p className="text-xs mb-5" style={{ color: '#9c9590' }}>設定しない場合はデフォルト背景が適用されます。YouTube URLの場合は自動取得されます。</p>
                        <label className="relative flex w-full sm:w-64 aspect-video rounded-xl cursor-pointer overflow-hidden group transition-all"
                               style={{ background: '#eae8e4', boxShadow: 'inset 3px 3px 8px #cbc8c3, inset -3px -3px 8px #ffffff' }}>
                            <input type="file" accept="image/*" onChange={handleThumbUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                            {thumbPreviewUrl ? (
                                <img src={thumbPreviewUrl} className="absolute inset-0 w-full h-full object-contain" alt="Thumbnail" />
                            ) : (
                                <div className="flex flex-col items-center justify-center w-full gap-2 group-hover:scale-105 transition-transform">
                                    <ImageIcon size={28} style={{ color: '#9c9590' }} />
                                    <span className="text-xs font-bold tracking-widest" style={{ color: '#9c9590' }}>クリックして画像を選択</span>
                                </div>
                            )}
                        </label>
                    </section>

                    {/* Section: テキスト情報 */}
                    <section className="rounded-2xl p-6 sm:p-8 space-y-6"
                             style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '10px 10px 30px #c2bfba, -10px -10px 30px #ffffff' }}>
                        <div>
                            <label className="block text-sm font-bold mb-3 tracking-widest" style={{ color: '#2a2520' }}>
                                動画タイトル <span className="text-red-500">*</span>
                            </label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                                   className="w-full rounded-xl p-4 text-sm font-bold outline-none"
                                   style={{ background: '#eae8e4', boxShadow: 'inset 3px 3px 8px #cbc8c3, inset -3px -3px 8px #ffffff', border: 'none', color: '#2a2520' }}
                                   placeholder="動画のタイトルを入力" />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-sm font-bold tracking-widest" style={{ color: '#2a2520' }}>概要欄・説明</label>
                                <span className="text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-lg"
                                      style={{ background: '#eae8e4', color: '#9c9590', boxShadow: '2px 2px 5px #cbc8c3, -2px -2px 5px #ffffff' }}>
                                    Markdown 対応
                                </span>
                            </div>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={6}
                                      className="w-full rounded-xl p-4 text-sm leading-relaxed outline-none resize-none"
                                      style={{ background: '#eae8e4', boxShadow: 'inset 3px 3px 8px #cbc8c3, inset -3px -3px 8px #ffffff', border: 'none', color: '#2a2520' }}
                                      placeholder={"・動画の概要\n・今回のテーマについて\n・関連リンク集"} />
                        </div>
                    </section>

                    {/* Section: タグ・設定 */}
                    <section className="rounded-2xl p-6 sm:p-8 space-y-7"
                             style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '10px 10px 30px #c2bfba, -10px -10px 30px #ffffff' }}>
                        {/* Tags */}
                        <div>
                            <div className="flex items-center gap-2.5 mb-4">
                                <Tags size={14} style={{ color: '#9c9590' }} />
                                <span className="text-sm font-bold tracking-widest" style={{ color: '#2a2520' }}>カテゴリー・タグ</span>
                            </div>
                            <div className="flex flex-wrap gap-2.5 mb-4">
                                {presetTags.map(tag => (
                                    <label key={tag.value} className="cursor-pointer">
                                        <input type="checkbox" checked={selectedTags.includes(tag.value)} onChange={() => handleTagToggle(tag.value)} className="hidden" />
                                        <div className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest transition-all"
                                             style={selectedTags.includes(tag.value)
                                                 ? { background: 'linear-gradient(135deg, #c0392b, #922b21)', color: '#fff', boxShadow: '0 4px 12px rgba(192,57,43,0.35)' }
                                                 : { background: '#eae8e4', color: '#6b6560', boxShadow: '3px 3px 8px #cbc8c3, -3px -3px 8px #ffffff' }}>
                                            {tag.label}
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
                            <div className="flex items-center gap-2.5 mb-4">
                                <MessageSquare size={14} style={{ color: '#9c9590' }} />
                                <span className="text-sm font-bold tracking-widest" style={{ color: '#2a2520' }}>コメント設定</span>
                            </div>
                            <div className="flex gap-3">
                                {[{ v: true, label: '許可する' }, { v: false, label: '許可しない' }].map(opt => (
                                    <label key={String(opt.v)} className="flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl text-sm font-bold tracking-widest transition-all"
                                           style={allowComments === opt.v
                                               ? { background: 'linear-gradient(135deg, #c0392b, #922b21)', color: '#fff', boxShadow: '0 4px 12px rgba(192,57,43,0.35)' }
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

                    {/* Admin section */}
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
                                style={{ background: 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)', color: '#fff', boxShadow: '0 8px 30px rgba(192,57,43,0.4), 6px 6px 18px #cbc8c3, -6px -6px 18px #ffffff' }}>
                            <CloudUpload size={20} />
                            {editVid ? '編集を保存する' : '動画を公開する'}
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
                             style={{ background: 'linear-gradient(135deg, #c0392b, #922b21)', boxShadow: '0 8px 24px rgba(192,57,43,0.4)' }}>
                            <CloudUpload size={28} color="white" />
                        </div>
                        <h3 className="text-base font-bold tracking-widest mb-2" style={{ color: '#2a2520' }}>アップロード中...</h3>
                        <p className="text-xs mb-5 tracking-widest" style={{ color: '#9c9590' }}>{progressText || 'しばらくお待ちください'}</p>
                        <div className="w-full rounded-full h-2 overflow-hidden"
                             style={{ background: 'rgba(203,200,195,0.5)', boxShadow: 'inset 2px 2px 5px #cbc8c3' }}>
                            <div className="h-2 rounded-full transition-all duration-300"
                                 style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #c0392b, #e74c3c)' }} />
                        </div>
                        <p className="text-xs mt-2 font-bold" style={{ color: '#c0392b' }}>{uploadProgress}%</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function VideoPostPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0ede8, #e8e4df)' }}>
                <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                     style={{ borderColor: '#c0392b', borderTopColor: 'transparent' }} />
            </div>
        }>
            <VideoPostContent />
        </Suspense>
    );
}