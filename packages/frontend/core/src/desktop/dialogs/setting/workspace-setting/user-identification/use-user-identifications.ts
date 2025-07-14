import { useQuery } from '@affine/core/components/hooks/use-query';
import { useMutation } from '@affine/core/components/hooks/use-mutation';
import { useCallback } from 'react';
import {
  createUserIdentificationMutation,
  deleteUserIdentificationMutation,
  updateUserIdentificationMutation,
  userIdentificationQuery,
  userIdentificationsQuery,
} from './graphql';

export interface UserIdentification {
  id: string;
  workspaceId: string;
  userId?: string | null;
  nickname?: string | null;
  title?: string | null;
  email?: string | null;
  imageData: string;
  imageType: string;
  createdAt: string;
  updatedAt: string;
}

export const useUserIdentifications = (workspaceId: string) => {
  const { data, error, isLoading, mutate } = useQuery({
    query: userIdentificationsQuery,
    variables: { workspaceId },
  });

  return {
    data: data?.userIdentifications as UserIdentification[] | undefined,
    loading: isLoading,
    error,
    mutate,
  };
};

export const useUserIdentification = (id: string | null) => {
  const { data, error, isLoading } = useQuery(
    id ? {
      query: userIdentificationQuery,
      variables: { id },
    } : null
  );

  return {
    data: data ? { userIdentification: data.userIdentification as UserIdentification } : undefined,
    loading: isLoading,
    error,
  };
};

export const useCreateUserIdentification = () => {
  const { trigger, isMutating, error } = useMutation({
    mutation: createUserIdentificationMutation,
  });

  const create = useCallback(
    async (input: {
      workspaceId: string;
      userId?: string | null;
      nickname?: string | null;
      title?: string | null;
      email?: string | null;
      imageData: string;
      imageType?: string;
    }) => {
      const result = await trigger({ input });
      return result.createUserIdentification;
    },
    [trigger]
  );

  return { create, loading: isMutating, error };
};

export const useUpdateUserIdentification = () => {
  const { trigger, isMutating, error } = useMutation({
    mutation: updateUserIdentificationMutation,
  });

  const update = useCallback(
    async (input: {
      id: string;
      userId?: string | null;
      nickname?: string | null;
      title?: string | null;
      email?: string | null;
      imageData?: string;
      imageType?: string;
    }) => {
      const result = await trigger({ input });
      return result.updateUserIdentification;
    },
    [trigger]
  );

  return { update, loading: isMutating, error };
};

export const useDeleteUserIdentification = () => {
  const { trigger, isMutating, error } = useMutation({
    mutation: deleteUserIdentificationMutation,
  });

  const deleteIdentification = useCallback(
    async (id: string) => {
      const result = await trigger({ id });
      return result.deleteUserIdentification;
    },
    [trigger]
  );

  return { delete: deleteIdentification, loading: isMutating, error };
};