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

// ---------------------------------------------------------------------------
// Adminning funksiya ruxsatlari (profiles.permissions) — faqat super admin beradi.
// Yuklash ruxsatlari (material turlari bo'yicha) alohida: lib/media.js → canUploadKind.
// Kalitlar serverdagi FUNC_PERMS (admin Edge Function) va bazadagi CHECK bilan bir xil.
// ---------------------------------------------------------------------------
export const FUNC_PERM_KEYS = ['users_view', 'users_add', 'users_block', 'users_reset', 'users_delete', 'ai_view', 'mail_view', 'stats_view'];
export const DEFAULT_ADMIN_PERMS = ['ai_view', 'mail_view', 'stats_view'];

/** Ruxsatlar ro'yxati (tavsif bilan) — har chaqirilganda joriy interfeys tilida. group: 'users' | 'view'. */
export function funcPerms() {
  return [
    { key: 'users_view', group: 'users', icon: '👁️', label: t("O'quvchilarni ko'rish"), desc: t("O'quvchilar ro'yxati, qidiruv va har birining progressi") },
    { key: 'users_add', group: 'users', icon: '➕', label: t("O'quvchi qo'shish"), desc: t("Yangi o'quvchi hisobini ochish (admin qo'sha olmaydi)") },
    { key: 'users_block', group: 'users', icon: '⛔', label: t('Bloklash'), desc: t("O'quvchini bloklash va blokdan chiqarish") },
    { key: 'users_reset', group: 'users', icon: '🔑', label: t('Parolni tiklash'), desc: t("O'quvchiga yangi parol belgilash") },
    { key: 'users_delete', group: 'users', icon: '🗑️', label: t("O'quvchini o'chirish"), desc: t("O'quvchi hisobini butunlay o'chirish") },
    { key: 'ai_view', group: 'view', icon: '🤖', label: t("AI va API kalitlarni ko'rish"), desc: t("AI holati va kalitlar ro'yxati (kalitlar maskalangan, o'zgartirib bo'lmaydi)") },
    { key: 'mail_view', group: 'view', icon: '✉️', label: t("Email xizmati holatini ko'rish"), desc: t("Email xizmati sozlanganmi — faqat holat, sozlash mumkin emas") },
    { key: 'stats_view', group: 'view', icon: '📊', label: t("Statistikani ko'rish"), desc: t('Materiallar, AI va kurs kontenti bo\'yicha umumiy raqamlar') },
  ];
}

/** Hech qachon adminga berilmaydigan imkoniyatlar — faqat super admin. */
export function superOnlyPowers() {
  return [
    { icon: '👑', label: t('Adminlarni qo\'shish, rol berish va ularning ruxsatlarini belgilash') },
    { icon: '🛡️', label: t("Ro'yxatdan o'tish usullari va Telegram botni sozlash") },
    { icon: '🔑', label: t("AI sozlamalari va API kalitlarni qo'shish / o'zgartirish / o'chirish") },
    { icon: '✉️', label: t('Email xizmatini sozlash') },
    { icon: '🔒', label: t("Super admin va boshqa adminlarning ma'lumotlarini ko'rish") },
  ];
}

/** Foydalanuvchi shu funksiyadan foydalana oladimi? Super admin — doim; admin — faqat unga berilgan; o'quvchi — hech qachon.
 *  (Haqiqiy cheklov serverda majburlanadi — bu faqat bo'lim va tugmalarni ko'rsatish/yashirish uchun.) */
export function can(user, perm) {
  if (!user) return false;
  if (user.role === 'superadmin') return true;
  return user.role === 'admin' && Array.isArray(user.permissions) && user.permissions.includes(perm);
}
