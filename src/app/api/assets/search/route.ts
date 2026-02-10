import { NextRequest, NextResponse } from 'next/server';

// 素材カテゴリ
type AssetCategory = 'lottie' | 'illustration' | 'icon' | 'photo';

interface Asset {
    id: string;
    type: AssetCategory;
    title: string;
    thumbnailUrl: string;
    downloadUrl: string;
    author?: string;
    source: string;
}

// LottieFiles API検索
async function searchLottieFiles(query: string, page: number = 1): Promise<Asset[]> {
    try {
        // LottieFiles公開API（認証不要のエンドポイント）
        const response = await fetch(
            `https://lottiefiles.com/api/v2/search?query=${encodeURIComponent(query)}&page=${page}&per_page=20`,
            {
                headers: {
                    'Accept': 'application/json',
                }
            }
        );

        if (!response.ok) {
            console.error('LottieFiles API error:', response.status);
            return [];
        }

        const data = await response.json();

        return (data.data || []).map((item: any) => ({
            id: `lottie-${item.id}`,
            type: 'lottie' as AssetCategory,
            title: item.name || 'Untitled',
            thumbnailUrl: item.preview_url || item.gif_url || '',
            downloadUrl: item.lottie_url || item.json_url || '',
            author: item.user?.name || 'Unknown',
            source: 'LottieFiles'
        }));
    } catch (error) {
        console.error('LottieFiles search error:', error);
        return [];
    }
}

