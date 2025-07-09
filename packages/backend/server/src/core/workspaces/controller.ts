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
import { CreateDocDto, UpdateDocDto } from './dto';

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
    private readonly event: EventBus
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
      await this.commentAttachmentStorage.get(workspaceId, docId, key);

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
      // First create the doc metadata in workspace_pages table
      await this.models.doc.upsertMeta(workspaceId, docId, {
        title: body.title || 'Untitled',
        public: false,
        defaultRole: 30, // Manager role
        mode: 0, // Page mode
        blocked: false,
      });

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
}
