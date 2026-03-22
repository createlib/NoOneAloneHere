'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy, limit, getDocs, collection, addDoc } from 'firebase/firestore';
import { db, APP_ID, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';
import * as jose from 'jose';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { SatelliteDish, ChevronDown, Share2, Headphones, Power, Mic, MicOff, MessageSquare, Hand, X, XCircle, Pin, Link as LinkIcon, AlertTriangle } from 'lucide-react';

const LIVEKIT_URL = "wss://noonealonehere-eoyjqp8c.livekit.cloud";
const LIVEKIT_API_KEY = "APIvGriAyz8L7Tm";
const LIVEKIT_API_SECRET = "IvJ9RG8pdaey7sKqJ8Hh9qFZxvYINz776eT6zStiLuL";
const DEFAULT_ICON = 'https://via.placeholder.com/150/f7f5f0/c8b9a6?text=U';

export default function LiveRoomClientPage() {
    return (
        <React.Suspense fallback={<div className="min-h-[100dvh] bg-[#1a110f] bg-texture flex items-center justify-center"><div className="w-10 h-10 border-4 border-[#b8860b] border-t-transparent rounded-full animate-spin"></div></div>}>
            <LiveRoomClientPageInner />
        </React.Suspense>
    );
}

function LiveRoomClientPageInner() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const targetRoomId = searchParams.get('roomId') as string;

    const [myProfile, setMyProfile] = useState<any>(null);
    const [myRank, setMyRank] = useState('arrival');
    const [isAdmin, setIsAdmin] = useState(false);
    
    const [currentRole, setCurrentRole] = useState<'none' | 'host' | 'speaker' | 'listener'>('none');
    const [roomData, setRoomData] = useState<any>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [comments, setComments] = useState<any[]>([]);
    const [isMiniPlayer, setIsMiniPlayer] = useState(false);
    
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isHandRaised, setIsHandRaised] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'comments' | 'listeners' | 'info'>('comments');
    const [commentInput, setCommentInput] = useState('');
    const [isPinChecked, setIsPinChecked] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);

    const livekitRoomRef = useRef<Room | null>(null);

    // Form inputs for Create (though normally created from podcast/new, but keeping full logic just in case)
    const [notificationMsg, setNotificationMsg] = useState('');

    const getRankLevel = (rank: string) => {
        const levels: any = { 'arrival': 0, 'settler': 1, 'builder': 2, 'guardian': 3, 'covenant': 4, 'admin': 99 };
        return levels[rank.toLowerCase()] || 0;
    };

    useEffect(() => {
        if (loading) return;
        if (!user || user.isAnonymous) {
            router.push('/login');
            return;
        }

        const initUser = async () => {
            try {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'));
                if (snap.exists()) {
                    const pd = snap.data();
                    setMyProfile(pd);
                    setMyRank(pd.membershipRank || 'arrival');
                    if (pd.userId === 'admin') setIsAdmin(true);
                }

                initRoom(targetRoomId);

            } catch (e) {
                console.error(e);
            }
        };

        if (user) {
            initUser();
        }
    }, [user, loading, targetRoomId]);

    const showNotif = (msg: string) => {
        setNotificationMsg(msg);
        setTimeout(() => setNotificationMsg(''), 3000);
    };

    const initRoom = async (roomId: string) => {
        if (!roomId || !user) return;
        
        let safeName = myProfile ? (myProfile.name || myProfile.userId) : '名無し';
        let safeIcon = myProfile ? myProfile.photoURL : DEFAULT_ICON;
        let role: 'host' | 'listener' = user.uid === roomId ? 'host' : 'listener';
        setCurrentRole(role);

        // Record Join
        if (role !== 'host') {
            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId, 'participants', user.uid), {
                uid: user.uid,
                name: safeName,
                icon: safeIcon,
                role: 'listener',
                handRaised: false,
                joinedAt: serverTimestamp()
            }, { merge: true });
        }

        connectLiveKit(roomId, role === 'host');

        // Sub Room
        const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId);
        const unsubRoom = onSnapshot(roomRef, (snap) => {
            if (!snap.exists() || snap.data().status !== 'live') {
                if (!isLeaving) {
                    setIsLeaving(true);
                    alert("この配信は終了しました。");
                    router.push('/media/podcasts');
                }
                return;
            }
            setRoomData(snap.data());
        });

        // Sub Parts
        const partsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId, 'participants');
        const unsubParts = onSnapshot(partsRef, (snap) => {
            const arr: any[] = [];
            snap.forEach(d => arr.push(d.data()));
            setParticipants(arr);

            const me = arr.find(p => p.uid === user.uid);
            if (me) {
                if (me.role !== currentRole) {
                    setCurrentRole(me.role as any);
                    reconnectLiveKit(roomId, me.role === 'host' || me.role === 'speaker');
                }
                setIsHandRaised(me.handRaised || false);
                setIsMicMuted(me.isMuted || false); // Sync mute state
            }
        });

        // Sub Comments
        const commentsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId, 'comments');
        const qc = query(commentsRef, orderBy('timestamp', 'asc'), limit(80));
        const unsubComments = onSnapshot(qc, (snap) => {
            const arr: any[] = [];
            snap.forEach(d => arr.push(d.data()));
            setComments(arr);
        });

        return () => {
            unsubRoom();
            unsubParts();
            unsubComments();
            disconnectLiveKit();
        };
    };

    const generateLiveKitToken = async (roomName: string, participantName: string, isPublisher: boolean) => {
        if (!user) return "";
        const secret = new TextEncoder().encode(LIVEKIT_API_SECRET);
        const jwt = await new jose.SignJWT({
            video: { room: roomName, roomJoin: true, canPublish: isPublisher, canSubscribe: true },
            name: participantName,
        })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer(LIVEKIT_API_KEY)
        .setSubject(user.uid)
        .setExpirationTime('12h')
        .sign(secret);
        return jwt;
    };

    const connectLiveKit = async (roomName: string, isPublisher: boolean) => {
        try {
            if (livekitRoomRef.current) await livekitRoomRef.current.disconnect();
            
            const token = await generateLiveKitToken(roomName, myProfile?.name || user?.uid || 'Unknown', isPublisher);
            const room = new Room({ adaptiveStream: true, dynacast: true });
            livekitRoomRef.current = room;

            room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                if (track.kind === 'audio') {
                    const el = track.attach();
                    document.body.appendChild(el);
                }
            });

            room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
                const spIds = speakers.map(s => s.identity);
                setActiveSpeakers(spIds);
                if (user && spIds.includes(user.uid)) {
                    updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetRoomId, 'participants', user.uid), { isSpeaking: true });
                } else if (user) {
                    updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetRoomId, 'participants', user.uid), { isSpeaking: false });
                }
            });

            await room.connect(LIVEKIT_URL, token);
            if (isPublisher) {
                await room.localParticipant.setMicrophoneEnabled(true);
                setIsMicMuted(false);
                updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetRoomId, 'participants', user!.uid), { isMuted: false });
            }
        } catch(e) {
            console.warn("LiveKit Connection Error", e);
            showNotif("音声サーバーに接続できませんでしたが、チャットは利用可能です。");
        }
    };

    const reconnectLiveKit = async (roomName: string, isPublisher: boolean) => {
        await connectLiveKit(roomName, isPublisher);
    };

    const disconnectLiveKit = async () => {
        if (livekitRoomRef.current) {
            await livekitRoomRef.current.disconnect();
            livekitRoomRef.current = null;
        }
    };

    // Actions
    const handleShare = () => {
        const url = `${window.location.origin}/media/live_room?roomId=${targetRoomId}`;
        navigator.clipboard.writeText(url).then(() => showNotif('ライブ配信のURLをコピーしました！'));
    };

    const handleLeaveRoom = async () => {
        if (!user) return;
        if (currentRole === 'host') {
            if (confirm("配信を終了しますか？ (リスナーもすべて切断されます)")) {
                setIsLeaving(true);
                await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetRoomId), { status: 'ended', endedAt: serverTimestamp() });
                router.push('/media/podcasts');
            }
        } else {
            setIsLeaving(true);
            router.push('/media/podcasts');
        }
    };

    const handleToggleMic = async () => {
        if (!user) return;
        const newMutedState = !isMicMuted;
        
        if (livekitRoomRef.current && livekitRoomRef.current.localParticipant) {
            try {
                // FIXED: Direct explicit boolean pass for microphone state ensuring it doesn't freeze.
                await livekitRoomRef.current.localParticipant.setMicrophoneEnabled(!newMutedState);
            } catch(e) {
                console.error("Mic toggle failed in LiveKit:", e);
                showNotif("マイクの切り替えに失敗しました。");
                return;
            }
        }
        
        setIsMicMuted(newMutedState);
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetRoomId, 'participants', user.uid), { 
            isMuted: newMutedState, 
            isSpeaking: false 
        });
    };

    const handleToggleHandRaise = async () => {
        if (!user) return;
        const nextState = !isHandRaised;
        setIsHandRaised(nextState);
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetRoomId, 'participants', user.uid), {
            handRaised: nextState
        });
    };

    const handleApproveSpeaker = async (uid: string) => {
        if (currentRole !== 'host') return;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetRoomId, 'participants', uid), {
            role: 'speaker',
            handRaised: false
        });
    };

    const handleKickUser = async (uid: string) => {
        if (currentRole !== 'host') return;
        if (confirm("退室させますか？")) {
             await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetRoomId, 'participants', uid));
        }
    };

    const handleLeaveStage = async () => {
        if (!user) return;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetRoomId, 'participants', user.uid), {
            role: 'listener',
            isSpeaking: false,
            isMuted: true
        });
    };

    const handleSendComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !commentInput.trim() || !targetRoomId) return;

        let safeName = myProfile ? (myProfile.name || myProfile.userId) : '名無し';
        let safeIcon = myProfile ? myProfile.photoURL : DEFAULT_ICON;
        const txt = commentInput.trim();
        setCommentInput('');
        setIsPinChecked(false);

        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetRoomId, 'comments'), {
            uid: user.uid,
            name: safeName,
            icon: safeIcon,
            text: txt,
            timestamp: serverTimestamp()
        });

        if (isPinChecked && currentRole === 'host') {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetRoomId), {
                pinnedComment: { text: txt, author: safeName }
            });
        }
    };

    const handleUnpin = async () => {
        if (currentRole === 'host') {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetRoomId), {
                pinnedComment: null
            });
        }
    };

    if (!roomData) return null; // Avoid flicker

    const speakers = participants.filter(p => p.role === 'host' || p.role === 'speaker');
    const listeners = participants.filter(p => p.role === 'listener');
    const handRaisedCount = listeners.filter(l => l.handRaised).length;

    return (
        <div className="antialiased h-[100dvh] w-screen overflow-hidden bg-[#1a110f] bg-texture relative text-[#f7f5f0] font-sans">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#d4af37]/15 blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#1e3a8a]/20 blur-[120px]"></div>
                <div className="absolute inset-0 bg-dark-texture opacity-80 mix-blend-overlay"></div>
            </div>

            {/* Notification */}
            <div className={`fixed top-10 left-1/2 transform -translate-x-1/2 z-[8000] transition-all duration-300 ${notificationMsg ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className="bg-[#3e2723]/95 text-[#f7f5f0] px-6 py-3 rounded-sm shadow-2xl flex items-center gap-3 backdrop-blur-xl border border-[#b8860b]">
                    <span className="text-sm font-bold tracking-widest font-serif">{notificationMsg}</span>
                </div>
            </div>

            {isMiniPlayer ? (
                <div className="absolute bottom-[5rem] right-4 w-[calc(100%-2rem)] sm:w-[360px] h-[76px] bg-[#1a110f]/95 backdrop-blur-xl border border-[#d4af37]/40 rounded-md shadow-2xl flex items-center justify-between px-4 cursor-pointer group hover:border-[#d4af37]/80 transition-colors z-[7000]" onClick={() => setIsMiniPlayer(false)}>
                    <div className="flex items-center gap-3 relative z-10 min-w-0">
                        <div className="relative w-12 h-12 rounded-sm overflow-hidden border border-[#5c4a3d] flex-shrink-0 bg-black/50">
                            {roomData.thumbUrl && <img src={roomData.thumbUrl} className="w-full h-full object-cover opacity-60" alt="" />}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <SatelliteDish className="text-[#d4af37] w-5 h-5 animate-pulse" />
                            </div>
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] text-[#d4af37] font-bold tracking-widest mb-0.5 uppercase drop-shadow-sm flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>Live Now</p>
                            <p className="text-xs font-bold text-white truncate w-32 sm:w-48 font-serif tracking-wide">{roomData.title}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-full w-full relative z-10 animate-fade-in-up">
                    {/* Header */}
                    <div className="flex justify-between items-center bg-black/40 backdrop-blur-md p-3 sm:p-4 border-b border-white/10 shrink-0 shadow-lg relative z-20">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <button onClick={() => setIsMiniPlayer(true)} className="text-white/60 hover:text-white transition-colors" title="最小化"><ChevronDown size={20} /></button>
                            <div className="bg-red-600/90 text-white px-2.5 py-0.5 rounded-sm text-[9px] font-bold tracking-widest flex items-center gap-1.5 shadow-[0_0_10px_rgba(220,38,38,0.5)] border border-red-500/50 flex-shrink-0">
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE
                            </div>
                            <h2 className="font-bold text-sm sm:text-base tracking-widest truncate font-serif text-white/90">{roomData.title}</h2>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                            <button onClick={handleShare} className="w-8 h-8 rounded-full bg-white/5 text-white/70 hover:text-white flex items-center justify-center border border-white/10 transition-colors hidden sm:flex"><Share2 size={14} /></button>
                            <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 shadow-inner">
                                <Headphones size={12} className="text-[#d4af37]" />
                                <span className="text-xs font-bold font-mono text-white/90">{listeners.length}</span>
                            </div>
                            <button onClick={handleLeaveRoom} className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-600 text-white flex items-center justify-center border border-white/20 transition-colors"><Power size={14} /></button>
                        </div>
                    </div>

                    {/* Main Area */}
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                        {/* Speakers Grid */}
                        <div className="flex-1 p-4 sm:p-8 overflow-y-auto custom-scrollbar relative">
                            <div className="flex flex-wrap justify-center content-start gap-8 sm:gap-12 max-w-4xl mx-auto pt-10">
                                {speakers.map(s => {
                                    const isSpeaking = activeSpeakers.includes(s.uid) || s.isSpeaking;
                                    return (
                                        <div key={s.uid} className="flex flex-col items-center gap-2.5 relative">
                                            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-[3px] bg-black/50 relative shadow-xl transition-all duration-300 ${isSpeaking ? 'speaking-ripple border-[#d4af37]' : 'border-white/10'}`}>
                                                {s.role === 'host' && <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-[#d4af37] text-[#2a1a17] text-[9px] px-2.5 py-0.5 rounded-sm font-bold border border-[#fffdf9]/50 tracking-widest z-10">HOST</div>}
                                                <img src={s.icon || DEFAULT_ICON} className="w-full h-full rounded-full object-cover" alt={s.name} />
                                                {s.isMuted && <div className="absolute bottom-0 right-0 bg-red-600 rounded-full p-1.5 border border-white/20 shadow-md text-white"><MicOff size={10} /></div>}
                                            </div>
                                            <span className="text-[11px] sm:text-xs font-bold tracking-widest text-white/90 max-w-[100px] truncate text-center drop-shadow-md">{s.name}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Right Panel */}
                        <div className="w-full lg:w-[340px] flex flex-col border-t lg:border-t-0 lg:border-l border-white/10 shrink-0 h-[45vh] lg:h-auto z-20 bg-[rgba(20,15,10,0.6)] backdrop-blur-md">
                            <div className="flex border-b border-white/10 shrink-0 bg-black/30">
                                <button onClick={() => setActiveTab('comments')} className={`flex-1 p-3.5 text-xs font-bold tracking-widest transition-colors ${activeTab === 'comments' ? 'border-b-2 border-[#d4af37] text-[#d4af37]' : 'border-b-2 border-transparent text-white/50'}`}>コメント</button>
                                {(currentRole === 'host' || isAdmin) && (
                                    <button onClick={() => setActiveTab('listeners')} className={`flex-1 p-3.5 text-xs font-bold tracking-widest transition-colors relative ${activeTab === 'listeners' ? 'border-b-2 border-[#d4af37] text-[#d4af37]' : 'border-b-2 border-transparent text-white/50'}`}>
                                        参加者
                                        {handRaisedCount > 0 && <span className="absolute top-1/2 transform -translate-y-1/2 right-2 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shadow-md">{handRaisedCount}</span>}
                                    </button>
                                )}
                                <button onClick={() => setActiveTab('info')} className={`flex-1 p-3.5 text-xs font-bold tracking-widest transition-colors ${activeTab === 'info' ? 'border-b-2 border-[#d4af37] text-[#d4af37]' : 'border-b-2 border-transparent text-white/50'}`}>概要</button>
                            </div>

                            <div className="flex-1 flex flex-col overflow-hidden">
                                {activeTab === 'comments' && (
                                    <>
                                        {roomData.pinnedComment && (
                                            <div className="shrink-0 border-b border-white/10 bg-gradient-to-r from-[#d4af37]/20 to-transparent p-3 relative shadow-md">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-[#d4af37]"></div>
                                                <div className="flex items-start gap-2.5 pl-1">
                                                    <Pin size={12} className="text-[#d4af37] mt-1 transform -rotate-45" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[9px] text-[#d4af37] font-bold tracking-widest mb-0.5">ピン留め {roomData.pinnedComment.author && `(${roomData.pinnedComment.author})`}</p>
                                                        <p className="text-xs text-white/90 font-medium whitespace-pre-wrap">{roomData.pinnedComment.text}</p>
                                                    </div>
                                                    {currentRole === 'host' && <button onClick={handleUnpin} className="text-white/40 hover:text-white p-1"><X size={12} /></button>}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar flex flex-col-reverse">
                                            {/* Reversed order map to align to bottom if using flex-col-reverse, or normally overflow auto with auto scroll. Standard is mapping normal. */}
                                            <div className="space-y-3 w-full pb-2">
                                                {comments.length === 0 && <div className="text-center py-6 text-white/40 text-xs tracking-widest font-bold">メッセージを送信して会話をはじめましょう</div>}
                                                {comments.map((c, i) => {
                                                    const isMe = c.uid === user?.uid;
                                                    return (
                                                        <div key={i} className={`flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                            {!isMe && <img src={c.icon || DEFAULT_ICON} className="w-7 h-7 rounded-full mr-2.5 self-end object-cover border border-white/20" alt="" />}
                                                            <div className="max-w-[85%]">
                                                                {!isMe && <p className="text-[9px] text-white/70 mb-1 ml-1 tracking-widest font-bold">{c.name}</p>}
                                                                <div className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm shadow-sm tracking-wide ${isMe ? 'bg-[#d4af37]/20 border border-[#d4af37]/30 text-[#f7f5f0] rounded-tr-sm' : 'bg-white/10 border border-white/5 text-[#f7f5f0] rounded-tl-sm'}`}>
                                                                    {c.text}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-black/40 border-t border-white/10 shrink-0 backdrop-blur-md">
                                            <form onSubmit={handleSendComment} className="flex flex-col gap-2">
                                                <div className="flex gap-2 relative">
                                                    <input type="text" value={commentInput} onChange={e => setCommentInput(e.target.value)} className="flex-1 bg-white/5 text-white text-sm px-4 py-2 pr-10 rounded-full border border-white/10 focus:border-[#d4af37]/70 transition-all outline-none" placeholder="コメントを送信..." />
                                                    <button type="submit" disabled={!commentInput.trim()} className="absolute right-1.5 top-1/2 transform -translate-y-1/2 w-7 h-7 rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8860b] text-black flex items-center justify-center disabled:opacity-50"><MessageSquare size={12} /></button>
                                                </div>
                                                {currentRole === 'host' && (
                                                    <label className="flex items-center gap-1.5 text-[10px] text-white/60 hover:text-white cursor-pointer ml-3">
                                                        <input type="checkbox" checked={isPinChecked} onChange={e => setIsPinChecked(e.target.checked)} className="rounded-sm bg-white/5 border-white/20 text-[#d4af37] focus:ring-[#d4af37] focus:ring-offset-0 focus:ring-1 w-3 h-3" />
                                                        <span>ピン留めとして送信</span>
                                                    </label>
                                                )}
                                            </form>
                                        </div>
                                    </>
                                )}
                                {activeTab === 'listeners' && (
                                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                        <div className="p-2 border-b border-white/10 flex justify-between">
                                            <span className="text-[10px] text-[#d4af37] font-bold tracking-widest">リスナー一覧</span>
                                            <span className="text-[10px] bg-red-600 text-white px-1.5 rounded-sm">リクエスト: {handRaisedCount}</span>
                                        </div>
                                        {listeners.map(l => (
                                            <div key={l.uid} className="flex justify-between items-center p-3 hover:bg-white/5 border-b border-white/5 transition-colors group">
                                                <div className="flex items-center gap-3">
                                                    <img src={l.icon || DEFAULT_ICON} className="w-8 h-8 rounded-full border border-white/20" alt="" />
                                                    <span className="text-xs text-white/90 font-medium truncate">{l.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {l.handRaised && <button onClick={() => handleApproveSpeaker(l.uid)} className="bg-[#d4af37] text-black text-[10px] font-bold px-2 py-1 rounded-sm">承認</button>}
                                                    <button onClick={() => handleKickUser(l.uid)} className="text-red-400 hover:text-red-500 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-500/20"><XCircle size={14} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {activeTab === 'info' && (
                                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar text-white/90">
                                        <h3 className="font-bold text-lg mb-4 text-[#d4af37] tracking-widest font-serif">{roomData.title}</h3>
                                        <div className="flex flex-wrap gap-2 mb-6">
                                            {roomData.tags && roomData.tags.map((t: string) => (
                                                <span key={t} className="bg-[#d4af37]/20 border border-[#d4af37]/40 text-white px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-widest">#{t}</span>
                                            ))}
                                        </div>
                                        <p className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed bg-white/5 p-4 rounded-sm border border-white/10">{roomData.desc}</p>
                                        {roomData.relatedArticleUrls && roomData.relatedArticleUrls.length > 0 && (
                                            <div className="mt-6 border-t border-white/10 pt-4">
                                                <h4 className="text-[10px] text-[#d4af37] font-bold tracking-widest mb-3 flex items-center gap-1.5"><LinkIcon size={12}/> 関連記事</h4>
                                                <div className="space-y-3">
                                                    {roomData.relatedArticleUrls.map((url: string, idx: number) => {
                                                        const noteMatch = url.match(/note\.com\/.*?n\/(n[a-zA-Z0-9]+)/);
                                                        if (noteMatch) {
                                                            return <iframe key={idx} src={`https://note.com/embed/notes/${noteMatch[1]}`} className="w-full h-64 bg-white rounded-sm border-0" />
                                                        }
                                                        return <a key={idx} href={url} target="_blank" rel="noreferrer" className="block p-3 bg-white/5 border border-white/10 rounded-sm hover:border-[#d4af37]/50 text-xs text-white/90 truncate"><LinkIcon size={10} className="inline mr-2 text-[#d4af37]" />{url}</a>
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer Action Bar */}
                    <div className="bg-black/20 border-t border-white/10 p-4 sm:p-5 flex justify-center items-center gap-4 sm:gap-6 relative z-30 shrink-0">
                        {(currentRole === 'listener' && (getRankLevel(myRank) >= 2 || isAdmin)) && (
                            <button onClick={handleToggleHandRaise} className={`px-5 py-3 rounded-full text-xs font-bold tracking-widest transition-all shadow-md group border ${isHandRaised ? 'bg-white/20 border-[#d4af37]' : 'bg-white/10 border-white/20 hover:border-[#d4af37]'}`}>
                                <Hand size={14} className={`inline mr-2 ${isHandRaised ? 'text-[#d4af37]' : 'text-white/70 group-hover:text-[#d4af37]'}`} /> 
                                {isHandRaised ? 'リクエスト中...' : '登壇をリクエスト'}
                            </button>
                        )}

                        {(currentRole === 'host' || currentRole === 'speaker') && (
                            <button onClick={handleToggleMic} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all border ${isMicMuted ? 'bg-red-600 border-red-400 opacity-90' : 'bg-gradient-to-br from-[#d4af37] to-[#b8860b] border-[#f7f5f0]/30 text-black'}`}>
                                {isMicMuted ? <MicOff size={24} className="text-white" /> : <Mic size={24} />}
                            </button>
                        )}

                        {currentRole === 'speaker' && (
                            <button onClick={handleLeaveStage} className="px-5 py-2.5 bg-transparent text-white/50 border border-white/20 rounded-full text-[10px] font-bold tracking-widest hover:text-white hover:bg-white/10 transition-colors">
                                降壇する
                            </button>
                        )}

                        {currentRole === 'host' && (
                            <button onClick={handleLeaveRoom} className="px-5 py-2.5 bg-red-600/20 text-red-400 border border-red-500/50 rounded-full text-[10px] sm:text-xs font-bold tracking-widest hover:bg-red-600 hover:text-white transition-all ml-2">
                                配信終了
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
