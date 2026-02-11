import type { BannerPlatform } from '@/types/banner';

export interface BannerSizePreset {
  name: string;
  width: number;
  height: number;
  label: string; // 表示ラベル（例: "728×90"）
}

export interface BannerPlatformConfig {
  id: BannerPlatform;
  name: string;
  shortName: string; // 短縮表示名
  presets: BannerSizePreset[];
}

export const BANNER_PLATFORMS: BannerPlatformConfig[] = [
  {
    id: 'google-display',
    name: 'Google Display',
    shortName: 'Google',
    presets: [
      { name: 'Leaderboard', width: 728, height: 90, label: '728×90' },
      { name: 'Medium Rectangle', width: 300, height: 250, label: '300×250' },
      { name: 'Wide Skyscraper', width: 160, height: 600, label: '160×600' },
      { name: 'Large Rectangle', width: 336, height: 280, label: '336×280' },
      { name: 'Banner', width: 468, height: 60, label: '468×60' },
      { name: 'Half Page', width: 300, height: 600, label: '300×600' },
      { name: 'Large Leaderboard', width: 970, height: 90, label: '970×90' },
      { name: 'Billboard', width: 970, height: 250, label: '970×250' },
    ],
  },
  {
    id: 'facebook',
    name: 'Facebook Ads',
    shortName: 'FB',
    presets: [
      { name: 'Feed Image', width: 1200, height: 628, label: '1200×628' },
      { name: 'Feed Square', width: 1080, height: 1080, label: '1080×1080' },
      { name: 'Story / Reel', width: 1080, height: 1920, label: '1080×1920' },
      { name: 'Carousel', width: 1080, height: 1080, label: '1080×1080' },
      { name: 'Right Column', width: 1200, height: 1200, label: '1200×1200' },
    ],
  },
  {
    id: 'instagram',
    name: 'Instagram Ads',
    shortName: 'IG',
    presets: [
      { name: 'Feed Square', width: 1080, height: 1080, label: '1080×1080' },
      { name: 'Feed Portrait', width: 1080, height: 1350, label: '1080×1350' },
      { name: 'Feed Landscape', width: 1080, height: 566, label: '1080×566' },
      { name: 'Story / Reel', width: 1080, height: 1920, label: '1080×1920' },
    ],
  },
  {
    id: 'line',
    name: 'LINE Ads',
    shortName: 'LINE',
    presets: [
      { name: 'Square', width: 1080, height: 1080, label: '1080×1080' },
      { name: 'Card', width: 1200, height: 628, label: '1200×628' },
      { name: 'Vertical', width: 1080, height: 1920, label: '1080×1920' },
      { name: 'Small Image', width: 600, height: 400, label: '600×400' },
    ],
  },
  {
    id: 'x',
    name: 'X (Twitter) Ads',
    shortName: 'X',
    presets: [
      { name: 'Single Image', width: 1200, height: 675, label: '1200×675' },
      { name: 'Square', width: 1080, height: 1080, label: '1080×1080' },
      { name: 'Website Card', width: 800, height: 418, label: '800×418' },
      { name: 'App Card', width: 800, height: 800, label: '800×800' },
    ],
  },
  {
    id: 'youtube',
    name: 'YouTube Ads',
    shortName: 'YT',
    presets: [
      { name: 'Display Ad', width: 300, height: 250, label: '300×250' },
      { name: 'Overlay Ad', width: 480, height: 70, label: '480×70' },
      { name: 'Companion Banner', width: 300, height: 60, label: '300×60' },
      { name: 'Thumbnail', width: 1280, height: 720, label: '1280×720' },
    ],
  },
  {
    id: 'custom',
    name: 'カスタム',
    shortName: 'Custom',
    presets: [],
  },
];

export function getPlatformConfig(platformId: BannerPlatform): BannerPlatformConfig | undefined {
  return BANNER_PLATFORMS.find((p) => p.id === platformId);
}

export function getPresetByName(
  platformId: BannerPlatform,
  presetName: string
): BannerSizePreset | undefined {
  const platform = getPlatformConfig(platformId);
  return platform?.presets.find((p) => p.name === presetName);
}
