/* cSpell:disable */
import { PrismaClient } from '@prisma/client';
import * as Y from 'yjs';

export class BulkDocumentReplacer {
  constructor(private readonly prisma: PrismaClient) {}

  private async isDocumentInTrash(
    workspaceId: string,
    docId: string
  ): Promise<boolean> {
    try {
      // Get the workspace root document to check trash status
      const rootSnapshot = await this.prisma.snapshot.findFirst({
        where: {
          workspaceId,
          id: workspaceId, // Root doc has same ID as workspace
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!rootSnapshot?.blob) {
        return false; // If no root doc, assume not in trash
      }

      // Load root document
      const rootDoc = new Y.Doc();
      Y.applyUpdate(rootDoc, Buffer.from(rootSnapshot.blob));

      // Get pages metadata
      const meta = rootDoc.getMap('meta');
      const pages = meta.get('pages') as Y.Array<Y.Map<any>>;

      if (!pages) {
        return false;
      }

      // Find the page entry for this document
      for (const page of pages) {
        if (page.get('id') === docId) {
          const isInTrash = page.get('trash') === true;
          return isInTrash;
        }
      }

      return false; // Document not found in metadata, assume not in trash
    } catch (error) {
      console.error(
        `[BulkDocumentReplacer] Error checking trash status for ${docId}:`,
        error
      );
      return false; // On error, assume not in trash to avoid skipping documents
    }
  }

  private async getNonTrashDocumentIds(
    workspaceId: string
  ): Promise<Set<string>> {
    try {
      console.log(
        `[BulkDocumentReplacer] Getting non-trash documents for workspace ${workspaceId}`
      );

      // Get the workspace root document
      const rootSnapshot = await this.prisma.snapshot.findFirst({
        where: {
          workspaceId,
          id: workspaceId, // Root doc has same ID as workspace
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!rootSnapshot?.blob) {
        console.log(
          `[BulkDocumentReplacer] No root document found, returning empty set`
        );
        return new Set<string>();
      }

      // Load root document
      const rootDoc = new Y.Doc();
      Y.applyUpdate(rootDoc, Buffer.from(rootSnapshot.blob));

      // Get pages metadata
      const meta = rootDoc.getMap('meta');
      const pages = meta.get('pages') as Y.Array<Y.Map<any>>;

      if (!pages) {
        console.log(
          `[BulkDocumentReplacer] No pages metadata found, returning empty set`
        );
        return new Set<string>();
      }

      const nonTrashDocIds = new Set<string>();

      // Collect all non-trash document IDs
      for (const page of pages) {
        const docId = page.get('id');
        const isInTrash = page.get('trash') === true;

        if (typeof docId === 'string' && !isInTrash) {
          nonTrashDocIds.add(docId);
        }
      }

      console.log(
        `[BulkDocumentReplacer] Found ${nonTrashDocIds.size} non-trash documents`
      );
      console.log(
        `[BulkDocumentReplacer] Non-trash document IDs:`,
        Array.from(nonTrashDocIds)
      );

      return nonTrashDocIds;
    } catch (error) {
      console.error(
        `[BulkDocumentReplacer] Error getting non-trash documents:`,
        error
      );
      return new Set<string>();
    }
  }

  async replaceInWorkspace(
    workspaceId: string,
    oldText: string,
    newText: string
  ): Promise<void> {
    return this.replaceInWorkspaceByText(workspaceId, oldText, newText);
  }

  async replaceInWorkspaceBySpeakerMapping(
    workspaceId: string,
    speakerMappings: { [speakerNum: string]: string }
  ): Promise<void> {
    console.log(
      `[BulkDocumentReplacer] Starting speaker replacement in workspace ${workspaceId}`
    );
    console.log(`[BulkDocumentReplacer] Speaker mappings:`, speakerMappings);

    // Get all documents in the workspace
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Get non-trash document IDs first
    const nonTrashDocIds = await this.getNonTrashDocumentIds(workspaceId);

    if (nonTrashDocIds.size === 0) {
      console.log(
        `[BulkDocumentReplacer] No non-trash documents found in workspace`
      );
      return;
    }

    // Get snapshots only for non-trash documents
    const snapshots = await this.prisma.snapshot.findMany({
      where: {
        workspaceId,
        id: {
          in: Array.from(nonTrashDocIds),
        },
      },
      distinct: ['id'],
    });

    console.log(
      `[BulkDocumentReplacer] Found ${snapshots.length} document snapshots to process`
    );

    // Process each document
    for (const snapshot of snapshots) {
      await this.replaceInDocumentBySpeakerMapping(
        workspaceId,
        snapshot.id,
        speakerMappings
      );
    }

    // Also check for documents that might not have snapshots yet
    const processedIds = new Set(snapshots.map(s => s.id));
    const unprocessedDocIds = Array.from(nonTrashDocIds).filter(
      id => !processedIds.has(id)
    );

    if (unprocessedDocIds.length > 0) {
      console.log(
        `[BulkDocumentReplacer] Processing ${unprocessedDocIds.length} documents without snapshots`
      );

      for (const docId of unprocessedDocIds) {
        await this.replaceInDocumentBySpeakerMapping(
          workspaceId,
          docId,
          speakerMappings
        );
      }
    }
  }

  async replaceInWorkspaceBySpeakerId(
    workspaceId: string,
    speakerId: string,
    newName: string
  ): Promise<void> {
    console.log(
      `[BulkDocumentReplacer] Starting speaker replacement in workspace ${workspaceId}`
    );
    console.log(
      `[BulkDocumentReplacer] Speaker ID: ${speakerId}, New Name: ${newName}`
    );

    // Get all documents in the workspace
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Get non-trash document IDs first
    const nonTrashDocIds = await this.getNonTrashDocumentIds(workspaceId);

    if (nonTrashDocIds.size === 0) {
      console.log(
        `[BulkDocumentReplacer] No non-trash documents found in workspace`
      );
      return;
    }

    // Get snapshots only for non-trash documents
    const snapshots = await this.prisma.snapshot.findMany({
      where: {
        workspaceId,
        id: {
          in: Array.from(nonTrashDocIds),
        },
      },
      distinct: ['id'],
    });

    console.log(
      `[BulkDocumentReplacer] Found ${snapshots.length} document snapshots to process`
    );

    // Process each document
    for (const snapshot of snapshots) {
      await this.replaceInDocumentBySpeakerId(
        workspaceId,
        snapshot.id,
        speakerId,
        newName
      );
    }

    // Also check for documents that might not have snapshots yet
    const processedIds = new Set(snapshots.map(s => s.id));
    const unprocessedDocIds = Array.from(nonTrashDocIds).filter(
      id => !processedIds.has(id)
    );

    if (unprocessedDocIds.length > 0) {
      console.log(
        `[BulkDocumentReplacer] Processing ${unprocessedDocIds.length} documents without snapshots`
      );

      for (const docId of unprocessedDocIds) {
        await this.replaceInDocumentBySpeakerId(
          workspaceId,
          docId,
          speakerId,
          newName
        );
      }
    }
  }

  private async replaceInWorkspaceByText(
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

    // Get non-trash document IDs first
    const nonTrashDocIds = await this.getNonTrashDocumentIds(workspaceId);

    if (nonTrashDocIds.size === 0) {
      console.log(
        `[BulkDocumentReplacer] No non-trash documents found in workspace`
      );
      return;
    }

    // Get snapshots only for non-trash documents
    const snapshots = await this.prisma.snapshot.findMany({
      where: {
        workspaceId,
        id: {
          in: Array.from(nonTrashDocIds),
        },
      },
      distinct: ['id'],
    });

    console.log(
      `[BulkDocumentReplacer] Found ${snapshots.length} document snapshots to process`
    );

    // Process each document
    for (const snapshot of snapshots) {
      await this.replaceInDocument(workspaceId, snapshot.id, oldText, newText);
    }

    // Also check for documents that might not have snapshots yet
    const processedIds = new Set(snapshots.map(s => s.id));
    const unprocessedDocIds = Array.from(nonTrashDocIds).filter(
      id => !processedIds.has(id)
    );

    if (unprocessedDocIds.length > 0) {
      console.log(
        `[BulkDocumentReplacer] Processing ${unprocessedDocIds.length} documents without snapshots`
      );

      for (const docId of unprocessedDocIds) {
        await this.replaceInDocument(workspaceId, docId, oldText, newText);
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

      // No need to check trash status here since we already filtered at query level

      // Use a transaction to ensure atomicity
      let replaced = false;
      ydoc.transact(() => {
        replaced = this.replaceTextInYDoc(ydoc, oldText, newText);
      });

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

  private async replaceInDocumentBySpeakerMapping(
    workspaceId: string,
    docId: string,
    speakerMappings: { [speakerNum: string]: string }
  ): Promise<void> {
    console.log(
      `[BulkDocumentReplacer] Processing document ${docId} with speaker mappings`
    );

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

      // No need to check trash status here since we already filtered at query level

      // Get state before update for comparison
      const stateBefore = Y.encodeStateAsUpdate(ydoc);

      // Use a transaction to ensure atomicity
      let replaced = false;
      ydoc.transact(() => {
        replaced = this.replaceSpeakerMappingInYDoc(
          ydoc,
          speakerMappings,
          docId
        );
      });

      if (replaced) {
        console.log(
          `[BulkDocumentReplacer] Found and replaced speakers in document ${docId}`
        );

        // Get state after update
        const stateAfter = Y.encodeStateAsUpdate(ydoc);

        // Check if state actually changed
        const stateChanged = !Buffer.from(stateBefore).equals(
          Buffer.from(stateAfter)
        );
        console.log(
          `[BulkDocumentReplacer] State actually changed: ${stateChanged}`
        );

        if (!stateChanged) {
          console.error(
            `[BulkDocumentReplacer] WARNING: Y.Doc state did not change despite replacement!`
          );
        }

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
        console.log(
          `[BulkDocumentReplacer] Successfully saved update for document ${docId}`
        );
      } else {
        console.log(
          `[BulkDocumentReplacer] No matching speakers found in document ${docId}`
        );
      }
    } catch (error) {
      console.error(`Failed to replace speakers in document ${docId}:`, error);
    }
  }

  private async replaceInDocumentBySpeakerId(
    workspaceId: string,
    docId: string,
    speakerId: string,
    newName: string
  ): Promise<void> {
    console.log(`[BulkDocumentReplacer] Processing document ${docId}`);

    // Special debugging for specific documents
    if (docId === '05296e0a-691b-466f-9821-d6afb722c454') {
      console.log(
        `[BulkDocumentReplacer] ===== DEBUGGING DOCUMENT 05296e0a-691b-466f-9821-d6afb722c454 =====`
      );
      console.log(`[BulkDocumentReplacer] Looking for speakerId: ${speakerId}`);
    }

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

      // No need to check trash status here since we already filtered at query level

      // Get state before update for comparison
      const stateBefore = Y.encodeStateAsUpdate(ydoc);

      // Use a transaction to ensure atomicity
      let replaced = false;
      ydoc.transact(() => {
        replaced = this.replaceSpeakerInYDoc(ydoc, speakerId, newName, docId);
      });

      if (replaced) {
        console.log(
          `[BulkDocumentReplacer] Found and replaced speaker/participant in document ${docId}`
        );

        // Get state after update
        const stateAfter = Y.encodeStateAsUpdate(ydoc);

        // Check if state actually changed
        const stateChanged = !Buffer.from(stateBefore).equals(
          Buffer.from(stateAfter)
        );
        console.log(
          `[BulkDocumentReplacer] State actually changed: ${stateChanged}`
        );

        if (!stateChanged) {
          console.error(
            `[BulkDocumentReplacer] WARNING: Y.Doc state did not change despite replacement!`
          );
        }

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
        console.log(
          `[BulkDocumentReplacer] Successfully saved update for document ${docId}`
        );
      } else {
        console.log(
          `[BulkDocumentReplacer] No matching speaker/participant found in document ${docId}`
        );
      }
    } catch (error) {
      console.error(`Failed to replace speaker in document ${docId}:`, error);
    }
  }

  private replaceTextInYDoc(
    ydoc: Y.Doc,
    oldText: string,
    newText: string
  ): boolean {
    let replaced = false;

    // Function to replace text in Y.Text instances
    const replaceInYText = (ytext: Y.Text, parentBlock?: Y.Map<any>) => {
      // Try to get delta operations first for speaker metadata handling
      try {
        const delta = ytext.toDelta();
        let hasChanges = false;

        const newDelta = delta.ops?.map((op: any) => {
          // Check if this operation has speaker metadata with code block styling
          if (op.attributes?.code) {
            // Log code block detection for debugging
            console.log(
              `[BulkDocumentReplacer] Found code block with attributes:`,
              op.attributes
            );
            console.log(`[BulkDocumentReplacer] Insert text:`, op.insert);

            // Check both speakerName attribute and insert text
            if (op.attributes?.speakerName === oldText) {
              console.log(
                `[BulkDocumentReplacer] Matched speakerName attribute: ${oldText} -> ${newText}`
              );
              hasChanges = true;
              return {
                ...op,
                attributes: {
                  ...op.attributes,
                  code: true, // Keep code block styling
                  speakerName: newText,
                },
                insert: newText, // Also update the displayed text
              };
            }
            // For code blocks without speakerName attribute, check the insert text
            else if (typeof op.insert === 'string' && op.insert === oldText) {
              console.log(
                `[BulkDocumentReplacer] Matched code block text: ${oldText} -> ${newText}`
              );
              hasChanges = true;
              return {
                ...op,
                attributes: {
                  ...op.attributes,
                  code: true, // Keep code block styling
                },
                insert: newText,
              };
            }
          }
          // Also check insert text for direct matches (non-code blocks)
          else if (
            typeof op.insert === 'string' &&
            op.insert.includes(oldText)
          ) {
            hasChanges = true;
            return {
              ...op,
              insert: op.insert.replace(
                new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                newText
              ),
            };
          }
          return op;
        });

        if (hasChanges && newDelta) {
          ytext.delete(0, ytext.length);
          ytext.applyDelta(newDelta);
          replaced = true;

          // Also update block-level speaker metadata if present
          if (parentBlock) {
            const speakerName = parentBlock.get('prop:speakerName');
            if (speakerName === oldText) {
              parentBlock.set('prop:speakerName', newText);
            }
          }
          return;
        }
      } catch (error) {
        // Fall back to simple text replacement
        console.warn(
          'Delta operation failed, falling back to text replacement:',
          error
        );
      }

      // Fallback to simple text replacement with attribute preservation
      const text = ytext.toString();
      if (text.includes(oldText)) {
        // Try to preserve formatting by getting the first delta operation
        try {
          const delta = ytext.toDelta();
          const firstOp = delta.ops?.[0];
          const attributes = firstOp?.attributes || {};

          ytext.delete(0, text.length);
          const newContent = text.replace(
            new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            newText
          );

          if (Object.keys(attributes).length > 0) {
            ytext.insert(0, newContent, attributes);
          } else {
            ytext.insert(0, newContent);
          }
        } catch {
          // Ultimate fallback
          const parts = text.split(oldText);
          ytext.delete(0, text.length);

          for (let i = 0; i < parts.length; i++) {
            if (i > 0) {
              ytext.insert(ytext.length, newText);
            }
            ytext.insert(ytext.length, parts[i]);
          }
        }

        replaced = true;
      }
    };

    // Recursively search for Y.Text instances
    const searchAndReplace = (item: any, parent?: any) => {
      if (item instanceof Y.Text) {
        replaceInYText(item, parent instanceof Y.Map ? parent : undefined);
      } else if (item instanceof Y.Map) {
        // Check if this is a block with speaker metadata
        const speakerName = item.get('prop:speakerName');

        // Update block-level speaker metadata
        if (speakerName === oldText) {
          item.set('prop:speakerName', newText);
          replaced = true;
        }

        for (const [key, value] of item.entries()) {
          // Special handling for BlockSuite text fields
          if (key === 'prop:text' && value instanceof Y.Text) {
            replaceInYText(value, item);
          }
          // Handle table cells
          else if (
            key.startsWith('prop:cells.') &&
            key.endsWith('.text') &&
            value instanceof Y.Text
          ) {
            replaceInYText(value, item);
          }
          // Handle mindmap shape text
          else if (key === 'text' && value instanceof Y.Text) {
            replaceInYText(value, item);
          }
          // Handle shape nodes with speaker metadata
          else if (key === 'speakerName' && value === oldText) {
            // Update speaker name in shape metadata
            item.set('speakerName', newText);
            // Also update the text content if it contains backticks (code style)
            const textValue = item.get('text');
            if (
              textValue &&
              typeof textValue === 'string' &&
              textValue.includes(`\`${oldText}\``)
            ) {
              item.set(
                'text',
                textValue.replace(`\`${oldText}\``, `\`${newText}\``)
              );
              replaced = true;
            }
          } else {
            searchAndReplace(value, item);
          }
        }
      } else if (item instanceof Y.Array) {
        item.forEach(subItem => searchAndReplace(subItem, item));
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

  private replaceSpeakerMappingInYDoc(
    ydoc: Y.Doc,
    speakerMappings: { [speakerNum: string]: string },
    docId?: string
  ): boolean {
    let replaced = false;
    let foundCount = 0;
    let replacedCount = 0;

    console.log(
      `[BulkDocumentReplacer] === Starting speaker mapping replacement for document ${docId} ===`
    );

    // Function to replace speaker patterns based on mappings
    const replaceInYText = (
      ytext: Y.Text,
      parentBlock?: Y.Map<any>,
      isTableCell: boolean = false
    ) => {
      try {
        const textContent = ytext.toString();

        if (isTableCell) {
          console.log(
            `[BulkDocumentReplacer] Checking table cell text: "${textContent}"`
          );
        }

        // Check if it matches generic speaker pattern
        const speakerMatch = textContent.match(/^화자\s*(\d+)$/);
        if (speakerMatch) {
          foundCount++;
          const speakerNum = speakerMatch[1];
          const newName = speakerMappings[speakerNum];

          console.log(
            `[BulkDocumentReplacer] Found "화자 ${speakerNum}" - Mapping available: ${newName ? 'YES' : 'NO'}`
          );

          if (newName) {
            // Replace with the mapped name
            ytext.delete(0, ytext.length);
            ytext.insert(0, newName);
            replaced = true;
            replacedCount++;
            console.log(
              `[BulkDocumentReplacer] Successfully replaced "화자 ${speakerNum}" with "${newName}"`
            );
            return;
          }
        }

        // Handle delta operations for more complex text
        const delta = ytext.toDelta();
        let hasChanges = false;

        const newDelta = delta.ops?.map((op: any) => {
          // For plain text without attributes, check for speaker patterns
          if (typeof op.insert === 'string' && !op.attributes) {
            const match = op.insert.match(/^화자\s*(\d+)$/);
            if (match) {
              const speakerNum = match[1];
              const newName = speakerMappings[speakerNum];
              if (newName) {
                hasChanges = true;
                return {
                  ...op,
                  insert: newName,
                };
              }
            }
          }

          // Check for code blocks with speaker patterns
          else if (op.attributes?.code && typeof op.insert === 'string') {
            const match = op.insert.match(/^화자\s*(\d+)$/);
            if (match) {
              const speakerNum = match[1];
              const newName = speakerMappings[speakerNum];
              if (newName) {
                hasChanges = true;
                return {
                  ...op,
                  attributes: {
                    ...op.attributes,
                    code: true,
                  },
                  insert: newName,
                };
              }
            }
          }

          return op;
        });

        if (hasChanges && newDelta) {
          ytext.delete(0, ytext.length);
          ytext.applyDelta(newDelta);
          replaced = true;
        }
      } catch (error) {
        console.warn(
          'Delta operation failed in speaker mapping replacement:',
          error
        );
      }
    };

    // Recursively search for Y.Text instances
    const searchAndReplace = (item: any, parent?: any, path: string = '') => {
      if (item instanceof Y.Text) {
        replaceInYText(item, parent instanceof Y.Map ? parent : undefined);
      } else if (item instanceof Y.Map) {
        // Handle shape text fields (mindmap nodes)
        const textValue = item.get('text');
        if (textValue instanceof Y.Text) {
          const textString = textValue.toString();

          // Check for backtick-wrapped speaker patterns
          const backtickMatch = textString.match(/^`화자\s*(\d+)`$/);
          if (backtickMatch) {
            const speakerNum = backtickMatch[1];
            const newName = speakerMappings[speakerNum];
            if (newName) {
              const newText = `\`${newName}\``;
              console.log(
                `[BulkDocumentReplacer] Updating shape text from "${textString}" to "${newText}"`
              );
              textValue.delete(0, textValue.length);
              textValue.insert(0, newText);
              replaced = true;
            }
          }
        } else if (textValue && typeof textValue === 'string') {
          // Check for speaker patterns in string text
          const match = textValue.match(/^`?화자\s*(\d+)`?$/);
          if (match) {
            const speakerNum = match[1];
            const newName = speakerMappings[speakerNum];
            if (newName) {
              const newText = `\`${newName}\``;
              console.log(
                `[BulkDocumentReplacer] Updating shape string text from "${textValue}" to "${newText}"`
              );
              item.set('text', newText);
              replaced = true;
            }
          }
        }

        for (const [key, value] of item.entries()) {
          const newPath = path ? `${path}/${key}` : key;

          // Special handling for BlockSuite text fields
          if (key === 'prop:text' && value instanceof Y.Text) {
            replaceInYText(value, item);
          }
          // Handle table cells
          else if (
            key.startsWith('prop:cells.') &&
            key.endsWith('.text') &&
            value instanceof Y.Text
          ) {
            const textContent = value.toString();
            console.log(
              `[BulkDocumentReplacer] Found table cell at ${newPath}: "${textContent}"`
            );

            // Call replaceInYText with isTableCell=true for table cells
            const beforeText = value.toString();
            replaceInYText(value, item, true);
            const afterText = value.toString();

            if (beforeText !== afterText) {
              console.log(
                `[BulkDocumentReplacer] Table cell text changed from "${beforeText}" to "${afterText}"`
              );
            }
          }
          // Handle mindmap shape text
          else if (key === 'text' && value instanceof Y.Text) {
            console.log(`[BulkDocumentReplacer] Found Y.Text at ${newPath}`);
            replaceInYText(value, item);
          } else {
            searchAndReplace(value, item, newPath);
          }
        }
      } else if (item instanceof Y.Array) {
        item.forEach((subItem, index) =>
          searchAndReplace(subItem, item, `${path}[${index}]`)
        );
      }
    };

    // Start from the root
    const store = ydoc.getMap('blocks');
    searchAndReplace(store);

    // Also check the meta store for any text
    const meta = ydoc.getMap('meta');
    searchAndReplace(meta);

    console.log(
      `[BulkDocumentReplacer] === Finished speaker mapping replacement for document ${docId} ===`
    );
    console.log(
      `[BulkDocumentReplacer] Found ${foundCount} speaker patterns, replaced ${replacedCount}`
    );

    return replaced;
  }

  private replaceSpeakerInYDoc(
    ydoc: Y.Doc,
    speakerId: string,
    newName: string,
    _docId?: string
  ): boolean {
    let replaced = false;

    // Function to replace speaker name by ID in Y.Text instances
    const replaceInYText = (
      ytext: Y.Text,
      parentBlock?: Y.Map<any>,
      isTableCell: boolean = false
    ) => {
      try {
        const textContent = ytext.toString();

        // For table cells, check if it matches generic speaker pattern
        if (isTableCell) {
          const speakerMatch = textContent.match(/^화자\s*(\d+)$/);
          if (speakerMatch) {
            // This method should not replace generic speaker patterns in table cells
            // It should only replace based on speakerId matches
            // Generic speaker pattern replacement should be handled by replaceSpeakerMappingInYDoc
            return;
          }
        }

        const delta = ytext.toDelta();
        let hasChanges = false;

        // Log delta operations for debugging action items
        const isTodoItem =
          parentBlock?.get('sys:flavour') === 'affine:list' &&
          parentBlock?.get('prop:type') === 'todo';
        if (isTodoItem) {
          console.log(
            `[BulkDocumentReplacer] Todo item text content: "${textContent}"`
          );
          console.log(
            `[BulkDocumentReplacer] Todo item delta:`,
            JSON.stringify(delta)
          );
          console.log(
            `[BulkDocumentReplacer] Looking for speakerId: ${speakerId}`
          );
        }

        // Handle both delta formats - array or object with ops property
        const deltaOps = Array.isArray(delta) ? delta : delta.ops;

        const newDelta = deltaOps?.map((op: any) => {
          // For plain text without attributes, check for speaker patterns
          if (typeof op.insert === 'string' && !op.attributes) {
            const speakerMatch = op.insert.match(/^화자\s*(\d+)$/);
            if (speakerMatch) {
              hasChanges = true;
              return {
                ...op,
                insert: newName,
              };
            }
          }

          // Check if this operation has speaker metadata with matching speakerId
          if (op.attributes?.code && op.attributes?.speakerId === speakerId) {
            if (isTodoItem) {
              console.log(
                `[BulkDocumentReplacer] Found matching speakerId in todo item: ${speakerId}`
              );
            }
            hasChanges = true;
            return {
              ...op,
              attributes: {
                ...op.attributes,
                code: true, // Keep code block styling
                speakerId: speakerId, // Keep the ID unchanged
                speakerName: newName, // Update the speaker name attribute
              },
              insert: newName, // Update the displayed text
            };
          }
          // Also check for participantId (used in meeting notes)
          else if (
            op.attributes?.code &&
            op.attributes?.participantId === speakerId
          ) {
            hasChanges = true;
            return {
              ...op,
              attributes: {
                ...op.attributes,
                code: true, // Keep code block styling
                participantId: speakerId, // Keep the ID unchanged
                participantName: newName, // Update the display name
              },
              insert: newName, // Update the displayed text
            };
          }
          // Also check for code blocks where speakerId might be stored at block level
          else if (op.attributes?.code && typeof op.insert === 'string') {
            // Check if parent block has matching speakerId or participantId
            const blockSpeakerId = parentBlock?.get('prop:speakerId');
            const blockParticipantId = parentBlock?.get('prop:participantId');
            if (
              blockSpeakerId === speakerId ||
              blockParticipantId === speakerId
            ) {
              hasChanges = true;
              return {
                ...op,
                attributes: {
                  ...op.attributes,
                  code: true,
                  speakerId:
                    blockSpeakerId === speakerId ? speakerId : undefined,
                  participantId:
                    blockParticipantId === speakerId ? speakerId : undefined,
                },
                insert: newName,
              };
            }
          }
          return op;
        });

        if (hasChanges && newDelta) {
          ytext.delete(0, ytext.length);
          ytext.applyDelta(newDelta);
          replaced = true;

          // Also update block-level speaker metadata if present
          if (parentBlock) {
            const blockSpeakerId = parentBlock.get('prop:speakerId');
            const blockParticipantId = parentBlock.get('prop:participantId');

            if (blockSpeakerId === speakerId) {
              parentBlock.set('prop:speakerName', newName);
            }
            if (blockParticipantId === speakerId) {
              parentBlock.set('prop:participantName', newName);
            }
          }
        }
      } catch (error) {
        console.warn('Delta operation failed in speaker replacement:', error);
      }
    };

    // Recursively search for Y.Text instances and speaker metadata
    const searchAndReplace = (item: any, parent?: any, path: string = '') => {
      if (item instanceof Y.Text) {
        replaceInYText(item, parent instanceof Y.Map ? parent : undefined);
      } else if (item instanceof Y.Map) {
        // Check if this is a block with speaker or participant metadata
        const blockSpeakerId = item.get('prop:speakerId');
        const blockParticipantId = item.get('prop:participantId');

        // Update block-level speaker metadata
        if (blockSpeakerId === speakerId) {
          console.log(`[BulkDocumentReplacer] Found speaker block at ${path}`);
          item.set('prop:speakerName', newName);
          replaced = true;
        }

        // Update block-level participant metadata (for meeting notes)
        if (blockParticipantId === speakerId) {
          console.log(
            `[BulkDocumentReplacer] Found participant block at ${path}`
          );
          item.set('prop:participantName', newName);
          replaced = true;
        }

        // First check if this Y.Map itself is a shape with speakerId/participantId
        const mapSpeakerId = item.get('speakerId');
        const mapParticipantId = item.get('participantId');

        if (mapSpeakerId === speakerId || mapParticipantId === speakerId) {
          console.log(
            `[BulkDocumentReplacer] Found shape with matching ID at ${path}`
          );
          console.log(
            `[BulkDocumentReplacer] Shape has speakerId: ${mapSpeakerId}, participantId: ${mapParticipantId}`
          );

          // Update speaker/participant name
          if (mapSpeakerId === speakerId) {
            const currentSpeakerName = item.get('speakerName');
            console.log(
              `[BulkDocumentReplacer] Current speakerName: ${currentSpeakerName}, new name: ${newName}`
            );
            if (currentSpeakerName !== newName) {
              item.set('speakerName', newName);
              replaced = true;
              console.log(
                `[BulkDocumentReplacer] Updated speakerName to ${newName}`
              );
            }
          }

          if (mapParticipantId === speakerId) {
            const currentParticipantName = item.get('participantName');
            console.log(
              `[BulkDocumentReplacer] Current participantName: ${currentParticipantName}, new name: ${newName}`
            );
            if (currentParticipantName !== newName) {
              item.set('participantName', newName);
              replaced = true;
              console.log(
                `[BulkDocumentReplacer] Updated participantName to ${newName}`
              );
            }
          }

          // Handle the text field
          const textValue = item.get('text');
          console.log(
            `[BulkDocumentReplacer] Shape text field type: ${typeof textValue}`
          );
          console.log(
            `[BulkDocumentReplacer] Shape text value: "${textValue}"`
          );

          // Handle Y.Text instance
          if (textValue instanceof Y.Text) {
            console.log(
              `[BulkDocumentReplacer] Text is Y.Text instance, converting to string`
            );
            const textString = textValue.toString();
            console.log(
              `[BulkDocumentReplacer] Y.Text content: "${textString}"`
            );

            // Check if current name is in backticks
            const currentName =
              item.get('speakerName') || item.get('participantName');
            const hasBackticks = textString.match(/^`[^`]+`$/);

            // Update text if it's the current speaker name wrapped in backticks or a generic pattern
            const isCurrentSpeakerName =
              hasBackticks && textString === `\`${currentName}\``;
            const isGenericSpeaker = textString.match(/^`?화자\s*\d+`?$/);

            if (isGenericSpeaker || isCurrentSpeakerName || hasBackticks) {
              const newText = `\`${newName}\``;
              console.log(
                `[BulkDocumentReplacer] Updating Y.Text from "${textString}" to "${newText}"`
              );
              textValue.delete(0, textValue.length);
              textValue.insert(0, newText);
              replaced = true;
              console.log(`[BulkDocumentReplacer] Successfully updated Y.Text`);
            }
          }
          // Handle string instance
          else if (textValue && typeof textValue === 'string') {
            console.log(`[BulkDocumentReplacer] Checking text patterns...`);

            // Check if it's a generic speaker pattern
            const isGenericSpeaker = textValue.match(/^`?화자\s*\d+`?$/);

            if (isGenericSpeaker) {
              const newText = `\`${newName}\``;
              console.log(
                `[BulkDocumentReplacer] Attempting to update generic speaker text from "${textValue}" to "${newText}"`
              );
              item.set('text', newText);
              replaced = true;
              console.log(
                `[BulkDocumentReplacer] Successfully updated generic speaker text`
              );
            } else {
              console.log(
                `[BulkDocumentReplacer] Text doesn't match any update patterns`
              );
            }
          } else if (textValue) {
            console.log(
              `[BulkDocumentReplacer] Text value is not a string or Y.Text, it's: ${textValue?.constructor?.name}`
            );
          }
        }

        for (const [key, value] of item.entries()) {
          const newPath = path ? `${path}/${key}` : key;

          // Special handling for BlockSuite text fields
          if (key === 'prop:text' && value instanceof Y.Text) {
            replaceInYText(value, item);
          }
          // Handle table cells
          else if (
            key.startsWith('prop:cells.') &&
            key.endsWith('.text') &&
            value instanceof Y.Text
          ) {
            const textContent = value.toString();
            console.log(
              `[BulkDocumentReplacer] Found table cell at ${newPath}`
            );
            console.log(
              `[BulkDocumentReplacer] Table cell text content: "${textContent}"`
            );

            // Extract cell ID to check for speakerId metadata
            const cellIdMatch = key.match(/prop:cells\.([^:]+):([^.]+)\.text/);
            let hasMatchingSpeakerId = false;
            if (cellIdMatch) {
              const [, rowId, cellId] = cellIdMatch;
              const cellSpeakerId = item.get(
                `prop:cells.${rowId}:${cellId}.speakerId`
              );
              const cellSpeakerName = item.get(
                `prop:cells.${rowId}:${cellId}.speakerName`
              );

              console.log(
                `[BulkDocumentReplacer] Cell metadata - speakerId: ${cellSpeakerId}, speakerName: ${cellSpeakerName}`
              );

              if (cellSpeakerId === speakerId) {
                hasMatchingSpeakerId = true;
                console.log(
                  `[BulkDocumentReplacer] Found cell with matching speakerId: ${cellSpeakerId}`
                );

                // First check and replace the text content if needed
                const speakerMatch = textContent.match(/^화자\s*(\d+)$/);
                const isCurrentSpeakerName =
                  cellSpeakerName && textContent === cellSpeakerName;

                if (speakerMatch || isCurrentSpeakerName) {
                  console.log(
                    `[BulkDocumentReplacer] Replacing table cell text from "${textContent}" to "${newName}"`
                  );

                  // Apply delta to maintain code block formatting
                  const newDelta = [
                    {
                      insert: newName,
                      attributes: {
                        code: true,
                        speakerId: cellSpeakerId,
                        speakerName: newName,
                      },
                    },
                  ];

                  value.delete(0, value.length);
                  value.applyDelta(newDelta);
                  replaced = true;
                }

                // Then update speaker name metadata
                if (cellSpeakerName !== newName) {
                  item.set(
                    `prop:cells.${rowId}:${cellId}.speakerName`,
                    newName
                  );
                  replaced = true;
                  console.log(
                    `[BulkDocumentReplacer] Updated cell speaker name metadata to: ${newName}`
                  );
                }
              }
            }

            // Only call replaceInYText if this cell doesn't have a matching speakerId
            // (to avoid skipping cells with generic patterns that have speakerId)
            if (!hasMatchingSpeakerId) {
              replaceInYText(value, item, true);
            }
          }
          // Handle mindmap shape text
          else if (key === 'text' && value instanceof Y.Text) {
            console.log(`[BulkDocumentReplacer] Found Y.Text at ${newPath}`);
            replaceInYText(value, item);
          } else {
            searchAndReplace(value, item, newPath);
          }
        }
      } else if (item instanceof Y.Array) {
        item.forEach((subItem, index) =>
          searchAndReplace(subItem, item, `${path}[${index}]`)
        );
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