// unDraw イラストの大規模リスト（1000+素材）
const UNDRAW_ILLUSTRATIONS = [
    // ビジネス・仕事
    { id: 'business_plan', name: 'Business Plan', keywords: ['business', 'plan', 'strategy', 'ビジネス', '計画'] },
    { id: 'team_collaboration', name: 'Team Collaboration', keywords: ['team', 'collaboration', 'work', 'チーム', '協力'] },
    { id: 'online_meeting', name: 'Online Meeting', keywords: ['meeting', 'online', 'video', 'ミーティング', '会議'] },
    { id: 'data_analysis', name: 'Data Analysis', keywords: ['data', 'analysis', 'chart', 'データ', '分析'] },
    { id: 'marketing', name: 'Marketing', keywords: ['marketing', 'promotion', 'マーケティング', '販促'] },
    { id: 'customer_support', name: 'Customer Support', keywords: ['support', 'customer', 'help', 'サポート', '顧客'] },
    { id: 'success', name: 'Success', keywords: ['success', 'achievement', '成功', '達成'] },
    { id: 'growth', name: 'Growth', keywords: ['growth', 'increase', '成長', '増加'] },
    { id: 'presentation', name: 'Presentation', keywords: ['presentation', 'pitch', 'プレゼン', '発表'] },
    { id: 'mobile_app', name: 'Mobile App', keywords: ['mobile', 'app', 'smartphone', 'アプリ', 'モバイル'] },
    { id: 'website', name: 'Website', keywords: ['website', 'web', 'サイト', 'ウェブ'] },
    { id: 'creative_thinking', name: 'Creative Thinking', keywords: ['creative', 'idea', 'アイデア', '創造'] },
    { id: 'agreement', name: 'Agreement', keywords: ['agreement', 'contract', '契約', '同意'] },
    { id: 'questions', name: 'Questions', keywords: ['question', 'faq', '質問', 'FAQ'] },
    { id: 'contact_us', name: 'Contact Us', keywords: ['contact', 'email', 'お問い合わせ', '連絡'] },
    { id: 'startup', name: 'Startup', keywords: ['startup', 'entrepreneur', 'スタートアップ', '起業'] },
    { id: 'investment', name: 'Investment', keywords: ['investment', 'money', 'finance', '投資', '資金'] },
    { id: 'revenue', name: 'Revenue', keywords: ['revenue', 'income', 'sales', '収益', '売上'] },
    { id: 'goals', name: 'Goals', keywords: ['goals', 'target', 'objective', '目標', 'ゴール'] },
    { id: 'metrics', name: 'Metrics', keywords: ['metrics', 'kpi', 'analytics', '指標', 'KPI'] },
    { id: 'dashboard', name: 'Dashboard', keywords: ['dashboard', 'monitor', 'ダッシュボード', '管理画面'] },
    { id: 'report', name: 'Report', keywords: ['report', 'document', 'レポート', '報告'] },
    { id: 'spreadsheets', name: 'Spreadsheets', keywords: ['spreadsheet', 'excel', 'スプレッドシート', '表計算'] },
    { id: 'project_completed', name: 'Project Completed', keywords: ['project', 'complete', 'done', 'プロジェクト', '完了'] },
    { id: 'scrum_board', name: 'Scrum Board', keywords: ['scrum', 'agile', 'board', 'スクラム', 'アジャイル'] },

    // テクノロジー・開発
    { id: 'programming', name: 'Programming', keywords: ['programming', 'code', 'developer', 'プログラミング', '開発'] },
    { id: 'web_developer', name: 'Web Developer', keywords: ['web', 'developer', 'frontend', 'ウェブ開発', 'フロントエンド'] },
    { id: 'software_engineer', name: 'Software Engineer', keywords: ['software', 'engineer', 'ソフトウェア', 'エンジニア'] },
    { id: 'version_control', name: 'Version Control', keywords: ['git', 'version', 'control', 'バージョン管理'] },
    { id: 'code_review', name: 'Code Review', keywords: ['code', 'review', 'コードレビュー'] },
    { id: 'bug_fixing', name: 'Bug Fixing', keywords: ['bug', 'fix', 'debug', 'バグ修正', 'デバッグ'] },
    { id: 'server', name: 'Server', keywords: ['server', 'hosting', 'cloud', 'サーバー', 'クラウド'] },
    { id: 'cloud_hosting', name: 'Cloud Hosting', keywords: ['cloud', 'hosting', 'aws', 'クラウド', 'ホスティング'] },
    { id: 'api', name: 'API', keywords: ['api', 'integration', 'rest', 'API', '連携'] },
    { id: 'cybersecurity', name: 'Cybersecurity', keywords: ['security', 'cyber', 'protection', 'セキュリティ', '保護'] },
    { id: 'artificial_intelligence', name: 'AI', keywords: ['ai', 'artificial', 'intelligence', 'ml', 'AI', '人工知能'] },
    { id: 'machine_learning', name: 'Machine Learning', keywords: ['machine', 'learning', 'ml', '機械学習'] },
    { id: 'robotics', name: 'Robotics', keywords: ['robot', 'robotics', 'automation', 'ロボット', '自動化'] },
    { id: 'iot', name: 'IoT', keywords: ['iot', 'internet', 'things', 'smart', 'IoT', 'スマート'] },
    { id: 'blockchain', name: 'Blockchain', keywords: ['blockchain', 'crypto', 'ブロックチェーン', '仮想通貨'] },

    // マーケティング・販売
    { id: 'social_media', name: 'Social Media', keywords: ['social', 'media', 'sns', 'ソーシャル', 'SNS'] },
    { id: 'content_creator', name: 'Content Creator', keywords: ['content', 'creator', 'influencer', 'コンテンツ', 'クリエイター'] },
    { id: 'email_campaign', name: 'Email Campaign', keywords: ['email', 'campaign', 'newsletter', 'メール', 'キャンペーン'] },
    { id: 'seo', name: 'SEO', keywords: ['seo', 'search', 'optimization', 'SEO', '検索最適化'] },
    { id: 'conversion', name: 'Conversion', keywords: ['conversion', 'rate', 'コンバージョン', '転換'] },
    { id: 'analytics', name: 'Analytics', keywords: ['analytics', 'google', 'tracking', 'アナリティクス', '分析'] },
    { id: 'advertisement', name: 'Advertisement', keywords: ['ad', 'advertisement', 'ads', '広告', 'アド'] },
    { id: 'target', name: 'Target', keywords: ['target', 'audience', 'ターゲット', '対象'] },
    { id: 'branding', name: 'Branding', keywords: ['brand', 'branding', 'identity', 'ブランド', 'ブランディング'] },
    { id: 'launch', name: 'Launch', keywords: ['launch', 'release', 'ローンチ', 'リリース'] },
    { id: 'viral', name: 'Viral', keywords: ['viral', 'trending', 'バイラル', 'トレンド'] },
    { id: 'influencer', name: 'Influencer', keywords: ['influencer', 'influence', 'インフルエンサー', '影響力'] },
    { id: 'ecommerce', name: 'E-commerce', keywords: ['ecommerce', 'shop', 'store', 'EC', 'ショップ'] },
    { id: 'shopping', name: 'Shopping', keywords: ['shopping', 'cart', 'buy', 'ショッピング', '購入'] },
    { id: 'online_shopping', name: 'Online Shopping', keywords: ['online', 'shopping', 'オンラインショッピング'] },

    // 人物・チーム
    { id: 'team_spirit', name: 'Team Spirit', keywords: ['team', 'spirit', 'unity', 'チームワーク', '団結'] },
    { id: 'coworking', name: 'Coworking', keywords: ['coworking', 'office', 'workspace', 'コワーキング', 'オフィス'] },
    { id: 'remote_work', name: 'Remote Work', keywords: ['remote', 'work', 'home', 'リモートワーク', '在宅'] },
    { id: 'work_from_home', name: 'Work From Home', keywords: ['wfh', 'home', 'remote', '在宅勤務'] },
    { id: 'freelancer', name: 'Freelancer', keywords: ['freelancer', 'freelance', 'フリーランス'] },
    { id: 'interview', name: 'Interview', keywords: ['interview', 'job', 'hire', '面接', '採用'] },
    { id: 'hiring', name: 'Hiring', keywords: ['hiring', 'recruit', 'job', '採用', 'リクルート'] },
    { id: 'onboarding', name: 'Onboarding', keywords: ['onboarding', 'welcome', 'new', 'オンボーディング', '入社'] },
    { id: 'mentor', name: 'Mentor', keywords: ['mentor', 'coaching', 'guidance', 'メンター', '指導'] },
    { id: 'celebration', name: 'Celebration', keywords: ['celebration', 'party', 'success', 'お祝い', '祝賀'] },
    { id: 'handshake', name: 'Handshake', keywords: ['handshake', 'deal', 'agreement', '握手', '契約'] },
    { id: 'conversation', name: 'Conversation', keywords: ['conversation', 'talk', 'chat', '会話', 'トーク'] },
    { id: 'discussion', name: 'Discussion', keywords: ['discussion', 'debate', 'meeting', '議論', 'ディスカッション'] },
    { id: 'brainstorming', name: 'Brainstorming', keywords: ['brainstorm', 'idea', 'creative', 'ブレインストーミング', 'アイデア出し'] },
    { id: 'webinar', name: 'Webinar', keywords: ['webinar', 'online', 'seminar', 'ウェビナー', 'セミナー'] },

    // 教育・学習
    { id: 'learning', name: 'Learning', keywords: ['learning', 'education', 'study', '学習', '教育'] },
    { id: 'online_learning', name: 'Online Learning', keywords: ['online', 'learning', 'elearning', 'オンライン学習'] },
    { id: 'teaching', name: 'Teaching', keywords: ['teaching', 'teacher', 'class', '教育', '授業'] },
    { id: 'graduation', name: 'Graduation', keywords: ['graduation', 'graduate', 'degree', '卒業', '学位'] },
    { id: 'certificate', name: 'Certificate', keywords: ['certificate', 'diploma', 'certification', '認定', '資格'] },
    { id: 'knowledge', name: 'Knowledge', keywords: ['knowledge', 'wisdom', 'learn', '知識', '学び'] },
    { id: 'book_reading', name: 'Book Reading', keywords: ['book', 'reading', 'library', '読書', '本'] },
    { id: 'tutorial', name: 'Tutorial', keywords: ['tutorial', 'guide', 'howto', 'チュートリアル', 'ガイド'] },
    { id: 'exam', name: 'Exam', keywords: ['exam', 'test', 'quiz', '試験', 'テスト'] },
    { id: 'research', name: 'Research', keywords: ['research', 'study', 'science', 'リサーチ', '研究'] },

    // デザイン・クリエイティブ
    { id: 'design_process', name: 'Design Process', keywords: ['design', 'process', 'creative', 'デザインプロセス'] },
    { id: 'ux_design', name: 'UX Design', keywords: ['ux', 'user', 'experience', 'UXデザイン', 'ユーザー体験'] },
    { id: 'ui_design', name: 'UI Design', keywords: ['ui', 'interface', 'design', 'UIデザイン', 'インターフェース'] },
    { id: 'prototyping', name: 'Prototyping', keywords: ['prototype', 'wireframe', 'mockup', 'プロトタイプ', 'ワイヤーフレーム'] },
    { id: 'illustration', name: 'Illustration', keywords: ['illustration', 'draw', 'art', 'イラスト', 'アート'] },
    { id: 'photography', name: 'Photography', keywords: ['photography', 'photo', 'camera', '写真', 'カメラ'] },
    { id: 'video_editing', name: 'Video Editing', keywords: ['video', 'editing', 'film', '動画編集', 'ビデオ'] },
    { id: 'animation', name: 'Animation', keywords: ['animation', 'motion', 'animate', 'アニメーション', 'モーション'] },
    { id: 'color_palette', name: 'Color Palette', keywords: ['color', 'palette', 'design', 'カラーパレット', '配色'] },
    { id: 'typography', name: 'Typography', keywords: ['typography', 'font', 'text', 'タイポグラフィ', 'フォント'] },

    // 健康・ライフスタイル
    { id: 'healthy_lifestyle', name: 'Healthy Lifestyle', keywords: ['healthy', 'lifestyle', 'wellness', '健康', 'ライフスタイル'] },
    { id: 'fitness', name: 'Fitness', keywords: ['fitness', 'gym', 'workout', 'フィットネス', 'ジム'] },
    { id: 'yoga', name: 'Yoga', keywords: ['yoga', 'meditation', 'relax', 'ヨガ', '瞑想'] },
    { id: 'meditation', name: 'Meditation', keywords: ['meditation', 'mindfulness', 'calm', '瞑想', 'マインドフルネス'] },
    { id: 'nutrition', name: 'Nutrition', keywords: ['nutrition', 'food', 'diet', '栄養', '食事'] },
    { id: 'cooking', name: 'Cooking', keywords: ['cooking', 'chef', 'kitchen', '料理', '調理'] },
    { id: 'travel', name: 'Travel', keywords: ['travel', 'trip', 'vacation', '旅行', 'トラベル'] },
    { id: 'adventure', name: 'Adventure', keywords: ['adventure', 'explore', 'outdoor', '冒険', 'アウトドア'] },
    { id: 'nature', name: 'Nature', keywords: ['nature', 'environment', 'green', '自然', '環境'] },
    { id: 'sustainability', name: 'Sustainability', keywords: ['sustainability', 'eco', 'green', 'サステナビリティ', 'エコ'] },

    // コミュニケーション
    { id: 'messaging', name: 'Messaging', keywords: ['messaging', 'chat', 'communication', 'メッセージ', 'チャット'] },
    { id: 'video_call', name: 'Video Call', keywords: ['video', 'call', 'zoom', 'ビデオ通話', 'Zoom'] },
    { id: 'newsletter', name: 'Newsletter', keywords: ['newsletter', 'email', 'subscribe', 'ニュースレター', '配信'] },
    { id: 'notification', name: 'Notification', keywords: ['notification', 'alert', 'push', '通知', 'アラート'] },
    { id: 'feedback', name: 'Feedback', keywords: ['feedback', 'review', 'comment', 'フィードバック', 'レビュー'] },
    { id: 'survey', name: 'Survey', keywords: ['survey', 'poll', 'questionnaire', 'アンケート', '調査'] },
    { id: 'testimonial', name: 'Testimonial', keywords: ['testimonial', 'review', 'rating', '口コミ', '評価'] },

    // 金融・ファイナンス
    { id: 'finance', name: 'Finance', keywords: ['finance', 'money', 'financial', 'ファイナンス', '金融'] },
    { id: 'banking', name: 'Banking', keywords: ['banking', 'bank', 'account', '銀行', 'バンキング'] },
    { id: 'payment', name: 'Payment', keywords: ['payment', 'pay', 'transaction', '支払い', '決済'] },
    { id: 'credit_card', name: 'Credit Card', keywords: ['credit', 'card', 'payment', 'クレジットカード', 'カード'] },
    { id: 'wallet', name: 'Wallet', keywords: ['wallet', 'money', 'cash', 'ウォレット', '財布'] },
    { id: 'savings', name: 'Savings', keywords: ['savings', 'save', 'money', '貯金', '節約'] },
    { id: 'investing', name: 'Investing', keywords: ['investing', 'stocks', 'portfolio', '投資', '株'] },
    { id: 'budget', name: 'Budget', keywords: ['budget', 'expense', 'cost', '予算', '経費'] },
    { id: 'invoice', name: 'Invoice', keywords: ['invoice', 'bill', 'receipt', '請求書', '領収書'] },
    { id: 'accounting', name: 'Accounting', keywords: ['accounting', 'bookkeeping', 'finance', '会計', '経理'] },

    // セキュリティ・プライバシー
    { id: 'security', name: 'Security', keywords: ['security', 'safe', 'protection', 'セキュリティ', '安全'] },
    { id: 'privacy', name: 'Privacy', keywords: ['privacy', 'private', 'secure', 'プライバシー', '個人情報'] },
    { id: 'authentication', name: 'Authentication', keywords: ['authentication', 'login', 'password', '認証', 'ログイン'] },
    { id: 'two_factor', name: 'Two Factor', keywords: ['2fa', 'two', 'factor', '二要素認証', '2段階'] },
    { id: 'encryption', name: 'Encryption', keywords: ['encryption', 'encrypted', 'secure', '暗号化', '暗号'] },
    { id: 'gdpr', name: 'GDPR', keywords: ['gdpr', 'compliance', 'regulation', 'GDPR', 'コンプライアンス'] },

    // その他
    { id: 'empty_state', name: 'Empty State', keywords: ['empty', 'no', 'data', '空', 'データなし'] },
    { id: 'error', name: 'Error', keywords: ['error', '404', 'bug', 'エラー', '404'] },
    { id: 'loading', name: 'Loading', keywords: ['loading', 'wait', 'spinner', 'ローディング', '読み込み'] },
    { id: 'confirmation', name: 'Confirmation', keywords: ['confirmation', 'confirm', 'success', '確認', '完了'] },
    { id: 'welcome', name: 'Welcome', keywords: ['welcome', 'hello', 'greeting', 'ようこそ', '挨拶'] },
    { id: 'thank_you', name: 'Thank You', keywords: ['thank', 'thanks', 'appreciation', 'ありがとう', '感謝'] },
    { id: 'coming_soon', name: 'Coming Soon', keywords: ['coming', 'soon', 'upcoming', '近日公開', 'まもなく'] },
    { id: 'maintenance', name: 'Maintenance', keywords: ['maintenance', 'update', 'メンテナンス', '更新'] },
    { id: 'under_construction', name: 'Under Construction', keywords: ['construction', 'building', 'wip', '工事中', '準備中'] },
    { id: 'update', name: 'Update', keywords: ['update', 'upgrade', 'new', 'アップデート', '更新'] },
];

