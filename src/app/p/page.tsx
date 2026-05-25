'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { db, APP_ID } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Anchor, User as UserIcon, ShieldHalf, Globe, Instagram, Twitter, Check, Gavel, Hammer, Home, MapPin, Briefcase, Play, Mic2 } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// ── Design tokens ──────────────────────────────────────────────────────────────
const SB    = '#1a3024';
const SAGE  = '#4a7c59';
const LIME  = '#8ecfb2';
const AMBER = '#d4af37';
const BG    = '#f5f3f0';
const T1    = '#2a2520';
const T2    = '#7a7068';
const TM    = '#ada49c';
const NEU_UP = '6px 6px 14px rgba(0,0,0,.09),-6px -6px 14px rgba(255,255,255,.85)';
const NEU_SM = '3px 3px 8px rgba(0,0,0,.07),-3px -3px 8px rgba(255,255,255,.8)';
const NEU_IN = 'inset 3px 3px 7px rgba(0,0,0,.07),inset -3px -3px 7px rgba(255,255,255,.75)';

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatText(text: string | undefined | null) {
    if (!text) return '';
    try {
        const textStr = String(text).replace(/__(.*?)__/g, '<u>$1</u>');
        const rawHtml = marked.parse(textStr, { breaks: true, gfm: true }) as string;
        return DOMPurify.sanitize(rawHtml, {
            ALLOWED_TAGS: ['p','br','b','i','em','strong','a','h1','h2','h3','ul','ol','li','u','span','blockquote','code','pre'],
            ALLOWED_ATTR: ['href','target','rel','class','style']
        });
    } catch {
        return DOMPurify.sanitize(text.replace(/\n/g, '<br>'));
    }
}

// ── Rank badge ─────────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: string }) {
    const r = rank?.toLowerCase() || 'arrival';
    const configs: Record<string, { label: string; icon: React.ReactNode; bg: string; color: string; border: string }> = {
        covenant: { label:'COVENANT', icon:<ShieldHalf size={9}/>, bg:'rgba(212,175,55,.12)', color:'#9a7c10', border:'rgba(212,175,55,.35)' },
        guardian: { label:'GUARDIAN', icon:<Gavel size={9}/>, bg:'rgba(74,124,89,.1)', color:SAGE, border:'rgba(74,124,89,.3)' },
        builder:  { label:'BUILDER',  icon:<Hammer size={9}/>, bg:'rgba(100,80,60,.08)', color:'#7a6050', border:'rgba(100,80,60,.25)' },
        settler:  { label:'SETTLER',  icon:<Home size={9}/>, bg:'rgba(173,164,156,.12)', color:T2, border:'rgba(173,164,156,.4)' },
        arrival:  { label:'ARRIVAL',  icon:<Anchor size={9}/>, bg:'rgba(173,164,156,.08)', color:TM, border:'rgba(173,164,156,.3)' },
    };
    const c = configs[r] || configs.arrival;
    return (
        <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:20,fontSize:9,fontWeight:800,letterSpacing:'.1em',background:c.bg,color:c.color,border:`1px solid ${c.border}`}}>
            {c.icon}{c.label}
        </span>
    );
}

// ── MBTI badge ─────────────────────────────────────────────────────────────────
function MbtiBadge({ mbti }: { mbti?: string | null }) {
    if (!mbti || mbti === '未設定') return null;
    const names: Record<string,string> = {
        'INTJ':'建築家','INTP':'論理学者','ENTJ':'指揮官','ENTP':'討論者',
        'INFJ':'提唱者','INFP':'仲介者','ENFJ':'主人公','ENFP':'運動家',
        'ISTJ':'管理者','ISFJ':'擁護者','ESTJ':'幹部','ESFJ':'領事',
        'ISTP':'巨匠','ISFP':'冒険家','ESTP':'起業家','ESFP':'エンターテイナー'
    };
    const analysts  = ['INTJ','INTP','ENTJ','ENTP'];
    const diplomats = ['INFJ','INFP','ENFJ','ENFP'];
    const sentinels = ['ISTJ','ISFJ','ESTJ','ESFJ'];
    let bg='rgba(173,164,156,.12)', color=T2, border='rgba(173,164,156,.3)';
    if (analysts.includes(mbti))  { bg='rgba(139,92,246,.08)'; color='#7c3aed'; border='rgba(139,92,246,.25)'; }
    if (diplomats.includes(mbti)) { bg='rgba(74,124,89,.08)';  color=SAGE;      border='rgba(74,124,89,.25)'; }
    if (sentinels.includes(mbti)) { bg='rgba(59,130,246,.08)'; color='#2563eb'; border='rgba(59,130,246,.25)'; }
    return (
        <span style={{display:'inline-flex',alignItems:'center',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:800,letterSpacing:'.06em',background:bg,color,border:`1px solid ${border}`,fontFamily:'monospace'}}>
            {mbti}{names[mbti] ? ` (${names[mbti]})` : ''}
        </span>
    );
}

