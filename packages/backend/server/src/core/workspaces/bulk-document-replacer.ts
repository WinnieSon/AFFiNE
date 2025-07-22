import { PrismaClient } from '@prisma/client';
import * as Y from 'yjs';

export class BulkDocumentReplacer {
  constructor(private readonly prisma: PrismaClient) {}

  async replaceInWorkspace(
    workspaceId: string,
    oldText: string,
    newText: string
  ): Promise<void> {
    // Get all documents in the workspace
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Get all document snapshots
    const snapshots = await this.prisma.snapshot.findMany({
      where: {
        workspaceId,
      },
    });

    // Process each document
    for (const snapshot of snapshots) {
      await this.replaceInDocument(workspaceId, snapshot.id, oldText, newText);
    }

    // Also process any documents that might not have snapshots yet
    const updates = await this.prisma.update.findMany({
      where: {
        workspaceId,
      },
      distinct: ['id'],
    });

    const processedIds = new Set(snapshots.map(s => s.id));

    for (const update of updates) {
      if (!processedIds.has(update.id)) {
        await this.replaceInDocument(workspaceId, update.id, oldText, newText);
      }
    }
  }

  private async replaceInDocument(
    workspaceId: string,
    docId: string,
    oldText: string,
    newText: string
  ): Promise<void> {
    try {
      // Get the latest snapshot and updates
      const snapshot = await this.prisma.snapshot.findFirst({
        where: {
          workspaceId,
          id: docId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const updates = await this.prisma.update.findMany({
        where: {
          workspaceId,
          id: docId,
          createdAt: snapshot
            ? {
                gt: snapshot.createdAt,
              }
            : undefined,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Create a new Y.Doc and apply existing state
      const ydoc = new Y.Doc();

      if (snapshot?.blob) {
        Y.applyUpdate(ydoc, Buffer.from(snapshot.blob));
      }

      for (const update of updates) {
        if (update.blob) {
          Y.applyUpdate(ydoc, Buffer.from(update.blob));
        }
      }

      // Replace text in the document
      const replaced = this.replaceTextInYDoc(ydoc, oldText, newText);

      if (replaced) {
        // Get the update diff
        const updateData = Y.encodeStateAsUpdate(ydoc);

        // Store the update
        await this.prisma.update.create({
          data: {
            workspaceId,
            id: docId,
            blob: updateData,
            seq: updates.length + 1,
            createdAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error(`Failed to replace in document ${docId}:`, error);
    }
  }

  private replaceTextInYDoc(
    ydoc: Y.Doc,
    oldText: string,
    newText: string
  ): boolean {
    let replaced = false;

    // Function to replace text in Y.Text instances
    const replaceInYText = (ytext: Y.Text) => {
      const text = ytext.toString();
      if (text.includes(oldText)) {
        const parts = text.split(oldText);
        ytext.delete(0, text.length);

        for (let i = 0; i < parts.length; i++) {
          if (i > 0) {
            ytext.insert(ytext.length, newText);
          }
          ytext.insert(ytext.length, parts[i]);
        }

        replaced = true;
      }
    };

    // Recursively search for Y.Text instances
    const searchAndReplace = (item: any) => {
      if (item instanceof Y.Text) {
        replaceInYText(item);
      } else if (item instanceof Y.Map) {
        for (const [key, value] of item.entries()) {
          // Special handling for BlockSuite text fields
          if (key === 'prop:text' && value instanceof Y.Text) {
            replaceInYText(value);
          }
          // Handle table cells
          else if (
            key.startsWith('prop:cells.') &&
            key.endsWith('.text') &&
            value instanceof Y.Text
          ) {
            replaceInYText(value);
          }
          // Handle mindmap shape text
          else if (key === 'text' && value instanceof Y.Text) {
            replaceInYText(value);
          } else {
            searchAndReplace(value);
          }
        }
      } else if (item instanceof Y.Array) {
        item.forEach(subItem => searchAndReplace(subItem));
      }
    };

    // Start from the root
    const store = ydoc.getMap('blocks');
    searchAndReplace(store);

    // Also check the meta store for any text
    const meta = ydoc.getMap('meta');
    searchAndReplace(meta);

    return replaced;
  }
}
