// ========================================
// Thumbnail Types
// ========================================

export type ThumbnailCategory =
  | 'youtube'
  | 'blog'
  | 'sns'
  | 'custom';

export type ThumbnailStatus = 'draft' | 'generated' | 'saved';

export interface Thumbnail {
  id: number;
  userId: string;
  title: string;
  category: ThumbnailCategory;
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
  status: ThumbnailStatus;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThumbnailListItem {
  id: number;
  title: string;
  category: ThumbnailCategory;
  width: number;
  height: number;
  presetName?: string | null;
  status: ThumbnailStatus;
  updatedAt: string;
  image?: {
    filePath: string;
  } | null;
}
