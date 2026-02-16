import type { ThumbnailCategory } from '@/types/thumbnail';

export interface ThumbnailSizePreset {
  name: string;
  width: number;
  height: number;
  label: string;
}

export interface ThumbnailCategoryConfig {
  id: ThumbnailCategory;
  name: string;
  shortName: string;
  presets: ThumbnailSizePreset[];
}

export const THUMBNAIL_CATEGORIES: ThumbnailCategoryConfig[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    shortName: 'YT',
    presets: [
      { name: 'サムネイル', width: 1280, height: 720, label: '1280×720' },
      { name: 'チャンネルバナー', width: 2560, height: 1440, label: '2560×1440' },
      { name: 'ショート', width: 1080, height: 1920, label: '1080×1920' },
    ],
  },
  {
    id: 'blog',
    name: 'ブログ',
    shortName: 'Blog',
    presets: [
      { name: 'アイキャッチ (16:9)', width: 1200, height: 675, label: '1200×675' },
      { name: 'アイキャッチ (OGP)', width: 1200, height: 630, label: '1200×630' },
      { name: 'WordPress', width: 1200, height: 800, label: '1200×800' },
      { name: 'はてなブログ', width: 800, height: 418, label: '800×418' },
    ],
  },
  {
    id: 'sns',
    name: 'SNS',
    shortName: 'SNS',
    presets: [
      { name: 'X (Twitter) ヘッダー', width: 1500, height: 500, label: '1500×500' },
      { name: 'X (Twitter) 投稿', width: 1200, height: 675, label: '1200×675' },
      { name: 'Instagram 正方形', width: 1080, height: 1080, label: '1080×1080' },
      { name: 'Instagram ストーリー', width: 1080, height: 1920, label: '1080×1920' },
      { name: 'Facebook カバー', width: 820, height: 312, label: '820×312' },
      { name: 'TikTok', width: 1080, height: 1920, label: '1080×1920' },
    ],
  },
  {
    id: 'custom',
    name: 'カスタム',
    shortName: 'カスタム',
    presets: [],
  },
];
