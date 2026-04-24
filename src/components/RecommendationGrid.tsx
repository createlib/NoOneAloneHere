'use client';

import React, { useEffect, useState } from 'react';
import { getRecommendationsForUser, getRecommendationsByAuthor, Recommendation } from '@/lib/recommendations';
import { User, MessageCircle, Heart } from 'lucide-react';
import { db, APP_ID } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface Props {
  targetUid: string;
}

export default function RecommendationGrid({ targetUid }: Props) {
  const [received, setReceived] = useState<(Recommendation & { authorData?: any })[]>([]);
  const [given, setGiven] = useState<(Recommendation & { targetData?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'received' | 'given'>('received');

  useEffect(() => {
    if (!targetUid) return;
    const load = async () => {
      setLoading(true);
      try {
        const [recList, givList] = await Promise.all([
          getRecommendationsForUser(targetUid),
          getRecommendationsByAuthor(targetUid)
        ]);

        // ユーザー情報を取得
        const recWithData = await Promise.all(recList.map(async (r) => {
          const uDoc = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', r.authorId));
          return { ...r, authorData: uDoc.exists() ? uDoc.data() : null };
        }));

        const givWithData = await Promise.all(givList.map(async (g) => {
          const uDoc = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', g.targetUserId));
          return { ...g, targetData: uDoc.exists() ? uDoc.data() : null };
        }));

        setReceived(recWithData);
        setGiven(givWithData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [targetUid]);

  if (loading) return <div className="text-center py-20 text-[#a09080] font-bold tracking-widest text-sm">読み込み中...</div>;

  const currentList = tab === 'received' ? received : given;

  return (
    <div className="space-y-6 px-4 sm:px-0">
      <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setTab('received')} className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest transition-all ${tab === 'received' ? 'bg-[#b8860b] text-[#fffdf9] shadow-md border border-[#b8860b]' : 'bg-[#fffdf9] text-[#725b3f] hover:bg-[#f7f5f0] border border-[#e8dfd1]'}`}>
              貰ったおすすめ ({received.length})
          </button>
          <button onClick={() => setTab('given')} className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest transition-all ${tab === 'given' ? 'bg-[#b8860b] text-[#fffdf9] shadow-md border border-[#b8860b]' : 'bg-[#fffdf9] text-[#725b3f] hover:bg-[#f7f5f0] border border-[#e8dfd1]'}`}>
              書いたおすすめ ({given.length})
          </button>
      </div>

      {currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-[#a09080] py-20 bg-[#fffdf9] rounded-sm border border-dashed border-[#e8dfd1]">
          <p className="font-bold tracking-widest text-sm">
            {tab === 'received' ? 'まだおすすめされていません。' : 'まだ誰かをおすすめしていません。'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 md:gap-4 pb-12">
          {currentList.map((item, idx) => {
            const displayUser = tab === 'received' ? (item as any).authorData : (item as any).targetData;
            
            return (
              <div key={idx} className="aspect-[3/4] relative bg-[#fffdf9] border border-[#e8dfd1] rounded-sm shadow-sm overflow-hidden group cursor-pointer hover:border-[#b8860b] transition-all">
                {item.mediaUrl ? (
                  <img src={item.mediaUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#f0ebdd] to-[#f8f5ed] flex flex-col items-center justify-center p-4">
                    <p className="text-sm font-serif text-[#3e2723] line-clamp-6 text-center leading-relaxed">
                      &ldquo;{item.content}&rdquo;
                    </p>
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-sm bg-white/20 border border-white/40 overflow-hidden flex-shrink-0">
                      {displayUser?.photoURL ? <img src={displayUser.photoURL} className="w-full h-full object-cover" /> : <User size={12} className="text-white m-auto mt-1" />}
                    </div>
                    <span className="text-xs font-bold text-white truncate shadow-black drop-shadow-md">
                      {tab === 'received' ? 'From: ' : 'To: '} {displayUser?.name || '名無し'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
