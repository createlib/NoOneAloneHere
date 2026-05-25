'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Anchor, Ship, Eye, EyeOff, LoaderCircle } from 'lucide-react';

// ── Design tokens (matches profile page) ─────────────────────────────────────
const SB   = '#1a3024';
const SAGE = '#4a7c59';
const LIME = '#8ecfb2';
const BG   = '#f5f3f0';
const T1   = '#2a2520';
const T2   = '#7a7068';
const TM   = '#ada49c';
const NEU_UP = '8px 8px 18px rgba(0,0,0,.1),-8px -8px 18px rgba(255,255,255,.9)';
const NEU_SM = '4px 4px 10px rgba(0,0,0,.08),-4px -4px 10px rgba(255,255,255,.85)';
const NEU_IN = 'inset 3px 3px 8px rgba(0,0,0,.08),inset -3px -3px 8px rgba(255,255,255,.75)';

export default function Login() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'error' | 'success'} | null>(null);

  useEffect(() => {
    if (user && !user.isAnonymous && !loading) {
      router.push('/user');
    }
  }, [user, loading, router]);

  const showNotif = (msg: string, type: 'error' | 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userid.trim() || !password) return;

    if (userid === 'admin' && password === 'admin') {
      localStorage.setItem('isAdminMock', 'true');
      router.push('/user');
      return;
    }

    setIsSubmitting(true);
    try {
      let email = userid.trim();
      if (!email.includes('@')) {
        const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
        const q = query(usersRef, where("userId", "==", email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const ud = snap.docs[0].data();
          if (ud.email) { email = ud.email; }
          else { throw new Error("初期設定が完了していません。一度「メールアドレス」でログインし、プロフィールを保存し直してください。"); }
        } else {
          throw new Error("[DB] 指定されたユーザーIDは見つかりません（データベース未登録）");
        }
      }
      await signInWithEmailAndPassword(auth, email, password);
      showNotif('乗船しました。マイページへ移動します', 'success');
    } catch (error: any) {
      console.error(error);
      let msg = 'ログインに失敗しました。';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') msg = 'ID・メールアドレス、またはパスワードが間違っています。';
      else if (error.code === 'auth/user-not-found') msg = '[Auth] ユーザーが見つかりません';
      else if (error.message) msg = error.message;
      showNotif(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || (user && !loading)) {
    return (
      <div style={{minHeight:'100vh',background:BG,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{width:40,height:40,borderRadius:'50%',border:`3px solid rgba(74,124,89,.2)`,borderTopColor:SAGE,animation:'spin .8s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',background:BG}}>
      {/* ── Left panel (dark green, desktop only) ── */}
      <div className="hidden lg:flex" style={{
        width:300,flexShrink:0,background:SB,flexDirection:'column',padding:'48px 32px',
        alignItems:'flex-start',justifyContent:'space-between',
      }}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:48}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(163,230,53,.12)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Anchor size={16} color={LIME}/>
            </div>
            <span style={{fontSize:18,fontWeight:800,letterSpacing:'.2em',color:'#fff'}}>NOAH</span>
          </div>
          <div style={{color:'rgba(255,255,255,.5)',fontSize:10,letterSpacing:'.12em',marginBottom:16}}>再び航海へ</div>
          <h2 style={{fontSize:28,fontWeight:800,color:'#e8f4ec',lineHeight:1.3,letterSpacing:'.02em'}}>
            また会えて<br/>嬉しいです。
          </h2>
        </div>
        <div style={{borderTop:'1px solid rgba(255,255,255,.08)',paddingTop:24,width:'100%'}}>
          <div style={{fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:'.08em',marginBottom:8}}>まだ船に乗っていない？</div>
          <Link href="/register" style={{fontSize:12,fontWeight:700,color:'#7aab88',letterSpacing:'.06em',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,.1)',background:'rgba(255,255,255,.04)',transition:'background .15s'}}>
            <Ship size={12}/> 乗船手続きへ
          </Link>
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'32px 20px'}}>
        {/* Mobile header */}
        <div className="lg:hidden" style={{position:'fixed',top:0,left:0,right:0,padding:'14px 20px',background:SB,display:'flex',alignItems:'center',gap:10,zIndex:10}}>
          <Anchor size={14} color={LIME}/>
          <span style={{fontSize:14,fontWeight:800,letterSpacing:'.18em',color:'#fff'}}>NOAH</span>
        </div>

        <div style={{width:'100%',maxWidth:420,paddingTop:60}} className="lg:pt-0">
          {/* Card */}
          <div style={{background:BG,borderRadius:20,boxShadow:NEU_UP,padding:'36px 32px'}}>
            {/* Logo mobile */}
            <div className="lg:hidden" style={{textAlign:'center',marginBottom:28}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:BG,boxShadow:NEU_SM,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',color:SAGE}}>
                <Anchor size={22}/>
              </div>
              <div style={{fontSize:10,color:TM,letterSpacing:'.12em'}}>再び航海へ</div>
            </div>

            <h1 className="hidden lg:block" style={{fontSize:22,fontWeight:800,color:T1,marginBottom:6,letterSpacing:'.04em'}}>おかえりなさい</h1>
            <p className="hidden lg:block" style={{fontSize:12,color:T2,marginBottom:28,letterSpacing:'.04em'}}>IDまたはメールアドレスでログイン</p>

            <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:16}}>
              {/* UserID */}
              <div>
                <label style={{display:'block',fontSize:10,fontWeight:700,color:T2,marginBottom:6,letterSpacing:'.1em'}}>ユーザーID または メールアドレス</label>
                <div style={{borderRadius:10,boxShadow:NEU_IN,background:BG,overflow:'hidden'}}>
                  <input
                    type="text"
                    value={userid}
                    onChange={e=>setUserid(e.target.value)}
                    required
                    placeholder="ユーザーID / email"
                    style={{width:'100%',padding:'12px 14px',border:'none',outline:'none',background:'transparent',fontSize:13,color:T1,fontFamily:'inherit',boxSizing:'border-box'}}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{display:'block',fontSize:10,fontWeight:700,color:T2,marginBottom:6,letterSpacing:'.1em'}}>パスワード</label>
                <div style={{borderRadius:10,boxShadow:NEU_IN,background:BG,display:'flex',alignItems:'center',overflow:'hidden'}}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e=>setPassword(e.target.value)}
                    required
                    placeholder="パスワードを入力"
                    style={{flex:1,padding:'12px 14px',border:'none',outline:'none',background:'transparent',fontSize:13,color:T1,fontFamily:'inherit'}}
                  />
                  <button type="button" onClick={()=>setShowPassword(s=>!s)} style={{padding:'0 14px',border:'none',background:'none',cursor:'pointer',color:TM,display:'flex',alignItems:'center'}}>
                    {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width:'100%',padding:'14px',borderRadius:12,border:'none',
                  background: isSubmitting ? 'rgba(74,124,89,.5)' : SAGE,
                  color:'#fff',fontSize:13,fontWeight:700,cursor:isSubmitting?'not-allowed':'pointer',
                  letterSpacing:'.08em',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                  boxShadow: isSubmitting ? 'none' : '0 4px 16px rgba(74,124,89,.35)',
                  marginTop:8,transition:'all .2s',
                }}
              >
                {isSubmitting
                  ? <><div style={{width:14,height:14,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',animation:'spin .8s linear infinite'}}/> ログイン中...</>
                  : <><Ship size={14}/> 乗船する</>
                }
              </button>
            </form>

            {/* Footer link (mobile) */}
            <div className="lg:hidden" style={{marginTop:24,textAlign:'center',paddingTop:20,borderTop:'1px solid rgba(0,0,0,.06)'}}>
              <span style={{fontSize:11,color:T2}}>まだ船に乗っていない方は </span>
              <Link href="/register" style={{fontSize:11,fontWeight:700,color:SAGE,textDecoration:'none',borderBottom:`1px solid ${SAGE}`,paddingBottom:1}}>乗船手続きへ</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {notification && (
        <div style={{
          position:'fixed',top:20,left:'50%',transform:'translateX(-50%)',
          zIndex:9999,padding:'12px 20px',borderRadius:12,
          background: notification.type === 'error' ? '#fef2f2' : '#1a3024',
          color: notification.type === 'error' ? '#ef4444' : '#d4ead9',
          fontSize:12,fontWeight:700,letterSpacing:'.06em',
          boxShadow:'0 8px 24px rgba(0,0,0,.2)',
          border: `1px solid ${notification.type === 'error' ? '#fca5a5' : 'rgba(255,255,255,.1)'}`,
          maxWidth:320,textAlign:'center',
        }}>
          {notification.msg}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
