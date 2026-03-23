'use client';

import React, { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage, APP_ID } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Link from 'next/link';
import { ArrowLeft, Camera, IdCard, Feather, Handshake, Tags, Briefcase, Link as LinkIcon, Eye, Save, Trash, Plus, CircleHelp, X, Check, AlertTriangle } from 'lucide-react';

const PREFECTURES = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県","海外","その他"];

const SKILL_CATEGORIES = {
    "💻 IT・エンジニアリング": ["Web制作", "WordPress", "Firebase", "ノーコード (Bubble等)", "ローコード", "アプリ開発", "プログラミング (フロントエンド)", "プログラミング (バックエンド)", "インフラ・サーバー", "データ分析", "AI・機械学習活用", "UI/UXデザイン", "セキュリティ"],
    "🎨 クリエイティブ・デザイン": ["グラフィックデザイン", "Webデザイン", "ロゴ作成", "イラストレーション", "動画撮影", "動画編集", "写真撮影", "画像加工", "3Dモデリング", "アニメーション", "サウンドクリエイト", "コピーライティング", "シナリオライティング"],
    "💼 ビジネス・企画": ["起業", "経営・マネジメント", "新規事業立案", "事業戦略", "マーケティング", "デジタルマーケティング", "SEO/SEM", "SNS運用", "広告運用", "広報・PR", "営業", "BtoBセールス", "BtoCセールス", "カスタマーサクセス", "人事・採用", "組織開発", "経理・財務", "法務・知財"],
    "🎤 対人・コミュニケーション": ["プレゼンテーション", "ファシリテーション", "講師・セミナー登壇", "コーチング", "メンタリング", "コンサルティング", "交渉・ネゴシエーション", "インタビュー・取材", "イベント企画・運営", "コミュニティマネジメント"],
    "🌐 語学・グローバル": ["英語 (日常会話)", "英語 (ビジネス)", "中国語", "韓国語", "スペイン語", "フランス語", "その他外国語", "翻訳・通訳", "海外ビジネス展開"],
    "🌿 ライフスタイル・その他": ["料理指導", "栄養指導", "整理収納", "ファイナンシャルプランニング", "フィットネストレーナー", "マインドフルネス指導", "キャリアコンサルティング", "動画配信 (YouTuber等)", "VTuber", "インフルエンサー"]
};

const HOBBY_CATEGORIES = {
    "🏃 スポーツ・運動系": ["ランニング", "ウォーキング", "筋トレ", "ヨガ", "ピラティス", "ダンス", "バスケットボール", "サッカー", "フットサル", "野球", "テニス", "バドミントン", "卓球", "ゴルフ", "ボルダリング", "登山", "サーフィン", "スノーボード", "スキー", "サイクリング", "水泳", "格闘技", "武道", "マラソン", "トライアスロン"],
    "🎵 音楽・エンタメ": ["カラオケ", "楽器演奏（ギター）", "楽器演奏（ピアノ）", "楽器演奏（その他）", "作曲・DTM", "歌", "バンド活動", "ライブ鑑賞", "フェス", "DJ", "映画鑑賞", "アニメ鑑賞", "漫画", "ゲーム", "ボードゲーム", "謎解き", "マジック", "お笑い鑑賞", "舞台鑑賞", "ミュージカル", "クラシック音楽"],
    "🎨 文化・アート": ["絵画", "イラスト", "デザイン", "写真撮影", "動画編集", "手芸", "DIY", "小説執筆", "ブログ", "書道", "華道", "茶道", "陶芸", "美術館巡り"],
    "📚 学び・教養": ["読書", "自己啓発", "歴史", "心理学", "投資・資産運用", "マーケティング", "プログラミング", "語学学習（英語）", "語学学習（その他）", "資格取得", "経済", "政治", "哲学", "科学"],
    "🍳 食・暮らし": ["料理", "お菓子作り", "パン作り", "カフェ巡り", "食べ歩き", "お酒", "ワイン", "日本酒", "クラフトビール", "コーヒー", "紅茶", "お茶", "インテリア", "ミニマリズム", "ガーデニング", "観葉植物", "ペット", "サウナ", "銭湯"],
    "✈️ 旅行・お出かけ": ["国内旅行", "海外旅行", "一人旅", "キャンプ", "グランピング", "温泉巡り", "神社仏閣巡り", "御朱印集め", "ドライブ", "ツーリング", "ツーリング（自転車）", "テーマパーク"],
    "🤝 コミュニティ・人": ["交流会", "イベント主催", "ボランティア", "地域活動", "コーチング", "子育て", "メンタリング", "NPO活動"],
    "🌿 その他": ["瞑想", "マインドフルネス", "占い", "スピリチュアル", "その他"]
};

