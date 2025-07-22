import { randomUUID } from 'node:crypto';

import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { nanoid } from 'nanoid';
import * as Y from 'yjs';

import {
  BlobNotFound,
  CallMetric,
  CommentAttachmentNotFound,
  DocHistoryNotFound,
  DocNotFound,
  EventBus,
  InvalidHistoryTimestamp,
} from '../../base';
import { DocMode, Models, PublicDocMode } from '../../models';
import { CurrentUser, Public } from '../auth';
import { PgWorkspaceDocStorageAdapter } from '../doc';
import { DocReader } from '../doc/reader';
import { AccessController } from '../permission';
import { CommentAttachmentStorage, WorkspaceBlobStorage } from '../storage';
import { DocID } from '../utils/doc';
import { CreateDocDto, CreateMeetingDocDto, UpdateDocDto } from './dto';
import { createMeetingMindMapDocument } from './meeting-note-generator';
import { OrganizeService } from './organize.service';
import { SpeakerRenameService } from './speaker-rename.service';
import type { Tag } from './tag.controller';

@Controller('/api/workspaces')
export class WorkspacesController {
  logger = new Logger(WorkspacesController.name);

  constructor(
    private readonly storage: WorkspaceBlobStorage,
    private readonly commentAttachmentStorage: CommentAttachmentStorage,
    private readonly ac: AccessController,
    private readonly workspace: PgWorkspaceDocStorageAdapter,
    private readonly docReader: DocReader,
    private readonly models: Models,
    private readonly event: EventBus,
    private readonly organizeService: OrganizeService,
    private readonly speakerRenameService: SpeakerRenameService
  ) {}

  // get workspace blob
  //
  // NOTE: because graphql can't represent a File, so we have to use REST API to get blob
  @Public()
  @Get('/:id/blobs/:name')
  @CallMetric('controllers', 'workspace_get_blob')
  async blob(
    @CurrentUser() user: CurrentUser | undefined,
    @Param('id') workspaceId: string,
    @Param('name') name: string,
    @Query('redirect') redirect: string | undefined,
    @Res() res: Response
  ) {
    await this.ac
      .user(user?.id ?? 'anonymous')
      .workspace(workspaceId)
      .assert('Workspace.Read');
    const { body, metadata, redirectUrl } = await this.storage.get(
      workspaceId,
      name,
      true
    );

    if (redirectUrl) {
      // redirect to signed url
      if (redirect === 'manual') {
        return res.send({
          url: redirectUrl,
        });
      } else {
        return res.redirect(redirectUrl);
      }
    }

    if (!body) {
      throw new BlobNotFound({
        spaceId: workspaceId,
        blobId: name,
      });
    }

    // metadata should always exists if body is not null
    if (metadata) {
      res.setHeader(
        'content-type',
        metadata.contentType.startsWith('application/json') // application/json is reserved for redirect url
          ? 'text/json'
          : metadata.contentType
      );
      res.setHeader('last-modified', metadata.lastModified.toUTCString());
      res.setHeader('content-length', metadata.contentLength);
    } else {
      this.logger.warn(`Blob ${workspaceId}/${name} has no metadata`);
    }

    res.setHeader('cache-control', 'public, max-age=2592000, immutable');
    body.pipe(res);
  }

  // get doc binary
  @Public()
  @Get('/:id/docs/:guid')
  @CallMetric('controllers', 'workspace_get_doc')
  async doc(
    @CurrentUser() user: CurrentUser | undefined,
    @Param('id') ws: string,
    @Param('guid') guid: string,
    @Res() res: Response
  ) {
    const docId = new DocID(guid, ws);
    if (docId.isWorkspace) {
      await this.ac
        .user(user?.id ?? 'anonymous')
        .workspace(ws)
        .assert('Workspace.Read');
    } else {
      await this.ac
        .user(user?.id ?? 'anonymous')
        .doc(ws, guid)
        .assert('Doc.Read');
    }
    const binResponse = await this.docReader.getDoc(
      docId.workspace,
      docId.guid
    );

    if (!binResponse) {
      throw new DocNotFound({
        spaceId: docId.workspace,
        docId: docId.guid,
      });
    }

    if (!docId.isWorkspace) {
      // fetch the publish page mode for publish page
      const docMeta = await this.models.doc.getMeta(
        docId.workspace,
        docId.guid,
        {
          select: {
            mode: true,
          },
        }
      );
      const publishPageMode =
        docMeta?.mode === PublicDocMode.Edgeless
          ? DocMode.edgeless
          : DocMode.page;

      res.setHeader('publish-mode', publishPageMode);
    }

    res.setHeader('content-type', 'application/octet-stream');
    res.send(binResponse.bin);
  }

