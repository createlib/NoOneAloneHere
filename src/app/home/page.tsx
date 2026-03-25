'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, APP_ID } from '@/lib/firebase';
import { doc, getDoc, collection, query, getDocs, where, Timestamp, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { Compass, Link as LinkIcon, Users, CalendarCheck, List, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Crown, ShieldHalf, ArrowRight, Anchor, MapPin, Clock, User as UserIcon, AlignLeft, X } from 'lucide-react';
import Navbar from '@/components/Navbar';
import EventDetailSheet from '@/components/EventDetailSheet';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();
  
  const [myProfile, setMyProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hostingEvents, setHostingEvents] = useState<any[]>([]);
  const [participatingEvents, setParticipatingEvents] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [eventJoinStatusMap, setEventJoinStatusMap] = useState<Record<string, boolean>>({});
  const [userData, setUserData] = useState<any>(null);

  const [isReferralsModalOpen, setIsReferralsModalOpen] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (!user || loading) return;

    let unsubHost: (() => void) | null = null;
    let unsubJoin: (() => void) | null = null;

      const fetchData = async () => {
        setDataLoading(true);

        const myProfileRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data');
        getDoc(myProfileRef).then(snap => {
            if(snap.exists()) {
                setUserData(snap.data());
                setIsAdmin(snap.data().userId === 'admin');
            }
        });

        const joinRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'participating_events');
        getDocs(joinRef).then(snap => {
            const smap: Record<string, boolean> = {};
            snap.forEach(d => smap[d.id] = true);
            setEventJoinStatusMap(smap);
        });
      try {
        // Fetch Profile
        let profileUserId = user.uid;
        const docSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'));
        if (docSnap.exists()) {
          const profileData = docSnap.data();
          profileUserId = profileData.userId;
          setMyProfile(profileData);
          if (profileData.userId === 'admin') setIsAdmin(true);
        } else {
          setMyProfile({ name: 'User', userId: user.uid });
        }

        const now = new Date().toISOString();

        // Fetch Hosting Events using onSnapshot to bypass Next.js Router Cache
        const eventsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'events');
        unsubHost = onSnapshot(eventsRef, (snapHost) => {
            let hostEvents: any[] = [];
            snapHost.forEach(d => {
                const evt = d.data();
                if (!evt.endTimestamp || evt.endTimestamp >= now) {
                    const isHost = evt.organizerId === user.uid || evt.organizerId === profileUserId || evt.authorId === user.uid;
                    if (isHost) {
                        hostEvents.push({ id: d.id, ...evt });
                    }
                }
            });

            hostEvents.sort((a: any,b: any) => {
                const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return tB - tA;
            });
            setHostingEvents(hostEvents);
            setDataLoading(false);
        }, (err) => {
            console.error("Home Hosting Fetch Error:", err);
            setDataLoading(false);
        });

        // Fetch Participating Events via legacy subcollection using onSnapshot
        const myJoinColl = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'participating_events');
        unsubJoin = onSnapshot(myJoinColl, async (snapJoin) => {
            const eventPromises = snapJoin.docs.map(async (joinDoc) => {
                const eventId = joinDoc.id; 
                try {
                    const evtRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', eventId);
                    const evtSnap = await getDoc(evtRef);
                    if (evtSnap.exists()) {
                        return { id: evtSnap.id, ...evtSnap.data() };
                    }
                } catch (e) { }
                return null; 
            });

            const allJoinedEvents = (await Promise.all(eventPromises)).filter(e => e !== null);
            let joinedEvents = allJoinedEvents.filter((evt: any) => !evt.endTimestamp || evt.endTimestamp >= now);

            joinedEvents.sort((a: any,b: any) => {
                const dateA = new Date(a.startDate).getTime() || 0;
                const dateB = new Date(b.startDate).getTime() || 0;
                return dateA - dateB;
            });

            setParticipatingEvents(joinedEvents);
        });

      } catch (err) {
        console.error("Home Data Fetch Error:", err);
        setDataLoading(false);
      }
    };

    fetchData();

    return () => {
        if (unsubHost) unsubHost();
        if (unsubJoin) unsubJoin();
    };
  }, [user, loading]);

  const copyInviteLink = () => {
    if (!myProfile || !myProfile.userId) return alert('ユーザーIDが取得できませんでした');
    const userName = myProfile.name || myProfile.userId;
    const inviteText = `${userName}さんからNOAHに招待されました。\n下記のリンクから乗船手続きを進めてください。\n\n■新規登録｜NOAH｜No One Alone, Here\nhttps://noonealonehere.pages.dev/register.html?ref=${myProfile.userId}\n\n■公式LINE｜公式LINEを登録し、いつでも乗船できるようにしてください。\nhttps://lin.ee/aaP0V9F\n\n■公式オープンチャット｜「フルネーム＠NOAHのID」で参加申請してください。\nhttps://line.me/ti/g2/yo2C_bp7U7agH9Rz--E2YhZ4Sc4Yy1ybqhQQZw?utm_source=invitation&utm_medium=link_copy&utm_campaign=default\n`;
    navigator.clipboard.writeText(inviteText).then(() => {
        alert('招待文とURLをコピーしました！');
    }).catch(err => {
        alert('コピーに失敗しました。');
    });
  };

  const changeMonth = (diff: number) => {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + diff);
      setCurrentDate(newDate);
  };

  if (loading || (!user && !loading)) {
      return (
          <div className="min-h-screen bg-texture flex items-center justify-center">
              <Compass className="animate-spin text-brand-500" size={48} />
          </div>
      );
  }

  // Generate Calendar Days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay(); 

  const emptyDays = Array.from({ length: startingDay }).map((_, i) => <div key={`empty-${i}`}></div>);
  const calendarDays = Array.from({ length: daysInMonth }).map((_, i) => {
      const d = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasEvent = participatingEvents.some(e => e.startDate === dateStr);
      return (
          <div key={`day-${d}`} className={`calendar-day text-sm sm:text-base cursor-pointer p-2 flex items-center justify-center rounded-sm transition-colors ${hasEvent ? 'bg-brand-100 border border-brand-300 font-bold text-brand-900 shadow-sm relative after:content-[""] after:w-1.5 after:h-1.5 after:bg-brand-500 after:rounded-full after:absolute after:bottom-1' : 'hover:bg-brand-50 text-brand-700'}`}>
              {d}
          </div>
      );
  });

  return (
    <div className="min-h-screen bg-texture">
      <Navbar />

      <main className="max-w-7xl mx-auto pt-24 px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-gradient-to-br from-[#3e2723] to-[#2a1a17] text-[#f7f5f0] rounded-sm p-8 shadow-xl relative overflow-hidden border border-[#b8860b]">
              <div className="absolute top-0 left-0 w-16 h-16 border-t border-l border-[#d4af37]/30 m-4 pointer-events-none"></div>
              <div className="absolute bottom-0 right-0 w-16 h-16 border-b border-r border-[#d4af37]/30 m-4 pointer-events-none"></div>
              
              <div className="relative z-10">
                  <h1 className="text-2xl font-bold mb-3 font-serif tracking-widest flex items-center gap-2">
                      <Compass className="text-[#d4af37]" /> NOAHへようこそ
                  </h1>
                  <p className="text-[#dcd4c6] text-sm mb-8 tracking-widest leading-relaxed">
                      誰も一人にならない箱舟。<br />
                      共鳴する仲間を見つけ、新たな世界を創り出しましょう。
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 mt-4">
                      <button onClick={copyInviteLink} className="flex-1 bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-[#2a1a17] border border-[#996515] px-4 py-3.5 rounded-sm font-bold text-xs shadow-md flex items-center justify-center gap-2 tracking-widest">
                          <LinkIcon size={16} /> 招待リンクをコピー
                      </button>
                      <button onClick={() => {
                          setIsReferralsModalOpen(true);
                          if (!myProfile || !myProfile.userId) return;
                          setReferralsLoading(true);
                          const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
                          const q = query(usersRef, where("referrerId", "==", myProfile.userId));
                          getDocs(q).then(snap => {
                              const refList: any[] = [];
                              snap.forEach(d => refList.push({ id: d.id, ...d.data() }));
                              setReferrals(refList);
                              setReferralsLoading(false);
                          }).catch(e => {
                              console.error(e);
                              setReferralsLoading(false);
                          });
                      }} className="flex-1 bg-[#1a110f] text-[#d4af37] border border-[#8b6a4f] px-4 py-3.5 rounded-sm font-bold text-xs shadow-md flex items-center justify-center gap-2 tracking-widest">
                          <Users size={16} /> 招待した人を見る
                      </button>
                  </div>
              </div>
              <div className="absolute right-0 bottom-0 opacity-[0.08] transform translate-x-4 translate-y-4 pointer-events-none">
                  <Anchor size={200} className="text-[#d4af37]" />
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-200 pb-3">
                  <h2 className="font-bold text-xl text-brand-900 flex items-center gap-2 font-serif tracking-widest">
                      <CalendarCheck className="text-brand-400" /> 参加予定のイベント
                  </h2>
                  <div className="flex bg-brand-50 p-1 rounded-sm border border-brand-200 shadow-inner w-fit">
                      <button onClick={() => setViewMode('list')} className={`px-5 py-1.5 rounded-sm text-[10px] sm:text-xs font-bold transition-all tracking-widest font-serif flex items-center gap-1 ${viewMode === 'list' ? 'bg-[#3e2723] text-[#d4af37] border border-[#b8860b] shadow-sm' : 'text-brand-700 hover:text-brand-900 border border-transparent'}`}>
                          <List size={14} />リスト
                      </button>
                      <button onClick={() => setViewMode('calendar')} className={`px-5 py-1.5 rounded-sm text-[10px] sm:text-xs font-bold transition-all tracking-widest font-serif flex items-center gap-1 ${viewMode === 'calendar' ? 'bg-[#3e2723] text-[#d4af37] border border-[#b8860b] shadow-sm' : 'text-brand-700 hover:text-brand-900 border border-transparent'}`}>
                          <CalendarIcon size={14} />カレンダー
                      </button>
                  </div>
              </div>

              {dataLoading ? (
                  <div className="animate-pulse flex items-center gap-4 p-5 bg-[#fffdf9] rounded-sm border border-brand-200">
                      <div className="rounded-sm bg-brand-100 h-16 w-16"></div>
                      <div className="flex-1 space-y-3 py-1">
                          <div className="h-4 bg-brand-100 rounded w-3/4"></div>
                          <div className="h-3 bg-brand-100 rounded w-1/2"></div>
                      </div>
                  </div>
              ) : viewMode === 'list' ? (
                  <div className="space-y-4">
                      {participatingEvents.length === 0 ? (
                        <div className="text-sm text-brand-400 py-8 bg-[#fffdf9] rounded-sm border border-brand-200 border-dashed text-center tracking-widest">
                            参加予定のイベントはありません
                        </div>
                      ) : (
                        participatingEvents.map(evt => (
                            <EventCard key={evt.id} evt={evt} onClick={() => setSelectedEvent(evt)} />
                        ))
                      )}
                  </div>
              ) : (
                  <div className="bg-[#fffdf9] rounded-sm border border-brand-200 shadow-md p-6 sm:p-8">
                      <div className="flex justify-between items-center mb-6 border-b border-brand-100 pb-4">
                          <h3 className="font-bold text-lg text-brand-900 font-serif tracking-widest">{year}年 {month + 1}月</h3>
                          <div className="flex gap-2">
                              <button onClick={() => changeMonth(-1)} className="p-2 border border-brand-200 rounded-sm text-brand-600 hover:bg-brand-100 transition-colors"><ChevronLeft size={16}/></button>
                              <button onClick={() => changeMonth(1)} className="p-2 border border-brand-200 rounded-sm text-brand-600 hover:bg-brand-100 transition-colors"><ChevronRight size={16}/></button>
                          </div>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-brand-400 mb-3 tracking-widest">
                          <div>日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div>土</div>
                      </div>
                      <div className="grid grid-cols-7 gap-2 text-sm text-brand-800">
                          {emptyDays}
                          {calendarDays}
                      </div>
                  </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-5">
              <div className="border-b border-brand-200 pb-3">
                  <h2 className="font-bold text-xl text-brand-900 flex items-center gap-2 font-serif tracking-widest">
                      <Crown className="text-[#d4af37]" /> 主催するイベント
                  </h2>
              </div>
              <div className="space-y-4">
                  {dataLoading ? (
                      <div className="text-xs text-brand-400 italic p-8 bg-[#fffdf9] rounded-sm border border-brand-200 text-center tracking-widest shadow-sm flex flex-col items-center">
                          <Compass className="animate-spin text-2xl mb-3 opacity-50 block mx-auto" />読み込み中...
                      </div>
                  ) : hostingEvents.length === 0 ? (
                      <div className="text-xs text-brand-400 italic p-8 bg-[#fffdf9] rounded-sm border border-brand-200 text-center tracking-widest shadow-sm">
                          主催する予定のイベントはありません
                      </div>
                  ) : (
                      hostingEvents.map(evt => (
                          <EventCard key={evt.id} evt={evt} onClick={() => setSelectedEvent(evt)} />
                      ))
                  )}
              </div>
            </div>

            <div className="bg-gradient-to-b from-[#f7f5f0] to-[#eae5d8] rounded-sm p-6 sm:p-8 border border-[#c8b9a6] shadow-md relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-brand-100 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
                <h3 className="font-bold text-[#3e2723] mb-4 flex items-center gap-2 font-serif tracking-widest text-lg relative z-10">
                    <ShieldHalf className="text-[#b8860b]" /> プランについて
                </h3>
                <p className="text-xs text-brand-700 leading-relaxed mb-6 tracking-wide relative z-10">
                    有料の役割（SETTLER等）を引き受けることで、イベントの企画や詳細な情報の閲覧が可能になります。
                </p>
                <Link href="/upgrade" className="inline-flex items-center text-xs font-bold text-[#b8860b] hover:text-[#996515] transition-colors tracking-widest bg-white px-4 py-2 rounded-sm border border-[#dcd4c6] shadow-sm relative z-10 group-hover:border-[#b8860b]">
                    役割の詳細を見る <ArrowRight size={14} className="ml-2 transition-transform group-hover:translate-x-1" />
                </Link>
            </div>
          </div>
        </div>

        {/* Global Modals for Home */}
        <EventDetailSheet 
            event={selectedEvent} 
            onClose={() => setSelectedEvent(null)}
            adjustMode={false}
            setFullImageUrl={setFullImageUrl}
            userData={userData}
            currentUserId={user?.uid}
            isJoined={selectedEvent ? eventJoinStatusMap[selectedEvent.id] : false}
            toggleParticipate={async (evt: any) => {
                const isJoined = eventJoinStatusMap[evt.id];
                const myJoinRef = doc(db, 'artifacts', APP_ID, 'users', user!.uid, 'participating_events', evt.id);
                const partRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', evt.id, 'participants', user!.uid);
                try {
                    if(isJoined) {
                        await deleteDoc(myJoinRef);
                        await deleteDoc(partRef);
                    } else {
                        await setDoc(myJoinRef, { joinedAt: new Date().toISOString() });
                        await setDoc(partRef, { joinedAt: new Date().toISOString() });
                    }
                    setEventJoinStatusMap(prev => ({...prev, [evt.id]: !isJoined}));
                } catch(e) { console.error(e); }
            }}
            onDelete={async (evt: any) => {
                try {
                    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'events', evt.id));
                    setHostingEvents(prev => prev.filter(e => e.id !== evt.id));
                } catch(e) { console.error('Delete failed:', e); alert('削除に失敗しました'); }
            }}
            openEditModal={(id) => {
                window.location.href = `/events?editEventId=${id}`;
            }}
            onShare={(evt) => {
                const url = `${window.location.origin}/events?eventId=${evt.id}`;
                const registerUrl = `${window.location.origin}/register?ref=${user?.uid || ''}`;
                const inviterName = myProfile ? (myProfile.name || myProfile.userId) : 'ユーザー';
                const title = evt.title || '無題';
                const rawDesc = evt.description || '';
                let shortDesc = rawDesc.substring(0, 200).replace(/\n/g, ' ');
                if (rawDesc.length > 200) shortDesc += '…';

                const loc = evt.isOnline ? (evt.locationName || 'オンライン') : (evt.locationName || '未設定');
                const price = Number(evt.price || 0) > 0 ? `¥${Number(evt.price).toLocaleString()}` : '無料';
                
                const text = `${inviterName}さんからイベント招待が届きました。
■イベントタイトル
　${title}
■場所
　${loc}
■参加費
　${price}
■イベント概要
${shortDesc}

⇩以降は詳細へ⇩
${url}

―――
⇩NOAHに参加していない方は、ユーザー登録をしてから参加ボタンを押してください。⇩
${registerUrl}`;
                navigator.clipboard.writeText(text).then(() => alert('共有リンクと紹介文をコピーしました！')).catch(() => alert('コピーに失敗しました。'));
            }}
        />

        {/* Referrals Modal */}
        {isReferralsModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsReferralsModalOpen(false)}></div>
                <div className="bg-[#fffdf9] w-full max-w-lg rounded-sm shadow-2xl relative z-10 max-h-[85vh] flex flex-col border border-brand-300">
                    <div className="flex justify-between items-center p-4 border-b border-brand-200 bg-texture">
                        <h3 className="font-bold text-lg text-brand-900 font-serif tracking-widest flex items-center gap-2">
                            <Users className="text-brand-500" /> 招待した人（乗船記録）
                        </h3>
                        <button onClick={() => setIsReferralsModalOpen(false)} className="text-brand-400 hover:text-brand-700 bg-brand-50 p-1.5 rounded-sm transition-colors border border-transparent hover:border-brand-200">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="p-4 overflow-y-auto flex-1 bg-[#f7f5f0]/50 custom-scrollbar">
                        {referralsLoading ? (
                            <div className="text-center text-brand-400 py-12 flex flex-col items-center">
                                <Compass className="animate-spin text-3xl mb-4 opacity-50 block mx-auto"/>
                                <p className="text-sm tracking-widest font-bold">乗船記録を検索中...</p>
                            </div>
                        ) : referrals.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-sm border border-brand-200 shadow-sm">
                                <Users className="text-brand-300 text-4xl mb-4 mx-auto"/>
                                <p className="text-sm text-brand-600 font-bold tracking-widest">まだ招待した人はいません</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {referrals.map(ref => (
                                    <Link href={`/user?uid=${ref.id}`} key={ref.id} className="flex items-center gap-3 p-3 bg-white rounded-sm border border-brand-200 shadow-sm hover:border-[#b8860b] hover:shadow-md transition-all group">
                                        {ref.photoURL ? (
                                            <img src={ref.photoURL} className="w-10 h-10 rounded-sm object-cover border border-brand-200 bg-brand-50" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-sm border border-brand-200 bg-[#f7f5f0] flex items-center justify-center text-[#c8b9a6] shadow-sm">
                                                <UserIcon size={20} />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <h4 className="font-bold text-sm text-brand-900 group-hover:text-blue-600 transition-colors">{ref.name || '名称未設定'}</h4>
                                            <p className="text-[10px] text-brand-500 tracking-widest">ID: {ref.userId}</p>
                                        </div>
                                        <div className="text-[10px] font-bold text-brand-500 bg-brand-50 px-2.5 py-1.5 rounded-sm border border-brand-200 tracking-widest shadow-inner">
                                            プロフィール充実度: <span className="text-brand-800 text-xs">{ref.profileScore || 0}%</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {fullImageUrl && (
            <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center backdrop-blur-sm transition-opacity" onClick={() => setFullImageUrl(null)}>
                <img src={fullImageUrl} className="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl" />
                <button className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors"><X className="w-6 h-6" /></button>
            </div>
        )}

      </main>
    </div>
  );
}

// Simple reusable EventCard for local file use
function EventCard({ evt, onClick }: { evt: any, onClick: () => void }) {
    const thumb = evt.thumbnailUrl || 'https://via.placeholder.com/150?text=NOAH';
    const dateStr = (evt.startDate === evt.endDate) 
            ? `${evt.startDate || ''} ${evt.startTime || ''}`
            : `${evt.startDate || ''} ${evt.startTime || ''} 〜 ${evt.endDate || ''} ${evt.endTime || ''}`;

    return (
        <button onClick={onClick} className="w-full text-left flex items-center gap-4 p-4 bg-[#fffdf9] rounded-sm border border-brand-200 cursor-pointer hover:bg-brand-50 transition-colors group">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-sm overflow-hidden flex-shrink-0 border border-brand-100 relative shadow-sm">
                <img src={thumb} alt={evt.title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1 mb-1.5">
                    {(evt.tags || []).slice(0,2).map((t: string) => (
                        <span key={t} className="text-[9px] bg-brand-50 border border-brand-200 text-brand-600 px-1.5 py-0.5 rounded-sm font-bold tracking-widest">#{t}</span>
                    ))}
                </div>
                <h4 className="font-bold text-brand-900 truncate text-sm sm:text-base mb-1.5 font-serif tracking-wide">{evt.title || '名称未設定'}</h4>
                <p className="text-[10px] sm:text-xs text-brand-600 flex items-center gap-3 tracking-widest font-medium">
                    <span className="truncate flex items-center gap-1"><Clock size={12} className="text-brand-400"/> {dateStr}</span>
                    <span className="truncate hidden sm:flex items-center gap-1"><MapPin size={12} className="text-brand-400"/> {evt.locationName || '未設定'}</span>
                </p>
            </div>
            <div className="text-brand-300 pr-2 group-hover:text-brand-500 transition-colors">
                <ChevronRight size={16} />
            </div>
        </button>
    );
}
