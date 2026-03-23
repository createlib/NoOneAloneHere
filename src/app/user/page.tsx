'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db, APP_ID } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, getCountFromServer, query, where, setDoc, deleteDoc, serverTimestamp, addDoc, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { Anchor, LogOut, CheckCircle, XCircle, AlertCircle, Globe, Instagram, Twitter, MessageCircle, Heart, Share, ShieldHalf, LayoutDashboard, Crown, User as UserIcon, Settings, Lock, FileText, Compass, Settings2, Pencil, Copy, Image, Film, Play, Headphones, Dna, Unlock, ChevronRight, Check, Key, Plus, List, Gavel, Hammer, Home, SatelliteDish } from 'lucide-react';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FollowModal from '@/components/FollowModal';
import KeyMemoModal from '@/components/KeyMemoModal';
import PlaylistModal from '@/components/PlaylistModal';
import PlaylistDetailModal from '@/components/PlaylistDetailModal';

import { marked } from 'marked';
import DOMPurify from 'dompurify';

function formatText(text: string) {
    if (!text) return '';
    try {
        const textStr = String(text).replace(/__(.*?)__/g, '<u>$1</u>');
        const rawHtml = marked.parse(textStr, { breaks: true, gfm: true }) as string;
        if (typeof window === 'undefined') {
            return rawHtml;
        }
        return DOMPurify.sanitize(rawHtml, { 
            ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'u', 'span', 'blockquote', 'code', 'pre'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
        });
    } catch {
        if (typeof window === 'undefined') return String(text).replace(/\n/g, '<br>');
        return DOMPurify.sanitize(String(text).replace(/\n/g, '<br>'));
    }
}

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

function getRankBadge(rank: string) {
    const r = rank?.toLowerCase() || 'arrival';
    if (r === 'covenant') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d4af37]/20 text-[#8b6508] border border-[#d4af37]/50 tracking-widest"><ShieldHalf size={10} className="mr-1"/>COVENANT</span>;
    if (r === 'guardian') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3e2723]/10 text-[#3e2723] border border-[#3e2723]/30 tracking-widest"><Gavel size={10} className="mr-1"/>GUARDIAN</span>;
    if (r === 'builder') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8b6a4f]/10 text-[#8b6a4f] border border-[#8b6a4f]/30 tracking-widest"><Hammer size={10} className="mr-1"/>BUILDER</span>;
    if (r === 'settler') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#c8b9a6]/20 text-[#725b3f] border border-[#c8b9a6]/50 tracking-widest"><Home size={10} className="mr-1"/>SETTLER</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f7f5f0] text-[#a09080] border border-[#e8dfd1] tracking-widest"><Anchor size={10} className="mr-1"/>ARRIVAL</span>;
}