  @Get('/:id/docs/:guid/histories/:timestamp')
  @CallMetric('controllers', 'workspace_get_history')
  async history(
    @CurrentUser() user: CurrentUser,
    @Param('id') ws: string,
    @Param('guid') guid: string,
    @Param('timestamp') timestamp: string,
    @Res() res: Response
  ) {
    const docId = new DocID(guid, ws);
    let ts;
    try {
      ts = new Date(timestamp);
    } catch {
      throw new InvalidHistoryTimestamp({ timestamp });
    }

    await this.ac.user(user.id).doc(ws, guid).assert('Doc.Read');

    const history = await this.workspace.getDocHistory(
      docId.workspace,
      docId.guid,
      ts.getTime()
    );

    if (history) {
      res.setHeader('content-type', 'application/octet-stream');
      res.setHeader('cache-control', 'private, max-age=2592000, immutable');
      res.send(history.bin);
    } else {
      throw new DocHistoryNotFound({
        spaceId: docId.workspace,
        docId: guid,
        timestamp: ts.getTime(),
      });
    }
  }

  @Get('/:id/docs/:docId/comment-attachments/:key')
  @CallMetric('controllers', 'workspace_get_comment_attachment')
  async commentAttachment(
    @CurrentUser() user: CurrentUser,
    @Param('id') workspaceId: string,
    @Param('docId') docId: string,
    @Param('key') key: string,
    @Res() res: Response
  ) {
    await this.ac.user(user.id).doc(workspaceId, docId).assert('Doc.Read');

    const { body, metadata, redirectUrl } =
      await this.commentAttachmentStorage.get(workspaceId, docId, key, true);

    if (redirectUrl) {
      return res.redirect(redirectUrl);
    }

    if (!body) {
      throw new CommentAttachmentNotFound();
    }

    // metadata should always exists if body is not null
    if (metadata) {
      res.setHeader('content-type', metadata.contentType);
      res.setHeader('last-modified', metadata.lastModified.toUTCString());
      res.setHeader('content-length', metadata.contentLength);
    } else {
      this.logger.warn(
        `Comment attachment ${workspaceId}/${docId}/${key} has no metadata`
      );
    }

    res.setHeader('cache-control', 'private, max-age=2592000, immutable');
    body.pipe(res);
  }

  // Create a new doc
  @Post('/:id/docs')
  @CallMetric('controllers', 'workspace_create_doc')
  async createDoc(
    @CurrentUser() user: CurrentUser,
    @Param('id') workspaceId: string,
    @Body() body: CreateDocDto,
    @Res() res: Response
  ) {
    // Check workspace write permission
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.CreateDoc');

    // Generate new doc ID
    const docId = randomUUID();

    try {
      // Note: We're NOT creating database metadata here because it causes issues
      // The document will be created only in Yjs for now

      // Create initial content if provided
      if (body.initialContent) {
        // Convert array to Uint8Array if needed
        const content =
          body.initialContent instanceof Uint8Array
            ? body.initialContent
            : new Uint8Array(body.initialContent);

        this.logger.log(
          `Creating doc with initial content, size: ${content.length} bytes`
        );

        try {
          await this.workspace.pushDocUpdates(
            workspaceId,
            docId,
            [content],
            user.id
          );
          this.logger.log(`Successfully pushed updates for doc ${docId}`);
        } catch (pushError) {
          this.logger.error(`Failed to push updates: ${pushError}`);
          throw pushError;
        }
      } else {
        // Create a proper empty Yjs document for AFFiNE
        // This is a base64 encoded Yjs update that creates the basic page structure
        const emptyDocBase64 =
          'AQaFzMPBqKyODgAnAQZibG9ja3MJcGFnZTpob21lASgAhczDwaisjg4ABnN5czppZAF3CXBhZ2U6aG9tZSgAhczDwaisjg4AC3N5czpmbGF2b3VyAXcLYWZmaW5lOnBhZ2UnAIXMw8GorI4OAAxzeXM6Y2hpbGRyZW4AJwCFzMPBqKyODgAKcHJvcDp0aXRsZQIEAIXMw8GorI4OBCJUZXN0IERvY3VtZW50IENyZWF0ZWQgdmlhIFJFU1QgQVBJAA==';
        const emptyDoc = new Uint8Array(Buffer.from(emptyDocBase64, 'base64'));
        await this.workspace.pushDocUpdates(
          workspaceId,
          docId,
          [emptyDoc],
          user.id
        );
      }

      // Force merge updates to create snapshot immediately
      // This ensures the document exists in the snapshots table before creating metadata
      try {
        await this.workspace.getDoc(workspaceId, docId);
        this.logger.log(`Successfully created snapshot for doc ${docId}`);
      } catch (error) {
        this.logger.error(`Failed to create snapshot: ${error}`);
        throw error;
      }

      // Add document to workspace metadata
      try {
        await this.addDocToWorkspaceMeta(
          workspaceId,
          docId,
          body.title || 'Untitled',
          user.id
        );
      } catch (error) {
        this.logger.warn(`Failed to add doc to workspace meta: ${error}`);
        // Non-critical error, continue
      }

      // Create database metadata for the document
      // This is essential for the document to be properly recognized
      await this.models.doc.upsertMeta(workspaceId, docId, {
        title: body.title || 'Untitled',
      });

      // Set the current user as the owner of the doc
      await this.models.docUser.setOwner(workspaceId, docId, user.id);

      // Emit doc created event
      this.event.emit('doc.created', {
        workspaceId,
        docId,
        editor: user.id,
      });

      return res.status(201).json({
        docId,
        workspaceId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      });
    } catch (error) {
      this.logger.error(`Failed to create doc: ${error}`);
      return res.status(500).json({ error: 'Failed to create document' });
    }
  }

