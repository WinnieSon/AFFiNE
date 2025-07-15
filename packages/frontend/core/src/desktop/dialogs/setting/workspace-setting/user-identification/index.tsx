import { Button, IconButton, Skeleton } from '@affine/component';
import { SettingRow } from '@affine/component/setting-components';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { EditIcon, PlusIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useCallback, useState } from 'react';

import { UserIdentificationEditModal } from './edit-modal';
import * as styles from './styles.css';
import { useUserIdentifications } from './use-user-identifications';

export const UserIdentificationPanel = () => {
  const workspace = useService(WorkspaceService).workspace;
  const t = useI18n();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data, loading, error, mutate } = useUserIdentifications(workspace.id);

  const handleEdit = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleCreate = useCallback(() => {
    setIsCreating(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setEditingId(null);
    setIsCreating(false);
    // Revalidate the data to show new items
    mutate().catch(console.error);
  }, [mutate]);

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p>{t['com.affine.error.unexpected-error']()}</p>
      </div>
    );
  }

  const registeredUsers = data?.filter(item => item.userId) || [];
  const unidentifiedUsers = data?.filter(item => !item.userId) || [];

  return (
    <div className={styles.container}>
      <SettingRow
        name={t['com.affine.settings.workspace.user-identification.title']()}
        desc={t[
          'com.affine.settings.workspace.user-identification.description'
        ]()}
      />

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            {t[
              'com.affine.settings.workspace.user-identification.registered'
            ]()}
          </h3>
          <IconButton
            size="small"
            icon={<PlusIcon />}
            onClick={handleCreate}
            style={{
              width: 32,
              height: 32,
            }}
            tooltip={t[
              'com.affine.settings.workspace.user-identification.add'
            ]()}
          />
        </div>

        <div className={styles.userGrid}>
          {loading && !data ? (
            <>
              <Skeleton variant="circular" width={64} height={64} />
              <Skeleton variant="circular" width={64} height={64} />
              <Skeleton variant="circular" width={64} height={64} />
            </>
          ) : registeredUsers.length > 0 ? (
            registeredUsers.map(user => (
              <div key={user.id} className={styles.userItem}>
                <div
                  className={styles.userButton}
                  onClick={() => handleEdit(user.id)}
                  title={user.nickname || user.email || ''}
                >
                  <img
                    src={user.imagesData?.[0] || user.imageData || ''}
                    alt={user.nickname || ''}
                    className={styles.userImage}
                  />
                  <div className={styles.editIcon}>
                    <EditIcon />
                  </div>
                </div>
                <span className={styles.userName}>
                  {user.nickname || user.email || t['Unnamed']()}
                </span>
              </div>
            ))
          ) : (
            <p className={styles.emptyText}>
              {t[
                'com.affine.settings.workspace.user-identification.no-registered'
              ]()}
            </p>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {t[
            'com.affine.settings.workspace.user-identification.unidentified'
          ]()}
        </h3>

        <div className={styles.userGrid}>
          {loading && !data ? (
            <>
              <Skeleton variant="circular" width={64} height={64} />
              <Skeleton variant="circular" width={64} height={64} />
            </>
          ) : unidentifiedUsers.length > 0 ? (
            unidentifiedUsers.map(user => (
              <div key={user.id} className={styles.userItem}>
                <div
                  className={styles.userButton}
                  onClick={() => handleEdit(user.id)}
                >
                  <img
                    src={user.imagesData?.[0] || user.imageData || ''}
                    alt=""
                    className={styles.userImage}
                  />
                  <div className={styles.editIcon}>
                    <EditIcon />
                  </div>
                </div>
                <span className={styles.userName}>
                  {t[
                    'com.affine.settings.workspace.user-identification.unknown'
                  ]()}
                </span>
              </div>
            ))
          ) : (
            <p className={styles.emptyText}>
              {t[
                'com.affine.settings.workspace.user-identification.no-unidentified'
              ]()}
            </p>
          )}
        </div>
      </div>

      {(Boolean(editingId) || isCreating) && (
        <UserIdentificationEditModal
          key={editingId || 'create'}
          workspaceId={workspace.id}
          identificationId={editingId}
          isCreating={isCreating}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};
