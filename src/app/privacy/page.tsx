'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
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
                        オタスケ
                    </Link>
                </div>
            </header>

            {/* Content */}
            <article className="max-w-4xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-black mb-2">プライバシーポリシー</h1>
                <p className="text-sm text-gray-500 mb-12">最終更新日: 2026年1月10日</p>

                <div className="prose prose-gray max-w-none">
                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">1. はじめに</h2>
                        <p className="text-gray-700 leading-relaxed">
                            株式会社ZETTAI（以下「当社」といいます）は、オタスケ（以下「本サービス」といいます）を通じて取得する個人情報の重要性を認識し、その保護を徹底するため、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">2. 取得する情報</h2>
                        <p className="text-gray-700 leading-relaxed mb-4">当社は、本サービスの提供にあたり、以下の情報を取得することがあります。</p>

                        <h3 className="text-lg font-bold mt-6 mb-3">2.1 利用者から直接提供される情報</h3>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 leading-relaxed">
                            <li>氏名</li>
                            <li>メールアドレス</li>
                            <li>電話番号</li>
                            <li>会社名・屋号</li>
                            <li>その他、登録フォームで入力された情報</li>
                        </ul>

                        <h3 className="text-lg font-bold mt-6 mb-3">2.2 サービス利用に伴い自動的に取得される情報</h3>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 leading-relaxed">
                            <li>IPアドレス</li>
                            <li>ブラウザの種類・バージョン</li>
                            <li>オペレーティングシステム</li>
                            <li>アクセス日時</li>
                            <li>参照元URL</li>
                            <li>Cookie情報</li>
                            <li>サービス利用履歴</li>
                        </ul>

                        <h3 className="text-lg font-bold mt-6 mb-3">2.3 サービス利用に関連する情報</h3>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 leading-relaxed">
                            <li>入力されたURL</li>
                            <li>入力されたプロンプト</li>
                            <li>アップロードされた画像</li>
                            <li>生成されたコンテンツ</li>
                            <li>サービス利用状況（生成回数、使用機能等）</li>
                        </ul>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">3. 情報の利用目的</h2>
                        <p className="text-gray-700 leading-relaxed mb-4">当社は、取得した情報を以下の目的で利用します。</p>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>本サービスの提供、運営、改善</li>
                            <li>利用者からのお問い合わせへの対応</li>
                            <li>利用料金の請求</li>
                            <li>本サービスに関する通知、案内の送信</li>
                            <li>マーケティング・広告配信（利用者の同意がある場合）</li>
                            <li>利用状況の分析・統計処理</li>
                            <li>不正利用の防止、セキュリティの確保</li>
                            <li>法令に基づく対応</li>
                            <li>その他、上記利用目的に付随する目的</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">4. 情報の第三者提供</h2>
                        <p className="text-gray-700 leading-relaxed mb-4">当社は、以下の場合を除き、利用者の同意なく個人情報を第三者に提供しません。</p>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>法令に基づく場合</li>
                            <li>人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                            <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                            <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき</li>
                            <li>合併、会社分割、事業譲渡その他の事由による事業の承継に伴って個人情報が提供される場合</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">5. 外部サービスの利用</h2>
                        <p className="text-gray-700 leading-relaxed mb-4">当社は、本サービスの提供にあたり、以下の外部サービスを利用する場合があります。各サービスにおける情報の取扱いについては、各社のプライバシーポリシーをご確認ください。</p>

                        <h3 className="text-lg font-bold mt-6 mb-3">5.1 AI・機械学習サービス</h3>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 leading-relaxed">
                            <li>Google Cloud Platform（Gemini API等）</li>
                            <li>その他のAIサービスプロバイダー</li>
                        </ul>
                        <p className="text-gray-600 text-sm mt-2">※ これらのサービスに送信されるデータ（プロンプト、画像等）は、各サービス提供者のプライバシーポリシーに従って処理されます。</p>

                        <h3 className="text-lg font-bold mt-6 mb-3">5.2 インフラ・ホスティング</h3>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 leading-relaxed">
                            <li>Supabase（認証、データベース）</li>
                            <li>Vercel（ホスティング）</li>
                            <li>Cloudflare（CDN、セキュリティ）</li>
                        </ul>

                        <h3 className="text-lg font-bold mt-6 mb-3">5.3 分析ツール</h3>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 leading-relaxed">
                            <li>Google Analytics（利用状況の分析）</li>
                        </ul>

                        <h3 className="text-lg font-bold mt-6 mb-3">5.4 決済サービス</h3>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 leading-relaxed">
                            <li>Stripe（決済処理）</li>
                        </ul>
                        <p className="text-gray-600 text-sm mt-2">※ クレジットカード情報は当社では保持せず、決済サービス提供者が直接処理します。</p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">6. Cookieの利用</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>当社は、本サービスにおいてCookie（クッキー）を使用します。</li>
                            <li>Cookieは、利用者の認証状態の維持、利用状況の分析、サービスの改善等のために使用されます。</li>
                            <li>利用者は、ブラウザの設定によりCookieの受け入れを拒否することができますが、その場合、本サービスの一部機能が利用できなくなる可能性があります。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">7. 情報の安全管理</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>当社は、個人情報の漏洩、滅失、毀損を防止するため、適切なセキュリティ対策を講じます。</li>
                            <li>当社は、個人情報を取り扱う従業員に対し、適切な教育・監督を行います。</li>
                            <li>当社は、個人情報の取扱いを外部に委託する場合、委託先に対し適切な監督を行います。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">8. 情報の保存期間</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>当社は、利用目的の達成に必要な期間、個人情報を保存します。</li>
                            <li>アカウント情報は、アカウント削除後6ヶ月間保存した後、削除します。</li>
                            <li>サービス利用履歴は、統計処理後、匿名化した上で保存することがあります。</li>
                            <li>法令により保存が義務付けられている情報は、法令で定められた期間保存します。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">9. 利用者の権利</h2>
                        <p className="text-gray-700 leading-relaxed mb-4">利用者は、当社に対し、以下の権利を行使することができます。</p>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li><strong>開示請求権:</strong> 当社が保有する利用者の個人情報の開示を請求することができます。</li>
                            <li><strong>訂正請求権:</strong> 個人情報が事実と異なる場合、訂正を請求することができます。</li>
                            <li><strong>利用停止請求権:</strong> 個人情報の利用の停止を請求することができます。</li>
                            <li><strong>削除請求権:</strong> 個人情報の削除を請求することができます。</li>
                            <li><strong>第三者提供停止請求権:</strong> 第三者への提供の停止を請求することができます。</li>
                        </ol>
                        <p className="text-gray-700 leading-relaxed mt-4">
                            上記の請求を行う場合は、本ポリシー末尾の連絡先までお問い合わせください。なお、ご本人確認のための書類の提出をお願いする場合があります。
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">10. 未成年者の利用</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>本サービスは、18歳以上の方を対象としています。</li>
                            <li>18歳未満の方が本サービスを利用する場合は、親権者または法定代理人の同意が必要です。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">11. 海外への情報移転</h2>
                        <p className="text-gray-700 leading-relaxed">
                            当社が利用する外部サービス（クラウドサービス、AI API等）のサーバーは、日本国外に所在する場合があります。この場合、利用者の情報は、当該国・地域の法令に従って処理される可能性があります。当社は、海外への情報移転にあたり、適切な安全管理措置を講じます。
                        </p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">12. 本ポリシーの変更</h2>
                        <ol className="list-decimal list-inside space-y-3 text-gray-700 leading-relaxed">
                            <li>当社は、法令の改正、事業内容の変更等により、本ポリシーを変更することがあります。</li>
                            <li>重要な変更を行う場合は、本サービス上での通知またはメールにより利用者にお知らせします。</li>
                            <li>変更後の本ポリシーは、本サービス上に掲載した時点から効力を生じます。</li>
                        </ol>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold mb-4 pb-2 border-b border-gray-200">13. お問い合わせ</h2>
                        <p className="text-gray-700 leading-relaxed">
                            本ポリシーに関するお問い合わせ、個人情報に関する請求は、以下の連絡先までお願いいたします。
                        </p>
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <p className="text-gray-700">
                                <strong>株式会社ZETTAI</strong><br />
                                <strong>個人情報保護責任者:</strong> 代表取締役<br />
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