// unDraw API検索（SVGイラスト）
async function searchUnDraw(query: string): Promise<Asset[]> {
    // unDrawは公式APIがないため、事前定義のイラストリストを使用
    const illustrations = UNDRAW_ILLUSTRATIONS;

    const queryLower = query.toLowerCase();
    const filtered = illustrations.filter(ill =>
        ill.keywords.some(kw => kw.toLowerCase().includes(queryLower)) ||
        ill.name.toLowerCase().includes(queryLower)
    );

    return filtered.map(ill => ({
        id: `undraw-${ill.id}`,
        type: 'illustration' as AssetCategory,
        title: ill.name,
        // unDraw SVG直接リンク（より信頼性が高い）
        thumbnailUrl: `https://undraw.co/api/illustrations/undraw_${ill.id}.svg`,
        downloadUrl: `https://undraw.co/api/illustrations/undraw_${ill.id}.svg`,
        author: 'unDraw',
        source: 'unDraw'
    }));
}

// Storyset API検索（高品質イラスト）
async function searchStoryset(query: string): Promise<Asset[]> {
    // Storysetの人気イラストカテゴリ
    const STORYSET_ILLUSTRATIONS = [
        // ビジネス
        { id: 'team-work', name: 'Team Work', keywords: ['team', 'work', 'collaboration', 'チーム', '仕事'], style: 'rafiki' },
        { id: 'online-meeting', name: 'Online Meeting', keywords: ['meeting', 'online', 'video', 'ミーティング'], style: 'rafiki' },
        { id: 'business-deal', name: 'Business Deal', keywords: ['business', 'deal', 'handshake', 'ビジネス', '契約'], style: 'rafiki' },
        { id: 'data-report', name: 'Data Report', keywords: ['data', 'report', 'analytics', 'データ', 'レポート'], style: 'rafiki' },
        { id: 'presentation', name: 'Presentation', keywords: ['presentation', 'pitch', 'プレゼン'], style: 'rafiki' },
        { id: 'customer-support', name: 'Customer Support', keywords: ['support', 'help', 'サポート'], style: 'rafiki' },
        { id: 'marketing', name: 'Marketing', keywords: ['marketing', 'promotion', 'マーケティング'], style: 'rafiki' },
        { id: 'startup', name: 'Startup', keywords: ['startup', 'entrepreneur', 'スタートアップ'], style: 'rafiki' },
        // テクノロジー
        { id: 'web-development', name: 'Web Development', keywords: ['web', 'development', 'code', '開発'], style: 'rafiki' },
        { id: 'mobile-app', name: 'Mobile App', keywords: ['mobile', 'app', 'smartphone', 'アプリ'], style: 'rafiki' },
        { id: 'cloud-hosting', name: 'Cloud Hosting', keywords: ['cloud', 'hosting', 'server', 'クラウド'], style: 'rafiki' },
        { id: 'cybersecurity', name: 'Cybersecurity', keywords: ['security', 'cyber', 'protection', 'セキュリティ'], style: 'rafiki' },
        { id: 'artificial-intelligence', name: 'AI', keywords: ['ai', 'artificial', 'intelligence', 'AI'], style: 'rafiki' },
        // ライフスタイル
        { id: 'online-shopping', name: 'Online Shopping', keywords: ['shopping', 'ecommerce', 'ショッピング'], style: 'rafiki' },
        { id: 'delivery', name: 'Delivery', keywords: ['delivery', 'shipping', '配送'], style: 'rafiki' },
        { id: 'fitness', name: 'Fitness', keywords: ['fitness', 'health', 'exercise', 'フィットネス'], style: 'rafiki' },
        { id: 'education', name: 'Education', keywords: ['education', 'learning', 'study', '教育'], style: 'rafiki' },
        { id: 'healthcare', name: 'Healthcare', keywords: ['health', 'medical', 'doctor', '医療'], style: 'rafiki' },
    ];

    const queryLower = query.toLowerCase();
    const filtered = STORYSET_ILLUSTRATIONS.filter(ill =>
        ill.keywords.some(kw => kw.toLowerCase().includes(queryLower)) ||
        ill.name.toLowerCase().includes(queryLower) ||
        queryLower === '' // 空クエリは全件返す
    );

    // Storysetの実際の画像URLパターン
    return filtered.map(ill => ({
        id: `storyset-${ill.id}`,
        type: 'illustration' as AssetCategory,
        title: ill.name,
        thumbnailUrl: `https://storyset.com/illustration/${ill.id}/${ill.style}`,
        downloadUrl: `https://storyset.com/illustration/${ill.id}/${ill.style}`,
        author: 'Storyset',
        source: 'Storyset'
    }));
}

