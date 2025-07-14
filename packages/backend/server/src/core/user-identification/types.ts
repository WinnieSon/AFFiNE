import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { UserType } from '../user/types';
import { WorkspaceType } from '../workspaces/types';

@ObjectType()
export class UserIdentificationType {
  @Field(() => ID)
  id!: string;

  @Field()
  workspaceId!: string;

  @Field(() => String, { nullable: true })
  userId?: string | null;

  @Field(() => String, { nullable: true })
  nickname?: string | null;

  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field()
  imageData!: string;

  @Field()
  imageType!: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => WorkspaceType)
  workspace!: WorkspaceType;

  @Field(() => UserType, { nullable: true })
  user?: UserType | null;
}

@InputType()
export class CreateUserIdentificationInput {
  @Field()
  workspaceId!: string;

  @Field(() => String, { nullable: true })
  userId?: string | null;

  @Field(() => String, { nullable: true })
  nickname?: string | null;

  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field()
  imageData!: string;

  @Field(() => String, { nullable: true })
  imageType?: string;
}

@InputType()
export class UpdateUserIdentificationInput {
  @Field()
  id!: string;

  @Field(() => String, { nullable: true })
  userId?: string | null;

  @Field(() => String, { nullable: true })
  nickname?: string | null;

  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  imageData?: string;

  @Field(() => String, { nullable: true })
  imageType?: string;
}