  // Create a new doc from meeting note data
  @Post('/:id/docs/from-meeting')
  @CallMetric('controllers', 'workspace_create_meeting_doc')
  async createMeetingDoc(
    @CurrentUser() user: CurrentUser,
    @Param('id') workspaceId: string,
    @Body() body: CreateMeetingDocDto,
    @Res() res: Response
  ) {
    // Check workspace write permission
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.CreateDoc');

    // Generate new doc ID
    const docId = randomUUID();

    try {
      // Handle tags - check existing and create new ones
      let tagIds: string[] = [];
      if (body.tags && body.tags.length > 0) {
        // Get existing tags from workspace
        const existingTags = await this.getWorkspaceTags(workspaceId);

        for (const tagName of body.tags) {
          // Check if tag already exists
          let existingTag = existingTags.find(t => t.value === tagName);

          if (!existingTag) {
            // Create new tag
            const newTag: Tag = {
              id: nanoid(),
              value: tagName,
              color: this.getRandomTagColor(),
              createDate: Date.now(),
              updateDate: Date.now(),
            };

            await this.addTagToWorkspace(workspaceId, newTag, user.id);
            this.logger.log(`Created new tag: ${tagName} (${newTag.id})`);
            tagIds.push(newTag.id);
          } else {
            this.logger.log(
              `Using existing tag: ${tagName} (${existingTag.id})`
            );
            tagIds.push(existingTag.id);
          }
        }
      }

      // Format document title with date/time
      let formattedTitle = '📋';
      if (body.date && body.time) {
        formattedTitle += `${body.date} ${body.time} `;
      } else if (body.date) {
        formattedTitle += `${body.date} `;
      }
      formattedTitle += body.title || '회의록';

      // Create meeting note document structure
      const meetingDoc = createMeetingMindMapDocument(body);
      const content = Y.encodeStateAsUpdate(meetingDoc);

      this.logger.log(
        `Creating meeting note doc with content, size: ${content.length} bytes`
      );

      // Push the document content
      await this.workspace.pushDocUpdates(
        workspaceId,
        docId,
        [content],
        user.id
      );

      this.logger.log(
        `Successfully pushed meeting note updates for doc ${docId}`
      );

      // Force merge updates to create snapshot immediately
      try {
        await this.workspace.getDoc(workspaceId, docId);
        this.logger.log(
          `Successfully created snapshot for meeting note doc ${docId}`
        );
      } catch (error) {
        this.logger.error(`Failed to create snapshot: ${error}`);
        throw error;
      }

      // Add document to workspace metadata with tag IDs
      try {
        await this.addDocToWorkspaceMeta(
          workspaceId,
          docId,
          formattedTitle,
          user.id,
          tagIds.length > 0 ? tagIds : undefined
        );
        this.logger.log(
          `Added document to workspace meta with ${tagIds.length} tags`
        );
      } catch (error) {
        this.logger.warn(
          `Failed to add meeting note doc to workspace meta: ${error}`
        );
        // Non-critical error, continue
      }

      // Create database metadata for the document
      await this.models.doc.upsertMeta(workspaceId, docId, {
        title: formattedTitle,
      });

      // Set the current user as the owner of the doc
      await this.models.docUser.setOwner(workspaceId, docId, user.id);

      // Emit doc created event
      this.event.emit('doc.created', {
        workspaceId,
        docId,
        editor: user.id,
      });

      // Auto-organize meeting note into YYYY-MM folder structure
      try {
        await this.organizeService.createDateBasedOrganization(
          workspaceId,
          docId,
          user.id,
          new Date()
        );
        this.logger.log(
          `Successfully auto-organized meeting note ${docId} into YYYY-MM folder structure`
        );
      } catch (error) {
        this.logger.warn(
          `Failed to auto-organize meeting note into folders: ${error}`
        );
        // Non-critical error, continue
      }

      return res.status(201).json({
        docId,
        workspaceId,
        title: formattedTitle,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        type: 'meeting-note',
      });
    } catch (error) {
      this.logger.error(`Failed to create meeting note doc: ${error}`);
      return res
        .status(500)
        .json({ error: 'Failed to create meeting note document' });
    }
  }

