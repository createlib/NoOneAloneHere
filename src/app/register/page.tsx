'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { ArrowLeft, Anchor, Compass, CheckCircle, XCircle, AlertCircle, Crown, Ban, Ship, Eye, EyeOff, LoaderCircle } from 'lucide-react';

const APP_ID = '1:803209683213:web:b62d13784fa2bbbb9f5044';
const ADMIN_SECRET = 'admin_start';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  
  const [referrer, setReferrer] = useState('');
  const [userid, setUserid] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isReferrerValid, setIsReferrerValid] = useState(false);
  const [referrerMsg, setReferrerMsg] = useState('半角英数字とアンダーバーのみ');
  const [referrerStatus, setReferrerStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'admin' | 'ban'>('idle');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'error' | 'success' | 'info'} | null>(null);

  // Read URL parameter
  useEffect(() => {
      const refParam = searchParams.get('ref');
      if (refParam) {
          setReferrer(refParam);
          checkReferrer(refParam);
      }
  }, [searchParams]);

  // Redirect if logged in
  useEffect(() => {
    if (user && !user.isAnonymous && !loading) {
      router.push('/home');
    }
  }, [user, loading, router]);

  const showNotif = (msg: string, type: 'error' | 'success' | 'info') => {
    setNotification({ msg, type });
    if (type !== 'info') {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleReferrerChange = (value: string) => {
      const sanitized = value.replace(/[^a-zA-Z0-9_]/g, '');
      setReferrer(sanitized);
  };

  // Debounced referrer checking
  useEffect(() => {
      const timeoutId = setTimeout(() => {
          if (referrer !== searchParams.get('ref')) {
               checkReferrer(referrer);
          }
      }, 500);
      return () => clearTimeout(timeoutId);
  }, [referrer, searchParams]);

  const checkReferrer = async (value: string) => {
      setIsReferrerValid(false);
      
      if (!value) {
          setReferrerMsg('半角英数字とアンダーバーのみ');
          setReferrerStatus('idle');
          return;
      }

      if (value === ADMIN_SECRET) {
          setReferrerMsg('管理者モード: 紹介者チェックをスキップします');
          setReferrerStatus('admin');
          setIsReferrerValid(true);
          return;
      }

      if (value === "admin") {
          setReferrerMsg('このIDは紹介者として指定できません');
          setReferrerStatus('ban');
          setIsReferrerValid(false);
          return;
      }

      setReferrerMsg('確認中...');
      setReferrerStatus('checking');

      try {
          const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
          const q = query(usersRef, where("userId", "==", value));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
              const userData = querySnapshot.docs[0].data();
              const displayName = userData.name || userData.userId || 'ユーザー';
              setReferrerMsg(`紹介者: ${displayName} さんを確認しました`);
              setReferrerStatus('valid');
              setIsReferrerValid(true);
          } else {
              setReferrerMsg('該当する紹介者が見つかりません');
              setReferrerStatus('invalid');
          }
      } catch (error) {
          console.error("Referrer check error:", error);
          setReferrerMsg('確認できませんでした');
          setReferrerStatus('invalid');
      }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReferrerValid || isSubmitting) return;

    setIsSubmitting(true);
    showNotif('乗船手続き中...', 'info');

    try {
        const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
        const idQuery = query(usersRef, where("userId", "==", userid));
        const idCheckSnapshot = await getDocs(idQuery);
        
        if (!idCheckSnapshot.empty) {
            throw new Error("このユーザーIDは既に使用されています。別のIDを指定してください。");
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        const timestamp = new Date().toISOString();
        
        // Private Data
        await setDoc(doc(db, 'artifacts', APP_ID, 'users', newUser.uid, 'profile', 'data'), {
            userId: userid,
            referrerId: referrer || null,
            email: email,
            name: userid,
            createdAt: timestamp,
            profilePublic: "false",
            membershipRank: "arrival" 
        });

        // Public Data
        await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', newUser.uid), {
            userId: userid,
            name: userid,
            email: email,
            isHidden: true,
            updatedAt: timestamp,
            referrerId: referrer || null,
            profileScore: 0
        });

        showNotif('乗船手続き完了！ホームへ移動します', 'success');
        // Redirect handled by AuthContext useEffect
    } catch (error: any) {
        console.error("Reg error:", error);
        let msg = '登録に失敗しました。';
        if (error.code === 'auth/email-already-in-use') msg = 'このメールアドレスは既に使用されています。';
        if (error.message) msg = error.message;
        showNotif(msg, 'error');
        setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative bg-texture">
        <div className="absolute top-4 left-4 sm:top-8 sm:left-8 z-10">
            <Link href="/" className="inline-flex items-center text-xs font-bold text-brand-500 hover:text-brand-800 transition-colors tracking-widest">
                <ArrowLeft size={16} className="mr-2" /> NOAHについて
            </Link>
        </div>

        <div className="max-w-md w-full space-y-8 bg-[#fffdf9] p-8 rounded-sm shadow-xl border border-brand-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand-300 m-2"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-brand-300 m-2"></div>

            <div className="text-center relative z-10">
                <div className="w-16 h-16 bg-brand-50 rounded-full border border-brand-200 flex items-center justify-center mx-auto mb-4 text-brand-900 shadow-sm">
                    <Anchor size={24} />
                </div>
                <h1 className="text-2xl font-bold tracking-[0.2em] text-brand-900 mb-1">NOAH</h1>
                <p className="mt-2 text-xs font-bold text-brand-500 tracking-widest">乗船手続き</p>
            </div>

            <form className="mt-8 space-y-6 relative z-10" onSubmit={handleRegister}>
                <div className="space-y-4">
                    {/* Referrer */}
                    <div>
                        <label className="block text-xs font-bold text-brand-800 mb-1 tracking-widest">紹介者ID <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <input type="text" value={referrer} onChange={(e) => handleReferrerChange(e.target.value)} required readOnly={!!searchParams.get('ref')} className={`appearance-none block w-full px-4 py-3 border border-brand-200 rounded-sm shadow-sm transition-all focus:outline-none focus:ring-1 focus:ring-brand-500 text-sm tracking-widest font-sans ${searchParams.get('ref') ? 'bg-brand-50 text-brand-600 font-bold' : 'bg-[#fffdf9] placeholder-brand-300'}`} placeholder="例: yamada_123" />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                {referrerStatus === 'checking' && <Compass className="animate-spin text-brand-400" size={16}/>}
                                {referrerStatus === 'valid' && <CheckCircle className="text-green-600" size={16}/>}
                                {referrerStatus === 'invalid' && <XCircle className="text-red-500" size={16}/>}
                                {referrerStatus === 'admin' && <Crown className="text-[#d4af37]" size={16}/>}
                                {referrerStatus === 'ban' && <Ban className="text-red-500" size={16}/>}
                            </div>
                        </div>
                        <p className={`mt-1.5 text-[10px] font-bold tracking-widest ${referrerStatus === 'valid' ? 'text-green-700' : referrerStatus === 'invalid' || referrerStatus === 'ban' ? 'text-red-600' : 'text-brand-500'}`}>{referrerMsg}</p>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-xs font-bold text-brand-800 mb-1 tracking-widest">お使いのメールアドレス <span className="text-red-500">*</span></label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="appearance-none block w-full px-4 py-3 border border-brand-200 rounded-sm shadow-sm bg-[#fffdf9] transition-all placeholder-brand-300 text-sm tracking-widest font-sans focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="your@email.com" />
                    </div>

                    {/* User ID */}
                    <div>
                        <label className="block text-xs font-bold text-brand-800 mb-1 tracking-widest">あなたの希望ユーザーID <span className="text-red-500">*</span></label>
                        <input type="text" value={userid} onChange={(e) => setUserid(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} required className="appearance-none block w-full px-4 py-3 border border-brand-200 rounded-sm shadow-sm bg-[#fffdf9] transition-all placeholder-brand-300 text-sm tracking-widest font-sans focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="半角英数字アンダーバーのみ" />
                        <p className="text-[10px] text-brand-500 mt-1 tracking-widest">後から変更可能です</p>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-xs font-bold text-brand-800 mb-1 tracking-widest">パスワード <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="appearance-none block w-full px-4 py-3 border border-brand-200 rounded-sm shadow-sm bg-[#fffdf9] transition-all placeholder-brand-300 text-sm tracking-widest font-sans focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="6文字以上" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-400 hover:text-brand-700 transition-colors">
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                </div>

                <button type="submit" disabled={!isReferrerValid || isSubmitting} className="w-full flex justify-center items-center py-3.5 px-4 border border-[#b8860b] text-sm font-bold rounded-sm text-[#f7f5f0] bg-[#3e2723] hover:bg-[#2a1a17] transition-all shadow-md mt-6 tracking-widest disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? (
                        <><LoaderCircle size={16} className="animate-spin mr-2" /> 乗船手続中...</>
                    ) : (
                        <><Ship size={16} className="mr-2" /> 登録して乗船する</>
                    )}
                </button>
            </form>

            <div className="mt-6 text-center relative z-10 border-t border-brand-100 pt-6">
                <p className="text-xs text-brand-600 font-bold tracking-widest">すでに船に乗っている方は <br className="sm:hidden" /><Link href="/login" className="text-[#8b6a4f] hover:text-[#5c4a3d] border-b border-[#8b6a4f] pb-0.5 ml-2">ログインへ</Link></p>
            </div>
        </div>

        {notification && (
            <div className={`fixed top-10 left-1/2 transform -translate-x-1/2 z-50 max-w-sm w-[90%] shadow-xl border rounded-sm p-4 text-center transition-all duration-300 ${notification.type === 'error' ? 'bg-[#fffdf9] text-red-700 border-brand-200' : 'bg-[#3e2723] text-[#f7f5f0] border-[#b8860b]'}`}>
                <p className="text-xs font-bold tracking-widest flex items-center justify-center gap-2">
                    {notification.type === 'error' ? <AlertCircle size={16}/> : null}
                    {notification.msg}
                </p>
            </div>
        )}
    </div>
  );
}

export default function Register() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-texture flex items-center justify-center"><LoaderCircle className="animate-spin text-brand-500" size={48} /></div>}>
            <RegisterForm />
        </Suspense>
    );
}
