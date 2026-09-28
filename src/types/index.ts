export type ItemType = 'text' | 'link' | 'image' | 'video' | 'file';

export interface Collection {
  id: string;
  name: string;
  isPrivate?: boolean;
  pin?: string;
  createdAt: Date;
}

export interface SharedItem {
  id: string;
  type: ItemType;
  content: string;
  fileName?: string;
  fileSize?: string;
  fileUrl?: string;
  collectionId?: string | null;
  createdAt: Date;
}
