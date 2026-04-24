'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, User, Check, Send } from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { createRecommendation } from '@/lib/recommendations';
import { useAuth } from '@/contexts/AuthContext';

interface RecommendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultTargetUser?: any | null; // 追加: 特定のユーザーページから直接開く場合
}

export default function RecommendModal({ isOpen, onClose, onSuccess, defaultTargetUser }: RecommendModalProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (defaultTargetUser) {
        setSelectedUser(defaultTargetUser);
      } else {
        setSelectedUser(null);
      }
      setContent('');
    }
  }, [isOpen, defaultTargetUser]);

  useEffect(() => {
    if (isOpen && user) {
      // 相互フォローまたは全ユーザーを取得（デモ用として全公開ユーザーを取得）
      const fetchUsers = async () => {
        try {
          const usersSnap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'users'));
          const usersList = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })).filter(u => u.uid !== user.uid);
          setUsers(usersList);
          setFilteredUsers(usersList);
        } catch (e) {
          console.error("Failed to load users for recommendation", e);
        }
      };
      fetchUsers();
    }
  }, [isOpen, user]);

  useEffect(() => {
    setFilteredUsers(
      users.filter(u => 
        (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (u.userId || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [searchQuery, users]);

  const handleSubmit = async () => {
    if (!user || !selectedUser || !content.trim()) return;
    setLoading(true);
    try {
      await createRecommendation({
        authorId: user.uid,
        targetUserId: selectedUser.uid,
        content: content.trim(),
      });
      setContent('');
      setSelectedUser(null);
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      alert('投稿に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#fffdf9] w-full max-w-md rounded-sm shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-[#e8dfd1]">
          <h2 className="text-lg font-bold text-[#3e2723] font-serif tracking-widest">誰かをおすすめする</h2>
          <button onClick={onClose} className="text-[#a09080] hover:text-[#3e2723]">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {!selectedUser ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a09080]" size={16} />
                <input
                  type="text"
                  placeholder="ユーザー名やIDで検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-[#e8dfd1] rounded-sm text-sm focus:outline-none focus:border-[#b8860b] bg-[#fffdf9]"
                />
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto border border-[#e8dfd1] rounded-sm p-2">
                {filteredUsers.length > 0 ? filteredUsers.map(u => (
                  <div 
                    key={u.uid} 
                    onClick={() => setSelectedUser(u)}
                    className="flex items-center gap-3 p-2 hover:bg-[#f7f5f0] cursor-pointer rounded-sm border border-transparent hover:border-[#e8dfd1] transition-all"
                  >
                    <div className="w-10 h-10 rounded-sm overflow-hidden bg-[#e8dfd1] flex items-center justify-center">
                      {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <User size={20} className="text-[#a09080]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#3e2723] truncate">{u.name || u.userId}</p>
                      <p className="text-xs text-[#a09080] truncate">@{u.userId}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-sm text-[#a09080] py-4">該当するユーザーがいません</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-[#f7f5f0] rounded-sm border border-[#e8dfd1]">
                <div className="w-12 h-12 rounded-sm overflow-hidden bg-[#e8dfd1]">
                  {selectedUser.photoURL ? <img src={selectedUser.photoURL} className="w-full h-full object-cover" /> : <User size={24} className="text-[#a09080] m-auto mt-2" />}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-[#3e2723]">{selectedUser.name}</p>
                  <p className="text-xs text-[#a09080]">@{selectedUser.userId}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-xs text-[#b8860b] underline">変更</button>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#725b3f] mb-2 tracking-widest">おすすめの言葉</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="この人の魅力や、おすすめしたいポイントを書いてください。（例：デザインの技術が素晴らしく、いつも刺激をもらっています！）"
                  className="w-full h-32 p-3 border border-[#e8dfd1] rounded-sm text-sm focus:outline-none focus:border-[#b8860b] bg-[#fffdf9] resize-none"
                />
              </div>

              <div className="bg-[#fffdf9] border border-dashed border-[#e8dfd1] p-4 text-center rounded-sm">
                <p className="text-xs text-[#a09080] mb-2">背景にする画像/動画（オプション）</p>
                <button disabled className="text-xs px-3 py-1 bg-[#f7f5f0] border border-[#e8dfd1] text-[#a09080] rounded-sm cursor-not-allowed">ファイルを選択</button>
                <p className="text-[10px] text-[#c8b9a6] mt-2">※現在はテキストのみの投稿が可能です</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#e8dfd1] flex justify-end gap-2 bg-[#fdfaf5]">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-[#725b3f] bg-[#fffdf9] border border-[#e8dfd1] rounded-sm hover:bg-[#f7f5f0]">キャンセル</button>
          <button 
            disabled={!selectedUser || !content.trim() || loading}
            onClick={handleSubmit} 
            className="px-4 py-2 text-sm font-bold text-[#f7f5f0] bg-[#3e2723] rounded-sm hover:bg-[#2a1a17] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Send size={16} /> 投稿する
          </button>
        </div>
      </div>
    </div>
  );
}
