'use client';
import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { Users, X, Anchor, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface FollowModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'following' | 'followers' | 'mutual' | null;
    targetUid: string;
    myUid?: string;
}

export default function FollowModal({ isOpen, onClose, type, targetUid, myUid }: FollowModalProps) {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !type || !targetUid) return;

        let isMounted = true;
        setLoading(true);
        setUsers([]);

        const fetchUsers = async () => {
            try {
                let targetIds: string[] = [];

                if (type === 'mutual') {
                    if (!myUid || myUid === targetUid) {
                        setLoading(false);
                        return;
                    }
                    
                    // My mutuals
                    const myFowSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', myUid, 'following'));
                    const myFlerSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', myUid, 'followers'));
                    const myFowIds = new Set(myFowSnap.docs.map(d => d.id));
                    const myMutualIds = myFlerSnap.docs.map(d => d.id).filter(id => myFowIds.has(id));

                    // Target mutuals
                    const targetFowSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', targetUid, 'following'));
                    const targetFlerSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', targetUid, 'followers'));
                    const targetFowIds = new Set(targetFowSnap.docs.map(d => d.id));
                    const targetMutualIds = targetFlerSnap.docs.map(d => d.id).filter(id => targetFowIds.has(id));

                    const targetMutualSet = new Set(targetMutualIds);
                    targetIds = myMutualIds.filter(id => targetMutualSet.has(id));

                } else {
                    const snap = await getDocs(collection(db, 'artifacts', APP_ID, 'users', targetUid, type));
                    targetIds = snap.docs.map(d => d.id);
                }

                if (targetIds.length === 0) {
                    if (isMounted) setLoading(false);
                    return;
                }

                const userPromises = targetIds.map(async (uid) => {
                    const docSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', uid));
                    if (docSnap.exists()) {
                        return { uid, ...docSnap.data() };
                    }
                    return null;
                });

                const loaded = await Promise.all(userPromises);
                if (isMounted) {
                    setUsers(loaded.filter(u => u !== null));
                    setLoading(false);
                }
            } catch (error) {
                console.error("Error fetching users for follow modal:", error);
                if (isMounted) setLoading(false);
            }
        };

        fetchUsers();

        return () => { isMounted = false; };
    }, [isOpen, type, targetUid, myUid]);

    if (!isOpen) return null;

    let displayTitle = '';
    if (type === 'following') displayTitle = 'フォロー中';
    else if (type === 'followers') displayTitle = 'フォロワー';
    else if (type === 'mutual') displayTitle = '共通の航海士';

    return (
        <div className="fixed inset-0 z-[4000] bg-[#2a1a17]/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#fffdf9] bg-texture w-full max-w-md h-[80vh] rounded-sm shadow-2xl flex flex-col border border-[#b8860b]">
                <div className="p-4 border-b border-[#e8dfd1] flex justify-between items-center bg-[#fffdf9]">
                    <h3 className="font-bold text-[#3e2723] font-serif tracking-widest flex items-center">
                        <Users className="text-[#b8860b] mr-2" size={20} />
                        <span>{displayTitle}</span>
                    </h3>
                    <button onClick={onClose} className="text-[#a09080] hover:text-[#3e2723] transition-colors w-8 h-8 flex items-center justify-center rounded-sm bg-[#f7f5f0] border border-[#e8dfd1]">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-0 overflow-y-auto flex-1 custom-scrollbar bg-[#fffdf9]">
                    {loading ? (
                        <div className="text-center py-10 text-[#a09080] text-sm font-bold tracking-widest">
                            読み込み中...
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-10 text-[#a09080] text-sm font-bold tracking-widest">
                            ユーザーはいません
                        </div>
                    ) : (
                        users.map((u, i) => (
                            <Link key={i} href={`/user?uid=${u.uid}`} onClick={onClose} className="flex items-center gap-4 p-4 border-b border-[#e8dfd1] hover:bg-[#f7f5f0] transition-colors group tracking-widest">
                                {u.photoURL ? (
                                    <img src={u.photoURL} alt={u.name} className="w-12 h-12 rounded-full border border-[#e8dfd1] object-cover bg-white" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full border border-[#e8dfd1] bg-[#f7f5f0] flex items-center justify-center text-[#c8b9a6]">
                                        <Anchor size={20} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-[#3e2723] truncate font-serif tracking-wide group-hover:text-[#b8860b] transition-colors">{u.name || u.userId || '名無し'}</h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-[#8b6a4f] font-mono font-bold">@{u.userId}</span>
                                        {u.jobTitle && (
                                            <span className="text-[9px] bg-[#f0ebdd] text-[#5c4a3d] px-1.5 py-0.5 rounded-sm border border-[#e8dfd1] truncate max-w-[120px]">{u.jobTitle}</span>
                                        )}
                                    </div>
                                </div>
                                <ChevronRight className="text-[#c8b9a6] text-xs group-hover:text-[#b8860b]" size={16} />
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
