// src/i18n/dict/ ichidagi barcha fayllar avtomatik birlashtiriladi (har biri [uz, ru, en, tr] qatorlar massivini export qiladi).
const modules = import.meta.glob('./*.js', { eager: true });

const rows = Object.entries(modules)
  .filter(([path]) => !path.endsWith('/index.js'))
  .flatMap(([, m]) => m.default || []);

export default rows;