  // Update existing doc
  @Put('/:id/docs/:guid')
  @CallMetric('controllers', 'workspace_update_doc')
  async updateDoc(
    @CurrentUser() user: CurrentUser,
    @Param('id') workspaceId: string,
    @Param('guid') docId: string,
    @Body() body: UpdateDocDto,
    @Res() res: Response
  ) {
    // Check doc write permission
    await this.ac.user(user.id).doc(workspaceId, docId).assert('Doc.Update');

    if (!body.updates || !Array.isArray(body.updates)) {
      return res.status(400).json({ error: 'Updates array is required' });
    }

    try {
      // Convert arrays to Uint8Array if needed
      const updates = body.updates.map(update =>
        update instanceof Uint8Array ? update : new Uint8Array(update)
      );

      // Apply updates to the doc
      const timestamp = await this.workspace.pushDocUpdates(
        workspaceId,
        docId,
        updates,
        user.id
      );

      return res.json({
        docId,
        workspaceId,
        timestamp,
        updatedBy: user.id,
      });
    } catch (error) {
      this.logger.error(`Failed to update doc: ${error}`);
      if (error instanceof DocNotFound) {
        return res.status(404).json({ error: 'Document not found' });
      } else {
        return res.status(500).json({ error: 'Failed to update document' });
      }
    }
  }

