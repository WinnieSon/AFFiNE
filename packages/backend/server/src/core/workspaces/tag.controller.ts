import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { nanoid } from 'nanoid';
import * as Y from 'yjs';

import { CallMetric } from '../../base';
import { CurrentUser } from '../auth';
import { PgWorkspaceDocStorageAdapter } from '../doc';
import { AccessController } from '../permission';

export interface Tag {
  id: string;
  value: string;
  color: string;
  createDate: number;
  updateDate: number;
}

export interface CreateTagDto {
  value: string;
  color: string;
}

export interface UpdateTagDto {
  value?: string;
  color?: string;
}

@Controller('/api/workspaces/:workspaceId/tags')
export class TagController {
  logger = new Logger(TagController.name);

  constructor(
    private readonly ac: AccessController,
    private readonly workspace: PgWorkspaceDocStorageAdapter
  ) {}

  // Get all tags in workspace
  @Get()
  @CallMetric('controllers', 'workspace_get_tags')
  async getTags(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Res() res: Response
  ) {
    // Check workspace read permission
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    try {
      const tags = await this.getWorkspaceTags(workspaceId);
      return res.json({ tags });
    } catch (error) {
      this.logger.error(`Failed to get tags: ${error}`);
      return res.status(500).json({ error: 'Failed to get tags' });
    }
  }

  // Get specific tag
  @Get(':tagId')
  @CallMetric('controllers', 'workspace_get_tag')
  async getTag(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('tagId') tagId: string,
    @Res() res: Response
  ) {
    // Check workspace read permission
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    try {
      const tags = await this.getWorkspaceTags(workspaceId);
      const tag = tags.find(t => t.id === tagId);

      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }

      return res.json({ tag });
    } catch (error) {
      this.logger.error(`Failed to get tag: ${error}`);
      return res.status(500).json({ error: 'Failed to get tag' });
    }
  }

  // Create new tag
  @Post()
  @CallMetric('controllers', 'workspace_create_tag')
  async createTag(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateTagDto,
    @Res() res: Response
  ) {
    // Check workspace write permission
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.CreateDoc');

    if (!body.value || !body.color) {
      return res
        .status(400)
        .json({ error: 'Tag value and color are required' });
    }

    try {
      const newTag: Tag = {
        id: nanoid(),
        value: body.value,
        color: body.color,
        createDate: Date.now(),
        updateDate: Date.now(),
      };

      await this.addTagToWorkspace(workspaceId, newTag, user.id);

      this.logger.log(`Created tag ${newTag.id} in workspace ${workspaceId}`);

      return res.status(201).json({
        tag: newTag,
        workspaceId,
        createdBy: user.id,
      });
    } catch (error) {
      this.logger.error(`Failed to create tag: ${error}`);
      return res.status(500).json({ error: 'Failed to create tag' });
    }
  }

  // Update tag
  @Put(':tagId')
  @CallMetric('controllers', 'workspace_update_tag')
  async updateTag(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('tagId') tagId: string,
    @Body() body: UpdateTagDto,
    @Res() res: Response
  ) {
    // Check workspace write permission
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.CreateDoc');

    try {
      const tags = await this.getWorkspaceTags(workspaceId);
      const tagIndex = tags.findIndex(t => t.id === tagId);

      if (tagIndex === -1) {
        return res.status(404).json({ error: 'Tag not found' });
      }

      const updatedTag = {
        ...tags[tagIndex],
        ...(body.value !== undefined && { value: body.value }),
        ...(body.color !== undefined && { color: body.color }),
        updateDate: Date.now(),
      };

      tags[tagIndex] = updatedTag;
      await this.updateWorkspaceTags(workspaceId, tags, user.id);

      this.logger.log(`Updated tag ${tagId} in workspace ${workspaceId}`);

      return res.json({
        tag: updatedTag,
        workspaceId,
        updatedBy: user.id,
      });
    } catch (error) {
      this.logger.error(`Failed to update tag: ${error}`);
      return res.status(500).json({ error: 'Failed to update tag' });
    }
  }

  // Delete tag
  @Delete(':tagId')
  @CallMetric('controllers', 'workspace_delete_tag')
  async deleteTag(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('tagId') tagId: string,
    @Res() res: Response
  ) {
    // Check workspace write permission
    await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.CreateDoc');

    try {
      const tags = await this.getWorkspaceTags(workspaceId);
      const filteredTags = tags.filter(t => t.id !== tagId);

      if (tags.length === filteredTags.length) {
        return res.status(404).json({ error: 'Tag not found' });
      }

      await this.updateWorkspaceTags(workspaceId, filteredTags, user.id);

      // TODO: Remove tag from all documents that have it

      this.logger.log(`Deleted tag ${tagId} from workspace ${workspaceId}`);

      return res.json({
        success: true,
        tagId,
        workspaceId,
        deletedBy: user.id,
      });
    } catch (error) {
      this.logger.error(`Failed to delete tag: ${error}`);
      return res.status(500).json({ error: 'Failed to delete tag' });
    }
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
   * Update all tags in workspace
   */
  private async updateWorkspaceTags(
    workspaceId: string,
    tags: Tag[],
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

    // Create new array with all tags
    const options = new Y.Array();
    tags.forEach(tag => {
      options.push([tag]);
    });

    tagsInfo.set('options', options);

    const update = Y.encodeStateAsUpdate(ydoc);
    await this.workspace.pushDocUpdates(
      workspaceId,
      workspaceId,
      [update],
      userId
    );
  }
}