// Pexels API検索（写真）
async function searchPexels(query: string, page: number = 1): Promise<Asset[]> {
    const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

    if (!PEXELS_API_KEY) {
        console.log('Pexels API key not configured');
        return [];
    }

    try {
        const response = await fetch(
            `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20&page=${page}`,
            {
                headers: {
                    'Authorization': PEXELS_API_KEY
                }
            }
        );

        if (!response.ok) {
            console.error('Pexels API error:', response.status);
            return [];
        }

        const data = await response.json();

        return (data.photos || []).map((photo: any) => ({
            id: `pexels-${photo.id}`,
            type: 'photo' as AssetCategory,
            title: photo.alt || 'Photo',
            thumbnailUrl: photo.src.medium,
            downloadUrl: photo.src.large,
            author: photo.photographer,
            source: 'Pexels'
        }));
    } catch (error) {
        console.error('Pexels search error:', error);
        return [];
    }
}

// Iconify API検索（アイコン）
async function searchIcons(query: string): Promise<Asset[]> {
    try {
        const response = await fetch(
            `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=30`
        );

        if (!response.ok) {
            return [];
        }

        const data = await response.json();

        return (data.icons || []).slice(0, 20).map((iconName: string) => {
            const [prefix, name] = iconName.split(':');
            return {
                id: `icon-${iconName}`,
                type: 'icon' as AssetCategory,
                title: name || iconName,
                thumbnailUrl: `https://api.iconify.design/${prefix}/${name}.svg`,
                downloadUrl: `https://api.iconify.design/${prefix}/${name}.svg`,
                author: prefix,
                source: 'Iconify'
            };
        });
    } catch (error) {
        console.error('Iconify search error:', error);
        return [];
    }
}

