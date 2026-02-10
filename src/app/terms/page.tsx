'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-white">
            {/* Header */}
            <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/waitingroom" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium">戻る</span>
                    </Link>
                    <Link href="/" className="text-xl font-black tracking-tighter">
                        オタスケ LP
                    </Link>
                </div>
            </header>

            {/* Content */}
            <article className="max-w-4xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-black mb-2">利用規約</h1>
                <p className="text-sm text-gray-500 mb-12">最終更新日: 2026年1月10日</p>

                <div className="prose prose-gray max-w-none">
                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第1条（総則）</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>本利用規約（以下「本規約」といいます）は、株式会社ZETTAI（以下「当社」といいます）が提供するオタスケ LP（以下「本サービス」といいます）の利用条件を定めるものです。</li>
                            <li>本サービスを利用するすべての方（以下「利用者」といいます）は、本規約に同意したものとみなされます。</li>
                            <li>本規約に同意いただけない場合、本サービスを利用することはできません。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第2条（定義）</h2>
                        <p className="text-gray-700 leading-relaxed mb-4">本規約において使用する用語の定義は、以下のとおりとします。</p>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>「本サービス」とは、当社が提供するAIを活用したランディングページ作成支援ツールおよびこれに付随するすべてのサービスを指します。</li>
                            <li>「生成コンテンツ」とは、利用者が本サービスを通じて作成した画像、テキスト、デザイン、HTMLコード等の一切の成果物を指します。</li>
                            <li>「入力データ」とは、利用者が本サービスに入力するURL、プロンプト、画像、テキスト等の一切のデータを指します。</li>
                            <li>「利用料金」とは、本サービスの利用に対して利用者が当社に支払う対価を指します。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第3条（サービスの内容）</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>本サービスは、AIを活用してランディングページの作成を支援するツールを提供するものです。</li>
                            <li>当社は、本サービスの内容、機能、仕様を予告なく変更、追加、廃止することができます。</li>
                            <li>当社は、本サービスの提供にあたり、第三者のサービス（AI API、クラウドサービス等）を利用する場合があります。当該第三者サービスの障害、仕様変更等により本サービスに影響が生じた場合、当社は一切の責任を負いません。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第4条（アカウント）</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>利用者は、本サービスの利用にあたり、当社所定の方法によりアカウントを登録するものとします。</li>
                            <li>利用者は、登録情報に変更が生じた場合、速やかに当社所定の方法により変更手続きを行うものとします。</li>
                            <li>利用者は、自己のアカウント情報を適切に管理する責任を負い、第三者に利用させ、または貸与、譲渡、売買等をしてはなりません。</li>
                            <li>アカウント情報の管理不十分、使用上の過誤、第三者の使用等による損害の責任は利用者が負うものとし、当社は一切の責任を負いません。</li>
                            <li>当社は、以下の場合、事前の通知なくアカウントを停止または削除することができます。
                                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                    <li>本規約に違反した場合</li>
                                    <li>登録情報に虚偽があった場合</li>
                                    <li>利用料金の支払いを怠った場合</li>
                                    <li>その他、当社が不適切と判断した場合</li>
                                </ul>
                            </li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第5条（利用料金および支払い）</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>利用者は、当社が定める利用料金を、当社が指定する方法により支払うものとします。</li>
                            <li>利用料金は、当社が別途定める料金表に従うものとし、当社は料金を変更する場合、事前に利用者に通知するものとします。</li>
                            <li>支払済みの利用料金は、理由の如何を問わず返金いたしません。</li>
                            <li>利用者が利用料金の支払いを遅延した場合、年14.6%の割合による遅延損害金を支払うものとします。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第6条（知的財産権・著作権）</h2>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                            <p className="text-amber-800 font-bold text-sm">重要：生成コンテンツの権利帰属について</p>
                        </div>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li><strong>生成コンテンツの著作権は、利用者に帰属します。</strong>当社は、生成コンテンツに関するいかなる権利も主張しません。</li>
                            <li>利用者は、生成コンテンツを自由に使用、複製、改変、頒布、公衆送信することができます。</li>
                            <li>本サービス自体（ソフトウェア、UI、ロゴ、商標等）に関する知的財産権は、当社または正当な権利者に帰属します。</li>
                            <li>利用者は、本サービスのリバースエンジニアリング、逆コンパイル、逆アセンブル等を行ってはなりません。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第7条（利用者の責任）</h2>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <p className="text-red-800 font-bold text-sm">重要：利用者は以下の責任を負います</p>
                        </div>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li><strong>利用者は、入力データおよび生成コンテンツが第三者の著作権、商標権、肖像権、プライバシー権その他一切の権利を侵害しないことを保証し、その責任を負います。</strong></li>
                            <li>利用者は、本サービスを利用して作成したコンテンツの内容について、全責任を負います。</li>
                            <li>利用者が入力するURLのウェブサイトのコンテンツを本サービスで使用する場合、利用者は当該コンテンツの使用権限を有していることを保証するものとします。</li>
                            <li>第三者から当社に対して、利用者の生成コンテンツまたは入力データに関して権利侵害等の申立てがなされた場合、利用者は自己の費用と責任においてこれを解決し、当社に一切の迷惑をかけないものとします。</li>
                            <li>前項の申立てにより当社が損害を被った場合、利用者は当社に対し、当該損害（弁護士費用を含む）を賠償するものとします。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第8条（禁止事項）</h2>
                        <p className="text-gray-700 leading-relaxed mb-4">利用者は、本サービスの利用にあたり、以下の行為を行ってはなりません。</p>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>法令または公序良俗に違反する行為</li>
                            <li>犯罪行為に関連する行為</li>
                            <li>第三者の著作権、商標権、特許権、意匠権、肖像権、プライバシー権、名誉権その他一切の権利を侵害する行為</li>
                            <li>第三者になりすます行為</li>
                            <li>虚偽の情報を登録または発信する行為</li>
                            <li>本サービスを利用して、以下のコンテンツを作成する行為
                                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                    <li>違法なコンテンツ</li>
                                    <li>わいせつ、児童ポルノまたは児童虐待に該当するコンテンツ</li>
                                    <li>差別、誹謗中傷、脅迫を含むコンテンツ</li>
                                    <li>詐欺的なコンテンツ</li>
                                    <li>マルウェアその他有害なプログラムを含むコンテンツ</li>
                                </ul>
                            </li>
                            <li>本サービスのサーバーまたはネットワークに過度な負荷をかける行為</li>
                            <li>本サービスの運営を妨害する行為</li>
                            <li>不正アクセス、クラッキング等の行為</li>
                            <li>本サービスを商業目的で再販売する行為（ただし、生成コンテンツを用いた事業活動は除く）</li>
                            <li>その他、当社が不適切と判断する行為</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第9条（免責事項）</h2>
                        <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-4">
                            <p className="text-gray-800 font-bold text-sm">重要：当社の免責事項</p>
                        </div>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li><strong>当社は、本サービスを「現状有姿」で提供し、明示または黙示を問わず、いかなる保証も行いません。</strong></li>
                            <li><strong>当社は、生成コンテンツの正確性、完全性、有用性、適法性、第三者の権利非侵害について、一切保証しません。</strong></li>
                            <li><strong>当社は、利用者が本サービスを利用して作成したコンテンツに起因する著作権侵害、商標権侵害、肖像権侵害その他一切の権利侵害について、一切の責任を負いません。</strong></li>
                            <li>当社は、本サービスの中断、停止、終了、利用不能または変更により利用者に生じた損害について、一切の責任を負いません。</li>
                            <li>当社は、利用者のデータの消失、破損について、一切の責任を負いません。</li>
                            <li>当社は、本サービスに関連して利用者間または利用者と第三者との間で生じた紛争について、一切の責任を負いません。</li>
                            <li>AIによる生成結果は予測不可能であり、当社は生成結果について一切の保証を行いません。</li>
                            <li>本サービスが利用する第三者サービス（AI API等）の利用規約に利用者が違反した場合、当社は一切の責任を負いません。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第10条（損害賠償の制限）</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li><strong>当社は、本サービスに関して利用者に生じた損害について、当社の故意または重大な過失による場合を除き、一切の損害賠償責任を負いません。</strong></li>
                            <li>前項にかかわらず、当社が損害賠償責任を負う場合であっても、当社の責任は、損害発生時の直近1ヶ月間に当該利用者が当社に支払った利用料金相当額を上限とします。</li>
                            <li>当社は、いかなる場合も、間接損害、特別損害、偶発的損害、派生的損害、逸失利益、事業機会の喪失、データの喪失について責任を負いません。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第11条（サービスの中断・終了）</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>当社は、以下の場合、事前の通知なく本サービスの全部または一部を中断することができます。
                                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                                    <li>システムの保守、点検、更新を行う場合</li>
                                    <li>地震、落雷、火災、停電、天災等の不可抗力により本サービスの提供が困難な場合</li>
                                    <li>第三者サービスの障害が発生した場合</li>
                                    <li>その他、当社がやむを得ないと判断した場合</li>
                                </ul>
                            </li>
                            <li>当社は、30日前までに利用者に通知することにより、本サービスの全部または一部を終了することができます。</li>
                            <li>当社は、本サービスの中断または終了により利用者に生じた損害について、一切の責任を負いません。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第12条（秘密保持）</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>利用者は、本サービスの利用に関して知り得た当社の技術上、営業上その他の秘密情報を第三者に開示または漏洩してはなりません。</li>
                            <li>前項の規定は、本契約終了後も存続するものとします。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第13条（反社会的勢力の排除）</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>利用者は、現在および将来にわたり、暴力団、暴力団員、暴力団準構成員、暴力団関係企業、総会屋、社会運動等標ぼうゴロ、特殊知能暴力集団その他これらに準ずる者（以下「反社会的勢力」といいます）に該当しないことを表明し、保証します。</li>
                            <li>利用者が反社会的勢力に該当すると当社が判断した場合、当社は事前の通知なく本サービスの利用を停止し、契約を解除することができます。</li>
                            <li>前項の場合、当社は利用者に対して損害賠償責任を負わないものとします。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第14条（権利義務の譲渡禁止）</h2>
                        <p className="text-gray-700 leading-relaxed">
                            利用者は、当社の書面による事前の承諾なく、本規約に基づく権利または義務を第三者に譲渡し、または担保に供してはなりません。
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第15条（分離可能性）</h2>
                        <p className="text-gray-700 leading-relaxed">
                            本規約のいずれかの条項が無効または執行不能と判断された場合であっても、本規約の他の条項の有効性には影響を与えないものとします。
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第16条（規約の変更）</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>当社は、利用者に通知することにより、本規約を変更することができます。</li>
                            <li>変更後の本規約は、当社が別途定める場合を除き、本サービス上に表示した時点から効力を生じるものとします。</li>
                            <li>利用者が変更後の本規約に同意しない場合、本サービスの利用を停止するものとします。変更後に本サービスを利用した場合、変更後の本規約に同意したものとみなします。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第17条（準拠法および管轄裁判所）</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>本規約は、日本法に準拠し、日本法に従って解釈されるものとします。</li>
                            <li>本規約に関する一切の紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">第18条（お問い合わせ）</h2>
                        <p className="text-gray-700 leading-relaxed">
                            本規約に関するお問い合わせは、以下の連絡先までお願いいたします。
                        </p>
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <p className="text-gray-700">
                                <strong>株式会社ZETTAI</strong><br />
                                メール: <a href="mailto:team@zettai.co.jp" className="text-amber-600 hover:underline">team@zettai.co.jp</a>
                            </p>
                        </div>
                    </section>

                    <div className="mt-12 pt-8 border-t border-gray-200">
                        <p className="text-sm text-gray-500 text-right">
                            制定日: 2026年1月10日<br />
                            株式会社ZETTAI
                        </p>
                    </div>
                </div>
            </article>

            {/* Footer */}
            <footer className="py-8 px-6 bg-gray-50 border-t border-gray-100">
                <div className="max-w-4xl mx-auto text-center">
                    <p className="text-xs text-gray-500">
                        &copy; 2026 ZETTAI INC. ALL RIGHTS RESERVED.
                    </p>
                </div>
            </footer>
        </main>
    );
}
