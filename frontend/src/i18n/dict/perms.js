// Adminlarning funksiya ruxsatlari ("Mening ruxsatlarim", "Ruxsatlar"), Telegram bot orqali ro'yxatdan o'tish va parolni Telegram orqali tiklash.
// Qator: [uz, ru, en, tr]
export default [
  // ---------- Mening ruxsatlarim (profil) ----------
  [`Ruxsat bor`, `Доступ есть`, `Allowed`, `İzin var`],
  [`🔐 Mening ruxsatlarim`, `🔐 Мои права`, `🔐 My permissions`, `🔐 İzinlerim`],
  [`Mening ruxsatlarim`, `Мои права`, `My permissions`, `İzinlerim`],
  [`Ruxsatlarni serverdan qayta yuklash`, `Перезагрузить права с сервера`, `Reload permissions from the server`, `İzinleri sunucudan yeniden yükle`],
  [
    `Siz super adminsiz — hamma bo'limga va hamma funksiyaga ruxsatingiz bor. Adminlarning ruxsatlarini «🔐 Ruxsatlar» bo'limida belgilaysiz.`,
    `Вы супер-админ — у вас есть доступ ко всем разделам и функциям. Права администраторов задаются в разделе «🔐 Права».`,
    `You are the super admin — you have access to every section and function. You set the admins’ permissions in the “🔐 Permissions” section.`,
    `Süper yöneticisiniz — tüm bölümlere ve işlevlere erişiminiz var. Yöneticilerin izinlerini «🔐 İzinler» bölümünde belirlersiniz.`,
  ],
  [
    `Sizning ma'lumotlaringiz (login, email, telefon) boshqa hech kimga — adminlarga ham — ko'rinmaydi.`,
    `Ваши данные (логин, email, телефон) не видит никто другой — в том числе администраторы.`,
    `Your details (login, email, phone) are not visible to anyone else — admins included.`,
    `Bilgileriniz (kullanıcı adı, e-posta, telefon) başka hiç kimseye — yöneticilere de — görünmez.`,
  ],
  [
    `Super admin sizga quyidagi ruxsatlarni bergan. Yangi ruxsat kerak bo'lsa, super admin bilan bog'laning.`,
    `Супер-админ выдал вам следующие права. Если нужны новые, свяжитесь с супер-админом.`,
    `The super admin has granted you the permissions below. If you need more, contact the super admin.`,
    `Süper yönetici size aşağıdaki izinleri verdi. Yenisi gerekirse süper yöneticiyle iletişime geçin.`,
  ],
  [`📤 Material yuklash`, `📤 Загрузка материалов`, `📤 Uploading materials`, `📤 Materyal yükleme`],
  [`⚙️ Funksiyalar`, `⚙️ Функции`, `⚙️ Functions`, `⚙️ İşlevler`],
  [`{a}/{b} funksiya`, `{a}/{b} функций`, `{a}/{b} functions`, `{a}/{b} işlev`],
  [`🔒 Faqat super admin uchun (sizda yo'q)`, `🔒 Только для супер-админа (у вас нет)`, `🔒 Super admin only (you don’t have these)`, `🔒 Yalnızca süper yönetici (sizde yok)`],

  // ---------- Funksiya ruxsatlari ----------
  [`O'quvchilarni ko'rish`, `Просмотр учеников`, `View students`, `Öğrencileri görüntüleme`],
  [`O'quvchilar ro'yxati, qidiruv va har birining progressi`, `Список учеников, поиск и прогресс каждого`, `Student list, search and each student’s progress`, `Öğrenci listesi, arama ve her birinin ilerlemesi`],
  [`O'quvchi qo'shish`, `Добавление учеников`, `Add students`, `Öğrenci ekleme`],
  [`Yangi o'quvchi hisobini ochish (admin qo'sha olmaydi)`, `Создание аккаунта ученика (админов добавлять нельзя)`, `Create a student account (admins cannot be added)`, `Yeni öğrenci hesabı açma (yönetici eklenemez)`],
  [`O'quvchini bloklash va blokdan chiqarish`, `Блокировка и разблокировка ученика`, `Block and unblock a student`, `Öğrenciyi engelleme ve engeli kaldırma`],
  [`O'quvchiga yangi parol belgilash`, `Установка нового пароля ученику`, `Set a new password for a student`, `Öğrenciye yeni parola belirleme`],
  [`O'quvchini o'chirish`, `Удаление ученика`, `Delete a student`, `Öğrenciyi silme`],
  [`O'quvchi hisobini butunlay o'chirish`, `Полное удаление аккаунта ученика`, `Permanently delete a student account`, `Öğrenci hesabını tamamen silme`],
  [`AI va API kalitlarni ko'rish`, `Просмотр AI и API-ключей`, `View AI and API keys`, `AI ve API anahtarlarını görüntüleme`],
  [
    `AI holati va kalitlar ro'yxati (kalitlar maskalangan, o'zgartirib bo'lmaydi)`,
    `Состояние AI и список ключей (ключи скрыты, изменять нельзя)`,
    `AI status and key list (keys are masked and cannot be changed)`,
    `AI durumu ve anahtar listesi (anahtarlar gizlidir, değiştirilemez)`,
  ],
  [`Email xizmati holatini ko'rish`, `Просмотр состояния почтового сервиса`, `View email service status`, `E-posta hizmeti durumunu görüntüleme`],
  [`Email xizmati sozlanganmi — faqat holat, sozlash mumkin emas`, `Настроен ли почтовый сервис — только статус, изменять нельзя`, `Whether the email service is set up — status only, no changes`, `E-posta hizmeti kurulu mu — yalnızca durum, ayar değiştirilemez`],
  [`Statistikani ko'rish`, `Просмотр статистики`, `View statistics`, `İstatistikleri görüntüleme`],
  [`Materiallar, AI va kurs kontenti bo'yicha umumiy raqamlar`, `Общие цифры по материалам, AI и содержимому курса`, `Overall numbers for materials, AI and course content`, `Materyaller, AI ve kurs içeriği için genel sayılar`],
  [`👥 O'quvchilar bilan ishlash`, `👥 Работа с учениками`, `👥 Working with students`, `👥 Öğrencilerle çalışma`],
  [`👁️ Ko'rish`, `👁️ Просмотр`, `👁️ Viewing`, `👁️ Görüntüleme`],

  // ---------- Faqat super admin ----------
  [`Adminlarni qo'shish, rol berish va ularning ruxsatlarini belgilash`, `Добавление администраторов, назначение ролей и настройка их прав`, `Adding admins, assigning roles and setting their permissions`, `Yönetici ekleme, rol verme ve izinlerini belirleme`],
  [`Ro'yxatdan o'tish usullari va Telegram botni sozlash`, `Способы регистрации и настройка Telegram-бота`, `Sign-up methods and Telegram bot setup`, `Kayıt yöntemleri ve Telegram botu ayarları`],
  [`AI sozlamalari va API kalitlarni qo'shish / o'zgartirish / o'chirish`, `Настройки AI и добавление / изменение / удаление API-ключей`, `AI settings and adding / editing / deleting API keys`, `AI ayarları ve API anahtarlarını ekleme / değiştirme / silme`],
  [`Email xizmatini sozlash`, `Настройка почтового сервиса`, `Setting up the email service`, `E-posta hizmetini ayarlama`],
  [`Super admin va boshqa adminlarning ma'lumotlarini ko'rish`, `Просмотр данных супер-админа и других администраторов`, `Seeing the super admin’s and other admins’ details`, `Süper yöneticinin ve diğer yöneticilerin bilgilerini görme`],

  // ---------- Ruxsatlar bo'limi (super admin) ----------
  [`🔐 Adminlarning ruxsatlari`, `🔐 Права администраторов`, `🔐 Admin permissions`, `🔐 Yöneticilerin izinleri`],
  [
    `Har bir admin nimalarga ruxsati borligini shu yerda belgilaysiz: **material yuklash** (bo'limlar bo'yicha) va **funksiyalar** (o'quvchilarni ko'rish va boshqarish, AI, email, statistika). Belgilanmagan narsani admin ko'ra olmaydi yoki bajara olmaydi. Siz — super admin — hammasiga egasiz.`,
    `Здесь вы задаёте, что разрешено каждому администратору: **загрузка материалов** (по разделам) и **функции** (просмотр и управление учениками, AI, email, статистика). Неотмеченное администратор не увидит и не сможет сделать. Вы — супер-админ — имеете доступ ко всему.`,
    `Here you decide what each admin may do: **uploading materials** (per section) and **functions** (viewing and managing students, AI, email, statistics). Anything not ticked, the admin can neither see nor do. You — the super admin — can do everything.`,
    `Her yöneticinin neleri yapabileceğini burada belirlersiniz: **materyal yükleme** (bölümlere göre) ve **işlevler** (öğrencileri görüntüleme ve yönetme, AI, e-posta, istatistik). İşaretlenmeyeni yönetici göremez ve yapamaz. Siz — süper yönetici — her şeye sahipsiniz.`,
  ],
  [
    `Ruxsat serverda va bazada darhol kuchga kiradi; adminning ekranidagi bo'limlar sahifa yangilanganda yangilanadi. Admin o'z ruxsatlarini profilidagi «🔐 Mening ruxsatlarim» bo'limida ko'radi.`,
    `Права вступают в силу на сервере и в базе сразу; разделы на экране администратора обновятся после обновления страницы. Свои права администратор видит в профиле, в блоке «🔐 Мои права».`,
    `Permissions take effect on the server and in the database immediately; the sections on the admin’s screen update when they refresh the page. Admins see their own permissions in their profile under “🔐 My permissions”.`,
    `İzinler sunucuda ve veritabanında hemen geçerli olur; yöneticinin ekranındaki bölümler sayfa yenilenince güncellenir. Yönetici kendi izinlerini profilindeki «🔐 İzinlerim» bölümünde görür.`,
  ],
  [`🔒 Faqat super admin uchun — hech kimga berilmaydi`, `🔒 Только для супер-админа — никому не выдаётся`, `🔒 Super admin only — never granted to anyone`, `🔒 Yalnızca süper yönetici için — kimseye verilmez`],
  [
    `Admin o'quvchilarni faqat siz ruxsat bergan darajada ko'radi va boshqaradi; super admin hamda boshqa adminlar ro'yxatda ko'rinmaydi.`,
    `Администратор видит и ведёт учеников только в пределах выданных вами прав; супер-админ и другие администраторы в списке не отображаются.`,
    `An admin sees and manages students only as far as you allow; the super admin and other admins never appear in the list.`,
    `Yönetici öğrencileri yalnızca sizin verdiğiniz ölçüde görür ve yönetir; süper yönetici ve diğer yöneticiler listede görünmez.`,
  ],

  // ---------- Foydalanuvchilar (admin ko'rinishi) ----------
  [`O'quvchilar {user} · bugun faol {today}`, `Учеников {user} · сегодня активны {today}`, `Students {user} · active today {today}`, `Öğrenci {user} · bugün aktif {today}`],
  [`{a} o'quvchi`, `{a} учеников`, `{a} students`, `{a} öğrenci`],
  [`+ O'quvchi qo'shish`, `+ Добавить ученика`, `+ Add a student`, `+ Öğrenci ekle`],
  [
    `Ruxsatlari: hamma bo'limga yuklash va faqat ko'rish funksiyalari (AI, email, statistika) — "🔐 Ruxsatlar" bo'limida o'zgartiring.`,
    `Права: загрузка во все разделы и только функции просмотра (AI, email, статистика) — измените их в разделе «🔐 Права».`,
    `Permissions: upload to every section and view-only functions (AI, email, statistics) — change them in the “🔐 Permissions” section.`,
    `İzinleri: tüm bölümlere yükleme ve yalnızca görüntüleme işlevleri (AI, e-posta, istatistik) — «🔐 İzinler» bölümünden değiştirin.`,
  ],
  [
    `Admin qilindi. Hozircha hamma bo'limga yuklash va faqat ko'rish funksiyalari berilgan — "🔐 Ruxsatlar" bo'limida cheklashingiz yoki kengaytirishingiz mumkin.`,
    `Назначен администратором. Пока выданы загрузка во все разделы и только функции просмотра — ограничить или расширить права можно в разделе «🔐 Права».`,
    `Made an admin. For now they can upload to every section and use view-only functions — you can narrow or widen this in the “🔐 Permissions” section.`,
    `Yönetici yapıldı. Şimdilik tüm bölümlere yükleme ve yalnızca görüntüleme işlevleri verildi — «🔐 İzinler» bölümünde kısıtlayabilir veya genişletebilirsiniz.`,
  ],
  [`O'quvchiga aylantirildi (ruxsatlari olib tashlandi)`, `Переведён в ученики (права сняты)`, `Changed to a student (permissions removed)`, `Öğrenciye dönüştürüldü (izinleri kaldırıldı)`],

  // ---------- Admin bosh sahifasi ----------
  [`{a} ta bo'limga yuklash va {b} ta funksiya ruxsat etilgan.`, `Загрузка разрешена в разделах: {a}; включено функций: {b}.`, `Upload allowed in {a} sections and {b} functions enabled.`, `{a} bölüme yükleme ve {b} işleve izin verildi.`],
  [`Batafsil →`, `Подробнее →`, `Details →`, `Ayrıntılar →`],

  // ---------- Ro'yxatdan o'tish bo'limi: Telegram usuli ----------
  [
    `✅ Bot ulandi. Endi «Telegram bot orqali (bepul)» usulini yoki telefon uchun Telegram tasdiqlashni yoqishingiz mumkin.`,
    `✅ Бот подключён. Теперь можно включить способ «Через Telegram-бота (бесплатно)» или подтверждение телефона через Telegram.`,
    `✅ Bot connected. You can now turn on the “Via the Telegram bot (free)” method or Telegram phone verification.`,
    `✅ Bot bağlandı. Artık «Telegram botuyla (ücretsiz)» yöntemini veya telefon için Telegram doğrulamasını açabilirsiniz.`,
  ],
  [
    `Telegram bot uzilsinmi? Telegram orqali ro'yxatdan o'tish va tasdiqlash o'chadi.`,
    `Отключить Telegram-бота? Регистрация и подтверждение через Telegram перестанут работать.`,
    `Disconnect the Telegram bot? Sign-up and verification via Telegram will stop working.`,
    `Telegram botunun bağlantısı kesilsin mi? Telegram ile kayıt ve doğrulama durur.`,
  ],
  [`Telegram bot orqali (bepul)`, `Через Telegram-бота (бесплатно)`, `Via the Telegram bot (free)`, `Telegram botuyla (ücretsiz)`],
  [`Bepul`, `Бесплатно`, `Free`, `Ücretsiz`],
  [
    `Foydalanuvchi ro'yxatdan o'tish sahifasidagi tugma orqali botni ochadi va «Raqamni ulashish» ni bosadi — raqami avtomatik tasdiqlanadi, kod yozish shart emas. Keyin saytda ism va parol kiritadi.`,
    `Пользователь открывает бота кнопкой на странице регистрации и нажимает «Поделиться номером» — номер подтверждается автоматически, вводить код не нужно. Затем на сайте вводит имя и пароль.`,
    `The user opens the bot with the button on the sign-up page and taps “Share number” — the number is verified automatically, no code to type. Then they enter a name and password on the site.`,
    `Kullanıcı kayıt sayfasındaki düğmeyle botu açar ve «Numarayı paylaş»a basar — numara otomatik doğrulanır, kod yazmak gerekmez. Ardından sitede ad ve parola girer.`,
  ],
  [
    `Bot ikki ish qiladi: telefon raqamini tasdiqlaydi (kod Telegramga yuboriladi) va Telegram orqali ro'yxatdan o'tishga imkon beradi. Botni bir marta ulaysiz — keyin hammasi avtomatik ishlaydi.`,
    `Бот выполняет две задачи: подтверждает номер телефона (код приходит в Telegram) и позволяет регистрироваться через Telegram. Бота подключаете один раз — дальше всё работает автоматически.`,
    `The bot does two jobs: it verifies phone numbers (the code is sent to Telegram) and lets people sign up through Telegram. You connect it once — after that everything runs automatically.`,
    `Bot iki iş yapar: telefon numarasını doğrular (kod Telegram'a gönderilir) ve Telegram üzerinden kayda izin verir. Botu bir kez bağlarsınız — sonrası otomatik çalışır.`,
  ],
  [
    `Kerakli usulni yoqing: yuqorida «Telegram bot orqali (bepul)» yoki «Telefon raqami bilan» ichida «Telegram bot orqali tasdiqlash».`,
    `Включите нужный способ: выше «Через Telegram-бота (бесплатно)» или внутри «По номеру телефона» — «Подтверждение через Telegram-бота».`,
    `Turn on the method you need: “Via the Telegram bot (free)” above, or “Verify via the Telegram bot” inside “With a phone number”.`,
    `İstediğiniz yöntemi açın: yukarıdaki «Telegram botuyla (ücretsiz)» veya «Telefon numarasıyla» içindeki «Telegram botuyla doğrulama».`,
  ],
  [
    `Token faqat serverda saqlanadi va brauzerga hech qachon yuborilmaydi. Bot foydalanuvchiga o'zi birinchi yoza olmaydi — foydalanuvchi sayt bergan havola orqali botni bir marta ochishi kerak. Raqami botda bir marta tasdiqlangan foydalanuvchiga keyingi kodlar Telegramga darhol yuboriladi (parolni tiklash ham shu orqali ishlaydi).`,
    `Токен хранится только на сервере и никогда не отправляется в браузер. Бот не может написать пользователю первым — пользователь должен один раз открыть бота по ссылке с сайта. Тем, чей номер уже подтверждён в боте, следующие коды сразу приходят в Telegram (так же работает и восстановление пароля).`,
    `The token is stored only on the server and never sent to the browser. The bot cannot message a user first — the user must open it once via the link from the site. Once a number is verified in the bot, later codes go straight to Telegram (password recovery works this way too).`,
    `Belirteç yalnızca sunucuda saklanır ve tarayıcıya asla gönderilmez. Bot kullanıcıya ilk mesajı yazamaz — kullanıcı siteden gelen bağlantıyla botu bir kez açmalıdır. Numarası botta bir kez doğrulanan kullanıcıya sonraki kodlar doğrudan Telegram'a gider (parola kurtarma da bu şekilde çalışır).`,
  ],

  // ---------- Ro'yxatdan o'tish sahifasi: Telegram bot ----------
  [`Telegram orqali · bepul`, `Через Telegram · бесплатно`, `Via Telegram · free`, `Telegram ile · ücretsiz`],
  [`Deyarli tayyor`, `Почти готово`, `Almost done`, `Neredeyse hazır`],
  [`Telegram bot orqali ro'yxatdan o'tish`, `Регистрация через Telegram-бота`, `Sign up with the Telegram bot`, `Telegram botuyla kayıt ol`],
  [`← Boshqa usulni tanlash`, `← Выбрать другой способ`, `← Choose another method`, `← Başka bir yöntem seç`],
  [`✅ Telegramda raqamingiz tasdiqlandi: {phone}`, `✅ Номер подтверждён в Telegram: {phone}`, `✅ Your number is verified in Telegram: {phone}`, `✅ Numaranız Telegram'da doğrulandı: {phone}`],
  [`Keyin telefon raqamingiz va shu parol bilan kirasiz.`, `Затем вы будете входить по номеру телефона и этому паролю.`, `Afterwards you will sign in with your phone number and this password.`, `Sonra telefon numaranız ve bu parolayla giriş yaparsınız.`],
  [`Hisob yaratish →`, `Создать аккаунт →`, `Create account →`, `Hesap oluştur →`],
  [
    `«Telegramni ochish» tugmasini bosing — bot ochiladi (ochilmagan bo'lsa, pastdagi tugmadan foydalaning).`,
    `Нажмите «Открыть Telegram» — откроется бот (если не открылся, воспользуйтесь кнопкой ниже).`,
    `Press “Open Telegram” — the bot opens (if it didn’t, use the button below).`,
    `«Telegram'ı aç» düğmesine basın — bot açılır (açılmadıysa aşağıdaki düğmeyi kullanın).`,
  ],
  [
    `Shu sahifaga qayting — ro'yxatdan o'tish avtomatik davom etadi. Kod yozish shart emas.`,
    `Вернитесь на эту страницу — регистрация продолжится автоматически. Вводить код не нужно.`,
    `Come back to this page — sign-up continues automatically. No code to type.`,
    `Bu sayfaya dönün — kayıt otomatik devam eder. Kod yazmanız gerekmez.`,
  ],
  [`So'rov muddati tugadi.`, `Срок запроса истёк.`, `The request has expired.`, `İsteğin süresi doldu.`],
  [`Botda raqamingiz tasdiqlanishi kutilmoqda…`, `Ожидаем подтверждения номера в боте…`, `Waiting for your number to be verified in the bot…`, `Numaranızın botta doğrulanması bekleniyor…`],
  [
    `Raqamingiz botda avval tasdiqlangan bo'lsa, kod Telegramga darhol keladi; aks holda bir marta botni ochasiz.`,
    `Если номер уже подтверждён в боте, код сразу придёт в Telegram; иначе один раз откроете бота.`,
    `If your number was already verified in the bot, the code arrives in Telegram right away; otherwise you open the bot once.`,
    `Numaranız botta daha önce doğrulandıysa kod hemen Telegram'a gelir; aksi halde botu bir kez açarsınız.`,
  ],
  [`✈️ Telegram botni ochish`, `✈️ Открыть Telegram-бота`, `✈️ Open the Telegram bot`, `✈️ Telegram botunu aç`],
  [`yoki Telegram orqali`, `или через Telegram`, `or via Telegram`, `veya Telegram ile`],
  [`✈️ Telegram bot orqali ro'yxatdan o'tish (bepul)`, `✈️ Регистрация через Telegram-бота (бесплатно)`, `✈️ Sign up with the Telegram bot (free)`, `✈️ Telegram botuyla kayıt ol (ücretsiz)`],
  [
    `Kod yozish shart emas: botda «Start» va «Raqamni ulashish» tugmalarini bosasiz, xolos.`,
    `Вводить код не нужно: в боте достаточно нажать «Start» и «Поделиться номером».`,
    `No code to type: in the bot you just press “Start” and “Share number”.`,
    `Kod yazmanız gerekmez: botta yalnızca «Start» ve «Numarayı paylaş» düğmelerine basarsınız.`,
  ],
  [`🤖 Telegram botga o'tish · @{bot}`, `🤖 Перейти к Telegram-боту · @{bot}`, `🤖 Go to the Telegram bot · @{bot}`, `🤖 Telegram botuna git · @{bot}`],

  // ---------- Parolni Telegram orqali tiklash ----------
  [`← Raqamni o'zgartirish`, `← Изменить номер`, `← Change the number`, `← Numarayı değiştir`],
  [`✈️ Kod Telegramdagi bot chatiga yuborildi (10 daqiqa amal qiladi).`, `✈️ Код отправлен в чат с ботом в Telegram (действует 10 минут).`, `✈️ The code was sent to the bot chat in Telegram (valid for 10 minutes).`, `✈️ Kod Telegram'daki bot sohbetine gönderildi (10 dakika geçerlidir).`],
  [`Tiklash usuli`, `Способ восстановления`, `Recovery method`, `Kurtarma yöntemi`],
  [`✈️ Telegram`, `✈️ Telegram`, `✈️ Telegram`, `✈️ Telegram`],
  [`Ro'yxatdan o'tgan telefon raqamingiz`, `Ваш зарегистрированный номер телефона`, `Your registered phone number`, `Kayıtlı telefon numaranız`],
  [
    `Kod shu raqam Telegram botda tasdiqlangan chatga yuboriladi. Raqamingiz botda hech qachon tasdiqlanmagan bo'lsa, bu usul ishlamaydi — administratorga murojaat qiling.`,
    `Код придёт в чат, где этот номер подтверждён в Telegram-боте. Если номер ни разу не подтверждался в боте, способ не сработает — обратитесь к администратору.`,
    `The code goes to the chat where this number was verified in the Telegram bot. If your number was never verified in the bot, this method won’t work — contact the administrator.`,
    `Kod, bu numaranın Telegram botunda doğrulandığı sohbete gönderilir. Numaranız botta hiç doğrulanmadıysa bu yöntem çalışmaz — yöneticiyle iletişime geçin.`,
  ],
  [`Telegramga kod yuborish`, `Отправить код в Telegram`, `Send the code to Telegram`, `Telegram'a kod gönder`],

  // ---------- Telegram tasdiqlash: kod darhol yuborilganda ----------
  [`✈️ Kod Telegramga yuborildi`, `✈️ Код отправлен в Telegram`, `✈️ The code was sent to Telegram`, `✈️ Kod Telegram'a gönderildi`],
  [
    `Telegramdagi bot chatiga 6 xonali kod keldi. Uni pastga kiriting (10 daqiqa amal qiladi).`,
    `В чат с ботом в Telegram пришёл 6-значный код. Введите его ниже (действует 10 минут).`,
    `A 6-digit code arrived in the bot chat in Telegram. Enter it below (valid for 10 minutes).`,
    `Telegram'daki bot sohbetine 6 haneli bir kod geldi. Aşağıya girin (10 dakika geçerlidir).`,
  ],
];
