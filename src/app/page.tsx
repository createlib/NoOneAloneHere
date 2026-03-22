import Footer from "@/components/Footer";
import { Bell, Compass, Feather, BookOpen, MonitorPlay, Hourglass, UserCheck, Building, Video, Handshake, Sparkles, Play, Mic, Shield, Anchor } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-texture overflow-x-hidden">
      
      {/* 
        HERO SECTION 
      */}
      <section className="relative min-h-screen flex flex-col items-center justify-center p-6 bg-brand-900 overflow-hidden">
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-60 md:opacity-[0.85] mix-blend-screen pointer-events-none">
          <img src="img/hakobune.png" alt="Noah's Ark" className="w-full h-full object-cover object-center" />
        </div>
        <div className="absolute -top-[50%] -left-[20%] w-[150%] h-[200%] bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.15)_0%,transparent_50%)] pointer-events-none z-0"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(10,5,0,0.7)_100%)] pointer-events-none z-0"></div>
        <div className="absolute bottom-0 left-0 w-full h-32 md:h-48 bg-gradient-to-t from-brand-50 to-transparent z-10 pointer-events-none"></div>
        
        <div className="z-20 flex flex-col items-center w-full max-w-5xl mt-[-2rem] md:mt-0">
          <div className="mb-4 w-full flex justify-center relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,253,249,0.35)_0%,transparent_50%)] pointer-events-none blur-xl"></div>
            <img 
              src="/img/typo.png" 
              alt="NOAH Logo" 
              className="w-[90%] md:w-[700px] h-auto object-contain transition-transform hover:scale-[1.02] duration-700 relative z-10 drop-shadow-[0_0_15px_rgba(255,253,249,0.2)]"
            />
          </div>
          <h2 className="text-xs md:text-lg text-brand-200 font-serif tracking-[0.4em] md:tracking-[0.6em] uppercase mb-16 text-center border-b border-brand-200/30 pb-4 px-8 md:px-16 drop-shadow-md">
            No One Alone, Here
          </h2>
          <div className="text-center space-y-6 mb-10 md:mb-16">
            <p className="text-xl md:text-3xl text-brand-50 tracking-widest font-bold leading-relaxed drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              ここでは、誰も一人にならない。
            </p>
            <p className="text-sm md:text-base text-brand-100 max-w-2xl mx-auto leading-loose pt-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] font-medium">
              信頼の連鎖が、人生の最高のパートナーを引き寄せる。<br />
              共鳴と安心でつながる、完全紹介制のクローズドコミュニティ。
            </p>
          </div>
        </div>
      </section>

      {/* 
        NEWS SECTION 
      */}
      <section className="py-12 px-6 max-w-4xl mx-auto z-20 relative -mt-8 sm:-mt-16">
        <div className="bg-brand-50 p-6 sm:p-10 shadow-lg border border-brand-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-500"></div>
          
          <div className="flex justify-between items-end mb-6 border-b border-brand-100 pb-3">
              <h2 className="text-2xl font-serif text-brand-900 flex items-center gap-2 tracking-widest font-bold">
                  <Bell className="w-6 h-6 text-brand-500" /> News
              </h2>
              <div className="flex items-center gap-4">
                  <Link href="/news" className="text-xs font-bold text-brand-500 hover:text-brand-700 tracking-widest flex items-center transition-colors">
                      一覧を見る <span className="text-lg ml-0.5">›</span>
                  </Link>
              </div>
          </div>
          
          <ul className="space-y-4">
              <li className="text-center py-4 text-brand-400 text-sm tracking-widest flex items-center justify-center">
                  最新のお知らせはありません。
              </li>
          </ul>
        </div>
      </section>

      {/* 
        CONCEPT SECTION 
      */}
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <div className="flex flex-col items-center justify-center text-center mb-16">
          <Compass className="w-8 h-8 text-brand-500 mb-4" strokeWidth={1.5} />
          <h2 className="text-3xl md:text-4xl font-serif text-brand-900 mb-2">Concept</h2>
          <p className="text-brand-600 tracking-widest text-sm uppercase">理念</p>
          <div className="w-16 h-[1px] bg-brand-500 mt-6"></div>
        </div>
        
        <div className="bg-[#fffdf9] p-8 md:p-12 shadow-md border border-brand-100 relative">
          <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-brand-500 -translate-x-2 -translate-y-2"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-brand-500 translate-x-2 translate-y-2"></div>
          
          <div className="space-y-6 text-base md:text-lg leading-loose text-center text-brand-800">
            <p>
              このコミュニティは、<strong className="text-brand-900">”誰も取り残さない”</strong>という揺るぎない信念から生まれました。<br className="hidden md:block"/>
              自分がコミュニティに何を与えられるか。コミュニティが自分に何を与えられるか。<br className="hidden md:block"/>
              一方通行ではない「与え合う」精神が、互いを高め合う力になります。
            </p>
            <p>
              どこか希薄な「何となくの繋がり」ではなく、<br className="hidden md:block"/>
              同じ箱舟に乗り合わせたという、確かな「安心感」と「帰る場所」を提供します。
            </p>
            <p>
              肩書きや表面的な情報だけでなく、その人が歩んできた背景や行動理念を深く知る。<br className="hidden md:block"/>
              そうして魂のレベルで共鳴することで、あなたの人生を共に歩む「最高のパートナー」と、<br className="hidden md:block"/>
              本来の何倍もの確率で出会うためのコミュニティです。
            </p>
          </div>
        </div>
      </section>

      {/* 
        MESSAGE SECTION 
      */}
      <section className="py-24 px-6 bg-brand-900 text-brand-50 bg-texture relative">
        <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E')]"></div>
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="flex items-center justify-center mb-10">
            <Feather className="w-10 h-10 text-brand-300" strokeWidth={1} />
          </div>
          <h2 className="text-2xl md:text-3xl text-center mb-12 text-brand-100 tracking-widest">
            創造主からのメッセージ
          </h2>
          <div className="space-y-8 text-sm md:text-base leading-relaxed tracking-wide font-light text-brand-200">
            <p>
              今、私たちが生きる社会には、地域や情報の格差によって孤立し、苦しんでいる人が数多く存在しています。
              私は、少しでもその隔たりをなくし、人々が本心から手を取り合って協力できる世界を作りたいと強く願ってきました。
              そして、その実現のためには「お互いの背景や行動理念を深く知る」ことが何よりも重要だと確信しています。
            </p>
            <p>
              なぜなら、私自身が「他者を深く知る」ことによって救われた経験があるからです。
            </p>
            <p>
              かつての私は、自分の人生に色がついていないように感じ、一人で思い悩んでいました。しかし、人と膝を突き合わせ、相手の目を見て、その人が抱える人生の経験や痛みに親身になって耳を傾けたとき、私の世界は劇的に変わりました。
            </p>
            <p>
              同じ時代を生きていても、誰一人として同じ経験をしている人はいない。その圧倒的な「違い」に触れ、心の底で共鳴した瞬間、「ああ、自分は自分でいいんだ」と、曖昧だった自分自身の輪郭がはっきりと浮かび上がったのです。
            </p>
            <div className="text-center py-6 border-y border-brand-700 my-8 text-brand-50 text-lg font-medium italic">
              相手を知っているから、安心して踏み込める。<br />
              安心して話せるから、自分の色に気づける。
            </div>
            <p className="text-center">
              テクノロジーの力を使って、もっとも人間らしい温かさを生み出す場所を、<br className="hidden md:block"/>
              あなたと作りたいと思っています。
            </p>
          </div>
        </div>
      </section>

      {/* 
        FEATURES SECTION 
      */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="flex flex-col items-center justify-center text-center mb-16">
          <BookOpen className="w-8 h-8 text-brand-500 mb-4" strokeWidth={1.5} />
          <h2 className="text-3xl md:text-4xl font-serif text-brand-900 mb-2">Features</h2>
          <p className="text-brand-600 tracking-widest text-sm uppercase">コミュニティの機能</p>
          <div className="w-16 h-[1px] bg-brand-500 mt-6"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { icon: MonitorPlay, title: "独自のメディア & メンバーDB", desc: "コミュニティメンバーのデータベース管理から、PRやピッチを目的とした動画共有まで、自己表現と仲間探しをシームレスに行えます。" },
            { icon: Hourglass, title: "イベント共有・宣伝", desc: "コミュニティメンバー同士が交流できる場を宣伝したり参加したりできます。" },
            { icon: UserCheck, title: "プロフィールマッチング", desc: "各種プロフィールの内容を検索し、相性がいい人やイベント、場所をマッチさせることができます。" },
            { icon: Building, title: "起業・企業支援", desc: "これから起業したいという人のための支援やツールの提供などをします。" },
            { icon: Video, title: "広告・PRサポート", desc: "資産(asset)として企業PR動画やライブ配信、写真などに関する製作サポートをします。" },
            { icon: Handshake, title: "地域・他コミュニティ連携", desc: "コミュニティが連携する地域やサービスを優先的、またはお得に利用することができます。" }
          ].map((feature, i) => (
            <div key={i} className="bg-[#fffdf9] p-8 border border-brand-100 hover:border-brand-500 transition-colors group flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center mb-6 group-hover:bg-brand-500 group-hover:text-white transition-colors text-brand-700">
                <feature.icon className="w-7 h-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold mb-4 text-brand-900">{feature.title}</h3>
              <p className="text-brand-700 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 
        ROLES & VOYAGES SECTION 
      */}
      <section className="py-24 px-6 bg-[#eae5d8] border-t border-brand-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center justify-center text-center mb-16">
            <Anchor className="w-8 h-8 text-brand-500 mb-4" strokeWidth={1.5} />
            <h2 className="text-3xl md:text-4xl font-serif text-brand-900 mb-2">Roles & Voyages</h2>
            <p className="text-brand-600 tracking-widest text-sm uppercase">役割と航海</p>
            <div className="w-16 h-[1px] bg-brand-500 mt-6"></div>
          </div>
          
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <p className="text-lg text-brand-900 leading-loose italic mb-4">
              世界が揺らぐ中で<br />
              ただ乗り込む者、<br />
              船を動かす者、<br />
              守る者、<br />
              次の世界を託される者。
            </p>
            <p className="text-sm text-brand-600">
              ※各役割は「上級会員」という概念ではなく、“覚悟のある人”にしか名乗れない名前として定義されています。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {[
              { id: "ARRIVAL", roleStr: "出会いと自己理解の入口", theme: "「この箱舟に、たどり着いた。」", desc: "まだ役割は持たないが、世界の一部になっている。箱舟の存在を知り、この航海に身を委ねることを選んだ人。" },
              { id: "SETTLER", roleStr: "居場所をつくる人", theme: "「ここで暮らすことを選んだ。」", desc: "ただの乗客から一歩進んだ存在。イベントやメディアを通して自ら発信し、箱舟の中で生活を営み始めた人。" },
              { id: "BUILDER", roleStr: "関係を育てる人", theme: "「未来を創る側に回った。」", desc: "生配信への登壇など、関係性を深める役割。航海のあいだ、次の世界に何を持ち込むかを共に形にし始めた人。" },
              { id: "GUARDIAN", roleStr: "場を守り、創る人", theme: "「共同体を守る責任を引き受けた。」", desc: "自ら配信を主催し、仕事・依頼を創出する立場。嵐の中でも箱舟が進み続けるよう見張り、支え、守る人。" },
            ].map((role, i) => (
              <div key={i} className="bg-[#fffdf9] p-6 sm:p-8 border border-brand-300 flex flex-col relative overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
                <div className="w-full h-48 sm:h-56 mb-6 overflow-hidden bg-brand-50 border border-brand-100 rounded-sm relative flex items-center justify-center">
                  <img src={`/img/${role.id}.png`} alt={role.id} className="w-full h-full object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-105 p-4" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mb-4">
                  <h3 className="text-2xl font-bold text-brand-900 tracking-widest font-serif">{role.id}</h3>
                  <span className="text-sm text-brand-500 font-bold tracking-widest">{role.roleStr}</span>
                </div>
                <div className="mb-2 flex-grow">
                  <p className="font-bold text-brand-800 mb-3 border-b border-brand-100 pb-2">{role.theme}</p>
                  <p className="text-sm text-brand-700 leading-relaxed">{role.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-br from-[#2a1a17] to-[#3e2723] p-1 shadow-2xl relative mt-16 max-w-5xl mx-auto group">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#d4af37] text-[#2a1a17] px-6 py-1 font-bold text-sm tracking-widest flex items-center gap-2 border border-brand-500 z-10 shadow-md">
              <Shield className="w-4 h-4" /> 特別枠
            </div>
            <div className="bg-[#fffdf9] border border-[#d4af37] relative h-full flex flex-col md:flex-row overflow-hidden">
              <div className="md:w-[45%] h-64 md:h-auto bg-brand-50 border-b md:border-b-0 md:border-r border-brand-100 flex items-center justify-center p-6 sm:p-10 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.05)_0%,transparent_100%)] pointer-events-none z-0"></div>
                <img src="/img/COVENANT.png" alt="COVENANT" className="max-w-full max-h-full object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-[1.03] relative z-10 drop-shadow-md" />
              </div>
              <div className="md:w-[55%] p-8 md:p-12 flex flex-col justify-center">
                <div className="border-b border-brand-100 pb-4 mb-6">
                  <div className="flex items-baseline gap-3 mb-1">
                    <h3 className="text-3xl font-bold text-brand-900 tracking-widest font-serif">COVENANT</h3>
                    <span className="text-sm text-brand-500 font-bold tracking-widest">契約者 / 中核層</span>
                  </div>
                  <p className="text-xs text-brand-600 italic tracking-widest mt-2">ノアと神が結んだ「契約」から</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-brand-800 mb-4">「世界を託された。」</p>
                  <p className="text-brand-700 leading-relaxed text-sm">
                    この航海が終わったあと、どんな世界を残すか。その責任を引き受けた人。<br />
                    中核メンバーとして意思決定に関与し、世界観・方針を保持します。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
