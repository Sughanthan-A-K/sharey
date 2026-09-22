export type ItemType = 'text' | 'link' | 'image' | 'video' | 'file';

export interface SharedItem {
  id: string;
  type: ItemType;
  content: string;
  fileName?: string;
  fileSize?: string;
  fileUrl?: string;
  createdAt: Date;
}
