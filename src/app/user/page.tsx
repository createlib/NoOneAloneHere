'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db, APP_ID } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, getCountFromServer, query, where, setDoc, deleteDoc, serverTimestamp, addDoc, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { Anchor, Ship, Hourglass, Compass, User as UserIcon, Bell, Settings, Lock, Share, Image as ImageIcon, ChevronRight, Dna, FileText, Check, ShieldHalf, Key, Play, CheckCircle2, MapPin } from 'lucide-react';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import FollowModal from '@/components/FollowModal';

import { marked } from 'marked';
import DOMPurify from 'dompurify';

function formatText(text: string) {
  if (!text) return '';
  const html = marked.parse(text) as string;
  // Fallback if window is undefined (SSR)
  if (typeof window === 'undefined') {
      return html;
  }
  return DOMPurify.sanitize(html);
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

// Extracted Profile Content Component to use useSearchParams inside Suspense
function UserProfileContent() {
  const searchParams = useSearchParams();
  const uidParam = searchParams.get('uid');
  const { user } = useAuth();
  
  const [targetUid, setTargetUid] = useState<string | null>(null);
  const [isSelf, setIsSelf] = useState<boolean>(true);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
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
      
      const targetId = uidParam || user.uid;
      setTargetUid(targetId);
      const selfViewing = targetId === user.uid;
      setIsSelf(selfViewing);
      
      try {
           const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', targetId);
           const publicSnap = await getDoc(publicRef);
           
           let loadedData: any = null;
           if (publicSnap.exists()) {
             loadedData = publicSnap.data();
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
               setIsMutual(true); // Self is always "mutual" in terms of permissions
               mutuallyFollowing = true;
           }
           
           // Load private data if mutual, self, or covenant
           if (mutuallyFollowing || loadedData?.membershipRank === 'covenant' || selfViewing) {
             const privateRef = doc(db, 'artifacts', APP_ID, 'users', targetId, 'profile', 'data');
             const privateSnap = await getDoc(privateRef);
             if (privateSnap.exists()) {
                 loadedData = { ...(loadedData || {}), ...privateSnap.data() };
             }
           }
           
           setUserData(loadedData);
        
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
  }, [user, uidParam, targetUid]);

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
          }
      } catch(e) {
          console.error("Follow error", e);
      }
  };

  const copyProfileLink = async () => {
      if (!user) return;
      const url = `${window.location.origin}/user?uid=${user.uid}`;
      try {
          await navigator.clipboard.writeText(url);
          alert('自己紹介用リンクをコピーしました！');
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
                                    <div className="text-[10px] sm:text-xs tracking-[0.4em] font-bold mb-0.5 drop-shadow-md" style={{ color: osTheme.sub }}>{userData.osRuby || 'GENBAN'}</div>
                                    <div className="text-3xl sm:text-4xl font-bold tracking-[0.15em] font-serif pl-2 text-white" style={{ textShadow: `0 0 15px ${osTheme.main}` }}>{userData.osKanji || '玄盤'}</div>
                                </div>
                            </>
                        )}
                  </div>

                  <div className="px-6 relative">
                      <div className="-mt-12 flex justify-between items-end mb-4">
                          <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-sm border-[3px] border-[#fffdf9] bg-[#fffdf9] shadow-sm overflow-hidden relative z-20 flex items-center justify-center text-[#c8b9a6]">
                              {userData.photoURL ? (
                                  <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                  <Anchor size={40} />
                              )}
                          </div>
                          <div className="mb-1 relative z-20">
                              {isSelf ? (
                                  <div className="flex flex-col items-end gap-1 w-full lg:w-auto">
                                      <Link href="/user/edit" className="inline-flex items-center justify-center px-4 py-2 border border-[#b8860b] shadow-sm text-xs font-bold rounded-sm text-[#3e2723] bg-[#fffdf9] hover:bg-[#f7f5f0] transition-colors tracking-widest font-serif">
                                          航海録を編集
                                      </Link>
                                  </div>
                              ) : (
                                  <button onClick={toggleFollow} className={`inline-flex items-center px-4 py-2 ${isFollowing ? 'border border-[#b8860b] text-[#3e2723] bg-[#fffdf9]' : 'border border-transparent bg-[#3e2723] text-[#f7f5f0] hover:bg-[#2a1a17]'} shadow-sm text-xs font-bold rounded-sm transition-colors tracking-widest font-serif`}>
                                      {isFollowing ? 'フォロー中' : 'フォロー'}
                                  </button>
                              )}
                          </div>
                      </div>

                      <div className="mb-4 relative z-20">
                          <h1 className="text-2xl font-bold text-[#3e2723] leading-tight font-serif flex items-center flex-wrap gap-3">
                              <span>{userData.name || userData.userId || '名無し'}</span>
                          </h1>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                              <p className="text-sm text-[#8b6a4f] font-mono font-medium tracking-wide">@{userData.userId || 'unknown'}</p>
                              {rank === 'covenant' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d4af37]/20 text-[#8b6508] border border-[#d4af37]/50 tracking-widest"><ShieldHalf size={10} className="mr-1"/>COVENANT</span>}
                              {isMutual && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f7f5f0] text-[#725b3f] border border-[#e8dfd1] tracking-widest flex items-center"><Check size={10} className="mr-1"/>相互フォロー</span>}
                          </div>

                          {isSelf && (
                              <div className="mt-4">
                                  <button onClick={copyProfileLink} className="inline-flex items-center gap-2 px-4 py-2 bg-[#f7f5f0] border border-[#e8dfd1] text-[#725b3f] rounded-sm text-xs font-bold hover:bg-[#fffdf9] hover:border-[#b8860b] hover:text-[#b8860b] transition-all shadow-sm tracking-widest">
                                      <Share size={14} /> 自己紹介リンクをコピー
                                  </button>
                              </div>
                          )}
                      </div>
                      
                      <div className={`grid ${isMutual || isSelf ? 'grid-cols-3' : 'grid-cols-2'} gap-2 py-4 border-t border-[#e8dfd1] relative z-20`}>
                          <button onClick={() => setFollowModalType('following')} className="text-center hover:bg-[#f7f5f0] transition-colors rounded-sm py-1">
                              <span className="block font-bold text-[#3e2723] text-lg font-serif">{followingCount}</span>
                              <span className="text-xs text-[#8b6a4f] font-medium tracking-widest">フォロー中</span>
                          </button>
                          <button onClick={() => setFollowModalType('followers')} className="text-center border-l border-[#e8dfd1] hover:bg-[#f7f5f0] transition-colors rounded-sm py-1">
                              <span className="block font-bold text-[#3e2723] text-lg font-serif">{followersCount}</span>
                              <span className="text-xs text-[#8b6a4f] font-medium tracking-widest">フォロワー</span>
                          </button>
                          {(isMutual || isSelf) && (
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
                      </div>
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
                                  {userData.offeringItems?.length > 0 ? (
                                      userData.offeringItems.map((item: string, idx: number) => (
                                          <li key={idx} className="text-[#5c4a3d] text-sm flex items-start gap-2"><Check className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0"/>{item}</li>
                                      ))
                                  ) : <li className="text-[#c8b9a6] italic text-sm">未設定</li>}
                              </ul>
                          </div>
                          <div className="bg-[#fffdf9] rounded-sm p-6 border border-[#e8dfd1] shadow-md relative overflow-hidden group hover:border-[#b8860b]/50 transition-colors">
                              <h3 className="text-sm font-bold text-[#725b3f] mb-4 tracking-widest font-serif relative z-10 border-b border-[#e8dfd1] pb-2">求めていること</h3>
                              <ul className="space-y-3 relative z-10">
                                  {userData.lookingForItems?.length > 0 ? (
                                      userData.lookingForItems.map((item: string, idx: number) => (
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
                                  <div className="prose prose-sm max-w-none text-[#5c4a3d]" dangerouslySetInnerHTML={{ __html: formatText(userData.goals) }}></div>
                              </div>
                          ) : (
                              <div className="py-8 bg-[#f7f5f0] border border-dashed border-[#e8dfd1] text-center mt-4 rounded-sm">
                                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#fffdf9] border border-[#e8dfd1] mb-3 shadow-sm"><Lock className="text-[#c8b9a6]" /></div>
                                  <p className="text-sm font-bold text-[#8b6a4f] tracking-widest">詳細は相互フォローで公開</p>
                              </div>
                          )}
                      </div>

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
                                          <Link href={`/media/videos/${v.id}`} key={v.id} className="flex flex-col group cursor-pointer bg-[#fffdf9] rounded-sm overflow-hidden border border-[#e8dfd1] shadow-sm hover:shadow-md hover:border-[#b8860b] transition-all w-full h-full">
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
                                              <Link href={`/media/podcasts/${p.id}`} key={p.id} className="flex flex-col bg-[#fffdf9] p-4 rounded-md border border-[#e8dfd1] shadow-sm hover:shadow-md transition-all hover:border-[#b8860b]/50 group w-full h-full">
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
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
                                      {userPlaylists.length === 0 ? (
                                          <div className="col-span-full py-20 bg-[#fffdf9] rounded-sm border border-dashed border-[#e8dfd1] flex flex-col items-center justify-center">
                                              <FileText className="text-[#e8dfd1] w-12 h-12 mb-3" />
                                              <p className="text-[#a09080] text-sm font-bold tracking-widest">プレイリストはまだありません</p>
                                          </div>
                                      ) : (
                                          userPlaylists.map(pl => (
                                              <div key={pl.id} className="bg-[#fffdf9] p-4 rounded-sm border border-[#e8dfd1] shadow-sm hover:border-[#b8860b]/50 transition-colors group cursor-not-allowed">
                                                  {pl.coverImageUrl ? (
                                                      <img src={pl.coverImageUrl} className="w-full aspect-video object-cover rounded-sm mb-3 group-hover:opacity-90 transition-opacity" />
                                                  ) : (
                                                      <div className="w-full aspect-video bg-[#f0ebdd] flex items-center justify-center rounded-sm mb-3 border border-[#e8dfd1]/50 group-hover:bg-[#e8dfd1] transition-colors">
                                                          <FileText className="text-[#c8b9a6] w-8 h-8" />
                                                      </div>
                                                  )}
                                                  <h3 className="font-bold text-[#3e2723] truncate group-hover:text-[#b8860b] transition-colors">{pl.name}</h3>
                                                  <p className="text-xs text-[#a09080] mt-1 font-mono">{pl.items?.length || 0} ITEMS</p>
                                              </div>
                                          ))
                                      )}
                                  </div>
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

      <Footer />
    </div>
  );
}
