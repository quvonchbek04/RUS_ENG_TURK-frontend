import { t } from '../i18n/index.js';

// Rol nomlari — getter: har o'qilganda joriy interfeys tilida qaytadi.
export const ROLE_LABEL = {
  get superadmin() {
    return t('Super admin');
  },
  get admin() {
    return t('Admin');
  },
  get user() {
    return t("O'quvchi");
  },
};
