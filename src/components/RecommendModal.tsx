'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, User, Check, Send, ImagePlus, Trash2 } from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, APP_ID } from '@/lib/firebase';
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
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (defaultTargetUser) {
        setSelectedUser(defaultTargetUser);
      } else {
        setSelectedUser(null);
      }
      setContent('');
      setFile(null);
      setPreviewUrl(null);
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
      let mediaUrl = '';
      if (file) {
        const ext = file.name.split('.').pop();
        const storageRef = ref(storage, `profiles/${user.uid}/recommend_${Date.now()}.${ext}`);
        const snap = await uploadBytes(storageRef, file);
        mediaUrl = await getDownloadURL(snap.ref);
      }

      await createRecommendation({
        authorId: user.uid,
        targetUserId: selectedUser.uid,
        content: content.trim(),
        mediaUrl: mediaUrl || undefined,
      });
      setContent('');
      setFile(null);
      setPreviewUrl(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const objUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objUrl);
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

              <div className="bg-[#fffdf9] border border-dashed border-[#e8dfd1] p-4 text-center rounded-sm relative">
                <p className="text-xs font-bold text-[#725b3f] mb-3 tracking-widest">背景画像（任意）</p>
                {previewUrl ? (
                  <div className="relative inline-block w-full max-w-[200px] aspect-[3/4] mx-auto rounded-sm overflow-hidden border border-[#e8dfd1]">
                    <img src={previewUrl} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => { setFile(null); setPreviewUrl(null); }}
                      className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-[#f7f5f0] border border-[#e8dfd1] text-[#725b3f] font-bold text-xs tracking-widest rounded-sm hover:bg-[#fffdf9] hover:border-[#b8860b] transition-all shadow-sm">
                      <ImagePlus size={16} className="text-[#b8860b]" /> 画像を選択する
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    <p className="text-[10px] text-[#c8b9a6] mt-3 tracking-widest leading-relaxed text-left max-w-xs mx-auto">
                      ※設定しない場合は、テキストだけのシンプルなカードになります。縦長（3:4等）の画像が綺麗に表示されます。
                    </p>
                  </div>
                )}
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