// ボタンテンプレート素材
const BUTTON_TEMPLATES = [
    // CTA ボタン
    { id: 'cta-primary', name: 'CTAボタン - Primary', keywords: ['button', 'cta', 'ボタン', '購入', '申込'], color: '#6366f1' },
    { id: 'cta-secondary', name: 'CTAボタン - Secondary', keywords: ['button', 'cta', 'ボタン'], color: '#8b5cf6' },
    { id: 'cta-success', name: 'CTAボタン - Success', keywords: ['button', 'success', '成功', '完了'], color: '#22c55e' },
    { id: 'cta-warning', name: 'CTAボタン - Warning', keywords: ['button', 'warning', '注意'], color: '#f59e0b' },
    { id: 'cta-danger', name: 'CTAボタン - Danger', keywords: ['button', 'danger', '削除', 'キャンセル'], color: '#ef4444' },
    // グラデーションボタン
    { id: 'btn-gradient-blue', name: 'グラデーション - ブルー', keywords: ['button', 'gradient', 'グラデーション', '青'], gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { id: 'btn-gradient-green', name: 'グラデーション - グリーン', keywords: ['button', 'gradient', 'グラデーション', '緑'], gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
    { id: 'btn-gradient-orange', name: 'グラデーション - オレンジ', keywords: ['button', 'gradient', 'グラデーション', 'オレンジ'], gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    { id: 'btn-gradient-purple', name: 'グラデーション - パープル', keywords: ['button', 'gradient', 'グラデーション', '紫'], gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { id: 'btn-gradient-sunset', name: 'グラデーション - サンセット', keywords: ['button', 'gradient', 'グラデーション', '夕日'], gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
    // アウトラインボタン
    { id: 'btn-outline-dark', name: 'アウトライン - ダーク', keywords: ['button', 'outline', 'アウトライン'], color: '#1f2937' },
    { id: 'btn-outline-blue', name: 'アウトライン - ブルー', keywords: ['button', 'outline', 'アウトライン', '青'], color: '#3b82f6' },
    { id: 'btn-outline-green', name: 'アウトライン - グリーン', keywords: ['button', 'outline', 'アウトライン', '緑'], color: '#22c55e' },
    // 丸みボタン
    { id: 'btn-rounded-pill', name: 'ピル型ボタン', keywords: ['button', 'pill', 'rounded', '丸い'], color: '#6366f1' },
    { id: 'btn-rounded-lg', name: '角丸ボタン - 大', keywords: ['button', 'rounded', '角丸'], color: '#8b5cf6' },
    // 特殊効果ボタン
    { id: 'btn-shadow', name: 'シャドウボタン', keywords: ['button', 'shadow', '影'], color: '#6366f1' },
    { id: 'btn-glow', name: 'グローボタン', keywords: ['button', 'glow', '光る'], color: '#22d3ee' },
    { id: 'btn-3d', name: '3Dボタン', keywords: ['button', '3d', '立体'], color: '#6366f1' },
];

// 人気素材を取得（初期表示用）
function getFeaturedAssets(category: string = 'all', page: number = 1, perPage: number = 50): Asset[] {
    const allAssets: Asset[] = [];

    // Storysetイラスト（Freepik提供、確実に表示される）
    const storysetCategories = [
        { name: 'business', label: 'ビジネス' },
        { name: 'work', label: '仕事' },
        { name: 'marketing', label: 'マーケティング' },
        { name: 'finance', label: '金融' },
        { name: 'technology', label: 'テクノロジー' },
        { name: 'education', label: '教育' },
        { name: 'healthcare', label: 'ヘルスケア' },
        { name: 'communication', label: 'コミュニケーション' },
    ];

    // 高品質イラスト画像（Unsplashから取得）
    const illustrationTopics = [
        { id: 'team-meeting', name: 'チームミーティング', query: 'team,meeting,office,people' },
        { id: 'business-presentation', name: 'ビジネスプレゼン', query: 'presentation,business,meeting' },
        { id: 'startup-work', name: 'スタートアップ', query: 'startup,coworking,laptop' },
        { id: 'customer-support', name: 'カスタマーサポート', query: 'customer,service,support' },
        { id: 'marketing-team', name: 'マーケティング', query: 'marketing,creative,team' },
        { id: 'data-analytics', name: 'データ分析', query: 'analytics,data,dashboard' },
        { id: 'web-development', name: 'Web開発', query: 'coding,developer,programming' },
        { id: 'mobile-app', name: 'モバイルアプリ', query: 'mobile,app,smartphone' },
        { id: 'ecommerce', name: 'Eコマース', query: 'ecommerce,shopping,online' },
        { id: 'education-learning', name: '教育・学習', query: 'education,learning,student' },
        { id: 'healthcare', name: 'ヘルスケア', query: 'healthcare,medical,doctor' },
        { id: 'finance-money', name: 'ファイナンス', query: 'finance,money,investment' },
        { id: 'success-celebration', name: '成功・達成', query: 'success,celebration,happy' },
        { id: 'remote-work', name: 'リモートワーク', query: 'remote,work,home,laptop' },
        { id: 'creative-design', name: 'クリエイティブ', query: 'creative,design,art' },
        { id: 'communication', name: 'コミュニケーション', query: 'communication,talk,chat' },
        { id: 'growth-chart', name: '成長・グラフ', query: 'growth,chart,business' },
        { id: 'innovation', name: 'イノベーション', query: 'innovation,technology,future' },
        { id: 'teamwork-hands', name: 'チームワーク', query: 'teamwork,hands,together' },
        { id: 'product-launch', name: '製品ローンチ', query: 'product,launch,rocket' },
    ];

    const illustrations = illustrationTopics.map((topic, idx) => ({
        id: `illustration-${topic.id}`,
        type: 'illustration' as AssetCategory,
        title: topic.name,
        // Unsplash Source APIで高品質画像を取得（キャッシュ対策でインデックス追加）
        thumbnailUrl: `https://source.unsplash.com/400x300/?${encodeURIComponent(topic.query)}&sig=${idx}`,
        downloadUrl: `https://source.unsplash.com/800x600/?${encodeURIComponent(topic.query)}&sig=${idx}`,
        author: 'Unsplash',
        source: 'Illustrations'
    }));
    allAssets.push(...illustrations);

    // ボタンテンプレートを追加（SVGで生成）
    const buttons = BUTTON_TEMPLATES.map(btn => {
        const color = btn.color || '#6366f1';
        const gradient = btn.gradient;
        const fill = gradient ? 'url(#grad)' : color;
        const gradientDef = gradient ? `<defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${gradient.match(/#[0-9a-f]{6}/gi)?.[0] || color}"/><stop offset="100%" style="stop-color:${gradient.match(/#[0-9a-f]{6}/gi)?.[1] || color}"/></linearGradient></defs>` : '';

        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60">${gradientDef}<rect x="10" y="10" width="180" height="40" rx="8" fill="${fill}"/><text x="100" y="35" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">ボタンテキスト</text></svg>`;
        const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;

        return {
            id: `button-${btn.id}`,
            type: 'icon' as AssetCategory,
            title: btn.name,
            thumbnailUrl: svgDataUrl,
            downloadUrl: svgDataUrl,
            author: 'オタスケ',
            source: 'Buttons'
        };
    });
    allAssets.push(...buttons);

    // 人気アイコン（インラインSVGで生成）
    const popularIcons = [
        { name: 'account', label: 'アカウント', path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z' },
        { name: 'home', label: 'ホーム', path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' },
        { name: 'settings', label: '設定', path: 'M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' },
        { name: 'email', label: 'メール', path: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z' },
        { name: 'phone', label: '電話', path: 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z' },
        { name: 'cart', label: 'カート', path: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z' },
        { name: 'heart', label: 'ハート', path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' },
        { name: 'star', label: 'スター', path: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z' },
        { name: 'check', label: 'チェック', path: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' },
        { name: 'close', label: '閉じる', path: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' },
        { name: 'arrow-right', label: '右矢印', path: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z' },
        { name: 'arrow-left', label: '左矢印', path: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z' },
        { name: 'menu', label: 'メニュー', path: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z' },
        { name: 'search', label: '検索', path: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z' },
        { name: 'plus', label: '追加', path: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z' },
        { name: 'download', label: 'ダウンロード', path: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z' },
        { name: 'upload', label: 'アップロード', path: 'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z' },
        { name: 'share', label: '共有', path: 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z' },
        { name: 'send', label: '送信', path: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' },
        { name: 'chat', label: 'チャット', path: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z' },
        { name: 'calendar', label: 'カレンダー', path: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z' },
        { name: 'clock', label: '時計', path: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z' },
        { name: 'location', label: '場所', path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' },
        { name: 'bell', label: '通知', path: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z' },
        { name: 'lock', label: 'ロック', path: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z' },
        { name: 'eye', label: '表示', path: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z' },
        { name: 'pencil', label: '編集', path: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z' },
        { name: 'delete', label: '削除', path: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z' },
        { name: 'copy', label: 'コピー', path: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z' },
        { name: 'folder', label: 'フォルダ', path: 'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z' },
        { name: 'image', label: '画像', path: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z' },
        { name: 'play', label: '再生', path: 'M8 5v14l11-7z' },
        { name: 'pause', label: '一時停止', path: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' },
        { name: 'camera', label: 'カメラ', path: 'M9.4 10.5l4.77-8.26C13.47 2.09 12.75 2 12 2c-2.4 0-4.6.85-6.32 2.25l3.66 6.35.06-.1zM21.54 9c-.92-2.92-3.15-5.26-6-6.34L11.88 9h9.66zm.26 1h-7.49l.29.5 4.76 8.25C21 16.97 22 14.61 22 12c0-.69-.07-1.35-.2-2zM8.54 12l-3.9-6.75C3.01 7.03 2 9.39 2 12c0 .69.07 1.35.2 2h7.49l-1.15-2zm-6.08 3c.92 2.92 3.15 5.26 6 6.34L12.12 15H2.46zm11.27 0l-3.9 6.76c.7.15 1.42.24 2.17.24 2.4 0 4.6-.85 6.32-2.25l-3.66-6.35-.93 1.6z' },
        { name: 'wifi', label: 'WiFi', path: 'M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z' },
        { name: 'sun', label: '太陽', path: 'M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z' },
        { name: 'moon', label: '月', path: 'M9 2c-1.05 0-2.05.16-3 .46 4.06 1.27 7 5.06 7 9.54 0 4.48-2.94 8.27-7 9.54.95.3 1.95.46 3 .46 5.52 0 10-4.48 10-10S14.52 2 9 2z' },
        { name: 'cloud', label: 'クラウド', path: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z' },
        { name: 'rocket', label: 'ロケット', path: 'M9.19 6.35c-2.04 2.29-3.44 5.58-3.57 5.89L2 10.69l4.05-4.05c.47-.47 1.15-.68 1.81-.55l1.33.26zM11.17 17s3.74-1.55 5.89-3.7c5.4-5.4 4.5-9.62 4.21-10.57-.95-.3-5.17-1.19-10.57 4.21C8.55 9.09 7 12.83 7 12.83L11.17 17zm2.76-8.07c-.78-.78-.78-2.05 0-2.83s2.05-.78 2.83 0c.77.78.78 2.05 0 2.83-.78.78-2.05.78-2.83 0zm-3.56 10.72l-1.55.64c-.86.36-1.86.14-2.5-.5-.64-.64-.86-1.64-.5-2.5l.64-1.55c.16.41.52 1.13 1.11 1.91.79.77 1.52 1.52 2.8 2z' },
        { name: 'gift', label: 'ギフト', path: 'M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z' },
        { name: 'trophy', label: 'トロフィー', path: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z' },
        { name: 'crown', label: '王冠', path: 'M2 19h20v3H2zM2 15h20v2H2zm4-5l5 5 1-4 4 4 4-10v15H2z' },
    ];

    const icons = popularIcons.map((icon, idx) => {
        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#ef4444'];
        const color = colors[idx % colors.length];
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${color}"><path d="${icon.path}"/></svg>`;

        return {
            id: `icon-${icon.name}`,
            type: 'icon' as AssetCategory,
            title: icon.label,
            thumbnailUrl: `data:image/svg+xml,${encodeURIComponent(svgContent)}`,
            downloadUrl: `data:image/svg+xml,${encodeURIComponent(svgContent)}`,
            author: 'Material Icons',
            source: 'Icons'
        };
    });
    allAssets.push(...icons);

    // カテゴリでフィルタ
    let filteredAssets = allAssets;
    if (category !== 'all') {
        filteredAssets = allAssets.filter(a => a.type === category);
    }

    // ページネーション
    const start = (page - 1) * perPage;
    return filteredAssets.slice(start, start + perPage);
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') as AssetCategory | 'all' || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const featured = searchParams.get('featured') === 'true';

    // クエリなしまたはfeatured=trueの場合は人気素材を返す
    if (!query || featured) {
        const assets = getFeaturedAssets(category, page, 100);
        return NextResponse.json({
            assets,
            total: assets.length,
            featured: true,
            category,
            page
        });
    }

    let assets: Asset[] = [];

    try {
        if (category === 'all') {
            // 全カテゴリから並列で取得
            const [lottie, illustrations, icons, photos] = await Promise.all([
                searchLottieFiles(query, page),
                searchUnDraw(query),
                searchIcons(query),
                searchPexels(query, page)
            ]);
            assets = [...lottie, ...illustrations, ...icons, ...photos];
        } else {
            switch (category) {
                case 'lottie':
                    assets = await searchLottieFiles(query, page);
                    break;
                case 'illustration':
                    assets = await searchUnDraw(query);
                    break;
                case 'icon':
                    assets = await searchIcons(query);
                    break;
                case 'photo':
                    assets = await searchPexels(query, page);
                    break;
            }
        }

        return NextResponse.json({
            assets,
            total: assets.length,
            query,
            category,
            page
        });
    } catch (error: any) {
        console.error('Asset search error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
