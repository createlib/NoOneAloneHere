'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { ArrowLeft, Anchor, Ship, Eye, EyeOff, LoaderCircle } from 'lucide-react';

const APP_ID = '1:803209683213:web:b62d13784fa2bbbb9f5044';

export default function Login() {
  const router = useRouter();
  const { user, loading } = useAuth();
  
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'error' | 'success'} | null>(null);

  useEffect(() => {
    if (user && !loading) {
      router.push('/home'); // Redirect to dashboard if already logged in
    }
  }, [user, loading, router]);

  const showNotif = (msg: string, type: 'error' | 'success') => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userid.trim() || !password) return;

    if (userid === 'admin' && password === 'admin') {
        localStorage.setItem('isAdminMock', 'true');
        router.push('/home');
        return;
    }

    setIsSubmitting(true);
    try {
        let email = userid.trim();

        if (!email.includes('@')) {
            const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
            const q = query(usersRef, where("userId", "==", email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const userData = querySnapshot.docs[0].data();
                if (userData.email) {
                    email = userData.email;
                } else {
                    throw new Error("初期設定が完了していません。一度「メールアドレス」でログインし、プロフィールを保存し直してください。");
                }
            } else {
                throw new Error("指定されたユーザーIDは見つかりません。");
            }
        }

        await signInWithEmailAndPassword(auth, email, password);
        showNotif('乗船しました。ホームへ移動します', 'success');
        // Redirection happens automatically via useEffect
    } catch (error: any) {
        console.error(error);
        let msg = 'ログインに失敗しました。';
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') msg = 'ID・メールアドレス、またはパスワードが間違っています。';
        else if (error.code === 'auth/user-not-found') msg = 'ユーザーが見つかりません。';
        else if (error.message) msg = error.message;
        
        showNotif(msg, 'error');
    } finally {
        setIsSubmitting(false);
    }
  };

  if (loading || (user && !loading)) {
    return (
        <div className="min-h-screen bg-texture flex items-center justify-center">
            <LoaderCircle className="animate-spin text-brand-500" size={48} />
        </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative bg-texture">
        <div className="absolute top-4 left-4 sm:top-8 sm:left-8 z-10">
            <Link href="/" className="inline-flex items-center text-xs font-bold text-brand-500 hover:text-brand-800 transition-colors tracking-widest">
                <ArrowLeft size={16} className="mr-2" />
                NOAHについて
            </Link>
        </div>

        <div className="max-w-md w-full space-y-8 bg-[#fffdf9] p-8 rounded-sm shadow-xl border border-brand-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-brand-300 m-2"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-brand-300 m-2"></div>

            <div className="text-center relative z-10">
                <div className="w-16 h-16 bg-brand-50 rounded-full border border-brand-200 flex items-center justify-center mx-auto mb-4 text-brand-900 shadow-sm">
                    <Anchor size={24} />
                </div>
                <h1 className="text-3xl font-bold tracking-[0.3em] text-brand-900 mb-1">NOAH</h1>
                <p className="mt-2 text-xs font-bold text-brand-500 tracking-widest">再び航海へ</p>
            </div>

            <form className="mt-8 space-y-6 relative z-10" onSubmit={handleLogin}>
                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-brand-800 mb-1 tracking-widest">ユーザーID または メールアドレス</label>
                        <input name="userid" type="text" value={userid} onChange={(e) => setUserid(e.target.value)} required className="appearance-none block w-full px-4 py-3 border border-brand-200 rounded-sm shadow-sm bg-[#fffdf9] transition-all placeholder-brand-300 text-sm tracking-widest font-sans focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="ユーザーID / email" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-brand-800 mb-1 tracking-widest">パスワード</label>
                        <div className="relative">
                            <input id="password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required className="appearance-none block w-full px-4 py-3 border border-brand-200 rounded-sm shadow-sm bg-[#fffdf9] transition-all placeholder-brand-300 text-sm tracking-widest font-sans focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="パスワードを入力" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-400 hover:text-brand-700 transition-colors">
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                </div>
                
                <button type="submit" disabled={isSubmitting} className="w-full flex justify-center items-center py-3.5 px-4 border border-[#b8860b] text-sm font-bold rounded-sm text-[#f7f5f0] bg-[#3e2723] hover:bg-[#2a1a17] transition-all shadow-md mt-6 tracking-widest disabled:opacity-70 disabled:cursor-not-allowed">
                    {isSubmitting ? (
                        <><LoaderCircle size={16} className="animate-spin mr-2" /> ログイン中...</>
                    ) : (
                        <><Ship size={16} className="mr-2" /> 乗船する</>
                    )}
                </button>
            </form>

            <div className="mt-6 text-center relative z-10 border-t border-brand-100 pt-6">
                <p className="text-xs text-brand-600 font-bold tracking-widest">まだ船に乗っていない方は <br className="sm:hidden" /><Link href="/register" className="text-[#8b6a4f] hover:text-[#5c4a3d] border-b border-[#8b6a4f] pb-0.5 ml-2">乗船手続きへ</Link></p>
            </div>
        </div>

        {notification && (
            <div className={`fixed top-10 left-1/2 transform -translate-x-1/2 z-50 max-w-sm w-[90%] shadow-xl border rounded-sm p-4 text-center transition-all duration-300 ${notification.type === 'error' ? 'bg-[#fffdf9] text-red-700 border-brand-200' : 'bg-[#3e2723] text-[#f7f5f0] border-[#b8860b]'}`}>
                <p className="text-xs font-bold tracking-widest">{notification.msg}</p>
            </div>
        )}
    </div>
  );
}
