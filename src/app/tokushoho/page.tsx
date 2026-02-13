'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TokushohoPage() {
    return (
        <main className="min-h-screen bg-white">
            {/* Header */}
            <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium">戻る</span>
                    </Link>
                    <Link href="/" className="text-xl font-black tracking-tighter">
                        OTASUKE！なんでも修正くん
                    </Link>
                </div>
            </header>

            {/* Content */}
            <article className="max-w-4xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-black mb-2">特定商取引法に基づく表示</h1>
                <p className="text-sm text-gray-500 mb-12">最終更新日: 2026年2月10日</p>

                <div className="prose prose-gray max-w-none">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <tbody className="divide-y divide-gray-200">
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 w-1/3 align-top">販売事業者</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">株式会社ZETTAI</td>
                                </tr>
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 align-top">代表者</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">{/* TODO: 代表者名 */}[代表者名を記載]</td>
                                </tr>
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 align-top">所在地</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">{/* TODO: 住所 */}[住所を記載]</td>
                                </tr>
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 align-top">電話番号</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">{/* TODO: 電話番号 */}[電話番号を記載]</td>
                                </tr>
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 align-top">メールアドレス</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">
                                        <a href="mailto:team@zettai.co.jp" className="text-amber-600 hover:underline">team@zettai.co.jp</a>
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 align-top">商品・サービス名</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">OTASUKE！なんでも修正くん（AIランディングページ作成支援SaaS）</td>
                                </tr>
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 align-top">販売価格</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>Free プラン：¥0/月</li>
                                            <li>Pro プラン：¥20,000/月（税込）</li>
                                            <li>Business プラン：¥40,000/月（税込）</li>
                                            <li>Enterprise プラン：¥100,000/月（税込）</li>
                                            <li>追加クレジット：¥20,000/回（税込）</li>
                                        </ul>
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 align-top">支払方法</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">クレジットカード（Stripe経由）</td>
                                </tr>
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 align-top">支払時期</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>サブスクリプション：契約時および毎月の自動更新時</li>
                                            <li>追加クレジット購入：購入時に即時決済</li>
                                        </ul>
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 align-top">サービス提供時期</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">決済完了後、即座にサービス利用可能</td>
                                </tr>
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 align-top">契約期間</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">
                                        <p>月単位の自動更新契約です。契約日から1ヶ月ごとに自動更新されます。</p>
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 align-top">解約・キャンセル</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>管理画面の「設定」からいつでもキャンセル可能</li>
                                            <li>キャンセル後も当月末までサービス利用可能</li>
                                            <li>支払済みの料金およびクレジット残高の返金はいたしません</li>
                                        </ul>
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 align-top">動作環境</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">
                                        最新版のGoogle Chrome、Safari、Firefox、Microsoft Edge<br />
                                        ※ インターネット接続が必要です
                                    </td>
                                </tr>
                                <tr>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 bg-gray-50 align-top">個人情報の取扱い</th>
                                    <td className="py-4 px-4 text-sm text-gray-700">
                                        <Link href="/privacy" className="text-amber-600 hover:underline">プライバシーポリシー</Link>をご参照ください
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-12 pt-8 border-t border-gray-200">
                        <p className="text-sm text-gray-500 text-right">
                            制定日: 2026年2月10日<br />
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
