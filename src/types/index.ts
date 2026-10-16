export type ItemType = 'text' | 'link' | 'image' | 'video' | 'file';

export interface Collection {
  id: string;
  name: string;
  isPrivate?: boolean;
  pin?: string;
  createdAt: Date;
  sortOrder?: number;
}

export interface ItemFileAttachment {
  name: string;
  size?: string;
  url: string;
  type: ItemType;
  mimeType?: string;
}

export interface SharedItem {
  id: string;
  type: ItemType;
  title?: string;
  content: string;
  fileName?: string;
  fileSize?: string;
  fileUrl?: string;
  fileItems?: ItemFileAttachment[];
  collectionId?: string | null;
  createdAt: Date;
  isPinned?: boolean;
}
