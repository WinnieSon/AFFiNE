import { Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';
import * as Y from 'yjs';

import { PgWorkspaceDocStorageAdapter } from '../doc';

interface FolderNode {
  id: string;
  parentId: string | null;
  type: 'folder' | 'doc' | 'tag' | 'collection';
  data: string;
  index: string;
}

@Injectable()
export class OrganizeService {
  private readonly logger = new Logger(OrganizeService.name);

  constructor(private readonly workspace: PgWorkspaceDocStorageAdapter) {}

  /**
   * Generate fractional indexing key between two positions
   */
  private generateFractionalIndex(
    prev?: string,
    next?: string,
    digits = 6
  ): string {
    const base = 36;
    const maxDigit = base - 1;

    if (!prev && !next) {
      return '0'.repeat(digits);
    }

    if (!prev) {
      // Insert at beginning
      const nextVal = parseInt(next?.charAt(0) ?? '0', base);
      if (nextVal > 0) {
        const midVal = Math.floor(nextVal / 2);
        return midVal.toString(base).padEnd(digits, '0');
      }
      return '0'.repeat(digits - 1) + '1';
    }

    if (!next) {
      // Insert at end
      const prevVal = parseInt(prev.charAt(0) || '0', base);
      if (prevVal < maxDigit) {
        const midVal = prevVal + Math.ceil((maxDigit - prevVal) / 2);
        return midVal.toString(base).padEnd(digits, '0');
      }
      return (
        prev.slice(0, -1) + (parseInt(prev.slice(-1), base) + 1).toString(base)
      );
    }

    // Insert between prev and next
    const prevNum = parseInt(prev, base);
    const nextNum = parseInt(next, base);
    const mid = Math.floor((prevNum + nextNum) / 2);

    if (mid === prevNum || mid === nextNum) {
      // Need more precision
      return this.generateFractionalIndex(prev, next, digits + 1);
    }

    return mid.toString(base).padEnd(digits, '0');
  }

  /**
   * Get the folders document for a workspace
   */
  private async getFoldersDoc(workspaceId: string): Promise<Y.Doc> {
    // Use OLD format: db$workspaceId$folders
    const docName = `db$${workspaceId}$folders`;
    const existingDoc = await this.workspace.getDoc(workspaceId, docName);

    const ydoc = new Y.Doc();
    if (existingDoc) {
      Y.applyUpdate(ydoc, existingDoc.bin);
    }

    return ydoc;
  }

  /**
   * Save folders document back to storage
   */
  private async saveFoldersDoc(
    workspaceId: string,
    ydoc: Y.Doc,
    userId: string
  ): Promise<void> {
    // Use OLD format: db$workspaceId$folders
    const docName = `db$${workspaceId}$folders`;
    const update = Y.encodeStateAsUpdate(ydoc);
    await this.workspace.pushDocUpdates(workspaceId, docName, [update], userId);
  }

  /**
   * Get all folder nodes from the document
   */
  private getFolderNodes(ydoc: Y.Doc): FolderNode[] {
    const nodes: FolderNode[] = [];

    // In OLD format, each folder is stored as a top-level key
    const sharedTypes = ydoc.share;
    for (const [key] of sharedTypes) {
      if (key && key !== 'folders' && key !== '') {
        const folderMap = ydoc.getMap(key);
        if (folderMap.size > 0) {
          const type = folderMap.get('type');
          if (type) {
            const node: FolderNode = {
              id: (folderMap.get('id') as string) || key,
              parentId: folderMap.get('parentId') as string | null,
              type: type as 'folder' | 'doc' | 'tag' | 'collection',
              data: folderMap.get('data') as string,
              index: folderMap.get('index') as string,
            };
            nodes.push(node);
          }
        }
      }
    }

    return nodes.sort((a, b) => (a.index || '').localeCompare(b.index || ''));
  }

  /**
   * Create a folder
   */
  async createFolder(
    workspaceId: string,
    parentId: string | null,
    name: string,
    userId: string
  ): Promise<string> {
    const ydoc = await this.getFoldersDoc(workspaceId);
    const nodes = this.getFolderNodes(ydoc);

    // Find siblings to determine index position
    const siblings = nodes.filter(n => n.parentId === parentId);
    const lastSibling =
      siblings.length > 0 ? siblings[siblings.length - 1] : null;
    const index = this.generateFractionalIndex(lastSibling?.index);

    const folderId = nanoid();

    // In OLD format, create folder as top-level key
    const folderNode = new Y.Map();
    folderNode.set('id', folderId);
    folderNode.set('parentId', parentId);
    folderNode.set('type', 'folder');
    folderNode.set('data', name);
    folderNode.set('index', index);

    // Set the folder using its ID as the key
    ydoc.getMap(folderId).set('id', folderId);
    ydoc.getMap(folderId).set('parentId', parentId);
    ydoc.getMap(folderId).set('type', 'folder');
    ydoc.getMap(folderId).set('data', name);
    ydoc.getMap(folderId).set('index', index);

    await this.saveFoldersDoc(workspaceId, ydoc, userId);

    this.logger.log(
      `Created folder: ${name} (${folderId}) in workspace ${workspaceId}`
    );

    return folderId;
  }

  /**
   * Create a document link in a folder
   */
  async createDocumentLink(
    workspaceId: string,
    parentId: string,
    documentId: string,
    userId: string
  ): Promise<string> {
    const ydoc = await this.getFoldersDoc(workspaceId);
    const nodes = this.getFolderNodes(ydoc);

    // Find siblings to determine index position
    const siblings = nodes.filter(n => n.parentId === parentId);
    const lastSibling =
      siblings.length > 0 ? siblings[siblings.length - 1] : null;
    const index = this.generateFractionalIndex(lastSibling?.index);

    const linkId = nanoid();

    // In OLD format, create link as top-level key
    ydoc.getMap(linkId).set('id', linkId);
    ydoc.getMap(linkId).set('parentId', parentId);
    ydoc.getMap(linkId).set('type', 'doc');
    ydoc.getMap(linkId).set('data', documentId);
    ydoc.getMap(linkId).set('index', index);

    await this.saveFoldersDoc(workspaceId, ydoc, userId);

    this.logger.log(
      `Created document link: ${documentId} in folder ${parentId} (workspace ${workspaceId})`
    );

    return linkId;
  }

  /**
   * Find folder by name and parent
   */
  async findFolder(
    workspaceId: string,
    parentId: string | null,
    name: string
  ): Promise<string | null> {
    const ydoc = await this.getFoldersDoc(workspaceId);
    const nodes = this.getFolderNodes(ydoc);

    const folder = nodes.find(
      n => n.type === 'folder' && n.parentId === parentId && n.data === name
    );

    return folder ? folder.id : null;
  }

  /**
   * Create YYYY-MM folder structure and add document
   */
  async createDateBasedOrganization(
    workspaceId: string,
    documentId: string,
    userId: string,
    date = new Date()
  ): Promise<void> {
    const year = date.getFullYear().toString();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}-${month}`;

    this.logger.log(
      `Creating date-based organization for ${yearMonth} in workspace ${workspaceId}`
    );

    // Find or create YYYY-MM folder at root level
    let yearMonthFolderId = await this.findFolder(workspaceId, null, yearMonth);
    if (!yearMonthFolderId) {
      yearMonthFolderId = await this.createFolder(
        workspaceId,
        null,
        yearMonth,
        userId
      );
      this.logger.log(
        `Created YYYY-MM folder: ${yearMonth} (${yearMonthFolderId})`
      );
    }

    // Add document to YYYY-MM folder
    await this.createDocumentLink(
      workspaceId,
      yearMonthFolderId,
      documentId,
      userId
    );

    this.logger.log(
      `Successfully organized document ${documentId} under ${yearMonth} folder`
    );
  }
}
