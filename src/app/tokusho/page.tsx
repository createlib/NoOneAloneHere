import React from 'react';
import Link from 'next/link';

export default function TokushoPage() {
    return (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-texture">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <Link href="/" className="text-[#8b6a4f] font-serif tracking-[0.3em] text-xl mb-4 inline-block hover:opacity-70 transition-opacity">
                        NOAH
                    </Link>
                    <h1 className="text-3xl font-bold text-[#3e2723] sm:text-4xl">特定商取引法に基づく表記</h1>
                    <p className="mt-4 text-sm text-[#5c4a3d]">特定商取引法に基づき、以下のとおり表示いたします。</p>
                </div>

                <div className="bg-[#fffdf9] shadow-md overflow-hidden sm:rounded-sm border border-[#e8dfd1]">
                    <dl>
                        <div className="bg-[#f7f5f0] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-center">販売事業者名</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                NOAH｜No One Alone, Here<br />
                                （代表者：柳町 一磨）
                            </dd>
                        </div>
                        <div className="bg-[#fffdf9] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-center">運営責任者</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">柳町 一磨</dd>
                        </div>
                        <div className="bg-[#f7f5f0] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-center">所在地</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                〒450-0002<br />
                                愛知県名古屋市中村区名駅4丁目24番5号 第2森ビル401<br />
                                <span className="text-xs text-[#725b3f] mt-1 inline-block">※請求があった場合、遅滞なく開示いたします。</span>
                            </dd>
                        </div>
                        <div className="bg-[#fffdf9] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-center">電話番号</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                電話での対応は行っておりません。<br />
                                お問い合わせは下記メールアドレスまでお願いいたします。
                            </dd>
                        </div>
                        <div className="bg-[#f7f5f0] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-center">メールアドレス</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                <a href="mailto:noonealone.here369@gmail.com" className="text-[#8b6a4f] hover:text-[#725b3f] underline break-all transition-colors">
                                    noonealone.here369@gmail.com
                                </a>
                            </dd>
                        </div>
                        <div className="bg-[#fffdf9] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-center">お問い合わせ対応時間</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">10:00〜18:00（平日のみ）</dd>
                        </div>
                        <div className="bg-[#f7f5f0] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-center">販売URL</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                <Link href="/" className="text-[#8b6a4f] hover:text-[#725b3f] underline break-all transition-colors">
                                    NOAH 公式サイト
                                </Link>
                            </dd>
                        </div>
                        <div className="bg-[#fffdf9] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-start pt-1">販売するサービスの内容</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                <p className="mb-4">本サービスは、紹介制のクローズドオンラインコミュニティおよび各種会員向け支援サービスです。</p>
                                <p className="mb-2 font-bold text-[#4a3b32]">主な提供内容は以下の通りです。</p>
                                <ul className="list-disc pl-5 space-y-1 mb-4">
                                    <li>会員限定プラットフォーム（メディア・メンバーDB）への参加権</li>
                                    <li>コミュニティ内でのプロフィールマッチング機能の利用</li>
                                    <li>会員同士のイベント共有、宣伝、参加権</li>
                                    <li>起業・企業支援ツールおよびサポートの提供</li>
                                    <li>企業PR動画やライブ配信等の広告制作サポート</li>
                                    <li>連携する地域・サービスの優待利用</li>
                                </ul>
                                <p className="text-xs text-[#725b3f]">
                                    ※提供内容はご契約の会員ランク（役割）によって異なります。<br />
                                    ※提供内容は、運営上の判断により予告なく変更・追加される場合があります。
                                </p>
                            </dd>
                        </div>
                        <div className="bg-[#f7f5f0] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-start pt-1">販売価格</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                <div className="space-y-3 mb-4">
                                    <p><strong>ARRIVAL（たどり着いた人）:</strong> 無料</p>
                                    <p><strong>SETTLER（暮らす人）:</strong> 月額 3,300円（税込）</p>
                                    <p><strong>BUILDER（創る人）:</strong> 月額 6,600円（税込）※リリース予定</p>
                                    <p><strong>GUARDIAN（守る人）:</strong> 月額 9,900円（税込）※リリース予定</p>
                                    <p><strong>COVENANT（託される人）:</strong> 年額 69,000円（税込）</p>
                                </div>
                                
                                <div className="bg-[#fffdf9] p-4 rounded-sm border border-[#d4af37] relative">
                                    <div className="absolute -top-3 left-4 bg-[#d4af37] text-[#2a1a17] px-2 py-0.5 text-xs font-bold tracking-widest">期間限定</div>
                                    <p className="mt-2 mb-1"><span className="font-bold text-[#4a3b32]">COVENANT（託される人）1年目特別価格</span></p>
                                    <p className="text-lg font-serif text-[#b8860b] mb-1">36,900円（税込）</p>
                                    <p className="text-xs text-[#725b3f]">※2年目の更新時からは通常価格（年額69,000円）へ自動移行します。</p>
                                </div>
                            </dd>
                        </div>
                        <div className="bg-[#fffdf9] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-center">商品代金以外の必要料金</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>インターネット接続にかかる通信料金</li>
                                    <li>オフラインイベント等への参加時の実費（交通費・宿泊費・飲食費など）</li>
                                </ul>
                            </dd>
                        </div>
                        <div className="bg-[#f7f5f0] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-center">支払方法</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                クレジットカード決済（Stripe）<br />
                                その他、販売ページに記載する決済方法
                            </dd>
                        </div>
                        <div className="bg-[#fffdf9] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-start pt-1">代金の支払い時期</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                <p className="mb-2"><strong>初回決済：</strong>申込み時に即時決済</p>
                                <p className="mb-2"><strong>2回目以降（月額プラン）：</strong>初回決済日を起算日として、毎月同日に自動課金</p>
                                <p className="mb-2"><strong>2回目以降（年額プラン）：</strong>初回決済日を起算日として、毎年同日に自動課金</p>
                                <p className="text-xs text-[#725b3f]">（例：1月10日に月額プラン入会 → 以降、毎月10日に決済）</p>
                            </dd>
                        </div>
                        <div className="bg-[#f7f5f0] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-center">サービス提供時期</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                決済完了後、直ちにコミュニティへの参加権限および各種機能の利用権限を付与し、サービス提供を開始します。
                            </dd>
                        </div>
                        <div className="bg-[#fffdf9] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-start pt-1">中途解約・退会について</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                <p className="mb-4">解約はいつでも可能です。<br/>ただし、決済後の返金はいかなる理由があっても行いません。<br/>年額プラン（COVENANT）をご利用中の場合、期間途中での解約および日割り返金はできません。</p>
                                <p className="font-bold text-[#4a3b32] mb-1">【解約方法】</p>
                                <p className="mb-1">次回決済日の前日までに、所定の退会・解約手続きを行うことで解約可能です。</p>
                                <p className="text-xs text-[#725b3f]">※決済日当日の申請は、翌月（または翌年）の解約扱いとなる場合があります。</p>
                            </dd>
                        </div>
                        <div className="bg-[#f7f5f0] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-center">クーリング・オフについて</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                本サービスはインターネットを通じた通信販売に該当するため、特定商取引法上のクーリング・オフ制度の適用対象外となります。
                            </dd>
                        </div>
                        <div className="bg-[#fffdf9] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-b border-[#e8dfd1]">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-center">免責事項</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                本サービスは、理想のパートナーとのマッチングや事業の成功、収益の向上を必ずしも保証するものではありません。<br /><br />
                                提供される情報やコミュニティ内での交流、各種支援の活用は、すべて会員ご自身の判断と責任で行っていただきます。<br /><br />
                                本サービスの利用、または会員間のトラブルにより生じたいかなる損害についても、当運営は責任を負いかねます。
                            </dd>
                        </div>
                        <div className="bg-[#f7f5f0] px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-bold text-[#3e2723] flex items-center">動作環境</dt>
                            <dd className="mt-1 text-sm text-[#5c4a3d] sm:mt-0 sm:col-span-2">
                                本サービスは、インターネット接続が可能なPC・スマートフォン・タブレット端末からご利用いただけます。<br />
                                最新のOSおよびブラウザ（Google Chrome, Safari, Edge等の最新版）でのご利用を推奨いたします。
                            </dd>
                        </div>
                    </dl>
                </div>

                <div className="mt-8 text-center text-sm text-[#725b3f]">
                    &copy; NOAH Community. All rights reserved.
                </div>
            </div>
        </div>
    );
}