// Extracted Profile Content Component to use useSearchParams inside Suspense
function UserProfileContent() {
  const searchParams = useSearchParams();
  const uidParam = searchParams.get('uid');
  const { user } = useAuth();
  const router = useRouter();
  
  const [targetUid, setTargetUid] = useState<string | null>(null);
  const [isSelf, setIsSelf] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [osData, setOsData] = useState<any>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [isPlaylistDetailOpen, setIsPlaylistDetailOpen] = useState(false);
  const [viewingPlaylist, setViewingPlaylist] = useState<any>(null);
  const [mediaRefreshKey, setMediaRefreshKey] = useState(0);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [mutualCount, setMutualCount] = useState(0);
  const [followModalType, setFollowModalType] = useState<'following'|'followers'|'mutual'|null>(null);
  
  const [activeTab, setActiveTab] = useState<'profile' | 'media'>('profile');
  const [mediaTab, setMediaTab] = useState<'videos' | 'podcasts' | 'playlists' | 'liked-videos' | 'liked-podcasts'>('videos');

  const [userVideos, setUserVideos] = useState<any[]>([]);
  const [userPodcasts, setUserPodcasts] = useState<any[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [likedVideos, setLikedVideos] = useState<any[]>([]);
  const [likedPodcasts, setLikedPodcasts] = useState<any[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      
      let targetId = uidParam || user.uid;
      setTargetUid(targetId);
      const selfViewing = targetId === user.uid;
      setIsSelf(selfViewing);
      
      try {
           const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', targetId);
           const publicSnap = await getDoc(publicRef);
           
           let loadedData: any = null;
           if (publicSnap.exists()) {
             loadedData = publicSnap.data();
           } else {
               // Resolution Fallback: Handle Legacy "Custom User ID" deep links
               const fallbackQuery = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'users'), where('userId', '==', targetId));
               const fallbackSnap = await getDocs(fallbackQuery);
               if (!fallbackSnap.empty) {
                   const resolvedDoc = fallbackSnap.docs[0];
                   const realUid = resolvedDoc.id;
                   
                   loadedData = resolvedDoc.data();
                   
                   // Overwrite local trackers with the resolved precise Auth UID
                   targetId = realUid;
                   setTargetUid(realUid);
                   setIsSelf(realUid === user.uid);
               }
           }
           
           let mutuallyFollowing = false;
           
           if (!selfViewing) {
               // Check relationships
               const myFollowingRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'following', targetId);
               const isFowSnap = await getDoc(myFollowingRef);
               const currentlyFollowing = isFowSnap.exists();
               setIsFollowing(currentlyFollowing);
               
               const followerRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'followers', targetId);
               const isFowBackSnap = await getDoc(followerRef);
               const currentlyFollowedBack = isFowBackSnap.exists();
               
               mutuallyFollowing = currentlyFollowing && currentlyFollowedBack;
               setIsMutual(mutuallyFollowing);
           } else {
               setIsMutual(false); // Do not show mutual UI for self
               mutuallyFollowing = true;
           }
           
           // Load private data if mutual, self, covenant, or admin
           let loadPrivData = mutuallyFollowing || loadedData?.membershipRank === 'covenant' || selfViewing;

           // Check Admin Hook
           let myAdmin = false;
           if (selfViewing && (loadedData?.membershipRank === 'admin' || loadedData?.userId === 'admin')) {
               myAdmin = true;
           } else if (!selfViewing && user) {
               const myRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', user.uid);
               const mySnap = await getDoc(myRef);
               if (mySnap.exists() && (mySnap.data().membershipRank === 'admin' || mySnap.data().userId === 'admin')) myAdmin = true;
           }
           
           if (user?.uid === "Zm7FWRopJKVfyzbp8KXXokMFjNC3") myAdmin = true;
           setIsAdmin(myAdmin);
           if (myAdmin) loadPrivData = true;

           if (loadPrivData) {
             const privateRef = doc(db, 'artifacts', APP_ID, 'users', targetId, 'profile', 'data');
             const privateSnap = await getDoc(privateRef);
             if (privateSnap.exists()) {
                 loadedData = { ...(loadedData || {}), ...privateSnap.data() };
             }
           }
           
           setUserData(loadedData);
           
           if (loadedData?.osNumber) {
               const osRef = doc(db, 'artifacts', APP_ID, 'os_blueprints', String(loadedData.osNumber));
               const osSnap = await getDoc(osRef);
               if (osSnap.exists()) {
                   setOsData(osSnap.data());
               }
           }
        
        // Load Counts
        const fowColl = collection(db, 'artifacts', APP_ID, 'users', targetId, 'following');
        const countSnapFow = await getCountFromServer(fowColl);
        setFollowingCount(countSnapFow.data().count);
        
        const flerColl = collection(db, 'artifacts', APP_ID, 'users', targetId, 'followers');
        const countSnapFler = await getCountFromServer(flerColl);
        setFollowersCount(countSnapFler.data().count);
        
      } catch (e) {
        console.error("Error loading profile:", e);
      } finally {
        setLoading(false);
      }
    }
    
    async function loadUserMedia() {
      if (!targetUid) return;
      setMediaLoading(true);
      try {
        const videosRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos');
        const vq = query(videosRef, where('authorId', '==', targetUid));
        const vSnap = await getDocs(vq);
        const videos = vSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        videos.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setUserVideos(videos);

        const podsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts');
        const pq = query(podsRef, where('authorId', '==', targetUid));
        const pSnap = await getDocs(pq);
        const pods = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        pods.sort((a: any, b: any) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime());
        setUserPodcasts(pods);

        const playRef = collection(db, 'artifacts', APP_ID, 'users', targetUid, 'playlists');
        const playSnap = await getDocs(playRef);
        const lists = playSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        lists.sort((a: any, b: any) => (b.updatedAt || b.createdAt || 0) - (a.createdAt || a.updatedAt || 0));
        setUserPlaylists(lists);

        if (user && targetUid === user.uid) {
            const allVidSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'videos'));
            const lvPromises = allVidSnap.docs.map(async (d) => {
                const lSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'videos', d.id, 'likes', user.uid));
                if (lSnap.exists()) return { id: d.id, ...d.data() };
                return null;
            });
            const lvResults = await Promise.all(lvPromises);
            setLikedVideos(lvResults.filter(v => v !== null));

            const allPodSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts'));
            const lpPromises = allPodSnap.docs.map(async (d) => {
                const lSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'podcasts', d.id, 'likes', user.uid));
                if (lSnap.exists()) return { id: d.id, ...d.data() };
                return null;
            });
            const lpResults = await Promise.all(lpPromises);
            setLikedPodcasts(lpResults.filter(p => p !== null));
        }

      } catch (e) {
        console.error("Error loading user media:", e);
      } finally {
        setMediaLoading(false);
      }
    }

    if (user) {
        loadData().then(() => {
            if (targetUid) loadUserMedia();
        });
    }
  }, [user, uidParam, targetUid, mediaRefreshKey]);

  useEffect(() => {
      if (!targetUid) return;
      const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'live_rooms', targetUid);
      const unsub = onSnapshot(roomRef, (snap) => {
          if (snap.exists() && snap.data().status === 'live') {
              setIsLive(true);
          } else {
              setIsLive(false);
          }
      });
      return () => unsub();
  }, [targetUid]);

  const handleRankChange = async (newRank: string) => {
      if (!isAdmin || !targetUid) return;
      if (!confirm(`ユーザーのランクを「${newRank.toUpperCase()}」に変更しますか？`)) return;
      try {
          await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', targetUid), { membershipRank: newRank });
          await setDoc(doc(db, 'artifacts', APP_ID, 'users', targetUid, 'profile', 'data'), { membershipRank: newRank }, { merge: true });
          setUserData({ ...userData, membershipRank: newRank });
          alert('ランクの変更が完了しました');
      } catch (e) {
          console.error(e);
          alert('ランク変更時にエラーが発生しました。');
      }
  };

  const toggleFollow = async () => {
      if (!user || !targetUid || targetUid === user.uid) return;
      
      try {
          const myFollowingRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'following', targetUid);
          const targetFollowerRef = doc(db, 'artifacts', APP_ID, 'users', targetUid, 'followers', user.uid);
          
          if (isFollowing) {
              await deleteDoc(myFollowingRef);
              await deleteDoc(targetFollowerRef);
              setIsFollowing(false);
              setIsMutual(false);
              setFollowersCount(prev => Math.max(0, prev - 1));
          } else {
              const ts = serverTimestamp();
              await setDoc(myFollowingRef, { createdAt: ts });
              await setDoc(targetFollowerRef, { createdAt: ts });
              setIsFollowing(true);
              // Optimistically assuming they might follow you back is handled by the initial load.
              // For a simple toggle, just updating counts
              setFollowersCount(prev => prev + 1);

              // Inject Notification
              try {
                  await addDoc(collection(db, 'artifacts', APP_ID, 'users', targetUid, 'notifications'), {
                      type: 'system',
                      title: '新しい共鳴者',
                      body: `${userData?.name || 'ユーザー'}さんがあなたをフォローしました。`,
                      link: `/p?uid=${user.uid}`,
                      isRead: false,
                      createdAt: Date.now()
                  });
              } catch (err) {
                  console.error("Failed to send notification", err);
              }
          }
      } catch(e) {
          console.error("Follow error", e);
      }
  };

  const copyProfileLink = async () => {
      if (!user) return;
      const url = `${window.location.origin}/p?uid=${user.uid}`;
      try {
          await navigator.clipboard.writeText(url);
          alert('独立した公開用プロフィールリンクをコピーしました！');
      } catch (e) {
          prompt('コピーに失敗しました。以下のURLを手動でコピーしてください：', url);
      }
  };

  if (loading) {
    return <div className="text-center py-20 text-[#a09080] font-bold tracking-widest min-h-[50vh] flex items-center justify-center">Loading...</div>;
  }

  if (!userData) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
          <div className="bg-[#fffdf9] p-8 rounded-sm shadow-md border border-[#e8dfd1] text-center max-w-sm mx-4">
              <UserIcon className="w-12 h-12 text-[#c8b9a6] mx-auto mb-4" />
              <h3 className="text-lg font-bold text-[#3e2723] mb-2 font-serif tracking-widest">ユーザーが見つかりません</h3>
              <p className="text-[#a09080] text-sm mb-6">IDが間違っているか、データが取得できませんでした。</p>
              <Link href="/user" className="inline-block w-full bg-[#3e2723] text-[#f7f5f0] font-bold py-3 rounded-sm hover:bg-[#2a1a17] transition-colors tracking-widest">自分のページに戻る</Link>
          </div>
      </div>
    );
  }

  // OS Cover logic (dummy for now unless osNumber exists)
  const isProfileComplete = (userData.profileScore || 0) >= 100;
  const showOSCover = (isSelf || isMutual) && isProfileComplete && userData.osNumber;
  const osTheme = showOSCover && userData.osJukkan ? OS_THEMES[userData.osJukkan] : OS_THEMES['癸'];

  const rank = userData.membershipRank || 'arrival';
  const hasPlaylistPermission = isSelf && ['guardian', 'covenant', 'admin'].includes(rank);

  return (
    <div className="max-w-7xl mx-auto pt-8 px-0 sm:px-6 lg:px-8 pb-20">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 lg:py-8">
          
          <aside className="w-full lg:w-[360px] flex-shrink-0">
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

                  <div className="px-6 relative">
                      <div className="-mt-12 flex justify-between items-end mb-4 relative">
                          <div className={`h-24 w-24 sm:h-28 sm:w-28 rounded-sm border-[3px] border-[#fffdf9] bg-[#fffdf9] shadow-sm overflow-hidden relative z-20 flex items-center justify-center text-[#c8b9a6] ${isLive ? 'ring-4 ring-red-500 animate-pulse cursor-pointer' : ''}`} onClick={() => isLive && router.push(`/media/live_room?roomId=${targetUid}`)}>
                              {userData.photoURL ? (
                                  <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                  <Anchor size={40} />
                              )}
                              {isLive && (
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                                      <Headphones className="text-white w-8 h-8" />
                                  </div>
                              )}
                          </div>
                          {isLive && (
                              <div className="absolute -bottom-3 left-12 sm:left-14 transform -translate-x-1/2 bg-[#d4af37] text-[#2a1a17] px-3 py-1 rounded-sm text-[10px] font-bold tracking-widest border border-[#b8860b] shadow-md z-30 flex items-center gap-1 whitespace-nowrap cursor-pointer hover:bg-[#b8860b] transition-colors" onClick={() => router.push(`/media/live_room?roomId=${targetUid}`)}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span> LIVE配信中
                              </div>
                          )}
                          <div className="mb-1 relative z-20 flex flex-wrap gap-2 justify-end">
                              {(isSelf || isAdmin) && (
                                  <Link href={`/user/edit${!isSelf ? '?uid='+targetUid : ''}`} className="inline-flex items-center justify-center px-4 py-2 border border-[#b8860b] shadow-sm text-xs font-bold rounded-sm text-[#3e2723] bg-[#fffdf9] hover:bg-[#f7f5f0] transition-colors tracking-widest font-serif">
                                      {isSelf ? '航海録を編集' : '代理編集(Admin)'}
                                  </Link>
                              )}
                              {!isSelf && (
                                  <button onClick={toggleFollow} className={`inline-flex items-center px-4 py-2 ${isFollowing ? 'border border-[#b8860b] text-[#3e2723] bg-[#fffdf9]' : 'border border-transparent bg-[#3e2723] text-[#f7f5f0] hover:bg-[#2a1a17]'} shadow-sm text-xs font-bold rounded-sm transition-colors tracking-widest font-serif`}>
                                      {isFollowing ? 'フォロー中' : 'フォロー'}
                                  </button>
                              )}
                          </div>
                      </div>

                      <div className="mb-4 relative z-20">
                          <h1 className="text-2xl font-bold text-[#3e2723] leading-tight font-serif flex items-center flex-wrap gap-3">
                              <span>{userData.name || userData.userId || '名無し'}</span>
                              {!isSelf && (
                                  <button onClick={() => setIsMemoOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#fffdf9] border border-[#e8dfd1] rounded-sm text-xs font-bold text-[#725b3f] hover:bg-[#f7f5f0] hover:text-[#3e2723] hover:border-[#b8860b] transition-all shadow-sm tracking-widest font-sans" title="自分だけが見られるメモ">
                                      <Key className="text-[#8b6a4f]" size={14} />鍵メモ
                                  </button>
                              )}
                          </h1>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                              <p className="text-sm text-[#8b6a4f] font-mono font-medium tracking-wide">@{userData.userId || 'unknown'}</p>
                              {getRankBadge(rank)}
                              {isAdmin && !isSelf && (
                                  <select value={rank} onChange={(e) => handleRankChange(e.target.value)} className="text-[10px] sm:text-xs border border-[#e8dfd1] bg-[#fffdf9] text-[#3e2723] rounded-sm ml-1 px-1 py-0.5 outline-none font-bold">
                                      <option value="arrival">ARRIVAL</option>
                                      <option value="settler">SETTLER</option>
                                      <option value="builder">BUILDER</option>
                                      <option value="guardian">GUARDIAN</option>
                                      <option value="covenant">COVENANT</option>
                                      <option value="admin">ADMIN</option>
                                  </select>
                              )}
                              {isMutual && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f7f5f0] text-[#725b3f] border border-[#e8dfd1] tracking-widest flex items-center"><Check size={10} className="mr-1"/>相互フォロー</span>}
                          </div>

                          {isSelf && (
                              <div className="mt-4 flex flex-col gap-2">
                                  {['guardian', 'covenant', 'admin'].includes(rank) && (
                                      isLive ? (
                                          <Link href={`/media/live_room?roomId=${user?.uid || ''}`} className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 border border-red-200 rounded-sm text-xs font-bold hover:bg-red-100 transition-all shadow-sm tracking-widest w-full sm:w-auto mt-2">
                                              <SatelliteDish size={16} className="animate-pulse" /> 配信ルームに戻る
                                          </Link>
                                      ) : (
                                          <Link href="/media/podcasts/new?type=live" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-[#2a1a17] border border-[#996515] rounded-sm text-sm font-bold hover:shadow-lg transition-all tracking-widest w-full sm:w-auto transform hover:-translate-y-0.5 mt-2">
                                              <SatelliteDish size={16} className="animate-pulse" /> SIGNAL CAST を配信する
                                          </Link>
                                      )
                                  )}
                                  <button onClick={copyProfileLink} className="inline-flex items-center justify-center gap-2 px-4 py-2 mt-2 bg-[#f7f5f0] border border-[#e8dfd1] text-[#725b3f] rounded-sm text-xs font-bold hover:bg-[#fffdf9] hover:border-[#b8860b] hover:text-[#b8860b] transition-all shadow-sm tracking-widest w-full sm:w-auto">
                                      <Share size={14} /> 自己紹介リンクをコピー
                                  </button>
                              </div>
                          )}
                      </div>
                      
                      <div className={`grid ${isMutual ? 'grid-cols-3' : 'grid-cols-2'} gap-2 py-4 border-t border-[#e8dfd1] relative z-20`}>
                          <button onClick={() => setFollowModalType('following')} className="text-center hover:bg-[#f7f5f0] transition-colors rounded-sm py-1">
                              <span className="block font-bold text-[#3e2723] text-lg font-serif">{followingCount}</span>
                              <span className="text-xs text-[#8b6a4f] font-medium tracking-widest">フォロー中</span>
                          </button>
                          <button onClick={() => setFollowModalType('followers')} className="text-center border-l border-[#e8dfd1] hover:bg-[#f7f5f0] transition-colors rounded-sm py-1">
                              <span className="block font-bold text-[#3e2723] text-lg font-serif">{followersCount}</span>
                              <span className="text-xs text-[#8b6a4f] font-medium tracking-widest">フォロワー</span>
                          </button>
                          {isMutual && (
                              <button onClick={() => setFollowModalType('mutual')} className="text-center border-l border-[#e8dfd1] hover:bg-[#f7f5f0] transition-colors rounded-sm py-1">
                                  <span className="block font-bold text-[#b8860b] text-lg font-serif">-</span>
                                  <span className="text-xs text-[#b8860b] font-medium tracking-widest">共通の航海士</span>
                              </button>
                          )}
                      </div>

                      <div className="py-4 border-t border-[#e8dfd1] relative z-20">
                          <div className="prose prose-sm max-w-none text-[#5c4a3d] leading-relaxed" dangerouslySetInnerHTML={{ __html: formatText(userData.bio) }}></div>
                      </div>

                      <div className="py-4 border-t border-[#e8dfd1] space-y-3 relative z-20">
                          <div className="flex items-center gap-3 text-sm text-[#5c4a3d]">
                              <div className="w-8 h-8 rounded-full bg-[#f7f5f0] flex items-center justify-center text-[#8b6a4f] border border-[#e8dfd1]"><FileText size={14} /></div>
                              <span className="font-medium">{userData.jobTitle || '職業未設定'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-[#5c4a3d]">
                              <div className="w-8 h-8 rounded-full bg-[#f7f5f0] flex items-center justify-center text-[#8b6a4f] border border-[#e8dfd1]"><Compass size={14} /></div>
                              <span className="font-medium">{userData.prefecture || '地域未設定'} {userData.birthplace && `(出身: ${userData.birthplace})`}</span>
                          </div>
                          {(userData.websiteUrl || userData.snsInstagram || userData.snsX) && (
                              <div className="flex gap-3 pt-2">
                                  {userData.websiteUrl && <a href={userData.websiteUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full border border-[#e8dfd1] bg-[#fffdf9] flex items-center justify-center text-[#725b3f] hover:bg-[#f7f5f0] transition-colors shadow-sm"><Globe size={14} /></a>}
                                  {userData.snsInstagram && <a href={userData.snsInstagram.startsWith('http') ? userData.snsInstagram : 'https://instagram.com/'+userData.snsInstagram} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full border border-[#e8dfd1] bg-[#fffdf9] flex items-center justify-center text-[#725b3f] hover:bg-[#f7f5f0] transition-colors shadow-sm"><Instagram size={14} /></a>}
                                  {userData.snsX && <a href={userData.snsX.startsWith('http') ? userData.snsX : 'https://twitter.com/'+userData.snsX} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full border border-[#e8dfd1] bg-[#fffdf9] flex items-center justify-center text-[#725b3f] hover:bg-[#f7f5f0] transition-colors shadow-sm"><Twitter size={14} /></a>}
                              </div>
                          )}
                      </div>

                      {isSelf && (
                          <div className="my-4 relative z-20 pb-4">
                              {isProfileComplete ? (
                                  <div className="mb-4">
                                      <Link href="/diagnostic" className="block w-full bg-gradient-to-r from-[#2a1a17] to-[#3e2723] border border-[#b8860b] text-[#f7f5f0] rounded-sm shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 group relative overflow-hidden">
                                          <div className="absolute inset-0" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=%2220%22 height=%2220%22 viewBox=%220 0 20 20%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Ccircle cx=%222%22 cy=%222%22 r=%221%22 fill=%22%23ffffff%22 fill-opacity=%220.05%22/%3E%3C/svg%3E')" }}></div>
                                          <div className="px-4 py-4 flex items-center justify-between relative z-10">
                                              <div className="flex items-center gap-4">
                                                  <div className="bg-[#d4af37]/20 rounded-full p-3 group-hover:scale-110 transition-transform border border-[#d4af37]/30">
                                                      <Dna className="text-[#d4af37]" size={20} />
                                                  </div>
                                                  <div className="text-left">
                                                      <p className="text-[10px] font-bold text-[#c8b9a6] tracking-widest mb-1 flex items-center gap-1">
                                                          <Unlock size={10} className="text-[#d4af37]" /> PROFILE 100%
                                                      </p>
                                                      <p className="text-sm sm:text-base font-black tracking-widest leading-tight font-serif">魂の設計図 <span className="text-[10px] font-sans text-[#d4af37] border border-[#d4af37] px-1 ml-1 rounded-sm opacity-80">OS</span></p>
                                                  </div>
                                              </div>
                                              <ChevronRight className="text-[#c8b9a6]" size={18} />
                                          </div>
                                      </Link>
                                  </div>
                              ) : (
                                  <div className="mb-4 p-4 bg-[#f7f5f0] border border-[#e8dfd1] rounded-sm relative z-20">
                                      <div className="flex justify-between items-center mb-2">
                                          <span className="text-xs font-bold text-[#8b6a4f] tracking-widest">プロフィール充実度</span>
                                          <span className="text-sm font-bold text-[#725b3f]">{userData.profileScore || 0}%</span>
                                      </div>
                                      <div className="w-full bg-[#e8dfd1] h-1.5 rounded-full overflow-hidden">
                                          <div className="bg-[#8b6a4f] h-1.5 transition-all duration-1000 ease-out" style={{ width: `${userData.profileScore || 0}%` }}></div>
                                      </div>
                                  </div>
                              )}

                              {rank !== 'covenant' && (
                                  <div className="mt-4">
                                      <Link href="/upgrade" className="block w-full bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-[#2a1a17] border border-[#996515] rounded-sm shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 group">
                                          <div className="px-3 py-2.5 flex items-center justify-between">
                                              <div className="flex items-center gap-3">
                                                  <div className="bg-[#fffdf9]/30 rounded-full p-1.5 group-hover:scale-110 transition-transform">
                                                      <ShieldHalf size={16} className="text-[#2a1a17]" />
                                                  </div>
                                                  <div className="text-left">
                                                      <p className="text-[9px] font-bold text-[#2a1a17]/80 leading-tight tracking-widest">機能制限を解除</p>
                                                      <p className="text-xs font-black tracking-widest leading-tight mt-0.5 font-serif">契約をアップグレード</p>
                                                  </div>
                                              </div>
                                              <ChevronRight size={14} className="text-[#2a1a17]/80" />
                                          </div>
                                      </Link>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          </aside>

          <div className="flex-1 min-w-0 mt-6 lg:mt-0">
              
              <div className="mb-6 border-b border-[#e8dfd1] px-4 sm:px-0">
                  <div className="flex justify-center sm:justify-start gap-6">
                      <button onClick={() => setActiveTab('profile')} className={`pb-3 border-b-[3px] font-bold tracking-widest text-sm transition-colors ${activeTab === 'profile' ? 'border-[#b8860b] text-[#b8860b]' : 'border-transparent text-[#a09080] hover:text-[#725b3f]'}`}>航海録 (プロフィール)</button>
                      <button onClick={() => setActiveTab('media')} className={`pb-3 border-b-[3px] font-bold tracking-widest text-sm transition-colors ${activeTab === 'media' ? 'border-[#b8860b] text-[#b8860b]' : 'border-transparent text-[#a09080] hover:text-[#725b3f]'}`}>MEDIA LOG</button>
                  </div>
              </div>

              {activeTab === 'profile' ? (
                  <div className="space-y-6 px-4 sm:px-0">
                      
                      {/* Message Section */}
                      <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-[#e8dfd1] p-6 sm:p-8 relative overflow-hidden">
                          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e8dfd1]">
                              <h2 className="text-lg font-bold text-[#3e2723] flex items-center gap-2 font-serif tracking-widest">想い・メッセージ</h2>
                              {(!isMutual && !isSelf) && <Lock className="text-[#c8b9a6] w-4 h-4 text-xs" />}
                          </div>
                          {(isMutual || isSelf) ? (
                              <div className="relative mt-6">
                                  <div className="relative z-10 prose prose-sm max-w-none text-[#5c4a3d]" dangerouslySetInnerHTML={{ __html: formatText(userData.message) }}></div>
                              </div>
                          ) : (
                              <div className="py-8 bg-[#f7f5f0] border border-dashed border-[#e8dfd1] text-center mt-4 rounded-sm">
                                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#fffdf9] border border-[#e8dfd1] mb-3 shadow-sm"><Lock className="text-[#c8b9a6]" /></div>
                                  <p className="text-sm font-bold text-[#8b6a4f] tracking-widest">詳細は相互フォローで公開</p>
                              </div>
                          )}
                      </div>

                      {/* Matching Section */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-[#fffdf9] rounded-sm p-6 border border-[#e8dfd1] shadow-md relative overflow-hidden group hover:border-[#b8860b]/50 transition-colors">
                              <h3 className="text-sm font-bold text-[#725b3f] mb-4 tracking-widest font-serif relative z-10 border-b border-[#e8dfd1] pb-2">提供できること</h3>
                              <ul className="space-y-3 relative z-10">
                                  {userData.canOffer?.length > 0 ? (
                                      userData.canOffer.map((item: string, idx: number) => (
                                          <li key={idx} className="text-[#5c4a3d] text-sm flex items-start gap-2"><Check className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0"/>{item}</li>
                                      ))
                                  ) : <li className="text-[#c8b9a6] italic text-sm">未設定</li>}
                              </ul>
                          </div>
                          <div className="bg-[#fffdf9] rounded-sm p-6 border border-[#e8dfd1] shadow-md relative overflow-hidden group hover:border-[#b8860b]/50 transition-colors">
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
                      
                      {/* Goals Section */}
                      <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-[#e8dfd1] p-6 relative overflow-hidden">
                          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e8dfd1]">
                              <h2 className="text-lg font-bold text-[#3e2723] font-serif tracking-widest">目標・ビジョン</h2>
                              {(!isMutual && !isSelf) && <Lock className="text-[#c8b9a6] w-4 h-4 text-xs" />}
                          </div>
                          {(isMutual || isSelf) ? (
                              <div className="relative mt-2">
                                  <div className="prose max-w-none text-[#5c4a3d]" dangerouslySetInnerHTML={{ __html: formatText(userData.goals) }}></div>
                              </div>
                          ) : (
                              <div className="py-8 bg-[#f7f5f0] border border-dashed border-[#e8dfd1] text-center mt-4 rounded-sm">
                                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#fffdf9] border border-[#e8dfd1] mb-3 shadow-sm"><Lock className="text-[#c8b9a6]" /></div>
                                  <p className="text-sm font-bold text-[#8b6a4f] tracking-widest">詳細は相互フォローで公開</p>
                              </div>
                          )}
                      </div>

                      {/* Skills & Hobbies Section */}
                      {((userData.skills && userData.skills.length > 0) || (userData.hobbies && userData.hobbies.length > 0)) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="bg-[#fffdf9] rounded-sm p-6 border border-[#e8dfd1] shadow-md">
                                  <h3 className="text-sm font-bold text-[#725b3f] mb-4 tracking-widest font-serif border-b border-[#e8dfd1] pb-2">スキル</h3>
                                  <div className="flex flex-wrap gap-2">
                                      {userData.skills && userData.skills.length > 0 ? (Array.isArray(userData.skills) ? userData.skills : [userData.skills]).map((tag: string, i: number) => (
                                          <span key={i} className="bg-[#f7f5f0] border border-[#e8dfd1] text-[#8b6a4f] px-3 py-1 rounded-sm text-xs font-bold tracking-widest shadow-sm">#{tag}</span>
                                      )) : <span className="text-sm text-[#c8b9a6] italic">未設定</span>}
                                  </div>
                              </div>
                              <div className="bg-[#fffdf9] rounded-sm p-6 border border-[#e8dfd1] shadow-md">
                                  <h3 className="text-sm font-bold text-[#725b3f] mb-4 tracking-widest font-serif border-b border-[#e8dfd1] pb-2">趣味</h3>
                                  <div className="flex flex-wrap gap-2">
                                      {userData.hobbies && userData.hobbies.length > 0 ? (Array.isArray(userData.hobbies) ? userData.hobbies : [userData.hobbies]).map((tag: string, i: number) => (
                                          <span key={i} className="bg-[#f7f5f0] border border-[#e8dfd1] text-[#8b6a4f] px-3 py-1 rounded-sm text-xs font-bold tracking-widest shadow-sm">#{tag}</span>
                                      )) : <span className="text-sm text-[#c8b9a6] italic">未設定</span>}
                                  </div>
                              </div>
                          </div>
                      )}

                      {/* Career Section */}
                      {userData.career && Array.isArray(userData.career) && userData.career.length > 0 && (
                          <div className="bg-[#fffdf9] sm:rounded-sm shadow-md border border-[#e8dfd1] p-6 sm:p-8 relative">
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
                                          <div className="prose max-w-none prose-stone text-[#5c4a3d] bg-[#fdfaf5] p-4 rounded-sm border border-[#e8dfd1] shadow-sm" dangerouslySetInnerHTML={{ __html: formatText(c.description || '') }}></div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                  </div>
              ) : (
                  <div className="space-y-6 px-4 sm:px-0">
                      <div className="mb-6">
                          <div className="flex flex-wrap gap-2">
                              <button onClick={() => setMediaTab('videos')} className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest transition-all ${mediaTab === 'videos' ? 'bg-[#b8860b] text-[#fffdf9] shadow-md border border-[#b8860b]' : 'bg-[#fffdf9] text-[#725b3f] hover:bg-[#f7f5f0] border border-[#e8dfd1]'}`}>
                                  動画 ({userVideos.length})
                              </button>
                              <button onClick={() => setMediaTab('podcasts')} className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest transition-all ${mediaTab === 'podcasts' ? 'bg-[#b8860b] text-[#fffdf9] shadow-md border border-[#b8860b]' : 'bg-[#fffdf9] text-[#725b3f] hover:bg-[#f7f5f0] border border-[#e8dfd1]'}`}>
                                  音声 ({userPodcasts.length})
                              </button>
                              <button onClick={() => setMediaTab('playlists')} className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest transition-all ${mediaTab === 'playlists' ? 'bg-[#b8860b] text-[#fffdf9] shadow-md border border-[#b8860b]' : 'bg-[#fffdf9] text-[#725b3f] hover:bg-[#f7f5f0] border border-[#e8dfd1]'}`}>
                                  プレイリスト ({userPlaylists.length})
                              </button>
                              {isSelf && (
                                  <>
                                      <button onClick={() => setMediaTab('liked-videos')} className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest transition-all flex items-center gap-1 ${mediaTab === 'liked-videos' ? 'bg-[#b8860b] text-[#fffdf9] shadow-md border border-[#b8860b]' : 'bg-[#fffdf9] text-[#725b3f] hover:bg-[#f7f5f0] border border-[#e8dfd1]'}`}>
                                          お気に入り(動画) <Lock size={12} className="opacity-70" />
                                      </button>
                                      <button onClick={() => setMediaTab('liked-podcasts')} className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest transition-all flex items-center gap-1 ${mediaTab === 'liked-podcasts' ? 'bg-[#b8860b] text-[#fffdf9] shadow-md border border-[#b8860b]' : 'bg-[#fffdf9] text-[#725b3f] hover:bg-[#f7f5f0] border border-[#e8dfd1]'}`}>
                                          お気に入り(音声) <Lock size={12} className="opacity-70" />
                                      </button>
                                  </>
                              )}
                          </div>
                      </div>

                      {mediaLoading ? (
                          <div className="col-span-full text-center py-20 text-[#a09080] font-bold tracking-widest text-sm">読み込み中...</div>
                      ) : (
                          <>
                              {(mediaTab === 'videos' || mediaTab === 'liked-videos') && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6 pb-12">
                                      {mediaTab === 'videos' && userVideos.length === 0 && (
                                          <div className="col-span-full flex flex-col items-center justify-center text-[#a09080] py-20 bg-[#fffdf9] rounded-sm border border-dashed border-[#e8dfd1]">
                                              <Play className="text-4xl mb-3 text-[#e8dfd1]" size={40} />
                                              <p className="font-bold tracking-widest text-sm">投稿された動画はありません。</p>
                                          </div>
                                      )}
                                      {mediaTab === 'liked-videos' && likedVideos.length === 0 && (
                                          <div className="col-span-full flex flex-col items-center justify-center text-[#a09080] py-20 bg-[#fffdf9] rounded-sm border border-dashed border-[#e8dfd1]">
                                              <Play className="text-4xl mb-3 text-[#e8dfd1]" size={40} />
                                              <p className="font-bold tracking-widest text-sm">お気に入りした動画はありません。</p>
                                          </div>
                                      )}
                                      {(mediaTab === 'videos' ? userVideos : likedVideos).map((v: any) => (
                                          <Link href={`/media/videos/detail?id=${v.id}`} key={v.id} className="flex flex-col group cursor-pointer bg-[#fffdf9] rounded-sm overflow-hidden border border-[#e8dfd1] shadow-sm hover:shadow-md hover:border-[#b8860b] transition-all w-full h-full">
                                              <div className="relative w-full aspect-video bg-[#000] overflow-hidden border-b border-[#e8dfd1]">
                                                  <img src={v.thumbnailUrl || 'https://via.placeholder.com/640x360?text=No+Image'} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                  <div className="absolute inset-0 bg-black/30 opacity-0 transition-all duration-300 flex items-center justify-center group-hover:opacity-100">
                                                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/50 transition-transform duration-300 group-hover:scale-110">
                                                          <Play className="text-white text-lg ml-1 border-white" fill="white" />
                                                      </div>
                                                  </div>
                                              </div>
                                              <div className="p-4 flex gap-3 flex-1">
                                                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                      <div>
                                                          <h3 className="text-sm font-bold text-[#3e2723] leading-snug line-clamp-2 mb-1.5 group-hover:text-[#b8860b] transition-colors font-serif tracking-wide">{v.title || 'タイトルなし'}</h3>
                                                      </div>
                                                      <p className="text-[9px] text-[#a09080] font-mono tracking-widest">{new Date(v.createdAt).toLocaleDateString()}</p>
                                                  </div>
                                              </div>
                                          </Link>
                                      ))}
                                  </div>
                              )}

                              {(mediaTab === 'podcasts' || mediaTab === 'liked-podcasts') && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6 pb-12">
                                      {mediaTab === 'podcasts' && userPodcasts.length === 0 && (
                                          <div className="col-span-full flex flex-col items-center justify-center text-[#a09080] py-20 bg-[#fffdf9] rounded-sm border border-dashed border-[#e8dfd1]">
                                              <Play className="text-4xl mb-3 text-[#e8dfd1]" size={40} />
                                              <p className="font-bold tracking-widest text-sm">投稿された音声はありません。</p>
                                          </div>
                                      )}
                                      {mediaTab === 'liked-podcasts' && likedPodcasts.length === 0 && (
                                          <div className="col-span-full flex flex-col items-center justify-center text-[#a09080] py-20 bg-[#fffdf9] rounded-sm border border-dashed border-[#e8dfd1]">
                                              <Play className="text-4xl mb-3 text-[#e8dfd1]" size={40} />
                                              <p className="font-bold tracking-widest text-sm">お気に入りした音声はありません。</p>
                                          </div>
                                      )}
                                      {(mediaTab === 'podcasts' ? userPodcasts : likedPodcasts).map((p: any) => {
                                          const plainDesc = p.description ? p.description.replace(/[#*`\->]/g, '').trim() : '説明がありません';
                                          const dateStr = new Date(p.createdAt || p.updatedAt || Date.now()).toLocaleDateString();
                                          return (
                                              <Link href={`/media/podcasts/detail?id=${p.id}`} key={p.id} className="flex flex-col bg-[#fffdf9] p-4 rounded-md border border-[#e8dfd1] shadow-sm hover:shadow-md transition-all hover:border-[#b8860b]/50 group w-full h-full">
                                                  <div className="flex gap-3 sm:gap-4 items-start mb-3">
                                                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-md bg-[#1a110f] overflow-hidden flex-shrink-0 border border-[#e8dfd1] relative shadow-inner mt-0.5">
                                                          <img src={p.thumbnailUrl || 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=640&auto=format&fit=crop'} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" />
                                                          <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors">
                                                              <Play className="text-white/90 text-xl shadow-sm drop-shadow-md group-hover:scale-110 transition-transform" fill="white" />
                                                          </div>
                                                      </div>
                                                      <div className="flex-1 min-w-0 flex flex-col justify-center h-14 sm:h-16">
                                                          <h3 className="text-sm sm:text-base font-bold text-[#3e2723] leading-snug line-clamp-2 font-serif group-hover:text-[#b8860b] transition-colors m-0 tracking-wide">{p.title || 'タイトルなし'}</h3>
                                                      </div>
                                                  </div>
                                                  
                                                  <p className="text-[11px] sm:text-xs text-[#8b6a4f] line-clamp-2 leading-relaxed mb-4 flex-1 tracking-wide">{plainDesc}</p>
                                                  
                                                  <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-[#e8dfd1]/70">
                                                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                                          <img src={p.authorIcon || 'https://via.placeholder.com/24?text=U'} className="w-5 h-5 rounded-full border border-[#e8dfd1] object-cover flex-shrink-0 shadow-sm" alt={p.authorName} />
                                                          <span className="text-[10px] text-[#725b3f] truncate font-bold tracking-widest">{p.authorName || '名無し'}</span>
                                                      </div>
                                                      <div className="flex items-center gap-2 shrink-0">
                                                          <span className="text-[9px] text-[#a09080] font-mono">{dateStr}</span>
                                                      </div>
                                                  </div>
                                              </Link>
                                          );
                                      })}
                                  </div>
                              )}

                              {mediaTab === 'playlists' && (
                                  <>
                                      {hasPlaylistPermission && (
                                          <div className="flex justify-end mb-4 animate-fade-in-up">
                                              <button onClick={() => { setEditingPlaylistId(null); setIsPlaylistModalOpen(true); }} className="px-4 py-2 bg-[#3e2723] hover:bg-[#2a1a17] text-[#d4af37] border border-[#b8860b] rounded-sm text-xs font-bold shadow-md tracking-widest transition-colors flex items-center gap-1.5">
                                                  <Plus size={14} /> プレイリスト作成
                                              </button>
                                          </div>
                                      )}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
                                          {userPlaylists.length === 0 ? (
                                              <div className="col-span-full py-20 bg-[#fffdf9] rounded-sm border border-dashed border-[#e8dfd1] flex flex-col items-center justify-center">
                                                  <FileText className="text-[#e8dfd1] w-12 h-12 mb-3" />
                                                  <p className="text-[#a09080] text-sm font-bold tracking-widest">プレイリストはまだありません</p>
                                              </div>
                                          ) : (
                                              userPlaylists.map(pl => (
                                                  <div key={pl.id} onClick={() => { setViewingPlaylist(pl); setIsPlaylistDetailOpen(true); }} className="bg-[#fffdf9] p-3 sm:p-4 rounded-sm border border-[#e8dfd1] shadow-sm hover:border-[#b8860b]/50 hover:shadow-md transition-all group cursor-pointer flex flex-col h-full">
                                                      <div className="w-full aspect-video bg-[#f0ebdd] relative overflow-hidden rounded-sm mb-3 border border-[#e8dfd1]/50 group-hover:border-[#b8860b]/30">
                                                          {pl.coverImageUrl ? (
                                                              <img src={pl.coverImageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                          ) : (
                                                              <div className="absolute inset-0 flex items-center justify-center group-hover:bg-[#e8dfd1] transition-colors">
                                                                  <FileText className="text-[#c8b9a6] w-8 h-8" />
                                                              </div>
                                                          )}
                                                          
                                                          {/* YouTube style right overlay */}
                                                          <div className="absolute top-0 right-0 bottom-0 w-1/3 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white transition-all group-hover:bg-black/70">
                                                              <span className="font-bold font-mono text-sm sm:text-base">{pl.items?.length || 0}</span>
                                                              <List size={16} className="mt-1 opacity-80" />
                                                          </div>
                                                          
                                                          {/* Play all overlay on hover */}
                                                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                              <div className="w-10 h-10 bg-[#b8860b] rounded-full flex items-center justify-center text-white shadow-lg transform scale-90 group-hover:scale-100 transition-all">
                                                                  <Play size={18} className="ml-1" fill="white" />
                                                              </div>
                                                          </div>
                                                      </div>
                                                      <h3 className="font-bold text-[#3e2723] text-sm line-clamp-2 leading-snug group-hover:text-[#b8860b] transition-colors">{pl.name}</h3>
                                                  </div>
                                              ))
                                          )}
                                      </div>
                                  </>
                              )}
                          </>
                      )}
                  </div>
              )}
          </div>
      </div>

      <FollowModal 
          isOpen={followModalType !== null} 
          onClose={() => setFollowModalType(null)} 
          type={followModalType} 
          targetUid={targetUid || user?.uid || ''} 
          myUid={user?.uid} 
      />

      {isMemoOpen && !isSelf && targetUid && user && (
          <KeyMemoModal 
              isOpen={isMemoOpen}
              onClose={() => setIsMemoOpen(false)}
              currentUserId={user.uid}
              targetUserId={targetUid}
              targetUserName={userData.name || '名無し'}
          />
      )}

      {isSelf && user && (
          <PlaylistModal
              isOpen={isPlaylistModalOpen}
              onClose={() => setIsPlaylistModalOpen(false)}
              userId={user.uid}
              playlistId={editingPlaylistId}
              onSaved={() => {
                  setMediaRefreshKey(k => k + 1);
              }}
          />
      )}

      <PlaylistDetailModal
          isOpen={isPlaylistDetailOpen}
          onClose={() => setIsPlaylistDetailOpen(false)}
          playlist={viewingPlaylist}
          canEdit={hasPlaylistPermission && viewingPlaylist?.authorId === user?.uid}
          onEdit={() => {
              setEditingPlaylistId(viewingPlaylist?.id || null);
              setIsPlaylistDetailOpen(false);
              setIsPlaylistModalOpen(true);
          }}
      />
    </div>
  );
}

export default function UserPage() {
  return (
    <div className="min-h-screen bg-texture">
      <Navbar />
      
      <div className="pt-16">
          <Suspense fallback={<div className="text-center py-20 text-[#a09080] font-bold tracking-widest">Loading...</div>}>
              <UserProfileContent />
          </Suspense>
      </div>
    </div>
  );
}
