'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, onSnapshot, updateDoc, deleteDoc, query, orderBy, limit, serverTimestamp, getDocs, addDoc, setDoc, getDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import * as jose from 'jose';
import { Room, RoomEvent, Participant } from 'livekit-client';
import { ChevronDown, Share2, Headphones, Power, Pin, X, Send, Hand, Mic, MicOff, RadioReceiver, ArrowUpRight } from 'lucide-react';

const LIVEKIT_URL = "wss://noonealonehere-eoyjqp8c.livekit.cloud";
const LIVEKIT_API_KEY = "APIvGriAyz8L7Tm";
const LIVEKIT_API_SECRET = "IvJ9RG8pdaey7sKqJ8Hh9qFZxvYINz776eT6zStiLuL";

export default function LiveRoomPage({ params }: { params: { id: string } }) {
    const roomId = params.id;
    const { user, loading } = useAuth();
    const router = useRouter();

    const [roomData, setRoomData] = useState<any>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [comments, setComments] = useState<any[]>([]);
    
    const [myProfile, setMyProfile] = useState<any>(null);
    const [myRank, setMyRank] = useState('arrival');
    const [isAdmin, setIsAdmin] = useState(false);
    
    const [currentRole, setCurrentRole] = useState<'host'|'speaker'|'listener'|'none'>('none');
    const [isHandRaised, setIsHandRaised] = useState(false);
    
    const [livekitRoom, setLivekitRoom] = useState<Room | null>(null);
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
    
    const [activeTab, setActiveTab] = useState<'comments'|'listeners'|'info'>('comments');
    const [commentInput, setCommentInput] = useState('');
    const [isPinComment, setIsPinComment] = useState(false);
    
    const [isMiniPlayer, setIsMiniPlayer] = useState(false);
    const [anonymousName, setAnonymousName] = useState('');
    const [hasAttemptedConnect, setHasAttemptedConnect] = useState(false);

    const commentsEndRef = useRef<HTMLDivElement>(null);

    // Audio Analysis
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number>(0);

    useEffect(() => {
        if (!anonymousName) {
            setAnonymousName('listener' + Math.floor(Math.random() * 10000));
        }
    }, [anonymousName]);

    useEffect(() => {
        if (loading) return;
        if (!user) {
            if (confirm('参加するにはログインが必要です。ログインしますか？')) {
                router.push('/login');
            } else {
                router.push('/home');
            }
            return;
        }

        const init = async () => {
            try {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'));
                if (snap.exists()) {
                    const data = snap.data();
                    setMyProfile(data);
                    setMyRank(data.membershipRank || 'arrival');
                    if (data.userId === 'admin') setIsAdmin(true);
                }
            } catch(e){}
        };
        init();
    }, [user, loading, router]);

    const getParticipantInfo = useCallback(() => {
        let safeName = myProfile ? (myProfile.name || myProfile.userId) : '名無し';
        let safeIcon = myProfile ? myProfile.photoURL : 'https://via.placeholder.com/150/f7f5f0/c8b9a6?text=U';

        if (currentRole !== 'host' && !isAdmin) {
            const isPublicSetting = myProfile && myProfile.profilePublic === 'true';
            const isPaidMember = myRank !== 'arrival';
            const canPublish = isPaidMember || isAdmin;
            
            if (!(isPublicSetting && canPublish)) {
                safeName = anonymousName;
                safeIcon = 'https://via.placeholder.com/150/f7f5f0/c8b9a6?text=U';
            }
        }
        return { safeName, safeIcon };
    }, [myProfile, currentRole, isAdmin, myRank, anonymousName]);

    useEffect(() => {
        if (!user || !myProfile || hasAttemptedConnect) return;
        setHasAttemptedConnect(true);

        const joinRoom = async () => {
            try {
                // Initialize Participant role
                if (user.uid === roomId) {
                    setCurrentRole('host');
                } else {
                    const { safeName, safeIcon } = getParticipantInfo();
                    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId, 'participants', user.uid), {
                        uid: user.uid,
                        name: safeName,
                        icon: safeIcon,
                        role: 'listener',
                        handRaised: false,
                        joinedAt: serverTimestamp()
                    }, { merge: true });
                }
            } catch (e) { console.error('Error joining room', e); }
        };
        joinRoom();
    }, [user, myProfile, roomId, getParticipantInfo, hasAttemptedConnect]);

    // Firestore Subscriptions
    useEffect(() => {
        if (!user || !hasAttemptedConnect) return;

        const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId);
        const unsubRoom = onSnapshot(roomRef, (snap) => {
            if (!snap.exists() || snap.data().status !== 'live') {
                alert('この配信は終了しました。');
                router.push('/media/podcasts');
                return;
            }
            setRoomData(snap.data());
        });

        const partsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId, 'participants');
        const unsubParts = onSnapshot(partsRef, (snap) => {
            const parts: any[] = [];
            snap.forEach(docSnap => {
                const p = docSnap.data();
                parts.push(p);
                if (p.uid === user.uid) {
                    setCurrentRole(p.role);
                    setIsHandRaised(p.handRaised || false);
                    if (p.role === 'listener' && !isMicMuted) {
                         setIsMicMuted(true);
                    }
                }
            });
            setParticipants(parts);
        });

        const commentsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId, 'comments');
        const q = query(commentsRef, orderBy('timestamp', 'asc'), limit(50));
        const unsubComments = onSnapshot(q, (snap) => {
            const comms: any[] = [];
            snap.forEach(docSnap => {
                comms.push({ id: docSnap.id, ...docSnap.data() });
            });
            setComments(comms);
            setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });

        return () => {
            unsubRoom();
            unsubParts();
            unsubComments();
            disconnectLiveKit();
            stopMicAnalysis();
        };
    }, [user, roomId, router, hasAttemptedConnect]);

    // LiveKit Connection
    useEffect(() => {
        if (!user || !myProfile) return;
        
        const connectToLiveKit = async () => {
            try {
                if (livekitRoom) return; // Already connected
                
                const isPublisher = currentRole === 'host' || currentRole === 'speaker';
                const secret = new TextEncoder().encode(LIVEKIT_API_SECRET);
                const jwt = await new jose.SignJWT({
                    video: { room: roomId, roomJoin: true, canPublish: isPublisher, canSubscribe: true },
                    name: myProfile?.name || user.uid,
                })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuer(LIVEKIT_API_KEY)
                .setSubject(user.uid)
                .setExpirationTime('12h')
                .sign(secret);

                const room = new Room({ adaptiveStream: true, dynacast: true });
                
                room.on(RoomEvent.TrackSubscribed, (track : any) => {
                    if (track.kind === 'audio') document.body.appendChild(track.attach());
                });

                room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
                    setActiveSpeakers(speakers.map(s => s.identity));
                });

                await room.connect(LIVEKIT_URL, jwt);
                if (isPublisher && !isMicMuted) {
                    await room.localParticipant.setMicrophoneEnabled(true);
                }
                setLivekitRoom(room);
            } catch (e) {
                console.error("LiveKit connection failed", e);
            }
        };

        if (currentRole !== 'none') {
            connectToLiveKit();
        }

        return () => {
           // We do not disconnect on every role change, we just adapt microphone
        };
    }, [user, myProfile, roomId, currentRole]);

    // Handle Mic enabling/disabling strictly on role changes
    useEffect(() => {
        if (!livekitRoom) return;
        const ensureMicState = async () => {
            const isPublisher = currentRole === 'host' || currentRole === 'speaker';
            try {
                if (isPublisher && !isMicMuted) {
                    await livekitRoom.localParticipant.setMicrophoneEnabled(true);
                    startMicAnalysis();
                } else {
                    await livekitRoom.localParticipant.setMicrophoneEnabled(false);
                    stopMicAnalysis();
                }
            } catch(e){}
        };
        ensureMicState();
    }, [currentRole, isMicMuted, livekitRoom]);

    const disconnectLiveKit = async () => {
        if (livekitRoom) {
            await livekitRoom.disconnect();
            setLivekitRoom(null);
        }
    };

    // --- Actions ---

    const toggleMic = async () => {
        if (!livekitRoom || !user) return;
        const nextMuted = !isMicMuted;
        
        try {
            await livekitRoom.localParticipant.setMicrophoneEnabled(!nextMuted);
            setIsMicMuted(nextMuted);
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId, 'participants', user.uid), { 
                isMuted: nextMuted, 
                isSpeaking: false 
            });
            if(!nextMuted) startMicAnalysis();
            else stopMicAnalysis();
        } catch(e) { console.error(e); }
    };

    const toggleHandRaise = async () => {
        if (!user) return;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId, 'participants', user.uid), {
            handRaised: !isHandRaised
        });
    };

    const approveSpeaker = async (targetUid: string) => {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId, 'participants', targetUid), {
            role: 'speaker',
            handRaised: false
        });
    };

    const leaveStage = async () => {
        if (!user) return;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId, 'participants', user.uid), {
            role: 'listener',
            isSpeaking: false
        });
        setIsMicMuted(true);
    };

    const kickUser = async (targetUid: string) => {
        if (confirm("このユーザーを退出させますか？")) {
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId, 'participants', targetUid));
        }
    };

    const leaveLiveRoom = async () => {
        if (currentRole === 'host') {
            if (!confirm('本当に配信を終了しますか？')) return;
            // Clean up room status to end stream
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId), { status: 'ended' });
        } else {
            if (user) {
                await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId, 'participants', user.uid));
            }
        }
        await disconnectLiveKit();
        router.push('/media/podcasts');
    };

    const sendComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !commentInput.trim()) return;

        const { safeName, safeIcon } = getParticipantInfo();
        const text = commentInput.trim();

        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId, 'comments'), {
            uid: user.uid,
            name: safeName,
            icon: safeIcon,
            text: text,
            timestamp: serverTimestamp()
        });

        if (isPinComment && currentRole === 'host') {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId), {
                pinnedComment: { text: text, author: safeName }
            });
        }

        setCommentInput('');
        setIsPinComment(false);
    };

    const unpinComment = async () => {
        if (currentRole !== 'host') return;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', roomId), {
            pinnedComment: null
        });
    };

    const shareRoom = () => {
        const url = `${window.location.origin}${window.location.pathname}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('URLをコピーしました');
        });
    };

    // --- Audio Analysis ---
    const startMicAnalysis = async () => {
        if (audioContextRef.current) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;
            const Actx = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new Actx();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 256;
            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const analyze = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);
                let sum = 0;
                for(let i=0; i<bufferLength; i++) sum += dataArray[i];
                const avg = sum / bufferLength;

                const isTalkingNow = avg > 15 && !isMicMuted;
                // Avoid too many firestore writes, only write if it changes
                // In a real app we'd debounce this significantly. We will just use LiveKit's ActiveSpeakers mechanism instead for DB-free visual updates!
                // Actually LiveKit `activeSpeakers` array gives us exactly who is talking!
                
                animationFrameRef.current = requestAnimationFrame(analyze);
            };
            analyze();
        } catch(e) {}
    };

    const stopMicAnalysis = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
        }
    };

    if (!roomData) return null;

    const speakers = participants.filter(p => p.role === 'host' || p.role === 'speaker');
    const listeners = participants.filter(p => p.role === 'listener');

    const reqCount = listeners.filter(l => l.handRaised).length;

    return (
        <div className={`fixed inset-0 z-[7000] flex flex-col text-[#f7f5f0] font-sans transition-all duration-500 overflow-hidden ${isMiniPlayer ? 'bottom-[5rem] right-4 w-[calc(100%-2rem)] sm:w-[360px] h-[76px] bg-transparent top-auto left-auto' : 'bg-[#1a110f]'}`}>
            
            {!isMiniPlayer && (
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#d4af37]/15 blur-[100px]"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[#1e3a8a]/20 blur-[120px]"></div>
                    <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-[#8b6a4f]/10 blur-[90px]"></div>
                    <div className="absolute inset-0 bg-[#000] opacity-30 mix-blend-overlay" style={{backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.65\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')"}}></div>
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
                </div>
            )}

            {!isMiniPlayer ? (
                <div className="flex flex-col h-full w-full relative z-10">
                    <div className="flex justify-between items-center bg-white/5 backdrop-blur-md p-3 sm:p-4 border-b border-white/10 shrink-0 shadow-lg relative z-20">
                        <div className="flex items-center gap-3 min-w-0">
                            <button onClick={() => setIsMiniPlayer(true)} className="text-white/60 hover:text-white px-2 transition-colors"><ChevronDown size={18} /></button>
                            <div className="bg-red-600/90 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-sm text-[9px] font-bold tracking-widest flex items-center gap-1.5 shadow-[0_0_10px_rgba(220,38,38,0.5)] border border-red-500/50">
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE
                            </div>
                            <h2 className="font-bold text-sm sm:text-base tracking-widest truncate font-serif drop-shadow-md text-white/90">{roomData.title}</h2>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                            <button onClick={shareRoom} className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-white/70 hover:text-white hover:bg-white/20 transition-colors border border-white/10 backdrop-blur-sm"><Share2 size={14}/></button>
                            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                <Headphones className="text-[#d4af37] w-3 h-3 opacity-90" />
                                <span className="text-xs font-bold font-mono text-white/90 drop-shadow-sm">{listeners.length}</span>
                            </div>
                            <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block"></div>
                            <button onClick={leaveLiveRoom} className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-600/90 text-white/80 hover:text-white transition-colors flex items-center justify-center border border-white/20"><Power size={14} /></button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                        <div className="flex-1 p-4 sm:p-8 overflow-y-auto relative">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(10,5,15,0.6)_100%)] pointer-events-none"></div>
                            <div className="flex flex-wrap justify-center content-start gap-8 sm:gap-12 relative z-10 max-w-4xl mx-auto h-full pt-10 sm:pt-16">
                                {speakers.map(s => {
                                    const isSpeaking = activeSpeakers.includes(s.uid);
                                    return (
                                        <div key={s.uid} className="flex flex-col items-center gap-2.5">
                                            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-[3px] bg-black/50 relative shadow-xl transition-all duration-300 ${isSpeaking ? 'scale-105 border-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.4)]' : 'border-white/10'}`}>
                                                {s.role === 'host' && <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-[#d4af37] text-[#2a1a17] text-[9px] px-2.5 py-0.5 rounded-sm font-bold border border-[#fffdf9]/50 shadow-md tracking-widest z-10">HOST</div>}
                                                <img src={s.icon || 'https://via.placeholder.com/150'} className="w-full h-full rounded-full object-cover" alt="" />
                                                {s.isMuted && <div className="absolute bottom-0 right-0 bg-red-600 rounded-full p-1.5 border border-white/20"><MicOff size={10} className="text-white" /></div>}
                                            </div>
                                            <span className="text-[11px] sm:text-xs font-bold tracking-widest text-white/90 max-w-[100px] truncate text-center drop-shadow-md">{s.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="w-full lg:w-[340px] flex flex-col border-t lg:border-t-0 lg:border-l border-white/10 shrink-0 h-[45vh] lg:h-auto z-20 bg-gradient-to-b from-[rgba(20,15,10,0.6)] to-[rgba(10,15,30,0.7)] backdrop-blur-xl">
                            <div className="flex border-b border-white/10 shrink-0 relative bg-black/30">
                                <button onClick={() => setActiveTab('comments')} className={`flex-1 p-3.5 text-xs font-bold tracking-widest border-b-2 transition-colors ${activeTab === 'comments' ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-white/50 hover:text-white/90'}`}>コメント</button>
                                {(currentRole === 'host' || currentRole === 'speaker') && (
                                    <button onClick={() => setActiveTab('listeners')} className={`flex-1 p-3.5 text-xs font-bold tracking-widest border-b-2 transition-colors relative ${activeTab === 'listeners' ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-white/50 hover:text-white/90'}`}>
                                        参加者
                                        {reqCount > 0 && <span className="absolute top-2 right-2 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{reqCount}</span>}
                                    </button>
                                )}
                                <button onClick={() => setActiveTab('info')} className={`flex-1 p-3.5 text-xs font-bold tracking-widest border-b-2 transition-colors ${activeTab === 'info' ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-white/50 hover:text-white/90'}`}>概要</button>
                            </div>

                            {activeTab === 'comments' && (
                                <div className="flex-1 flex flex-col overflow-hidden relative">
                                    {roomData.pinnedComment && (
                                        <div className="shrink-0 border-b border-white/10 bg-gradient-to-r from-[#d4af37]/20 to-transparent p-3 relative shadow-md">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-[#d4af37]"></div>
                                            <div className="flex items-start gap-2.5 pl-1">
                                                <Pin className="text-[#d4af37] w-3 h-3 mt-1 transform -rotate-45" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[9px] text-[#d4af37] font-bold tracking-widest mb-0.5">{roomData.pinnedComment.author}</p>
                                                    <p className="text-xs text-white/90 font-medium">{roomData.pinnedComment.text}</p>
                                                </div>
                                                {currentRole === 'host' && <button onClick={unpinComment} className="text-white/40 hover:text-white/80 p-1"><X size={12}/></button>}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-10">
                                        {comments.length === 0 ? (
                                            <div className="text-center py-6 text-white/40 text-xs tracking-widest font-bold">メッセージを送信して<br/>会話をはじめましょう</div>
                                        ) : (
                                            comments.map(c => {
                                                const isMe = user?.uid === c.uid;
                                                return (
                                                    <div key={c.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full mb-4`}>
                                                        {!isMe && <img src={c.icon || 'https://via.placeholder.com/150'} className="w-7 h-7 rounded-full mr-2.5 self-end object-cover border border-white/20"/>}
                                                        <div className="max-w-[85%]">
                                                            {!isMe && <p className="text-[9px] text-white/70 mb-1 ml-1 tracking-widest font-bold">{c.name}</p>}
                                                            <div className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm shadow-sm font-medium tracking-wide ${isMe ? 'bg-[#d4af37]/20 border border-[#d4af37]/30 text-[#f7f5f0] rounded-tr-sm' : 'bg-white/10 border border-white/5 text-[#f7f5f0] rounded-tl-sm'}`}>
                                                                {c.text}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                        <div ref={commentsEndRef} />
                                    </div>
                                    <div className="absolute bottom-[60px] left-0 w-full h-8 bg-gradient-to-t from-[rgba(26,17,15,0.8)] to-transparent pointer-events-none"></div>
                                    <div className="p-3 bg-black/40 border-t border-white/10 shrink-0 backdrop-blur-md">
                                        <form onSubmit={sendComment} className="flex flex-col gap-2">
                                            <div className="flex gap-2 relative">
                                                <input type="text" value={commentInput} onChange={e => setCommentInput(e.target.value)} className="flex-1 bg-white/5 text-white text-sm px-4 py-2.5 pr-10 rounded-full border border-white/10 focus:border-[#d4af37]/70 focus:bg-white/10 outline-none" placeholder="コメントを送信..." />
                                                <button type="submit" className="absolute right-1.5 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8860b] text-[#1a110f] flex items-center justify-center shadow-md">
                                                    <Send size={12} className="ml-[-1px]" />
                                                </button>
                                            </div>
                                            {currentRole === 'host' && (
                                                <label className="flex items-center gap-1.5 pl-2 mt-0.5 text-[10px] text-white/60 cursor-pointer font-bold">
                                                    <input type="checkbox" checked={isPinComment} onChange={e => setIsPinComment(e.target.checked)} className="rounded-sm bg-white/5 text-[#d4af37] focus:ring-[#d4af37] border-white/20 w-3 h-3" />
                                                    <Pin className="w-3 h-3 transform -rotate-45" /> ピン留めとして送信
                                                </label>
                                            )}
                                        </form>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'listeners' && (currentRole === 'host' || currentRole === 'speaker') && (
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    <div className="p-3 bg-black/20 border-b border-white/5 shrink-0 flex justify-between items-center">
                                        <span className="text-[10px] text-[#d4af37] tracking-widest font-bold flex items-center gap-1"><Hand size={12}/>登壇リクエスト</span>
                                        <span className="bg-red-600/80 text-white text-[9px] px-2 py-0.5 rounded-sm font-bold shadow-sm">{reqCount}</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
                                        {listeners.map(l => (
                                            <div key={l.uid} className="flex items-center justify-between p-2.5 hover:bg-white/10 rounded-sm transition-colors group border-b border-white/5 last:border-0">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <img src={l.icon || 'https://via.placeholder.com/150'} className="w-7 h-7 rounded-full object-cover border border-white/20 shadow-sm" alt=""/>
                                                    <span className="text-xs text-white/90 truncate tracking-wide font-medium">{l.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    {l.handRaised && <button onClick={() => approveSpeaker(l.uid)} className="bg-[#d4af37] text-[#2a1a17] text-[10px] font-bold px-2.5 py-1 rounded-sm shadow-md hover:bg-[#b8860b] transition-colors">承認</button>}
                                                    {currentRole === 'host' && <button onClick={() => kickUser(l.uid)} className="text-red-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'info' && (
                                <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                                    <h3 className="font-bold text-lg mb-4 text-[#d4af37] tracking-widest font-serif leading-snug drop-shadow-md">{roomData.title}</h3>
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {roomData.tags?.map((t:string) => <span key={t} className="bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#f7f5f0] px-2.5 py-1 rounded-sm text-[10px] font-bold tracking-widest backdrop-blur-sm">#{t}</span>)}
                                    </div>
                                    <h4 className="text-[10px] text-white/50 tracking-widest mb-2 font-bold uppercase">トピック・概要</h4>
                                    <div className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap bg-white/5 p-4 rounded-sm border border-white/10 shadow-inner">
                                        {roomData.desc || '概要はありません。'}
                                    </div>
                                    
                                    {(roomData.relatedArticleUrls?.length > 0 || roomData.relatedArticleUrl) && (
                                        <div className="mt-5 pt-4 border-t border-white/10">
                                            <h4 className="text-[10px] text-[#d4af37] tracking-widest mb-3 font-bold uppercase">関連記事</h4>
                                            <div className="space-y-4">
                                                {(Array.isArray(roomData.relatedArticleUrls) ? roomData.relatedArticleUrls : [roomData.relatedArticleUrl]).map((url:string, i:number) => {
                                                    const noteMatch = url.match(/note\.com\/.*?n\/(n[a-zA-Z0-9]+)/) || url.match(/note\.com\/embed\/notes\/(n[a-zA-Z0-9]+)/);
                                                    if (noteMatch && noteMatch[1]) {
                                                        return <iframe key={i} className="w-full max-w-full rounded-sm border border-white/10 shadow-lg bg-white h-[260px]" src={`https://note.com/embed/notes/${noteMatch[1]}`} style={{border:0}}></iframe>;
                                                    }
                                                    return <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block p-3.5 bg-white/5 border border-white/10 rounded-sm hover:bg-white/10 text-xs text-white/90 truncate flex items-center gap-2"><ArrowUpRight className="text-[#d4af37] w-3 h-3"/>{url}</a>
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-md border-t border-white/10 px-3 py-4 sm:p-5 pt-4 pb-8 shrink-0 flex justify-center items-center gap-4 sm:gap-6 relative z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.2)]">
                        {currentRole === 'listener' && (myRank !== 'arrival' || isAdmin) && (
                            <button onClick={toggleHandRaise} className={`px-5 py-3 rounded-full text-xs font-bold tracking-widest transition-all shadow-md backdrop-blur-sm flex items-center gap-2 border ${isHandRaised ? 'bg-white/20 border-[#d4af37] text-white' : 'bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-[#d4af37]'}`}>
                                <Hand className={`${isHandRaised ? 'text-[#d4af37]' : 'text-white/70'} w-4 h-4`} /> {isHandRaised ? 'リクエスト中...' : '登壇をリクエスト'}
                            </button>
                        )}
                        {(currentRole === 'host' || currentRole === 'speaker') && (
                            <button onClick={toggleMic} className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:scale-105 transition-transform border relative group ${isMicMuted ? 'bg-red-600/80 border-red-400 text-white' : 'bg-gradient-to-br from-[#d4af37] to-[#b8860b] text-[#1a110f] border-[#f7f5f0]/30'}`}>
                                {isMicMuted ? <MicOff className="w-6 h-6 z-10" /> : <Mic className="w-6 h-6 z-10" />}
                            </button>
                        )}
                        {currentRole === 'speaker' && (
                            <button onClick={leaveStage} className="px-4 py-2 bg-transparent text-white/50 border border-white/20 rounded-full text-xs font-bold tracking-widest hover:text-white hover:bg-white/10 transition-colors">降壇する</button>
                        )}
                        {currentRole === 'host' && (
                            <button onClick={leaveLiveRoom} className="px-5 py-2.5 bg-red-600/20 text-red-400 border border-red-500/50 rounded-full text-xs font-bold tracking-widest hover:bg-red-600 hover:text-white transition-all ml-4">配信を終了</button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="h-full w-full flex items-center justify-between px-4 bg-[#1a110f]/95 backdrop-blur-xl border border-[#d4af37]/40 rounded-md shadow-[0_15px_40px_rgba(0,0,0,0.5)] relative overflow-hidden cursor-pointer group hover:border-[#d4af37]/80 transition-colors" onClick={() => setIsMiniPlayer(false)}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(212,175,55,0.15)_0%,transparent_60%)] pointer-events-none"></div>
                    <div className="flex items-center gap-3 sm:gap-4 relative z-10 min-w-0">
                        <div className="relative w-12 h-12 rounded-sm overflow-hidden border border-[#5c4a3d] shadow-md flex-shrink-0">
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10"><RadioReceiver className="text-[#d4af37] w-5 h-5 animate-pulse" /></div>
                            <img src={roomData.thumbUrl || 'https://via.placeholder.com/150'} className="w-full h-full object-cover opacity-60" alt="" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] text-[#d4af37] font-bold tracking-widest mb-0.5 uppercase flex items-center gap-1.5"><span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span>Live Now</p>
                            <p className="text-xs font-bold text-white truncate w-32 sm:w-48 font-serif tracking-wide">{roomData.title}</p>
                        </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); leaveLiveRoom(); }} className="relative z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-red-600 transition-colors flex items-center justify-center border border-white/20"><Power className="w-3 h-3 text-white/80" /></button>
                </div>
            )}
        </div>
    );
}
