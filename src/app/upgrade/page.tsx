'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { db, APP_ID } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, ArrowLeft, ShieldHalf, CheckCircle, Clock, Check, X, Shield, Award } from 'lucide-react';

export default function UpgradePage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rank, setRank] = useState('arrival');

  useEffect(() => {
    if (authLoading) return;
    
    // NOTE: Mock admin check skipped in production Next.js flow, relying strictly on DB auth.
    if (user) {
      const fetchRank = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'profile', 'data'));
          if (docSnap.exists()) {
            setRank(docSnap.data().membershipRank || 'arrival');
          } else {
            setRank('arrival');
          }
        } catch (e) {
          console.error(e);
          setRank('arrival');
        } finally {
          setLoading(false);
        }
      };
      fetchRank();
    } else {
      setLoading(false);
      // Optional: redirect to login if forced, but keeping accessible is fine, just they can't upgrade.
    }
  }, [user, authLoading]);

  // numeric rank for logic
  const rankLevels: Record<string, number> = { 'arrival': 0, 'settler': 1, 'builder': 2, 'guardian': 3, 'covenant': 4, 'admin': 99 };
  const rLevel = rankLevels[rank] || 0;

  const currentPlanStyle = "mt-auto w-full py-3.5 bg-[#f7f5f0] text-[#a09080] font-bold text-xs tracking-widest border border-[#dcd4c6] cursor-not-allowed flex justify-center items-center gap-2";
  const downgradeMsgStyle = "mt-auto w-full py-3.5 bg-[#f7f5f0]/50 text-[#a09080] font-bold text-[10px] tracking-widest cursor-not-allowed text-center border border-dashed border-[#e8dfd1]";
  const upgradeStyleDefault = "mt-auto block text-center w-full py-3.5 bg-[#8b6a4f] text-[#fffdf9] font-bold text-xs tracking-widest hover:bg-[#725b3f] transition-colors shadow-md";
  const upgradeStyleCov = "mt-auto block text-center w-full py-4 bg-gradient-to-r from-[#d4af37] to-[#b8860b] text-[#2a1a17] font-bold text-sm tracking-widest hover:from-[#b8860b] hover:to-[#996515] hover:text-[#fffdf9] transition-all shadow-md transform hover:-translate-y-0.5";

  const renderButton = (planId: string, planLevel: number, url: string) => {
    if (planLevel === rLevel || (planLevel === 4 && rLevel === 99)) {
       return (
         <button className={currentPlanStyle} disabled>
            <CheckCircle className="w-4 h-4" />現在のプラン
         </button>
       );
    } else if (planLevel < rLevel && rLevel !== 99) {
       return (
         <div className={downgradeMsgStyle}>
            ※ダウングレードは運営へお問い合わせください
         </div>
       );
    } else {
       if (planId === 'covenant') {
         return (
            <a href={url} target="_blank" className={upgradeStyleCov}>契約を結ぶ</a>
         );
       } else {
         return (
            <a href={url} target="_blank" className={upgradeStyleDefault}>契約を変更する</a>
         );
       }
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-texture">
      {/* Home Return Link */}
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8 z-20">
        <Link href="/home" className="inline-flex items-center text-xs font-bold text-[#8b6a4f] hover:text-[#5c4a3d] transition-colors tracking-widest">
          <ArrowLeft className="mr-2 w-4 h-4" />
          ホームに戻る
        </Link>
      </div>

      <div className="max-w-6xl mx-auto pt-10">
        {/* Header */}
        <div className="text-center mb-16">
          <ShieldHalf className="w-10 h-10 text-[#8b6a4f] mx-auto mb-4" strokeWidth={1.5} />
          <h1 className="text-3xl font-bold text-[#3e2723] sm:text-4xl font-serif tracking-widest">Upgrade Role</h1>
          <p className="mt-4 text-sm text-[#725b3f] tracking-widest uppercase">契約の確認・変更</p>
          <div className="w-16 h-[1px] bg-[#8b6a4f] mt-6 mx-auto"></div>
        </div>

        {loading || authLoading ? (
          <div className="text-center py-10">
              <Loader2 className="w-8 h-8 text-[#8b6a4f] animate-spin mx-auto mb-4" />
              <p className="text-xs text-[#5c4a3d] tracking-widest font-bold">現在の契約状況を確認しています...</p>
          </div>
        ) : (
          <div>
            {/* Kyomei Section */}
            <div className="bg-gradient-to-br from-[#fffdf9] to-[#f7f5f0] border border-[#d4af37] p-8 sm:p-12 mb-16 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-[#b8860b] m-4 pointer-events-none opacity-50"></div>
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-[#b8860b] m-4 pointer-events-none opacity-50"></div>
                
                <div className="text-center mb-8 relative z-10">
                    <h2 className="text-2xl sm:text-3xl font-bold text-[#3e2723] font-serif tracking-widest mb-2">共鳴価格制度</h2>
                    <p className="text-sm text-[#8b6a4f] tracking-widest">― 価格は、つながりの深さで決まる ―</p>
                </div>
                
                <div className="max-w-3xl mx-auto text-[#5c4a3d] space-y-6 relative z-10 text-sm sm:text-base leading-relaxed">
                    <p className="text-center font-bold text-[#4a3b32] text-lg">
                        NOAHでは、紹介した人数ではなく<br className="hidden sm:block" />
                        <span className="text-[#b8860b] text-xl border-b-2 border-[#b8860b] pb-1">「今も共に在るか」</span>を大切にします。
                    </p>
                    <p className="text-center">
                        あなた自身と、あなたが迎え入れた5人が<br className="hidden sm:block" />
                        共にプロフィール100%の状態を保っている限り、特別価格が適用されます。
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        <div className="bg-white p-6 border border-[#e8dfd1] shadow-sm relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#8b6a4f]"></div>
                            <h4 className="font-bold text-[#3e2723] mb-3 border-b border-[#e8dfd1] pb-2 flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-[#8b6a4f]" />適用条件（更新時判定）</h4>
                            <ul className="space-y-2 text-sm font-medium">
                                <li>・自分のプロフィールが <span className="text-[#b8860b] font-bold">100%</span></li>
                                <li>・紹介した5名が同時に <span className="text-[#b8860b] font-bold">100%</span></li>
                            </ul>
                            <p className="text-[10px] text-[#725b3f] mt-4 leading-relaxed">※更新タイミングで条件を満たしていれば、その月の請求から優遇価格が適用されます。</p>
                        </div>
                        
                        <div className="bg-white p-6 border border-[#e8dfd1] shadow-sm relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#c8b9a6]"></div>
                            <h4 className="font-bold text-[#3e2723] mb-3 border-b border-[#e8dfd1] pb-2 flex items-center"><Clock className="w-4 h-4 mr-2 text-[#8b6a4f]" />猶予ルール</h4>
                            <p className="text-sm mb-2 font-medium">更新時に未達の場合：</p>
                            <ul className="space-y-2 text-sm">
                                <li>・<span className="text-[#b8860b] font-bold">1回分</span>の猶予期間あり</li>
                                <li>・次回更新時に再達成すれば優遇復帰</li>
                            </ul>
                            <p className="text-xs text-[#8b6a4f] mt-4 font-bold tracking-widest text-center border-t border-dashed border-[#e8dfd1] pt-3">関係はやり直せます。NOAHは恐怖で縛りません。</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pricing Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16 items-stretch">
                
                {/* ARRIVAL */}
                <div className="bg-[#fffdf9] p-6 sm:p-8 border border-[#c8b9a6] shadow-sm flex flex-col relative h-full">
                    <div className="absolute top-0 right-0 bg-[#8b6a4f] text-white text-[10px] px-3 py-1 font-bold tracking-widest">無料</div>
                    <div className="mb-5">
                        <h3 className="text-xl font-bold text-[#3e2723] mb-1 font-serif tracking-widest">ARRIVAL</h3>
                        <p className="text-xs text-[#8b6a4f] font-bold tracking-widest">出会いと自己理解の入口</p>
                    </div>
                    <div className="text-3xl font-serif text-[#3e2723] mb-6">¥0 <span className="text-xs text-[#725b3f] font-sans">/ 月</span></div>
                    
                    <div className="flex-grow space-y-6 mb-8">
                        <div>
                            <p className="text-[10px] font-bold text-[#8b6a4f] mb-3 border-b border-[#e8dfd1] pb-1 uppercase tracking-widest">できること</p>
                            <ul className="space-y-2 text-xs text-[#5c4a3d]">
                                <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />プロフィール作成</li>
                                <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />プロフ100%達成で診断レポートDL</li>
                                <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />ユーザー一覧閲覧（検索不可）</li>
                                <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />イベント参加</li>
                                <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />コンテンツ閲覧</li>
                            </ul>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[#a09080] mb-3 border-b border-[#e8dfd1] pb-1 uppercase tracking-widest">できないこと</p>
                            <ul className="space-y-2 text-xs text-[#a09080] opacity-80">
                                <li className="flex items-start leading-snug"><X className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0" />イベント作成</li>
                                <li className="flex items-start leading-snug"><X className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0" />仕事・依頼掲載</li>
                                <li className="flex items-start leading-snug"><X className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0" />動画投稿 / Podcast投稿</li>
                                <li className="flex items-start leading-snug"><X className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0" />生配信参加（リスナー含む）</li>
                                <li className="flex items-start leading-snug"><X className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0" />診断60分類検索</li>
                            </ul>
                        </div>
                    </div>
                    {renderButton('arrival', 0, '#')}
                </div>

                {/* SETTLER */}
                <div className="bg-[#fffdf9] p-6 sm:p-8 border-2 border-[#8b6a4f] shadow-lg flex flex-col relative h-full transform lg:-translate-y-2">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#8b6a4f] text-[#fffdf9] px-4 py-0.5 text-[10px] font-bold tracking-widest rounded-sm shadow-sm whitespace-nowrap">STANDARD</div>
                    <div className="mb-5 mt-2">
                        <h3 className="text-xl font-bold text-[#3e2723] mb-1 font-serif tracking-widest">SETTLER</h3>
                        <p className="text-xs text-[#8b6a4f] font-bold tracking-widest">居場所をつくる人</p>
                    </div>
                    <div className="mb-6 bg-brand-50 p-4 rounded-sm border border-[#e8dfd1]">
                        <div className="text-[11px] text-[#725b3f] mb-1 font-bold">通常: ¥3,300 / 月</div>
                        <div className="text-2xl font-serif text-[#3e2723] font-bold flex items-end gap-1">
                            <span className="text-[10px] font-sans text-[#b8860b] mb-1.5">共鳴価格</span>¥2,750 <span className="text-[10px] text-[#725b3f] font-sans mb-1.5">/ 月</span>
                        </div>
                    </div>
                    <div className="flex-grow space-y-6 mb-8">
                        <div>
                            <p className="text-[10px] font-bold text-[#8b6a4f] mb-3 border-b border-[#e8dfd1] pb-1 uppercase tracking-widest">できること</p>
                            <ul className="space-y-2 text-xs text-[#5c4a3d]">
                                <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" /><span className="font-bold text-[#3e2723]">ARRIVALの全機能</span></li>
                                <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />イベント作成／募集</li>
                                <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />動画投稿 / Podcast投稿</li>
                                <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />生配信リスナー参加</li>
                                <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />診断60分類検索</li>
                            </ul>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[#a09080] mb-3 border-b border-[#e8dfd1] pb-1 uppercase tracking-widest">できないこと</p>
                            <ul className="space-y-2 text-xs text-[#a09080] opacity-80">
                                <li className="flex items-start leading-snug"><X className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0" />生配信登壇 / 生配信主催</li>
                                <li className="flex items-start leading-snug"><X className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0" />仕事・依頼掲載</li>
                            </ul>
                        </div>
                    </div>
                    {renderButton('settler', 1, 'https://buy.stripe.com/eVq4gz28G87Bb0ldXY7bW08')}
                </div>

                {/* BUILDER */}
                <div className="bg-[#fffdf9] p-6 sm:p-8 border border-[#c8b9a6] shadow-sm flex flex-col relative h-full">
                    <div className="mb-5">
                        <h3 className="text-xl font-bold text-[#3e2723] mb-1 font-serif tracking-widest">BUILDER</h3>
                        <p className="text-xs text-[#8b6a4f] font-bold tracking-widest">関係を育てる人</p>
                    </div>
                    <div className="mb-6 bg-brand-50 p-4 rounded-sm border border-[#e8dfd1]">
                        <div className="text-[11px] text-[#725b3f] mb-1 font-bold">通常: ¥6,600 / 月</div>
                        <div className="text-2xl font-serif text-[#3e2723] font-bold flex items-end gap-1">
                            <span className="text-[10px] font-sans text-[#b8860b] mb-1.5">共鳴価格</span>¥5,500 <span className="text-[10px] text-[#725b3f] font-sans mb-1.5">/ 月</span>
                        </div>
                    </div>
                    <div className="flex-grow space-y-6 mb-8">
                        <div>
                            <p className="text-[10px] font-bold text-[#8b6a4f] mb-3 border-b border-[#e8dfd1] pb-1 uppercase tracking-widest">できること</p>
                            <ul className="space-y-2 text-xs text-[#5c4a3d]">
                                <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" /><span className="font-bold text-[#3e2723]">SETTLERの全機能</span></li>
                                <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />生配信への登壇申請</li>
                                <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />仕事・依頼掲載</li>
                            </ul>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-[#a09080] mb-3 border-b border-[#e8dfd1] pb-1 uppercase tracking-widest">できないこと</p>
                            <ul className="space-y-2 text-xs text-[#a09080] opacity-80">
                                <li className="flex items-start leading-snug"><X className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0" />生配信主催</li>
                            </ul>
                        </div>
                    </div>
                    {renderButton('builder', 2, '#')}
                </div>

                {/* GUARDIAN */}
                <div className="bg-[#fffdf9] p-6 sm:p-8 border border-[#c8b9a6] shadow-sm flex flex-col relative h-full">
                    <div className="mb-5">
                        <h3 className="text-xl font-bold text-[#3e2723] mb-1 font-serif tracking-widest">GUARDIAN</h3>
                        <p className="text-xs text-[#8b6a4f] font-bold tracking-widest">場を守り、創る人</p>
                    </div>
                    <div className="mb-6 bg-brand-50 p-4 rounded-sm border border-[#e8dfd1]">
                        <div className="text-[11px] text-[#725b3f] mb-1 font-bold">通常: ¥9,900 / 月</div>
                        <div className="text-2xl font-serif text-[#3e2723] font-bold flex items-end gap-1">
                            <span className="text-[10px] font-sans text-[#b8860b] mb-1.5">共鳴価格</span>¥7,700 <span className="text-[10px] text-[#725b3f] font-sans mb-1.5">/ 月</span>
                        </div>
                    </div>
                    <div className="flex-grow mb-8">
                        <p className="text-[10px] font-bold text-[#8b6a4f] mb-3 border-b border-[#e8dfd1] pb-1 uppercase tracking-widest">できること</p>
                        <ul className="space-y-2 text-xs text-[#5c4a3d]">
                            <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" /><span className="font-bold text-[#3e2723]">BUILDERの全機能</span></li>
                            <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />生配信主催（ライブ立ち上げ）</li>
                            <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />MEDIA LOGでのシリーズ化</li>
                            <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />コンテンツの体系化</li>
                            <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />仕事・依頼掲載</li>
                            <li className="flex items-start leading-snug">
                                <Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#8b6a4f] shrink-0" />
                                <div>
                                    <span className="font-bold text-[#3e2723] border-b border-[#e8dfd1]">NOAH独自アプリ・システムのフルアクセス</span>
                                    <p className="text-[9px] text-[#8b6a4f] mt-1 leading-tight">※今後リリースされる各種支援ツールも解放されます</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                    {renderButton('guardian', 3, '#')}
                </div>

                {/* COVENANT */}
                <div className="bg-gradient-to-br from-[#2a1a17] to-[#3e2723] p-1 shadow-2xl relative lg:col-span-2 flex flex-col h-full">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#d4af37] text-[#2a1a17] px-4 py-1 font-bold text-xs tracking-widest flex items-center gap-1 border border-[#8b6a4f] shadow-sm whitespace-nowrap z-10">
                        <Shield className="w-3 h-3" /> 特別枠
                    </div>
                    <div className="bg-[#fffdf9] p-6 sm:p-8 border border-[#d4af37] h-full flex flex-col sm:flex-row gap-6 sm:gap-10">
                        <div className="flex-1 flex flex-col">
                            <div className="mb-5">
                                <h3 className="text-2xl font-bold text-[#3e2723] mb-1 font-serif tracking-widest">COVENANT</h3>
                                <p className="text-xs text-[#8b6a4f] font-bold tracking-widest">契約者 / 中核層</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
                                <div>
                                    <p className="text-[10px] font-bold text-[#8b6a4f] mb-3 border-b border-[#e8dfd1] pb-1 uppercase tracking-widest">立ち位置</p>
                                    <ul className="space-y-2 text-xs text-[#5c4a3d]">
                                        <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#b8860b] shrink-0" /><span className="font-bold text-[#3e2723]">GUARDIAN相当の全機能</span></li>
                                        <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#b8860b] shrink-0" />思想的契約者</li>
                                        <li className="flex items-start leading-snug"><Check className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#b8860b] shrink-0" />長期参加前提</li>
                                    </ul>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-[#8b6a4f] mb-3 border-b border-[#e8dfd1] pb-1 uppercase tracking-widest">追加特典</p>
                                    <ul className="space-y-2 text-xs text-[#5c4a3d]">
                                        <li className="flex items-start leading-snug"><Award className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#b8860b] shrink-0" />中核メンバーバッジ表示</li>
                                        <li className="flex items-start leading-snug"><Award className="w-3.5 h-3.5 mr-2 mt-0.5 text-[#b8860b] shrink-0" />年1回 COVENANT限定MTG</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="w-full sm:w-[280px] flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-[#e8dfd1] pt-6 sm:pt-0 sm:pl-8 shrink-0">
                            <div className="space-y-3 mb-8">
                                <div className="flex justify-between items-end border-b border-dashed border-[#e8dfd1] pb-1">
                                    <span className="text-xs text-[#725b3f] font-bold">通常</span>
                                    <span className="text-sm text-[#725b3f]">¥59,400 <span className="text-[10px]">/ 年</span></span>
                                </div>
                                <div className="flex justify-between items-end border-b border-dashed border-[#e8dfd1] pb-1">
                                    <span className="text-xs text-[#b8860b] font-bold">共鳴価格<span className="text-[9px] ml-1">(永久優遇)</span></span>
                                    <span className="text-sm font-bold text-[#b8860b]">¥49,500 <span className="text-[10px]">/ 年</span></span>
                                </div>
                                <div className="mt-4 pt-4 bg-[#fef9c3]/30 p-4 border border-[#d4af37]/30 rounded-sm">
                                    <p className="text-[10px] font-bold text-red-600 mb-1 tracking-widest text-center">初年度限定（創世記369名まで）</p>
                                    <div className="text-3xl font-serif text-[#b8860b] font-bold text-center mt-2">
                                        ¥39,800 <span className="text-xs text-[#725b3f] font-sans font-normal">/ 年</span>
                                    </div>
                                    <p className="text-[9px] text-[#725b3f] mt-2 text-center">(月額換算: 約3,316円)</p>
                                </div>
                            </div>
                            {renderButton('covenant', 4, 'https://buy.stripe.com/dRm14n28GevZ0lH2fg7bW09')}
                        </div>
                    </div>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