// ── Section card ───────────────────────────────────────────────────────────────
function SectionCard({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
    return (
        <div style={{background:BG,borderRadius:16,boxShadow:NEU_UP,padding:'20px 22px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,paddingBottom:12,borderBottom:'1px solid rgba(0,0,0,.06)'}}>
                {accent && <div style={{width:3,height:14,borderRadius:2,background:accent,flexShrink:0}}/>}
                <h2 style={{fontSize:12,fontWeight:800,color:T1,letterSpacing:'.1em',margin:0}}>{title}</h2>
            </div>
            {children}
        </div>
    );
}

// ── Tag chip ───────────────────────────────────────────────────────────────────
function Tag({ label }: { label: string }) {
    return (
        <span style={{display:'inline-flex',padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:600,color:T2,background:BG,boxShadow:NEU_SM,letterSpacing:'.04em'}}>
            #{label}
        </span>
    );
}

// ── Main ───────────────────────────────────────────────────────────────────────
function PublicProfileContent() {
    const searchParams = useSearchParams();
    const targetUid = searchParams?.get('uid');

    const [userData, setUserData] = useState<any>(null);
    const [userVideos, setUserVideos] = useState<any[]>([]);
    const [userPodcasts, setUserPodcasts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!targetUid) {
            const t = setTimeout(() => setLoading(false), 800);
            return () => clearTimeout(t);
        }
        const loadData = async () => {
            setLoading(true);
            try {
                const userRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', targetUid);
                let userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    const fallback = doc(db, 'artifacts', APP_ID, 'users', targetUid);
                    userSnap = await getDoc(fallback);
                    if (!userSnap.exists()) { setUserData(null); setLoading(false); return; }
                }
                const d = userSnap.data();
                setUserData(d);
                try {
                    const vSnap = await getDocs(query(collection(db,'artifacts',APP_ID,'public','data','videos'), where('authorId','==',targetUid)));
                    const vMap = vSnap.docs.map(x=>({id:x.id,...x.data()}));
                    vMap.sort((a:any,b:any)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime());
                    setUserVideos(vMap);
                    const pSnap = await getDocs(query(collection(db,'artifacts',APP_ID,'public','data','podcasts'), where('authorId','==',targetUid)));
                    const pMap = pSnap.docs.map(x=>({id:x.id,...x.data()}));
                    pMap.sort((a:any,b:any)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime());
                    setUserPodcasts(pMap);
                } catch(e) { console.error('Media fetch error',e); }
            } catch(e) { console.error(e); }
            finally { setLoading(false); }
        };
        loadData();
    }, [targetUid]);

    if (loading) {
        return (
            <div style={{minHeight:'100vh',background:BG,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
                <div style={{width:36,height:36,borderRadius:'50%',border:`3px solid rgba(74,124,89,.15)`,borderTopColor:SAGE,animation:'spin .8s linear infinite'}}/>
                <div style={{fontSize:11,color:TM,letterSpacing:'.1em'}}>プロフィールを読み込み中...</div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    if (!userData) {
        return (
            <div style={{minHeight:'100vh',background:BG,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
                <div style={{background:BG,borderRadius:20,boxShadow:NEU_UP,padding:'48px 36px',textAlign:'center',maxWidth:360}}>
                    <div style={{width:64,height:64,borderRadius:'50%',background:BG,boxShadow:NEU_SM,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',color:TM}}>
                        <UserIcon size={26}/>
                    </div>
                    <div style={{fontSize:16,fontWeight:800,color:T1,marginBottom:8}}>ユーザーが見つかりません</div>
                    <div style={{fontSize:12,color:T2,lineHeight:1.7}}>IDが間違っているか、存在しないページです。</div>
                </div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    const rank = userData.membershipRank || 'arrival';

    return (
        <div style={{minHeight:'100vh',background:BG,fontFamily:'sans-serif'}}>

            {/* ── Topbar ── */}
            <div style={{background:SB,height:48,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 12px rgba(0,0,0,.2)'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,color:'#e8f4ec',fontSize:14,fontWeight:900,letterSpacing:'.22em'}}>
                    <Anchor size={13} color={LIME}/> NOAH
                </div>
            </div>

            {/* ── Page body ── */}
            <div style={{maxWidth:1080,margin:'0 auto',padding:'28px 16px 80px'}}>
                <div className="pub-layout">

                    {/* ── Sidebar ── */}
                    <aside className="pub-sidebar">
                        <div style={{background:BG,borderRadius:20,boxShadow:NEU_UP,padding:'28px 22px',display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>

                            {/* Avatar — plain, no banner behind */}
                            <div style={{width:96,height:96,borderRadius:'50%',overflow:'hidden',boxShadow:NEU_UP,display:'flex',alignItems:'center',justifyContent:'center',fontSize:34,fontWeight:700,color:AMBER,background:BG,flexShrink:0}}>
                                {userData.photoURL
                                    ? <img src={userData.photoURL} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                    : (userData.name||'?')[0]
                                }
                            </div>

                            {/* Name + badges */}
                            <div style={{textAlign:'center'}}>
                                <h1 style={{fontSize:18,fontWeight:800,color:T1,margin:'0 0 4px',letterSpacing:'.02em'}}>{userData.name || userData.userId || '名無し'}</h1>
                                <div style={{fontSize:11,color:TM,fontFamily:'monospace',marginBottom:8}}>@{userData.userId||'unknown'}</div>
                                <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:6}}>
                                    <RankBadge rank={rank}/>
                                    <MbtiBadge mbti={userData.mbti}/>
                                </div>
                            </div>

                            <div style={{width:'100%',height:1,background:'rgba(0,0,0,.06)'}}/>

                            {/* Info list */}
                            <div style={{width:'100%',display:'flex',flexDirection:'column',gap:10}}>
                                {userData.jobTitle && (
                                    <div style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:12,color:T2,lineHeight:1.5}}>
                                        <Briefcase size={13} color={SAGE} style={{flexShrink:0,marginTop:1}}/>{userData.jobTitle}
                                    </div>
                                )}
                                {userData.prefecture && (
                                    <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:T2}}>
                                        <MapPin size={13} color={SAGE} style={{flexShrink:0}}/>{userData.prefecture}
                                    </div>
                                )}
                                {userData.birthplace && (
                                    <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:T2}}>
                                        <Home size={13} color={TM} style={{flexShrink:0}}/>{userData.birthplace}出身
                                    </div>
                                )}
                            </div>

                            {/* SNS */}
                            {(userData.websiteUrl || userData.snsInstagram || userData.snsX) && (
                                <>
                                    <div style={{width:'100%',height:1,background:'rgba(0,0,0,.06)'}}/>
                                    <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                                        {userData.websiteUrl && (
                                            <a href={userData.websiteUrl} target="_blank" rel="noreferrer" style={{width:36,height:36,borderRadius:'50%',background:BG,boxShadow:NEU_SM,display:'flex',alignItems:'center',justifyContent:'center',color:T2,textDecoration:'none'}}>
                                                <Globe size={14}/>
                                            </a>
                                        )}
                                        {userData.snsInstagram && (
                                            <a href={userData.snsInstagram.startsWith('http') ? userData.snsInstagram : 'https://instagram.com/'+userData.snsInstagram} target="_blank" rel="noreferrer" style={{width:36,height:36,borderRadius:'50%',background:BG,boxShadow:NEU_SM,display:'flex',alignItems:'center',justifyContent:'center',color:T2,textDecoration:'none'}}>
                                                <Instagram size={14}/>
                                            </a>
                                        )}
                                        {userData.snsX && (
                                            <a href={userData.snsX.startsWith('http') ? userData.snsX : 'https://twitter.com/'+userData.snsX} target="_blank" rel="noreferrer" style={{width:36,height:36,borderRadius:'50%',background:BG,boxShadow:NEU_SM,display:'flex',alignItems:'center',justifyContent:'center',color:T2,textDecoration:'none'}}>
                                                <Twitter size={14}/>
                                            </a>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </aside>

                    {/* ── Main content ── */}
                    <main style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:16}}>

                        {userData.bio && (
                            <SectionCard title="自己紹介" accent={SAGE}>
                                <div className="pub-prose" dangerouslySetInnerHTML={{__html: formatText(userData.bio)}}/>
                            </SectionCard>
                        )}

                        {userData.message && (
                            <SectionCard title="自分を表現する" accent={AMBER}>
                                <div className="pub-prose" dangerouslySetInnerHTML={{__html: formatText(userData.message)}}/>
                            </SectionCard>
                        )}

                        {(userData.skills?.length > 0 || userData.hobbies?.length > 0) && (
                            <div className="pub-pair">
                                {userData.skills?.length > 0 && (
                                    <SectionCard title="スキル" accent={SAGE}>
                                        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                                            {userData.skills.map((s:string,i:number)=><Tag key={i} label={s}/>)}
                                        </div>
                                    </SectionCard>
                                )}
                                {userData.hobbies?.length > 0 && (
                                    <SectionCard title="趣味・興味" accent={TM}>
                                        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                                            {userData.hobbies.map((h:string,i:number)=><Tag key={i} label={h}/>)}
                                        </div>
                                    </SectionCard>
                                )}
                            </div>
                        )}

                        {(userData.canOffer?.length > 0 || userData.lookingFor?.length > 0) && (
                            <div className="pub-pair">
                                {userData.canOffer?.length > 0 && (
                                    <SectionCard title="提供できること" accent={SAGE}>
                                        <ul style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:8}}>
                                            {userData.canOffer.map((item:string,i:number)=>(
                                                <li key={i} style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:13,color:T1,lineHeight:1.6}}>
                                                    <Check size={13} color={SAGE} style={{flexShrink:0,marginTop:2}}/>{item}
                                                </li>
                                            ))}
                                        </ul>
                                    </SectionCard>
                                )}
                                {userData.lookingFor?.length > 0 && (
                                    <SectionCard title="求めていること" accent={AMBER}>
                                        <ul style={{listStyle:'none',padding:0,margin:0,display:'flex',flexDirection:'column',gap:8}}>
                                            {userData.lookingFor.map((item:string,i:number)=>(
                                                <li key={i} style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:13,color:T1,lineHeight:1.6}}>
                                                    <Check size={13} color={AMBER} style={{flexShrink:0,marginTop:2}}/>{item}
                                                </li>
                                            ))}
                                        </ul>
                                    </SectionCard>
                                )}
                            </div>
                        )}

                        {userData.career?.length > 0 && (
                            <SectionCard title="主な経歴・活動史" accent={T2}>
                                <div style={{position:'relative',paddingLeft:20}}>
                                    <div style={{position:'absolute',left:6,top:4,bottom:4,width:1,background:'rgba(0,0,0,.08)'}}/>
                                    <div style={{display:'flex',flexDirection:'column',gap:20}}>
                                        {userData.career.map((c:any,i:number)=>(
                                            <div key={i} style={{position:'relative'}}>
                                                <div style={{position:'absolute',left:-22,top:4,width:12,height:12,borderRadius:'50%',background:AMBER,border:`2px solid ${BG}`,boxShadow:NEU_SM}}/>
                                                <div style={{fontSize:14,fontWeight:800,color:T1,marginBottom:4}}>{c.company||'会社名不明'}</div>
                                                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:8}}>
                                                    <span style={{fontSize:10,fontWeight:700,color:SAGE,background:'rgba(74,124,89,.1)',border:'1px solid rgba(74,124,89,.2)',padding:'2px 8px',borderRadius:10}}>{c.role||'役割'}</span>
                                                    <span style={{fontSize:10,color:TM}}>{c.start||'?'} 〜 {c.end||'現在'}</span>
                                                </div>
                                                {c.description && (
                                                    <div style={{background:'rgba(0,0,0,.03)',borderRadius:10,padding:'10px 14px',boxShadow:NEU_IN}}>
                                                        <div className="pub-prose" dangerouslySetInnerHTML={{__html: formatText(c.description)}}/>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </SectionCard>
                        )}

                        {(userVideos.length > 0 || userPodcasts.length > 0) && (
                            <SectionCard title="メディア・発信録" accent={T2}>
                                {userVideos.length > 0 && (
                                    <div style={{marginBottom:20}}>
                                        <div style={{fontSize:10,fontWeight:700,color:TM,letterSpacing:'.1em',marginBottom:10}}>公開動画 ({userVideos.length})</div>
                                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10}}>
                                            {userVideos.map((v:any,i:number)=>(
                                                <a key={i} href={`/media/videos/detail?id=${v.id}`} target="_blank" rel="noreferrer" style={{textDecoration:'none',display:'flex',gap:10,background:BG,boxShadow:NEU_SM,borderRadius:10,padding:8}}>
                                                    <div style={{width:60,height:42,borderRadius:6,overflow:'hidden',flexShrink:0,background:'#111',position:'relative'}}>
                                                        <img src={v.thumbnailUrl||'https://via.placeholder.com/120x80?text=VIDEO'} alt="" style={{width:'100%',height:'100%',objectFit:'cover',opacity:.85}}/>
                                                        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                                                            <Play size={11} color="#fff" fill="#fff"/>
                                                        </div>
                                                    </div>
                                                    <div style={{flex:1,minWidth:0,fontSize:11,fontWeight:700,color:T1,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{v.title}</div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {userPodcasts.length > 0 && (
                                    <div>
                                        <div style={{fontSize:10,fontWeight:700,color:TM,letterSpacing:'.1em',marginBottom:10}}>公開ラジオ ({userPodcasts.length})</div>
                                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:10}}>
                                            {userPodcasts.map((p:any,i:number)=>{
                                                const m=p.duration?Math.floor(p.duration/60):0;
                                                const s=p.duration?Math.floor(p.duration%60):0;
                                                const dur=p.duration?`${m}:${s<10?'0'+s:s}`:'';
                                                return(
                                                    <a key={i} href={`/media/podcasts/detail?id=${p.id}`} target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
                                                        <div style={{borderRadius:10,boxShadow:NEU_SM,background:BG,padding:6}}>
                                                            <div style={{width:'100%',aspectRatio:'1',borderRadius:8,overflow:'hidden',position:'relative',marginBottom:6}}>
                                                                <img src={p.thumbnailUrl||'https://via.placeholder.com/300x300?text=CAST'} alt={p.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                                                <div style={{position:'absolute',bottom:4,right:4,display:'flex',gap:3,alignItems:'center',background:'rgba(0,0,0,.65)',borderRadius:4,padding:'2px 5px'}}>
                                                                    <Mic2 size={8} color="#fff"/>
                                                                    {dur && <span style={{fontSize:8,color:'#fff',fontWeight:700}}>{dur}</span>}
                                                                </div>
                                                            </div>
                                                            <div style={{fontSize:10,fontWeight:700,color:T1,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',padding:'0 2px'}}>{p.title||'タイトルなし'}</div>
                                                        </div>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </SectionCard>
                        )}

                        <div style={{textAlign:'center',paddingTop:8}}>
                            <a href="/" style={{display:'inline-flex',alignItems:'center',gap:6,textDecoration:'none',color:TM,fontSize:10,letterSpacing:'.12em'}}>
                                <Anchor size={10} color={SAGE}/> powered by NOAH
                            </a>
                        </div>
                    </main>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }

                .pub-layout {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .pub-sidebar { width: 100%; }
                .pub-pair    { display: flex; flex-direction: column; gap: 16px; }

                @media (min-width: 800px) {
                    .pub-layout {
                        flex-direction: row;
                        align-items: flex-start;
                        gap: 24px;
                    }
                    .pub-sidebar {
                        width: 260px;
                        flex-shrink: 0;
                        position: sticky;
                        top: 64px;
                    }
                    .pub-pair {
                        flex-direction: row;
                        gap: 16px;
                    }
                    .pub-pair > * { flex: 1; min-width: 0; }
                }

                .pub-prose { font-size: 13px; color: ${T2}; line-height: 1.75; }
                .pub-prose p { margin: 0 0 8px; }
                .pub-prose h1,.pub-prose h2,.pub-prose h3 { color: ${T1}; font-weight: 800; margin: 12px 0 6px; }
                .pub-prose a { color: ${SAGE}; text-decoration: underline; }
                .pub-prose ul,.pub-prose ol { padding-left: 18px; margin: 6px 0; }
                .pub-prose blockquote { border-left: 3px solid ${SAGE}; padding-left: 10px; color: ${TM}; margin: 8px 0; }
                .pub-prose code { background: rgba(0,0,0,.05); padding: 1px 5px; border-radius: 4px; font-family: monospace; font-size: 12px; }
            `}</style>
        </div>
    );
}

export default function PublicProfilePageWrapper() {
    return (
        <Suspense fallback={
            <div style={{minHeight:'100vh',background:'#f5f3f0',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
                <div style={{width:36,height:36,borderRadius:'50%',borderTop:`3px solid #4a7c59`,borderRight:'3px solid transparent',animation:'spin .8s linear infinite'}}/>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        }>
            <PublicProfileContent/>
        </Suspense>
    );
}
