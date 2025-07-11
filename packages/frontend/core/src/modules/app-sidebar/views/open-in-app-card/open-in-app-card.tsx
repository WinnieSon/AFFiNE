import { Button, Checkbox, IconButton } from '@affine/component';
import {
  OpenInAppService,
  OpenLinkMode,
} from '@affine/core/modules/open-in-app';
import { appIconMap } from '@affine/core/utils';
import { Trans, useI18n } from '@affine/i18n';
import { CloseIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useState } from 'react';

import * as styles from './open-in-app-card.css';

export const OpenInAppCard = () => {
  // Open in app card disabled
  return null;
};