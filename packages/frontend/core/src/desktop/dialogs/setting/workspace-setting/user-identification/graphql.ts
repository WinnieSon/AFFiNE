export const userIdentificationsQuery = {
  id: 'userIdentificationsQuery' as const,
  op: 'userIdentifications',
  query: `query userIdentifications($workspaceId: String!) {
    userIdentifications(workspaceId: $workspaceId) {
      id
      workspaceId
      userId
      nickname
      title
      email
      imagesData
      imageData
      imageType
      createdAt
      updatedAt
    }
  }`,
};

export const userIdentificationQuery = {
  id: 'userIdentificationQuery' as const,
  op: 'userIdentification',
  query: `query userIdentification($id: ID!) {
    userIdentification(id: $id) {
      id
      workspaceId
      userId
      nickname
      title
      email
      imagesData
      imageData
      imageType
      createdAt
      updatedAt
    }
  }`,
};

export const createUserIdentificationMutation = {
  id: 'createUserIdentificationMutation' as const,
  op: 'createUserIdentification',
  query: `mutation createUserIdentification($input: CreateUserIdentificationInput!) {
    createUserIdentification(input: $input) {
      id
      workspaceId
      userId
      nickname
      title
      email
      imagesData
      createdAt
      updatedAt
    }
  }`,
};

export const updateUserIdentificationMutation = {
  id: 'updateUserIdentificationMutation' as const,
  op: 'updateUserIdentification',
  query: `mutation updateUserIdentification($input: UpdateUserIdentificationInput!) {
    updateUserIdentification(input: $input) {
      id
      workspaceId
      userId
      nickname
      title
      email
      imagesData
      createdAt
      updatedAt
    }
  }`,
};

export const deleteUserIdentificationMutation = {
  id: 'deleteUserIdentificationMutation' as const,
  op: 'deleteUserIdentification',
  query: `mutation deleteUserIdentification($id: ID!) {
    deleteUserIdentification(id: $id)
  }`,
};
