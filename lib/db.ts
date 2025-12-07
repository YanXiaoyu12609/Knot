import Dexie, { Table } from 'dexie';

export interface Creator {
  firstName?: string;
  lastName: string;
  creatorType: 'author' | 'editor' | 'translator';
}

export interface ParsedReference {
  index: number;      // 引用序号 [1], [2] 等
  text: string;       // 完整参考文献文本
  doi?: string;       // 提取的 DOI（如果有）
  authors?: string;   // 作者信息
  title?: string;     // 文献标题
  year?: string;      // 出版年份
}

export interface Collection {
  id: string;
  name: string;
  parentId: string | null;
  dateAdded: number;
}

export interface ReferenceItem {
  id: string;
  type: string; // 'journalArticle', 'book', 'webpage', etc.
  title: string;
  creators: Creator[];
  date?: string;
  publicationTitle?: string; // Journal or Book title
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  tags: string[];
  shortTitle?: string; // Abbreviated title
  collectionIds?: string[]; // IDs of collections this item belongs to
  dateAdded: number; // Timestamp
  dateModified: number; // Timestamp
  deleted?: boolean;
  aiAnalysis?: string; // Markdown content from AI analysis
  references?: ParsedReference[]; // Extracted references from the paper
}

export interface Attachment {
  id: string;
  parentId: string;
  name: string;
  contentType: string;
  size: number;
  data?: Blob; // Storing file content directly in IDB for this prototype
  dateAdded: number;
}

export class AntigraDB extends Dexie {
  items!: Table<ReferenceItem>;
  attachments!: Table<Attachment>;
  collections!: Table<Collection>;

  constructor() {
    super('AntigraDB');
    this.version(1).stores({
      items: 'id, type, title, dateAdded, [tags], *collectionIds',
      attachments: 'id, parentId, dateAdded',
      collections: 'id, parentId, name'
    });
  }
}

export const db = new AntigraDB();
