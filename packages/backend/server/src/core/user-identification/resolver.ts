import { Inject, Injectable } from '@nestjs/common';
import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { PrismaClient } from '@prisma/client';

import { CurrentUser } from '../auth/session';
import type { CurrentUser as CurrentUserType } from '../auth/session';
import { AccessController } from '../permission';
import { UserType } from '../user/types';
import { WorkspaceType } from '../workspaces/types';
import {
  CreateUserIdentificationInput,
  UpdateUserIdentificationInput,
  UserIdentificationType,
} from './types';

@Injectable()
@Resolver(() => UserIdentificationType)
export class UserIdentificationResolver {
  constructor(
    @Inject(AccessController) private readonly access: AccessController,
    @Inject(PrismaClient) private readonly prisma: PrismaClient
  ) {}

  @Query(() => [UserIdentificationType])
  async userIdentifications(
    @CurrentUser() user: CurrentUserType,
    @Args('workspaceId') workspaceId: string
  ): Promise<UserIdentificationType[]> {
    await this.access.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    return this.prisma.userIdentification.findMany({
      where: {
        workspaceId,
      },
      orderBy: [
        { userId: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  @Query(() => UserIdentificationType, { nullable: true })
  async userIdentification(
    @CurrentUser() user: CurrentUserType,
    @Args('id', { type: () => ID }) id: string
  ): Promise<UserIdentificationType | null> {
    const identification = await this.prisma.userIdentification.findUnique({
      where: { id },
    });

    if (!identification) {
      return null;
    }

    await this.access.user(user.id).workspace(identification.workspaceId).assert('Workspace.Read');

    return identification;
  }

  @Mutation(() => UserIdentificationType)
  async createUserIdentification(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: CreateUserIdentificationInput
  ): Promise<UserIdentificationType> {
    await this.access.user(user.id).workspace(input.workspaceId).assert('Workspace.Settings.Update');

    return this.prisma.userIdentification.create({
      data: {
        ...input,
        userId: input.userId || user.id, // Default to current user if not specified
        createdBy: user.id,
        imageType: input.imageType || 'image/jpeg',
      },
    });
  }

  @Mutation(() => UserIdentificationType)
  async updateUserIdentification(
    @CurrentUser() user: CurrentUserType,
    @Args('input') input: UpdateUserIdentificationInput
  ): Promise<UserIdentificationType> {
    const identification = await this.prisma.userIdentification.findUnique({
      where: { id: input.id },
    });

    if (!identification) {
      throw new Error('User identification not found');
    }

    await this.access.user(user.id).workspace(identification.workspaceId).assert('Workspace.Settings.Update');

    const { id, ...updateData } = input;

    return this.prisma.userIdentification.update({
      where: { id },
      data: updateData,
    });
  }

  @Mutation(() => Boolean)
  async deleteUserIdentification(
    @CurrentUser() user: CurrentUserType,
    @Args('id', { type: () => ID }) id: string
  ): Promise<boolean> {
    const identification = await this.prisma.userIdentification.findUnique({
      where: { id },
    });

    if (!identification) {
      throw new Error('User identification not found');
    }

    await this.access.user(user.id).workspace(identification.workspaceId).assert('Workspace.Settings.Update');

    await this.prisma.userIdentification.delete({
      where: { id },
    });

    return true;
  }

  @ResolveField(() => WorkspaceType)
  async workspace(
    @Parent() identification: UserIdentificationType
  ): Promise<WorkspaceType | null> {
    return this.prisma.workspace.findUnique({
      where: { id: identification.workspaceId },
    });
  }

  @ResolveField(() => UserType, { nullable: true })
  async user(
    @Parent() identification: UserIdentificationType
  ): Promise<UserType | null> {
    if (!identification.userId) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: { id: identification.userId },
    });
  }
}