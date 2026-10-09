// Yuklanadigan material turlari: chap menyu, yuklash formasi va ko'rish sahifasi uchun umumiy sozlamalar.
export const MEDIA_META = {
  audio: {
    icon: '🎵',
    label: 'Musiqa va audio',
    short: 'Musiqa',
    accept: 'audio/*,.mp3,.m4a,.ogg,.wav,.aac',
    hint: "MP3, M4A, OGG, WAV · bir nechta faylni birdan tanlash mumkin · har biri ≤ 50 MB",
    multiple: true,
    needsFile: true,
    textLabel: "Qo'shiq matni / transkript (ixtiyoriy)",
  },
  video: {
    icon: '🎬',
    label: 'Videolar',
    short: 'Video',
    accept: 'video/*,.mp4,.webm,.mov',
    hint: 'MP4, WEBM · har biri ≤ 50 MB',
    multiple: true,
    needsFile: true,
    textLabel: 'Izoh / subtitr matni (ixtiyoriy)',
  },
  image: {
    icon: '🖼️',
    label: 'Rasmlar',
    short: 'Rasmlar',
    accept: 'image/*',
    hint: 'JPG, PNG, WEBP, GIF · bir nechta rasmni birdan yuklash mumkin',
    multiple: true,
    needsFile: true,
    textLabel: 'Rasm tagidagi izoh (ixtiyoriy)',
  },
  dialog: {
    icon: '💬',
    label: 'Dialoglar',
    short: 'Dialoglar',
    accept: '.txt,.docx,.pdf',
    hint: "Har qatorda: «A: Hello! | Salom!» · ixtiyoriy audio fayl ham biriktirish mumkin",
  },
  vocab: {
    icon: '📚',
    label: "Lug'atlar",
    short: "Lug'atlar",
    accept: '.txt,.docx,.pdf',
    hint: "Har qatorda: «so'z — tarjima» yoki «so'z ; talaffuz ; tarjima» · lug'at mashqiga avtomatik qo'shiladi",
  },
  text: {
    icon: '📄',
    label: 'Matnlar',
    short: 'Matnlar',
    accept: '.txt,.docx,.pdf',
    hint: "PDF, DOCX yoki TXT — matn ajratib olinadi va ovoz bilan o'qish mumkin bo'ladi",
  },
  news: {
    icon: '📰',
    label: 'Yangiliklar',
    short: 'Yangiliklar',
    accept: 'image/*',
    hint: "E'lon matni · ixtiyoriy rasm",
    textLabel: "Yangilik matni",
  },
};

export const MEDIA_ORDER = ['news', 'audio', 'video', 'dialog', 'vocab', 'text', 'image'];
