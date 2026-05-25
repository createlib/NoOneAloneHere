'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc, addDoc } from 'firebase/firestore';
import { auth, db, APP_ID } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Anchor, Compass, CheckCircle, XCircle, Crown, Ban, Ship, Eye, EyeOff, AlertCircle, LoaderCircle } from 'lucide-react';

// ── Design tokens ──────────────────────────────────────────────────────────────
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

const ADMIN_SECRET = 'admin_start';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const [referrer, setReferrer]           = useState('');
  const [userid, setUserid]               = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPassword, setShowPassword]   = useState(false);

  const [isReferrerValid, setIsReferrerValid] = useState(false);
  const [referrerMsg, setReferrerMsg]     = useState('半角英数字とアンダーバーのみ');
  const [referrerStatus, setReferrerStatus] = useState<'idle'|'checking'|'valid'|'invalid'|'admin'|'ban'>('idle');

  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [notification, setNotification]   = useState<{msg:string, type:'error'|'success'|'info'}|null>(null);

  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam) { setReferrer(refParam); checkReferrer(refParam); }
  }, [searchParams]);

  useEffect(() => {
    if (user && !user.isAnonymous && !loading) router.push('/home');
  }, [user, loading, router]);

  const showNotif = (msg: string, type: 'error'|'success'|'info') => {
    setNotification({ msg, type });
    if (type !== 'info') setTimeout(() => setNotification(null), 3000);
  };

  const handleReferrerChange = (value: string) => {
    setReferrer(value.replace(/[^a-zA-Z0-9_]/g, ''));
  };

  useEffect(() => {
    const id = setTimeout(() => {
      if (referrer !== searchParams.get('ref')) checkReferrer(referrer);
    }, 500);
    return () => clearTimeout(id);
  }, [referrer, searchParams]);

  const checkReferrer = async (value: string) => {
    setIsReferrerValid(false);
    if (!value) { setReferrerMsg('半角英数字とアンダーバーのみ'); setReferrerStatus('idle'); return; }
    if (value === ADMIN_SECRET) { setReferrerMsg('管理者モード: 紹介者チェックをスキップします'); setReferrerStatus('admin'); setIsReferrerValid(true); return; }
    if (value === 'admin') { setReferrerMsg('このIDは紹介者として指定できません'); setReferrerStatus('ban'); return; }
    setReferrerMsg('確認中...'); setReferrerStatus('checking');
    try {
      const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
      const snap = await getDocs(query(usersRef, where("userId", "==", value)));
      if (!snap.empty) {
        const ud = snap.docs[0].data();
        setReferrerMsg(`紹介者: ${ud.name || ud.userId || 'ユーザー'} さんを確認しました`);
        setReferrerStatus('valid'); setIsReferrerValid(true);
      } else {
        setReferrerMsg('該当する紹介者が見つかりません'); setReferrerStatus('invalid');
      }
    } catch { setReferrerMsg('確認できませんでした'); setReferrerStatus('invalid'); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReferrerValid || isSubmitting) return;
    setIsSubmitting(true);
    showNotif('乗船手続き中...', 'info');
    try {
      const usersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'users');
      const idSnap = await getDocs(query(usersRef, where("userId", "==", userid)));
      if (!idSnap.empty) throw new Error("このユーザーIDは既に使用されています。別のIDを指定してください。");

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = cred.user;
      const ts = new Date().toISOString();

      await setDoc(doc(db, 'artifacts', APP_ID, 'users', newUser.uid, 'profile', 'data'), {
        userId: userid, referrerId: referrer||null, email, name: userid,
        createdAt: ts, profilePublic: "true", membershipRank: "arrival",
        // デフォルト公開設定
        birthVisibility: 'none', genderVisibility: 'public',
        hometownVisibility: 'public', activityAreaVisibility: 'public',
      });
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', newUser.uid), {
        userId: userid, name: userid, email, isHidden: true,
        updatedAt: ts, referrerId: referrer||null, profileScore: 0
      });

      if (referrer && referrer !== ADMIN_SECRET) {
        try {
          const refSnap = await getDocs(query(usersRef, where("userId", "==", referrer)));
          if (!refSnap.empty) {
            await addDoc(collection(db, 'artifacts', APP_ID, 'users', refSnap.docs[0].id, 'notifications'), {
              type:'new_member', title:'新しい乗船者',
              body:`あなたの紹介リンクから ${userid} さんがNOAHに乗船しました！`,
              link:`/user?uid=${newUser.uid}`, fromUid: newUser.uid, isRead:false, createdAt:Date.now()
            });
          }
        } catch(e) { console.error("Referral Error:", e); }
      }
      showNotif('乗船手続き完了！ホームへ移動します', 'success');
    } catch (error: any) {
      console.error(error);
      let msg = '登録に失敗しました。';
      if (error.code === 'auth/email-already-in-use') msg = 'このメールアドレスは既に使用されています。';
      if (error.message) msg = error.message;
      showNotif(msg, 'error');
      setIsSubmitting(false);
    }
  };

  // Referrer status icon
  const RefIcon = () => {
    if (referrerStatus === 'checking') return <Compass size={14} style={{color:TM,animation:'spin .8s linear infinite'}}/>;
    if (referrerStatus === 'valid')    return <CheckCircle size={14} style={{color:'#22c55e'}}/>;
    if (referrerStatus === 'invalid')  return <XCircle size={14} style={{color:'#ef4444'}}/>;
    if (referrerStatus === 'admin')    return <Crown size={14} style={{color:'#d4af37'}}/>;
    if (referrerStatus === 'ban')      return <Ban size={14} style={{color:'#ef4444'}}/>;
    return null;
  };
  const refMsgColor = referrerStatus==='valid' ? '#22c55e' : (referrerStatus==='invalid'||referrerStatus==='ban') ? '#ef4444' : TM;

  return (
    <div style={{minHeight:'100vh',display:'flex',background:BG}}>
      {/* ── Left panel (desktop) ── */}
      <div className="hidden lg:flex" style={{
        width:300,flexShrink:0,background:SB,flexDirection:'column',
        padding:'48px 32px',alignItems:'flex-start',justifyContent:'space-between',
      }}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:48}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:'rgba(163,230,53,.12)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Anchor size={16} color={LIME}/>
            </div>
            <span style={{fontSize:18,fontWeight:800,letterSpacing:'.2em',color:'#fff'}}>NOAH</span>
          </div>
          <div style={{color:'rgba(255,255,255,.5)',fontSize:10,letterSpacing:'.12em',marginBottom:16}}>乗船手続き</div>
          <h2 style={{fontSize:26,fontWeight:800,color:'#e8f4ec',lineHeight:1.35,letterSpacing:'.02em'}}>
            NOAHへよう<br/>こそ。<br/>新しい航海が<br/>始まります。
          </h2>
          <div style={{marginTop:32,padding:'14px 16px',background:'rgba(163,230,53,.06)',borderRadius:10,border:'1px solid rgba(163,230,53,.12)'}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,.5)',letterSpacing:'.08em',marginBottom:6}}>紹介者IDとは？</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.6)',lineHeight:1.6}}>NOAHは紹介制のコミュニティです。すでに乗船している仲間のIDを入力してください。</div>
          </div>
        </div>
        <div style={{borderTop:'1px solid rgba(255,255,255,.08)',paddingTop:24,width:'100%'}}>
          <div style={{fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:'.08em',marginBottom:8}}>すでに乗船している？</div>
          <Link href="/login" style={{fontSize:12,fontWeight:700,color:'#7aab88',letterSpacing:'.06em',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,border:'1px solid rgba(255,255,255,.1)',background:'rgba(255,255,255,.04)'}}>
            <Ship size={12}/> ログインへ
          </Link>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'32px 20px'}}>
        {/* Mobile header */}
        <div className="lg:hidden" style={{position:'fixed',top:0,left:0,right:0,padding:'14px 20px',background:SB,display:'flex',alignItems:'center',gap:10,zIndex:10}}>
          <Anchor size={14} color={LIME}/>
          <span style={{fontSize:14,fontWeight:800,letterSpacing:'.18em',color:'#fff'}}>NOAH</span>
        </div>

        <div style={{width:'100%',maxWidth:440,paddingTop:64}} className="lg:pt-0">
          <div style={{background:BG,borderRadius:20,boxShadow:NEU_UP,padding:'36px 32px'}}>
            {/* Mobile title */}
            <div className="lg:hidden" style={{textAlign:'center',marginBottom:28}}>
              <div style={{width:56,height:56,borderRadius:'50%',background:BG,boxShadow:NEU_SM,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',color:SAGE}}>
                <Anchor size={22}/>
              </div>
              <div style={{fontSize:10,color:TM,letterSpacing:'.12em'}}>乗船手続き</div>
            </div>

            <h1 className="hidden lg:block" style={{fontSize:22,fontWeight:800,color:T1,marginBottom:6,letterSpacing:'.04em'}}>新規乗船</h1>
            <p className="hidden lg:block" style={{fontSize:12,color:T2,marginBottom:28,letterSpacing:'.04em'}}>紹介者IDを入力して手続きを完了してください</p>

            <form onSubmit={handleRegister} style={{display:'flex',flexDirection:'column',gap:14}}>

              {/* Referrer */}
              <div>
                <label style={{display:'block',fontSize:10,fontWeight:700,color:T2,marginBottom:6,letterSpacing:'.1em'}}>
                  紹介者ID <span style={{color:'#ef4444'}}>*</span>
                </label>
                <div style={{borderRadius:10,boxShadow:NEU_IN,background:BG,display:'flex',alignItems:'center',overflow:'hidden',opacity:searchParams.get('ref')?0.75:1}}>
                  <input
                    type="text"
                    value={referrer}
                    onChange={e=>handleReferrerChange(e.target.value)}
                    required
                    readOnly={!!searchParams.get('ref')}
                    placeholder="例: yamada_123"
                    style={{flex:1,padding:'12px 14px',border:'none',outline:'none',background:'transparent',fontSize:13,color:T1,fontFamily:'inherit'}}
                  />
                  <div style={{padding:'0 12px',display:'flex',alignItems:'center'}}><RefIcon/></div>
                </div>
                <div style={{fontSize:10,color:refMsgColor,marginTop:5,letterSpacing:'.04em',paddingLeft:2}}>{referrerMsg}</div>
              </div>

              {/* Email */}
              <div>
                <label style={{display:'block',fontSize:10,fontWeight:700,color:T2,marginBottom:6,letterSpacing:'.1em'}}>
                  メールアドレス <span style={{color:'#ef4444'}}>*</span>
                </label>
                <div style={{borderRadius:10,boxShadow:NEU_IN,background:BG,overflow:'hidden'}}>
                  <input
                    type="email"
                    value={email}
                    onChange={e=>setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    style={{width:'100%',padding:'12px 14px',border:'none',outline:'none',background:'transparent',fontSize:13,color:T1,fontFamily:'inherit',boxSizing:'border-box'}}
                  />
                </div>
              </div>

              {/* UserID */}
              <div>
                <label style={{display:'block',fontSize:10,fontWeight:700,color:T2,marginBottom:6,letterSpacing:'.1em'}}>
                  希望ユーザーID <span style={{color:'#ef4444'}}>*</span>
                </label>
                <div style={{borderRadius:10,boxShadow:NEU_IN,background:BG,overflow:'hidden'}}>
                  <input
                    type="text"
                    value={userid}
                    onChange={e=>setUserid(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    required
                    placeholder="半角英数字・アンダーバーのみ"
                    style={{width:'100%',padding:'12px 14px',border:'none',outline:'none',background:'transparent',fontSize:13,color:T1,fontFamily:'inherit',boxSizing:'border-box'}}
                  />
                </div>
                <div style={{fontSize:10,color:TM,marginTop:4,paddingLeft:2}}>後から変更可能です</div>
              </div>

              {/* Password */}
              <div>
                <label style={{display:'block',fontSize:10,fontWeight:700,color:T2,marginBottom:6,letterSpacing:'.1em'}}>
                  パスワード <span style={{color:'#ef4444'}}>*</span>
                </label>
                <div style={{borderRadius:10,boxShadow:NEU_IN,background:BG,display:'flex',alignItems:'center',overflow:'hidden'}}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e=>setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="6文字以上"
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
                disabled={!isReferrerValid || isSubmitting}
                style={{
                  width:'100%',padding:'14px',borderRadius:12,border:'none',
                  background: (!isReferrerValid||isSubmitting) ? 'rgba(74,124,89,.35)' : SAGE,
                  color:'#fff',fontSize:13,fontWeight:700,
                  cursor:(!isReferrerValid||isSubmitting)?'not-allowed':'pointer',
                  letterSpacing:'.08em',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                  boxShadow: (!isReferrerValid||isSubmitting) ? 'none' : '0 4px 16px rgba(74,124,89,.35)',
                  marginTop:8,transition:'all .2s',
                }}
              >
                {isSubmitting
                  ? <><div style={{width:14,height:14,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',animation:'spin .8s linear infinite'}}/> 乗船手続中...</>
                  : <><Ship size={14}/> 登録して乗船する</>
                }
              </button>
            </form>

            {/* Footer link (mobile) */}
            <div className="lg:hidden" style={{marginTop:20,textAlign:'center',paddingTop:18,borderTop:'1px solid rgba(0,0,0,.06)'}}>
              <span style={{fontSize:11,color:T2}}>すでに乗船している方は </span>
              <Link href="/login" style={{fontSize:11,fontWeight:700,color:SAGE,textDecoration:'none',borderBottom:`1px solid ${SAGE}`,paddingBottom:1}}>ログインへ</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {notification && (
        <div style={{
          position:'fixed',top:20,left:'50%',transform:'translateX(-50%)',
          zIndex:9999,padding:'12px 20px',borderRadius:12,
          background: notification.type==='error' ? '#fef2f2' : notification.type==='info' ? '#1a3024' : '#1a3024',
          color: notification.type==='error' ? '#ef4444' : '#d4ead9',
          fontSize:12,fontWeight:700,letterSpacing:'.06em',
          boxShadow:'0 8px 24px rgba(0,0,0,.2)',
          border:`1px solid ${notification.type==='error'?'#fca5a5':'rgba(255,255,255,.1)'}`,
          maxWidth:320,textAlign:'center',
          display:'flex',alignItems:'center',justifyContent:'center',gap:8,
        }}>
          {notification.type==='error'&&<AlertCircle size={14}/>}
          {notification.msg}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function Register() {
  return (
    <Suspense fallback={
      <div style={{minHeight:'100vh',background:'#f5f3f0',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <LoaderCircle size={32} style={{color:'#4a7c59',animation:'spin .8s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <RegisterForm/>
    </Suspense>
  );
}
