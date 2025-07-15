import { Button, Input, Modal, notify } from '@affine/component';
import { useI18n } from '@affine/i18n';
import { DeleteIcon, ImageIcon, PlusIcon } from '@blocksuite/icons/rc';
import { useCallback, useEffect, useRef, useState } from 'react';

import * as styles from './edit-modal.css';
import {
  useCreateUserIdentification,
  useDeleteUserIdentification,
  useUpdateUserIdentification,
  useUserIdentification,
} from './use-user-identifications';

interface UserIdentificationEditModalProps {
  workspaceId: string;
  identificationId: string | null;
  isCreating: boolean;
  onClose: () => void;
}

export const UserIdentificationEditModal = ({
  workspaceId,
  identificationId,
  isCreating,
  onClose,
}: UserIdentificationEditModalProps) => {
  const t = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: existingData, loading: dataLoading } = useUserIdentification(
    isCreating ? null : identificationId
  );
  const { create, loading: createLoading } = useCreateUserIdentification();
  const { update, loading: updateLoading } = useUpdateUserIdentification();
  const { delete: deleteIdentification, loading: deleteLoading } =
    useDeleteUserIdentification();

  const [formData, setFormData] = useState({
    nickname: '',
    title: '',
    email: '',
    imagesData: [] as string[],
  });

  useEffect(() => {
    if (isCreating) {
      // Reset form for creation
      setFormData({
        nickname: '',
        title: '',
        email: '',
        imagesData: [],
      });
    }
  }, [isCreating]);

  useEffect(() => {
    if (!isCreating && existingData?.userIdentification) {
      const { nickname, title, email, imagesData, imageData } =
        existingData.userIdentification;

      // Handle both new format (imagesData) and legacy format (imageData)
      let images: string[] = [];
      if (imagesData && imagesData.length > 0) {
        images = imagesData;
      } else if (imageData) {
        // Convert legacy single image to array format
        images = [imageData];
      }

      setFormData({
        nickname: nickname || '',
        title: title || '',
        email: email || '',
        imagesData: images,
      });
    }
  }, [
    existingData?.userIdentification?.id,
    isCreating,
    existingData?.userIdentification,
  ]); // Only depend on ID to prevent loops

  const handleImageSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);

      if (files.length === 0) return;

      // Check total images limit (current + new)
      if (formData.imagesData.length + files.length > 10) {
        notify.error({
          message:
            t['Maximum 10 images allowed']() || 'Maximum 10 images allowed',
        });
        return;
      }

      const processFiles = files.map(file => {
        return new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
              // Create canvas to resize image
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');

              // Set max dimensions
              const maxWidth = 200;
              const maxHeight = 200;
              let width = img.width;
              let height = img.height;

              // Calculate new dimensions
              if (width > height) {
                if (width > maxWidth) {
                  height = (height * maxWidth) / width;
                  width = maxWidth;
                }
              } else {
                if (height > maxHeight) {
                  width = (width * maxHeight) / height;
                  height = maxHeight;
                }
              }

              canvas.width = width;
              canvas.height = height;

              // Draw and compress image
              ctx?.drawImage(img, 0, 0, width, height);
              const compressedData = canvas.toDataURL('image/jpeg', 0.7);
              resolve(compressedData);
            };
            img.src = reader.result as string;
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(processFiles)
        .then(newImages => {
          setFormData(prev => ({
            ...prev,
            imagesData: [...prev.imagesData, ...newImages],
          }));
        })
        .catch(error => {
          console.error('Error processing images:', error);
        });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [formData.imagesData.length, t]
  );

  const handleRemoveImage = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      imagesData: prev.imagesData.filter((_, i) => i !== index),
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (formData.imagesData.length === 0) {
      notify.error({
        title:
          t[
            'com.affine.settings.workspace.user-identification.error.no-image'
          ](),
      });
      return;
    }

    try {
      if (isCreating) {
        await create({
          workspaceId,
          ...formData,
          // userId will be set automatically by backend
        });
        notify.success({
          title:
            t[
              'com.affine.settings.workspace.user-identification.success.created'
            ](),
        });
      } else if (identificationId) {
        await update({
          id: identificationId,
          ...formData,
        });
        notify.success({
          title:
            t[
              'com.affine.settings.workspace.user-identification.success.updated'
            ](),
        });
      }
      onClose();
    } catch (error) {
      notify.error({
        title: t['com.affine.error.unexpected-error'](),
      });
    }
  }, [
    formData,
    isCreating,
    identificationId,
    workspaceId,
    create,
    update,
    onClose,
    t,
  ]);

  const handleDelete = useCallback(async () => {
    if (!identificationId) return;

    if (
      window.confirm(
        t['com.affine.settings.workspace.user-identification.confirm-delete']()
      )
    ) {
      try {
        await deleteIdentification(identificationId);
        notify.success({
          title:
            t[
              'com.affine.settings.workspace.user-identification.success.deleted'
            ](),
        });
        onClose();
      } catch (error) {
        notify.error({
          title: t['com.affine.error.unexpected-error'](),
        });
      }
    }
  }, [identificationId, deleteIdentification, onClose, t]);

  const isLoading = createLoading || updateLoading || deleteLoading;

  // Don't render until data is loaded (for edit mode)
  if (!isCreating && dataLoading) {
    return null;
  }

  return (
    <Modal
      open
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
      width={480}
      contentOptions={{
        className: styles.modalContent,
      }}
    >
      <div className={styles.modalHeader}>
        <h2 className={styles.modalTitle}>
          {isCreating
            ? t[
                'com.affine.settings.workspace.user-identification.modal.title.create'
              ]()
            : t[
                'com.affine.settings.workspace.user-identification.modal.title.edit'
              ]()}
        </h2>
      </div>

      <div className={styles.modalBody}>
        <div className={styles.imageSection}>
          <div className={styles.imageGallery}>
            {formData.imagesData.map((imageData, index) => (
              <div key={index} className={styles.imagePreview}>
                <img
                  src={imageData}
                  alt={`Image ${index + 1}`}
                  className={styles.previewImage}
                />
                <button
                  type="button"
                  className={styles.removeImageButton}
                  onClick={() => handleRemoveImage(index)}
                  disabled={isLoading}
                >
                  <DeleteIcon />
                </button>
              </div>
            ))}

            {formData.imagesData.length < 10 && (
              <div
                className={styles.addImageButton}
                onClick={handleImageSelect}
              >
                <PlusIcon />
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className={styles.fileInput}
          />
        </div>

        <div className={styles.formSection}>
          <div className={styles.formField}>
            <label className={styles.label}>
              {t[
                'com.affine.settings.workspace.user-identification.modal.nickname'
              ]()}
            </label>
            <Input
              value={formData.nickname}
              onChange={value =>
                setFormData(prev => ({ ...prev, nickname: value }))
              }
              placeholder={t[
                'com.affine.settings.workspace.user-identification.modal.nickname.placeholder'
              ]()}
              disabled={isLoading}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.label}>
              {t[
                'com.affine.settings.workspace.user-identification.modal.title'
              ]()}
            </label>
            <Input
              value={formData.title}
              onChange={value =>
                setFormData(prev => ({ ...prev, title: value }))
              }
              placeholder={t[
                'com.affine.settings.workspace.user-identification.modal.title.placeholder'
              ]()}
              disabled={isLoading}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.label}>
              {t[
                'com.affine.settings.workspace.user-identification.modal.email'
              ]()}
            </label>
            <Input
              value={formData.email}
              onChange={value =>
                setFormData(prev => ({ ...prev, email: value }))
              }
              placeholder={t[
                'com.affine.settings.workspace.user-identification.modal.email.placeholder'
              ]()}
              type="email"
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      <div className={styles.modalFooter}>
        {!isCreating && (
          <Button
            variant="error"
            prefix={<DeleteIcon />}
            onClick={() => {
              handleDelete().catch(console.error);
            }}
            disabled={isLoading}
          >
            {t['Delete']()}
          </Button>
        )}
        <div className={styles.footerActions}>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {t['Cancel']()}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              handleSave().catch(console.error);
            }}
            disabled={isLoading || formData.imagesData.length === 0}
          >
            {isCreating ? t['Create']() : t['Save']()}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