  /**
   * Add document to workspace metadata
   */
  private async addDocToWorkspaceMeta(
    workspaceId: string,
    docId: string,
    title: string,
    userId: string,
    tagIds?: string[]
  ): Promise<void> {
    try {
      // Get the workspace's root document
      const rootDoc = await this.workspace.getDoc(workspaceId, workspaceId);
      if (!rootDoc) {
        this.logger.warn(
          `Root document not found for workspace ${workspaceId}`
        );
        return;
      }

      // Parse the root document
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, rootDoc.bin);

      // Get the meta map and pages array
      const meta = ydoc.getMap('meta');
      const pages = meta.get('pages') as Y.Array<Y.Map<any>>;

      if (!pages) {
        this.logger.warn(`No pages array found in workspace ${workspaceId}`);
        return;
      }

      // Check if document already exists in pages
      let docFound = false;
      for (let i = 0; i < pages.length; i++) {
        const pageMap = pages.get(i);
        if (pageMap instanceof Y.Map && pageMap.get('id') === docId) {
          docFound = true;
          break;
        }
      }

      if (!docFound) {
        // Create new entry
        const timestamp = Date.now();
        const docMeta = new Y.Map();
        docMeta.set('id', docId);
        docMeta.set('title', title);
        docMeta.set('createDate', timestamp);
        docMeta.set('updatedDate', timestamp);

        // Add tag IDs if provided
        const tagsArray = new Y.Array();
        if (tagIds && tagIds.length > 0) {
          this.logger.log(
            `Adding ${tagIds.length} tag IDs to document metadata: ${JSON.stringify(tagIds)}`
          );
          tagIds.forEach(tagId => {
            tagsArray.push([tagId]); // Push tag ID
          });
        }
        docMeta.set('tags', tagsArray);

        pages.push([docMeta]);

        this.logger.log(
          `Added doc ${docId} to workspace ${workspaceId} metadata with ${tagsArray.length} tags`
        );
      } else {
        this.logger.log(
          `Doc ${docId} already exists in workspace ${workspaceId} metadata`
        );
      }

      // Get the update and push it back
      const update = Y.encodeStateAsUpdate(ydoc);
      await this.workspace.pushDocUpdates(
        workspaceId,
        workspaceId,
        [update],
        userId
      );
    } catch (error) {
      this.logger.error(
        `Failed to update document timestamps: ${error}`,
        error
      );
      // Don't throw - this is not critical for document creation
    }
  }

  /**
   * Check if document title indicates it should be created as mindmap
   */
  private isMeetingDocument(title: string): boolean {
    const meetingKeywords = [
      '회의',
      '회의록',
      '미팅',
      'meeting',
      'minutes',
      'conference',
      '논의',
      'discussion',
      '세미나',
      'seminar',
      '워크숍',
      'workshop',
    ];

    const lowerTitle = title.toLowerCase();
    return meetingKeywords.some(keyword =>
      lowerTitle.includes(keyword.toLowerCase())
    );
  }

  /**
   * Get random tag color
   */
  private getRandomTagColor(): string {
    const colors = [
      'var(--affine-palette-line-red)',
      'var(--affine-palette-line-orange)',
      'var(--affine-palette-line-yellow)',
      'var(--affine-palette-line-green)',
      'var(--affine-palette-line-blue)',
      'var(--affine-palette-line-purple)',
      'var(--affine-palette-line-magenta)',
      'var(--affine-palette-line-grey)',
      'var(--affine-palette-line-tangerine)',
      'var(--affine-palette-line-teal)',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Get tags from workspace metadata
   */
  private async getWorkspaceTags(workspaceId: string): Promise<Tag[]> {
    const rootDoc = await this.workspace.getDoc(workspaceId, workspaceId);
    if (!rootDoc) {
      this.logger.warn(`Root document not found for workspace ${workspaceId}`);
      return [];
    }

    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, rootDoc.bin);

    const meta = ydoc.getMap('meta');
    const properties = meta.get('properties') as Y.Map<any>;

    if (!properties) {
      return [];
    }

    const tagsInfo = properties.get('tags') as Y.Map<any>;
    if (!tagsInfo) {
      return [];
    }

    const options = tagsInfo.get('options') as Y.Array<any>;
    if (!options) {
      return [];
    }

    return options.toJSON() as Tag[];
  }

  /**
   * Add a new tag to workspace
   */
  private async addTagToWorkspace(
    workspaceId: string,
    tag: Tag,
    userId: string
  ): Promise<void> {
    const rootDoc = await this.workspace.getDoc(workspaceId, workspaceId);
    if (!rootDoc) {
      throw new Error(`Root document not found for workspace ${workspaceId}`);
    }

    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, rootDoc.bin);

    const meta = ydoc.getMap('meta');
    let properties = meta.get('properties') as Y.Map<any>;

    if (!properties) {
      properties = new Y.Map();
      meta.set('properties', properties);
    }

    let tagsInfo = properties.get('tags') as Y.Map<any>;
    if (!tagsInfo) {
      tagsInfo = new Y.Map();
      properties.set('tags', tagsInfo);
    }

    let options = tagsInfo.get('options') as Y.Array<any>;
    if (!options) {
      options = new Y.Array();
      tagsInfo.set('options', options);
    }

    options.push([tag]);

    const update = Y.encodeStateAsUpdate(ydoc);
    await this.workspace.pushDocUpdates(
      workspaceId,
      workspaceId,
      [update],
      userId
    );
  }

  /**
   * Rename speaker across all documents in workspace
   *
   * @warning This operation will update ALL documents in the workspace
   */
  @Post('/:id/speaker-rename')
  @CallMetric('controllers', 'workspace_speaker_rename')
  async renameSpeaker(
    @CurrentUser() user: CurrentUser,
    @Param('id') workspaceId: string,
    @Body() body: { oldName: string; newName: string; confirmWarning?: boolean }
  ) {
    if (!body.oldName || !body.newName) {
      throw new Error('Both oldName and newName are required');
    }

    if (body.oldName === body.newName) {
      throw new Error('Old name and new name cannot be the same');
    }

    // Require confirmation
    if (!body.confirmWarning) {
      return {
        warning: `This operation will replace all occurrences of "${body.oldName}" with "${body.newName}" in ALL documents in this workspace. This cannot be undone.`,
        requiresConfirmation: true,
      };
    }

    // Check permission - user must be able to create docs (which implies write access)
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .can('Workspace.CreateDoc');

    this.logger.log(
      `User ${user.id} is renaming speaker "${body.oldName}" to "${body.newName}" in workspace ${workspaceId}`
    );

    // Perform the rename
    const result = await this.speakerRenameService.renameSpeakerInWorkspace({
      workspaceId,
      oldName: body.oldName,
      newName: body.newName,
      userId: user.id,
    });

    return {
      success: true,
      result,
      message: `Successfully renamed "${body.oldName}" to "${body.newName}" in ${result.updatedDocuments} out of ${result.totalDocuments} documents`,
    };
  }
}