// ==========================================
// ★ THE PERSONAL OS / Core Logic Engine
// 誕生日から1〜60の運命数(OSナンバー：日干支)を算出
// ==========================================
function calculateOsNumber(dateStr: string) {
    if (!dateStr) return null;
    const parts = dateStr.split(/[-/]/);
    if (parts.length < 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;

    const targetDate = new Date(Date.UTC(y, m, d));
    const baseDate = new Date(Date.UTC(1900, 1, 20)); // Base for 60 pillars

    const diffDays = Math.floor((targetDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    const day_idx = ((diffDays % 60) + 60) % 60;
    return day_idx + 1;
}

const ALL_SKILLS = Object.values(SKILL_CATEGORIES).flat();
const ALL_HOBBIES = Object.values(HOBBY_CATEGORIES).flat();

type CareerItem = { company: string, role: string, start: string, end: string, description: string };

function ProfileEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const targetUid = searchParams.get('uid') || (user ? user.uid : null);
  
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [originalData, setOriginalData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  
  // Form States
  const [photoURL, setPhotoURL] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  
  const [name, setName] = useState('');
  const [realName, setRealName] = useState('');
  const [furigana, setFurigana] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [prefecture, setPrefecture] = useState('');
  const [birthplace, setBirthplace] = useState('');
  const [gender, setGender] = useState('無回答');
  const [birthDate, setBirthDate] = useState('');
  const [birthVisibility, setBirthVisibility] = useState('full');
  
  const [bio, setBio] = useState('');
  const [message, setMessage] = useState('');
  const [goals, setGoals] = useState('');
  
  const [canOfferStr, setCanOfferStr] = useState('');
  const [lookingForStr, setLookingForStr] = useState('');
  
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [customSkillsStr, setCustomSkillsStr] = useState('');
  
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [customHobbiesStr, setCustomHobbiesStr] = useState('');
  
  const [careerList, setCareerList] = useState<CareerItem[]>([]);
  
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [snsInstagram, setSnsInstagram] = useState('');
  const [snsX, setSnsX] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  
  const [profilePublic, setProfilePublic] = useState('true');
  
  // UI States
  const [score, setScore] = useState(0);
  const [missingItems, setMissingItems] = useState<string[]>([]);
  const [showMdHelp, setShowMdHelp] = useState(false);
  const [notification, setNotification] = useState<{msg: string, isError: boolean} | null>(null);

  useEffect(() => {
    async function init() {
        if (authLoading) return;
        if (!user || !targetUid) {
            if (!user) router.push('/login');
            return;
        }

        try {
            // Check Admin
            const myDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', user.uid);
            const mySnap = await getDoc(myDocRef);
            let myAdmin = false;
            if (mySnap.exists() && (mySnap.data().membershipRank === 'admin' || mySnap.data().userId === 'admin')) myAdmin = true;
            if (user.uid === "Zm7FWRopJKVfyzbp8KXXokMFjNC3") myAdmin = true;
            setIsAdmin(myAdmin);

            if (targetUid !== user.uid && !myAdmin) {
                alert("権限がありません");
                router.push("/user");
                return;
            }

            // Load Data
            const docRef = doc(db, 'artifacts', APP_ID, 'users', targetUid, 'profile', 'data');
            const docSnap = await getDoc(docRef);
            const data = docSnap.exists() ? docSnap.data() : { userId: targetUid };
            
            setOriginalData(data);
            
            // Populate
            setPhotoURL(data.photoURL || '');
            setName(data.name || '');
            setRealName(data.realName || '');
            setFurigana(data.furigana || '');
            setJobTitle(data.jobTitle || '');
            setPrefecture(data.prefecture || '');
            setBirthplace(data.birthplace || '');
            setGender(data.gender || '無回答');
            setBirthDate(data.birthDate || '');
            setBirthVisibility(data.birthVisibility || 'full');
            
            setBio(data.bio || '');
            setMessage(data.message || '');
            setGoals(data.goals || '');
            
            setCanOfferStr((data.canOffer || []).join(', '));
            setLookingForStr((data.lookingFor || []).join(', '));
            
            const skills = data.skills || [];
            setSelectedSkills(skills.filter((s: string) => ALL_SKILLS.includes(s)));
            setCustomSkillsStr(skills.filter((s: string) => !ALL_SKILLS.includes(s)).join(', '));
            
            const hobbies = data.hobbies || [];
            setSelectedHobbies(hobbies.filter((s: string) => ALL_HOBBIES.includes(s)));
            setCustomHobbiesStr(hobbies.filter((s: string) => !ALL_HOBBIES.includes(s)).join(', '));
            
            setCareerList(data.career || []);
            
            setWebsiteUrl(data.websiteUrl || '');
            setSnsInstagram(data.snsInstagram || '');
            setSnsX(data.snsX || '');
            setContactEmail(data.contactEmail || '');
            
            setProfilePublic(data.profilePublic || 'true');

        } catch (e) {
            console.error(e);
            showNotif('データの読み込みに失敗しました', true);
        } finally {
            setLoading(false);
        }
    }
    init();
  }, [user, authLoading, targetUid, router]);

  useEffect(() => {
     // Calculate Live Score
     let curScore = 0;
     let missing = [];
     
     const hasPhoto = !!photoURL || !!photoFile;
     if (hasPhoto) curScore += 8; else missing.push('プロフィール画像の設定 (8%)');
     if (name) curScore += 4; else missing.push('表示名 (4%)');
     if (realName) curScore += 4; else missing.push('本名 (4%)');
     if (furigana) curScore += 4; else missing.push('ふりがな (4%)');
     if (jobTitle) curScore += 4; else missing.push('職業・肩書 (4%)');
     if (prefecture) curScore += 4; else missing.push('活動拠点 (4%)');
     if (birthplace) curScore += 4; else missing.push('出身地 (4%)');
     if (gender && gender !== '無回答') curScore += 4; else missing.push('性別 (4%)');
     if (birthDate) curScore += 4; else missing.push('生年月日 (4%)');
     
     if (bio && bio.length >= 150) curScore += 10; else missing.push('自己紹介150字以上 (10%)');
     if (message && message.length >= 150) curScore += 10; else missing.push('想い・メッセージ150字以上 (10%)');
     if (goals && goals.length >= 150) curScore += 10; else missing.push('目標・ビジョン150字以上 (10%)');
     
     const offers = canOfferStr.split(',').filter(s=>s.trim());
     if (offers.length > 0) curScore += 5; else missing.push('提供できること1つ以上 (5%)');
     const lookingFor = lookingForStr.split(',').filter(s=>s.trim());
     if (lookingFor.length > 0) curScore += 5; else missing.push('求めていること1つ以上 (5%)');
     
     const customS = customSkillsStr.split(',').filter(s=>s.trim());
     if (selectedSkills.length + customS.length >= 3) curScore += 5; else missing.push('スキル3つ以上 (5%)');
     
     const customH = customHobbiesStr.split(',').filter(s=>s.trim());
     if (selectedHobbies.length + customH.length >= 3) curScore += 5; else missing.push('趣味3つ以上 (5%)');
     
     if (careerList.length > 0) curScore += 5; else missing.push('経歴1つ以上 (5%)');
     
     if (websiteUrl || snsInstagram || snsX || contactEmail) curScore += 5; else missing.push('SNS・外部リンク1つ以上 (5%)');
     
     setScore(Math.min(curScore, 100));
     setMissingItems(missing);

  }, [
      photoURL, photoFile, name, realName, furigana, jobTitle, prefecture, birthplace, 
      gender, birthDate, bio, message, goals, canOfferStr, lookingForStr, 
      selectedSkills, customSkillsStr, selectedHobbies, customHobbiesStr, 
      careerList, websiteUrl, snsInstagram, snsX, contactEmail
  ]);

  const showNotif = (msg: string, isErr = false) => {
      setNotification({msg, isError: isErr});
      setTimeout(() => setNotification(null), 3000);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setPhotoFile(file);
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) setPhotoURL(ev.target.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSave = async (e: FormEvent) => {
      e.preventDefault();
      if (!user || !targetUid) return;
      
      setSaving(true);
      showNotif('記録を保存中...', false);

      try {
          let currentPhotoUrl = originalData.photoURL || null;
          
          if (photoFile) {
              const snap = await uploadBytes(ref(storage, `profiles/${targetUid}/${Date.now()}_${photoFile.name}`), photoFile);
              currentPhotoUrl = await getDownloadURL(snap.ref);
          }
          
          const osNumberVal = calculateOsNumber(birthDate);
          
          const offers = canOfferStr.split(',').map(s=>s.trim()).filter(s=>s);
          const looks = lookingForStr.split(',').map(s=>s.trim()).filter(s=>s);
          const cSkills = customSkillsStr.split(',').map(s=>s.trim()).filter(s=>s);
          const cHobbies = customHobbiesStr.split(',').map(s=>s.trim()).filter(s=>s);

          const finalData = {
              ...originalData,
              userId: originalData.userId || targetUid,
              membershipRank: originalData.membershipRank || 'arrival',
              email: originalData.email || user.email || null,
              name: name.trim(),
              realName: realName.trim(),
              furigana: furigana.trim(),
              jobTitle: jobTitle.trim(),
              prefecture,
              birthplace,
              gender,
              birthDate,
              osNumber: osNumberVal,
              birthVisibility,
              bio: bio.trim(),
              message: message.trim(),
              canOffer: offers,
              lookingFor: looks,
              goals: goals.trim(),
              contactEmail: contactEmail.trim(),
              websiteUrl: websiteUrl.trim(),
              snsInstagram: snsInstagram.trim(),
              snsX: snsX.trim(),
              profilePublic,
              photoURL: currentPhotoUrl,
              skills: [...new Set([...selectedSkills, ...cSkills])],
              hobbies: [...new Set([...selectedHobbies, ...cHobbies])],
              career: careerList,
              updatedAt: new Date().toISOString(),
              profileScore: score
          };

          const privateRef = doc(db, 'artifacts', APP_ID, 'users', targetUid, 'profile', 'data');
          await setDoc(privateRef, finalData, { merge: true });

          const publicRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'users', targetUid);
          const isPaidMember = (finalData.membershipRank !== 'arrival');
          const isPublicSetting = (finalData.profilePublic === 'true');
          const canPublish = isPaidMember || isAdmin;

          if (isPublicSetting && canPublish) {
              const publicData = { ...finalData, isHidden: false };
              delete publicData.realName;
              await setDoc(publicRef, publicData, { merge: true });
          } else {
              const minimalData = {
                  userId: finalData.userId,
                  name: finalData.name || finalData.userId,
                  photoURL: finalData.photoURL || null,
                  email: finalData.email || null,
                  isHidden: true,
                  referrerId: finalData.referrerId || null,
                  profileScore: finalData.profileScore,
                  osNumber: finalData.osNumber
              };
              await setDoc(publicRef, minimalData, { merge: true });
          }

          if (isPublicSetting && !canPublish) {
              alert(`プロフィールを保存しました。(充実度: ${score}%)\n※現在ARRIVAL会員のため、設定を「公開」にしても検索結果には表示されません。`);
          } else {
              showNotif(`航海録を更新しました (充実度: ${score}%)`);
          }

          setTimeout(() => {
              router.push(targetUid ? `/user?uid=${targetUid}` : '/user');
          }, 1500);

      } catch (err) {
          console.error("Save Error", err);
          showNotif('保存に失敗しました。時間をおいて再試行してください。', true);
          setSaving(false);
      }
  };

  const toggleCheck = (item: string, list: string[], setList: (L: string[])=>void) => {
      if (list.includes(item)) setList(list.filter(x => x !== item));
      else setList([...list, item]);
  };

  if (loading) return <div className="min-h-screen bg-texture flex items-center justify-center text-[#a09080] font-bold tracking-widest pb-20 pt-20">Loading...</div>;

  return (
    <div className="min-h-screen bg-texture pb-20">
        <nav className="glass-header border-b border-[#e8dfd1] fixed w-full z-[1500] top-0 h-16 shadow-sm">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-[#a09080] hover:text-[#3e2723] transition-colors flex items-center gap-2 text-sm font-bold tracking-widest">
                        <ArrowLeft size={16} />
                        <span className="hidden sm:inline">マイページへ戻る</span>
                    </button>
                </div>
                <div className="font-serif font-bold text-[#3e2723] tracking-widest text-base sm:text-lg">
                    航海録の編集
                </div>
                <div className="w-8 sm:w-24"></div>
            </div>
        </nav>

        <main className="max-w-3xl mx-auto pt-24 px-4 sm:px-6">
            <form onSubmit={handleSave} className="space-y-8">
                
                {/* Image Upload */}
                <div className="bg-[#fffdf9] p-6 sm:p-8 rounded-sm shadow-md border border-[#e8dfd1]">
                    <h3 className="text-sm font-bold text-[#3e2723] mb-4 tracking-widest border-b border-[#e8dfd1] pb-2 flex items-center"><Camera className="w-4 h-4 text-[#a09080] mr-2"/>プロフィール画像</h3>
                    <div className="flex flex-col items-center">
                        <div className="relative w-32 h-32 bg-[#f7f5f0] rounded-full border-2 border-dashed border-[#c8b9a6] flex flex-col items-center justify-center text-[#a09080] hover:bg-[#fffdf9] cursor-pointer overflow-hidden group shadow-inner mb-4">
                            <input type="file" onChange={handlePhotoUpload} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                            {photoURL ? (
                                <img src={photoURL} className="absolute inset-0 w-full h-full object-cover" alt="Profile preview"/>
                            ) : (
                                <div className="group-hover:scale-110 transition-transform flex flex-col items-center">
                                    <Camera className="w-8 h-8 mb-1" />
                                    <span className="text-[10px] tracking-widest font-bold">画像を選択</span>
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-[#a09080] tracking-widest">正方形にトリミングされて表示されます</p>
                    </div>
                </div>

                {/* Basic Info */}
                <div className="bg-[#fffdf9] p-6 sm:p-8 rounded-sm shadow-md border border-[#e8dfd1] space-y-5">
                    <h3 className="text-sm font-bold text-[#3e2723] mb-2 tracking-widest border-b border-[#e8dfd1] pb-2 flex items-center"><IdCard className="w-4 h-4 text-[#a09080] mr-2"/>基本情報</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-[#5c4a3d] mb-1.5 tracking-widest">表示名 (SNS名) <span className="text-red-500">*</span></label>
                            <input type="text" value={name} onChange={e=>setName(e.target.value)} required className="w-full border-[#e8dfd1] rounded-sm text-sm p-3 bg-[#f7f5f0]" placeholder="例: 航海 太郎" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#5c4a3d] mb-1.5 tracking-widest">本名 <span className="text-red-500">*</span> <span className="text-[#a09080] text-[10px] font-normal ml-1">(※公開されません)</span></label>
                            <input type="text" value={realName} onChange={e=>setRealName(e.target.value)} required className="w-full border-[#e8dfd1] rounded-sm text-sm p-3 bg-[#f7f5f0]" placeholder="例: 山田 太郎" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#5c4a3d] mb-1.5 tracking-widest">ふりがな <span className="text-red-500">*</span></label>
                            <input type="text" value={furigana} onChange={e=>setFurigana(e.target.value)} required className="w-full border-[#e8dfd1] rounded-sm text-sm p-3 bg-[#f7f5f0]" placeholder="例: やまだ たろう" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#5c4a3d] mb-1.5 tracking-widest">職業・肩書</label>
                            <input type="text" value={jobTitle} onChange={e=>setJobTitle(e.target.value)} className="w-full border-[#e8dfd1] rounded-sm text-sm p-3 bg-[#f7f5f0]" placeholder="例: UI/UXデザイナー" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#5c4a3d] mb-1.5 tracking-widest">活動拠点 (都道府県)</label>
                            <select value={prefecture} onChange={e=>setPrefecture(e.target.value)} className="w-full border-[#e8dfd1] rounded-sm text-sm p-3 bg-[#f7f5f0]">
                                <option value="">選択してください</option>
                                {PREFECTURES.map(p=><option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#5c4a3d] mb-1.5 tracking-widest">出身地</label>
                            <select value={birthplace} onChange={e=>setBirthplace(e.target.value)} className="w-full border-[#e8dfd1] rounded-sm text-sm p-3 bg-[#f7f5f0]">
                                <option value="">選択してください</option>
                                {PREFECTURES.map(p=><option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#5c4a3d] mb-1.5 tracking-widest">性別</label>
                            <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full border-[#e8dfd1] rounded-sm text-sm p-3 bg-[#f7f5f0]">
                                <option value="無回答">無回答</option>
                                <option value="男性">男性</option>
                                <option value="女性">女性</option>
                                <option value="その他">その他</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-[#f0ebdd] p-4 rounded-sm border border-[#e8dfd1] mt-2">
                        <label className="block text-xs font-bold text-[#5c4a3d] mb-3 tracking-widest">生年月日と公開設定</label>
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                            <input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)} className="w-full sm:w-auto flex-1 border-[#e8dfd1] rounded-sm text-sm p-2.5 bg-white" />
                            <select value={birthVisibility} onChange={e=>setBirthVisibility(e.target.value)} className="w-full sm:w-auto border-[#e8dfd1] rounded-sm text-sm p-2.5 bg-white">
                                <option value="full">全体に公開 (年/月/日)</option>
                                <option value="monthDay">月日のみ公開 (月/日)</option>
                                <option value="none">非公開</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Personality */}
                <div className="bg-[#fffdf9] p-6 sm:p-8 rounded-sm shadow-md border border-[#e8dfd1] space-y-6">
                    <h3 className="text-sm font-bold text-[#3e2723] mb-2 tracking-widest border-b border-[#e8dfd1] pb-2 flex items-center"><Feather className="w-4 h-4 text-[#a09080] mr-2"/>パーソナリティ</h3>
                    
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-xs font-bold text-[#5c4a3d] tracking-widest">自己紹介 (Bio) <span className="text-[#a09080] text-[10px] font-normal ml-1">(※150字以上で評価)</span></label>
                            <button type="button" onClick={()=>setShowMdHelp(true)} className="text-[#725b3f] hover:text-[#3e2723] transition-colors text-[10px] flex items-center gap-1 bg-[#f0ebdd] px-2 py-1 rounded-sm border border-[#e8dfd1] shadow-sm font-bold"><CircleHelp className="w-3 h-3"/>書き方</button>
                        </div>
                        <textarea rows={4} value={bio} onChange={e=>setBio(e.target.value)} className="w-full border-[#e8dfd1] rounded-sm text-sm p-3 bg-[#f7f5f0] leading-relaxed" placeholder="これまでの歩みや現在の活動内容を簡潔に。"></textarea>
                        <div className={`text-right text-[10px] mt-1 tracking-widest font-bold ${bio.length >= 150 ? 'text-green-600' : 'text-[#a09080]'}`}>
                            {bio.length >= 150 ? `✓ ${bio.length} / 150文字 (クリア)` : `${bio.length} / 150文字 (あと${150 - bio.length}文字)`}
                        </div>
                    </div>
                    
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-xs font-bold text-[#5c4a3d] tracking-widest">想い・メッセージ <span className="text-[#a09080] text-[10px] font-normal ml-1">(※150字以上で評価)</span></label>
                        </div>
                        <textarea rows={5} value={message} onChange={e=>setMessage(e.target.value)} className="w-full border-[#e8dfd1] rounded-sm text-sm p-3 bg-[#f7f5f0] leading-relaxed" placeholder="コミュニティの仲間に向けた想い。相互フォローのみ公開。"></textarea>
                        <div className={`text-right text-[10px] mt-1 tracking-widest font-bold ${message.length >= 150 ? 'text-green-600' : 'text-[#a09080]'}`}>
                            {message.length >= 150 ? `✓ ${message.length} / 150文字 (クリア)` : `${message.length} / 150文字 (あと${150 - message.length}文字)`}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-xs font-bold text-[#5c4a3d] tracking-widest">目標・ビジョン <span className="text-[#a09080] text-[10px] font-normal ml-1">(※150字以上で評価)</span></label>
                        </div>
                        <textarea rows={3} value={goals} onChange={e=>setGoals(e.target.value)} className="w-full border-[#e8dfd1] rounded-sm text-sm p-3 bg-[#f7f5f0] leading-relaxed" placeholder="将来成し遂げたいこと等。相互フォローのみ公開。"></textarea>
                        <div className={`text-right text-[10px] mt-1 tracking-widest font-bold ${goals.length >= 150 ? 'text-green-600' : 'text-[#a09080]'}`}>
                            {goals.length >= 150 ? `✓ ${goals.length} / 150文字 (クリア)` : `${goals.length} / 150文字 (あと${150 - goals.length}文字)`}
                        </div>
                    </div>
                </div>

                {/* Matching Info */}
                <div className="bg-[#fffdf9] p-6 sm:p-8 rounded-sm shadow-md border border-[#e8dfd1] space-y-6">
                    <h3 className="text-sm font-bold text-[#3e2723] mb-2 tracking-widest border-b border-[#e8dfd1] pb-2 flex items-center"><Handshake className="w-4 h-4 text-[#a09080] mr-2"/>マッチング情報</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-[#5c4a3d] mb-1.5 tracking-widest">提供できること <span className="text-[#a09080] text-[10px] font-normal">(カンマ区切り)</span></label>
                            <textarea rows={3} value={canOfferStr} onChange={e=>setCanOfferStr(e.target.value)} className="w-full border-[#e8dfd1] rounded-sm text-sm p-3 bg-[#f7f5f0] leading-relaxed" placeholder="例: Webデザイン, 起業の相談, 美味しいコーヒーを淹れること"></textarea>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#5c4a3d] mb-1.5 tracking-widest">求めていること <span className="text-[#a09080] text-[10px] font-normal">(カンマ区切り)</span></label>
                            <textarea rows={3} value={lookingForStr} onChange={e=>setLookingForStr(e.target.value)} className="w-full border-[#e8dfd1] rounded-sm text-sm p-3 bg-[#f7f5f0] leading-relaxed" placeholder="例: エンジニアの仲間, 動画編集ができる人"></textarea>
                        </div>
                    </div>
                </div>

                {/* Skills & Hobbies */}
                <div className="bg-[#fffdf9] p-6 sm:p-8 rounded-sm shadow-md border border-[#e8dfd1] space-y-6">
                    <h3 className="text-sm font-bold text-[#3e2723] mb-4 tracking-widest border-b border-[#e8dfd1] pb-2 flex items-center"><Tags className="w-4 h-4 text-[#a09080] mr-2"/>スキルと趣味</h3>
                    
                    <div>
                        <label className="block text-xs font-bold text-[#5c4a3d] mb-1 tracking-widest">スキルの選択 <span className="text-[#a09080] text-[10px] font-normal ml-1">(※3つ以上で評価)</span></label>
                        <div className="space-y-3 mt-2">
                            {Object.entries(SKILL_CATEGORIES).map(([cat, items]) => (
                                <details key={cat} className="group border border-[#e8dfd1] rounded-sm bg-[#fffdf9] overflow-hidden shadow-sm">
                                    <summary className="p-3 cursor-pointer hover:bg-[#f7f5f0] font-bold text-sm text-[#3e2723] flex justify-between tracking-widest">
                                        {cat}
                                    </summary>
                                    <div className="p-3 flex flex-wrap gap-2 border-t border-dashed border-[#e8dfd1] bg-[#f0ebdd]">
                                        {items.map(item => (
                                            <label key={item} className="cursor-pointer">
                                                <input type="checkbox" className="hidden" checked={selectedSkills.includes(item)} onChange={() => toggleCheck(item, selectedSkills, setSelectedSkills)} />
                                                <div className={`px-3 py-1.5 rounded-sm border text-xs tracking-widest transition-colors shadow-sm ${selectedSkills.includes(item) ? 'bg-[#b8860b] text-[#fffdf9] border-[#b8860b]' : 'border-[#e8dfd1] text-[#725b3f] bg-white hover:bg-[#fffdf9]'}`}>
                                                    {item}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </details>
                            ))}
                        </div>
                        <input type="text" value={customSkillsStr} onChange={e=>setCustomSkillsStr(e.target.value)} placeholder="その他のスキル (カンマ区切り)" className="mt-3 w-full border-[#e8dfd1] rounded-sm text-sm p-2.5 bg-[#f7f5f0]" />
                    </div>

                    <div className="mt-8">
                        <label className="block text-xs font-bold text-[#5c4a3d] mb-1 tracking-widest">趣味の選択 <span className="text-[#a09080] text-[10px] font-normal ml-1">(※3つ以上で評価)</span></label>
                        <div className="space-y-3 mt-2">
                            {Object.entries(HOBBY_CATEGORIES).map(([cat, items]) => (
                                <details key={cat} className="group border border-[#e8dfd1] rounded-sm bg-[#fffdf9] overflow-hidden shadow-sm">
                                    <summary className="p-3 cursor-pointer hover:bg-[#f7f5f0] font-bold text-sm text-[#3e2723] flex justify-between tracking-widest">
                                        {cat}
                                    </summary>
                                    <div className="p-3 flex flex-wrap gap-2 border-t border-dashed border-[#e8dfd1] bg-[#f0ebdd]">
                                        {items.map(item => (
                                            <label key={item} className="cursor-pointer">
                                                <input type="checkbox" className="hidden" checked={selectedHobbies.includes(item)} onChange={() => toggleCheck(item, selectedHobbies, setSelectedHobbies)} />
                                                <div className={`px-3 py-1.5 rounded-sm border text-xs tracking-widest transition-colors shadow-sm ${selectedHobbies.includes(item) ? 'bg-[#b8860b] text-[#fffdf9] border-[#b8860b]' : 'border-[#e8dfd1] text-[#725b3f] bg-white hover:bg-[#fffdf9]'}`}>
                                                    {item}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </details>
                            ))}
                        </div>
                        <input type="text" value={customHobbiesStr} onChange={e=>setCustomHobbiesStr(e.target.value)} placeholder="その他の趣味 (カンマ区切り)" className="mt-3 w-full border-[#e8dfd1] rounded-sm text-sm p-2.5 bg-[#f7f5f0]" />
                    </div>
                </div>

                {/* Career */}
                <div className="bg-[#fffdf9] p-6 sm:p-8 rounded-sm shadow-md border border-[#e8dfd1]">
                    <h3 className="text-sm font-bold text-[#3e2723] mb-2 tracking-widest border-b border-[#e8dfd1] pb-2 flex items-center justify-between">
                        <span className="flex items-center"><Briefcase className="w-4 h-4 text-[#a09080] mr-2"/>経歴 <span className="text-[#a09080] text-[10px] font-normal ml-1">(※相互フォローに公開)</span></span>
                    </h3>
                    
                    <div className="space-y-3 mb-4">
                        {careerList.map((c, idx) => (
                            <div key={idx} className="bg-[#f7f5f0] p-5 rounded-sm border border-[#e8dfd1] relative shadow-sm">
                                <button type="button" onClick={()=>setCareerList(careerList.filter((_,i)=>i!==idx))} className="absolute top-2 right-3 text-[#a09080] hover:text-red-700 transition-colors"><Trash className="w-4 h-4"/></button>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 mt-2">
                                    <input type="text" value={c.company} onChange={e=>{const list=[...careerList]; list[idx].company=e.target.value; setCareerList(list);}} className="w-full border-[#e8dfd1] rounded-sm p-2 text-sm bg-[#fffdf9]" placeholder="会社・組織名" />
                                    <input type="text" value={c.role} onChange={e=>{const list=[...careerList]; list[idx].role=e.target.value; setCareerList(list);}} className="w-full border-[#e8dfd1] rounded-sm p-2 text-sm bg-[#fffdf9]" placeholder="役職・役割" />
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    <input type="month" value={c.start} onChange={e=>{const list=[...careerList]; list[idx].start=e.target.value; setCareerList(list);}} className="w-full border-[#e8dfd1] rounded-sm p-2 text-sm bg-[#fffdf9]" />
                                    <input type="month" value={c.end} onChange={e=>{const list=[...careerList]; list[idx].end=e.target.value; setCareerList(list);}} className="w-full border-[#e8dfd1] rounded-sm p-2 text-sm bg-[#fffdf9]" title="空欄の場合は「現在」となります" />
                                </div>
                                <textarea value={c.description} onChange={e=>{const list=[...careerList]; list[idx].description=e.target.value; setCareerList(list);}} className="w-full border-[#e8dfd1] rounded-sm p-3 text-sm bg-[#fffdf9] leading-relaxed" rows={3} placeholder="業務内容・詳細"></textarea>
                            </div>
                        ))}
                    </div>

                    <div className="bg-[#f0ebdd] border border-[#e8dfd1] p-4 rounded-sm shadow-sm relative">
                        <div className="absolute top-0 left-0 w-0.5 h-full bg-[#b8860b]"></div>
                        <h4 className="text-xs font-bold text-[#3e2723] mb-3 tracking-widest">新しい経歴を追加</h4>
                        <button type="button" onClick={()=>setCareerList([...careerList, {company:'',role:'',start:'',end:'',description:''}])} className="w-full py-2.5 bg-[#3e2723] text-[#fffdf9] font-bold text-xs rounded-sm hover:bg-[#2a1a17] transition-colors shadow-md tracking-widest flex items-center justify-center">
                            <Plus className="w-4 h-4 mr-1"/> 経歴リストに追加
                        </button>
                    </div>
                </div>

                {/* SNS Links */}
                <div className="bg-[#fffdf9] p-6 sm:p-8 rounded-sm shadow-md border border-[#e8dfd1] space-y-4">
                    <h3 className="text-sm font-bold text-[#3e2723] mb-2 tracking-widest border-b border-[#e8dfd1] pb-2 flex items-center"><LinkIcon className="w-4 h-4 text-[#a09080] mr-2"/>SNS・外部リンク <span className="text-[#a09080] text-[10px] font-normal ml-1">(※どれか1つ以上で評価)</span></h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 flex justify-center text-[#a09080] text-xl"><LinkIcon className="w-5 h-5"/></div>
                            <input type="url" value={websiteUrl} onChange={e=>setWebsiteUrl(e.target.value)} placeholder="ポートフォリオやブログのURL" className="flex-1 border-[#e8dfd1] rounded-sm text-sm p-2.5 bg-[#f7f5f0]" />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 flex justify-center text-[#a09080] text-xl font-bold">IG</div>
                            <input type="text" value={snsInstagram} onChange={e=>setSnsInstagram(e.target.value)} placeholder="InstagramのID または URL" className="flex-1 border-[#e8dfd1] rounded-sm text-sm p-2.5 bg-[#f7f5f0]" />
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 flex justify-center text-[#a09080] text-xl font-bold">X</div>
                            <input type="text" value={snsX} onChange={e=>setSnsX(e.target.value)} placeholder="X(Twitter)のID または URL" className="flex-1 border-[#e8dfd1] rounded-sm text-sm p-2.5 bg-[#f7f5f0]" />
                        </div>
                    </div>
                </div>

                {/* Privacy Setting */}
                <div className="bg-[#f0ebdd] p-6 sm:p-8 rounded-sm shadow-inner border border-[#e8dfd1] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-bold text-[#3e2723] tracking-widest mb-1 flex items-center"><Eye className="w-4 h-4 text-[#a09080] mr-2"/>プロフィールの検索公開</h3>
                        <p className="text-[10px] text-[#a09080] tracking-widest">「公開」にすると、他の乗船者があなたを検索で見つけられるようになります。</p>
                    </div>
                    <select value={profilePublic} onChange={e=>setProfilePublic(e.target.value)} className="border-[#c8b9a6] rounded-sm text-sm p-2.5 bg-white font-bold text-[#3e2723] shadow-sm focus:ring-[#b8860b] focus:border-[#b8860b] min-w-[120px]">
                        <option value="true">公開する</option>
                        <option value="false">非公開にする</option>
                    </select>
                </div>

                {/* Score Summary */}
                {score < 100 && (
                    <div className="bg-[#fffdf9] p-6 sm:p-8 rounded-sm shadow-md border border-[#c8b9a6] relative overflow-hidden mb-6">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-[#b8860b]"></div>
                        <h3 className="text-base font-bold text-[#3e2723] tracking-widest mb-3 flex items-center">
                            <Check className="w-5 h-5 text-[#b8860b] mr-2" /> 100%達成まであと少し！
                        </h3>
                        <p className="text-sm text-[#5c4a3d] mb-4 tracking-widest font-bold">現在の充実度: <span className="text-xl text-[#b8860b] mx-1">{score}</span>%</p>
                        <div className="bg-[#f0ebdd] p-4 border border-[#e8dfd1] rounded-sm">
                            <p className="text-xs font-bold text-[#3e2723] mb-2 tracking-widest">残り必要な項目</p>
                            <ul className="text-xs text-[#a09080] space-y-1.5 tracking-widest grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                                {missingItems.map((m, idx) => <li key={idx}>・{m}</li>)}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="pb-10 pt-4">
                    <button type="submit" disabled={saving} className="w-full py-4 bg-[#3e2723] text-[#d4af37] font-bold text-lg rounded-sm hover:bg-[#2a1a17] transition-colors shadow-xl tracking-widest border border-[#b8860b] flex items-center justify-center disabled:opacity-50">
                        <Save className="w-5 h-5 mr-2"/> {saving ? '保存中...' : '航海録を保存する'}
                    </button>
                </div>
            </form>
        </main>

        {showMdHelp && (
            <div className="fixed inset-0 z-[4000] bg-[#2a1a17]/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#fffdf9] bg-texture w-full max-w-md rounded-sm shadow-2xl flex flex-col border border-[#c8b9a6] overflow-hidden">
                    <div className="p-4 border-b border-[#e8dfd1] flex justify-between items-center bg-[#fffdf9]">
                        <h3 className="font-bold text-[#3e2723] font-serif tracking-widest flex items-center">テキストの装飾方法</h3>
                        <button onClick={()=>setShowMdHelp(false)} className="text-[#a09080] hover:text-[#3e2723] transition-colors"><X size={20}/></button>
                    </div>
                    <div className="p-6 overflow-y-auto space-y-5 text-sm text-[#5c4a3d] leading-relaxed bg-[#fffdf9]">
                        <p className="text-xs font-bold tracking-widest mb-2 border-l-4 border-[#b8860b] pl-2">文章を以下の記号で囲むと、綺麗にデザインされて表示されます。</p>
                        <ul className="space-y-4 text-xs font-mono">
                            <li><strong>改行</strong>: そのままEnter</li>
                            <li><strong>太字</strong>: **強調したい文字**</li>
                            <li><strong>斜体</strong>: *斜めにしたい文字*</li>
                            <li><strong>リスト</strong>: - リスト項目 (行頭ハイフンと半角スペース)</li>
                        </ul>
                    </div>
                </div>
            </div>
        )}

        {notification && (
            <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[3000] transition-all duration-300">
                <div className={`px-6 py-3 rounded-sm shadow-2xl flex items-center gap-3 backdrop-blur-md border ${notification.isError ? 'bg-[#fffdf9] text-red-700 border-red-300' : 'bg-[#3e2723] text-[#f7f5f0] border-[#8b6a4f]'}`}>
                    {notification.isError ? <AlertTriangle className="text-red-500 w-5 h-5"/> : <Check className="text-[#d4af37] w-5 h-5"/>}
                    <span className="text-sm font-bold tracking-widest font-serif">{notification.msg}</span>
                </div>
            </div>
        )}
    </div>
  );
}

export default function ProfileEditPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-texture pt-24 text-center text-[#a09080]">Loading...</div>}>
            <ProfileEditContent />
        </Suspense>
    );
}
