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

// unDraw API検索（SVGイラスト）
async function searchUnDraw(query: string): Promise<Asset[]> {
    // unDrawは公式APIがないため、事前定義のイラストリストを使用
    const illustrations = [
        { id: 'business_plan', name: 'Business Plan', keywords: ['business', 'plan', 'strategy', 'ビジネス'] },
        { id: 'team_collaboration', name: 'Team Collaboration', keywords: ['team', 'collaboration', 'work', 'チーム'] },
        { id: 'online_meeting', name: 'Online Meeting', keywords: ['meeting', 'online', 'video', 'ミーティング'] },
        { id: 'data_analysis', name: 'Data Analysis', keywords: ['data', 'analysis', 'chart', 'データ'] },
        { id: 'marketing', name: 'Marketing', keywords: ['marketing', 'promotion', 'マーケティング'] },
        { id: 'customer_support', name: 'Customer Support', keywords: ['support', 'customer', 'help', 'サポート'] },
        { id: 'success', name: 'Success', keywords: ['success', 'achievement', '成功'] },
        { id: 'growth', name: 'Growth', keywords: ['growth', 'increase', '成長'] },
        { id: 'presentation', name: 'Presentation', keywords: ['presentation', 'pitch', 'プレゼン'] },
        { id: 'mobile_app', name: 'Mobile App', keywords: ['mobile', 'app', 'smartphone', 'アプリ'] },
        { id: 'website', name: 'Website', keywords: ['website', 'web', 'サイト'] },
        { id: 'creative_thinking', name: 'Creative Thinking', keywords: ['creative', 'idea', 'アイデア'] },
        { id: 'agreement', name: 'Agreement', keywords: ['agreement', 'contract', '契約'] },
        { id: 'questions', name: 'Questions', keywords: ['question', 'faq', '質問'] },
        { id: 'contact_us', name: 'Contact Us', keywords: ['contact', 'email', 'お問い合わせ'] },
    ];

    const queryLower = query.toLowerCase();
    const filtered = illustrations.filter(ill =>
        ill.keywords.some(kw => kw.toLowerCase().includes(queryLower)) ||
        ill.name.toLowerCase().includes(queryLower)
    );

    return filtered.map(ill => ({
        id: `undraw-${ill.id}`,
        type: 'illustration' as AssetCategory,
        title: ill.name,
        thumbnailUrl: `https://undraw.co/api/illustrations/${ill.id}?color=6366f1`,
        downloadUrl: `https://undraw.co/api/illustrations/${ill.id}?color=6366f1`,
        author: 'unDraw',
        source: 'unDraw'
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

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') as AssetCategory | 'all' || 'all';
    const page = parseInt(searchParams.get('page') || '1');

    if (!query) {
        return NextResponse.json({ assets: [], total: 0 });
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
