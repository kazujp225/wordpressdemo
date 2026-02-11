// ========================================
// Banner Types
// ========================================

export type BannerPlatform =
  | 'google-display'
  | 'facebook'
  | 'instagram'
  | 'line'
  | 'x'
  | 'youtube'
  | 'custom';

export type BannerStatus = 'draft' | 'generated' | 'saved';

export interface BannerMetadata {
  segment?: string;
  campaignName?: string;
  generationModel?: string;
  generationDurationMs?: number;
  [key: string]: unknown;
}

export interface Banner {
  id: number;
  userId: string;
  title: string;
  platform: BannerPlatform;
  width: number;
  height: number;
  presetName?: string | null;
  prompt?: string | null;
  productInfo?: string | null;
  imageId?: number | null;
  image?: {
    id: number;
    filePath: string;
    width?: number | null;
    height?: number | null;
    mime: string;
  } | null;
  referenceImageUrl?: string | null;
  status: BannerStatus;
  metadata?: BannerMetadata | null;
  createdAt: string;
  updatedAt: string;
}

export interface BannerListItem {
  id: number;
  title: string;
  platform: BannerPlatform;
  width: number;
  height: number;
  presetName?: string | null;
  status: BannerStatus;
  updatedAt: string;
  image?: {
    filePath: string;
  } | null;
}
