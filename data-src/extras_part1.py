# -*- coding: utf-8 -*-
# Har bir dars uchun qo'shimcha: dialog2, grammarMore, reading
# L(dialog_title, [(spk,en,uz)...], [(g_title,g_text,[(en,uz)...])...], (r_title, r_en, r_uz, [(q,a)...]))
def L(dt, dl, gm, rd):
    return {
        'dialog2': {'title': dt, 'lines': [list(x) for x in dl]},
        'grammarMore': [{'title': t, 'text': x, 'examples': [list(e) for e in ex]} for t, x, ex in gm],
        'reading': {'title': rd[0], 'text': rd[1], 'uz': rd[2], 'questions': [list(q) for q in rd[3]]},
    }

E = {}

E['m0'] = L('Meeting a new classmate',
 [('A', 'Hello! My name is Ali. What is your name?', "Salom! Mening ismim Ali. Sizning ismingiz nima?"),
  ('B', 'Hi, Ali. I am Dilya. Nice to meet you.', "Salom, Ali. Men Dilyaman. Tanishganimdan xursandman."),
  ('A', 'How do you spell your name?', "Ismingizni qanday yozasiz (harflab ayting)?"),
  ('B', 'D-I-L-Y-A.', "D-I-L-Y-A."),
  ('A', 'Thank you. Are you a new student?', "Rahmat. Siz yangi talabamisiz?"),
  ('B', 'Yes, I am. This is my first day.', "Ha. Bugun mening birinchi kunim."),
  ('A', 'Welcome! Let me show you the classroom.', "Xush kelibsiz! Sinfni ko'rsatib qo'yay."),
  ('B', 'Thank you very much!', "Katta rahmat!")],
 [('Harflarni talaffuz qilish bo\'yicha maslahat', "Ingliz alifbosida 26 harf bor, lekin tovushlar 44 ga yaqin. Shuning uchun harf nomi va tovushini alohida o'rganing: masalan, 'a' harfi 'cat' so'zida [æ], 'name' so'zida [eɪ] deb o'qiladi. Ismni harflab aytish (spelling) tanishuvda juda kerak.", [("A - B - C - D", "ey - bi - si - di"), ("My name is Bob: B-O-B.", "Mening ismim Bob: B-O-B.")]),
  ('Katta va kichik harflar', "Ingliz tilida gap boshi, shaxs ismlari, mamlakat va tillar nomi, hafta kunlari va oylar bosh harf bilan yoziladi. 'I' (men) olmoshi doim katta harf bilan yoziladi.", [("I am from Uzbekistan.", "Men O'zbekistondanman."), ("On Monday I speak English.", "Dushanba kuni men inglizcha gapiraman.")])],
 ('My first English lesson', "Today is my first English lesson. The teacher is kind. She writes the alphabet on the board. We read the letters together: A, B, C, D. Then we spell our names. I am a little shy, but I am happy.", "Bugun mening birinchi ingliz tili darsim. O'qituvchi mehribon. U doskaga alifboni yozadi. Biz harflarni birga o'qiymiz: A, B, C, D. Keyin ismlarimizni harflaymiz. Men biroz uyatchanman, lekin xursandman.",
  [("Whose first lesson is it?", "It is my first English lesson."), ("What does the teacher write on the board?", "She writes the alphabet."), ("How does the student feel?", "He/She is a little shy, but happy.")]))

E['m1'] = L('At the language centre',
 [('Admin', 'Good morning. How can I help you?', "Xayrli tong. Sizga qanday yordam bera olaman?"),
  ('Sara', 'I would like to join an English course.', "Men ingliz tili kursiga yozilmoqchiman."),
  ('Admin', 'Sure. What is your full name?', "Albatta. To'liq ismingiz nima?"),
  ('Sara', 'My name is Sara Karimova. S-A-R-A.', "Mening ismim Sara Karimova. S-A-R-A."),
  ('Admin', 'And what is your phone number?', "Telefon raqamingiz-chi?"),
  ('Sara', 'It is 90 123 45 67.', "90 123 45 67."),
  ('Admin', 'Thank you. The course starts on Monday.', "Rahmat. Kurs dushanba kuni boshlanadi."),
  ('Sara', 'Great. See you on Monday!', "Ajoyib. Dushanbagacha!")],
 [('To be fe\'li: am / is / are', "'To be' fe'li shaxsga qarab o'zgaradi: I am, he/she/it is, you/we/they are. Qisqa shakllar og'zaki nutqda ko'p ishlatiladi: I'm, he's, they're.", [("I am a student. = I'm a student.", "Men talabaman."), ("She is from Samarkand.", "U Samarqanddan.")]),
  ('Tanishuv so\'roqlari', "What is your name? (Ismingiz nima?), Where are you from? (Qayerdansiz?), How old are you? (Necha yoshdasiz?) — bular tanishuvning asosiy uchta savoli. Javobda to'liq gap ishlating.", [("Where are you from? — I am from Tashkent.", "Qayerdansiz? — Men Toshkentdanman."), ("How old are you? — I am twenty.", "Necha yoshdasiz? — Yigirma yoshdaman.")])],
 ('Meet Sara', "Sara is twenty years old. She is from Samarkand. She is a student at the university. Now she is at a language centre because she wants to speak English well. Her phone number is 90 123 45 67.", "Sara yigirma yoshda. U Samarqanddan. U universitetda talaba. Hozir u til markazida, chunki u inglizchani yaxshi gapirishni xohlaydi. Uning telefon raqami 90 123 45 67.",
  [("How old is Sara?", "She is twenty."), ("Where is she from?", "She is from Samarkand."), ("Why is she at the language centre?", "Because she wants to speak English well.")]))

E['m2'] = L('Shopping for fruit',
 [('Seller', 'Good afternoon! What do you need?', "Xayrli kun! Sizga nima kerak?"),
  ('Buyer', 'I need some apples and bananas.', "Menga bir oz olma va banan kerak."),
  ('Seller', 'How many apples do you want?', "Nechta olma xohlaysiz?"),
  ('Buyer', 'Two kilos, please. How much are they?', "Ikki kilo, iltimos. Ular qancha turadi?"),
  ('Seller', 'They are ten thousand soums per kilo.', "Kilosi o'n ming so'm."),
  ('Buyer', 'OK. I buy two kilos of apples.', "Mayli. Ikki kilo olma olaman."),
  ('Seller', 'Here you are. Anything else?', "Marhamat. Yana nima kerak?"),
  ('Buyer', 'No, thank you. That is all.', "Yo'q, rahmat. Hammasi shu.")],
 [('Present Simple: -s qo\'shimchasi', "He/she/it bilan fe'lga -s (yoki -es) qo'shiladi: she works, he watches. Inkorda do not / does not ishlatiladi va fe'l asl holida qoladi: she does not work.", [("My mother cooks every day.", "Onam har kuni ovqat pishiradi."), ("He does not drink tea.", "U choy ichmaydi.")]),
  ('Savol tuzish: Do / Does', "Savolda gap boshiga Do (I, you, we, they) yoki Does (he, she, it) qo'yiladi. Does dan keyin fe'lga -s qo'shilmaydi.", [("Do you like fruit?", "Siz mevani yoqtirasizmi?"), ("Does she buy bread here?", "U bu yerdan non sotib oladimi?")])],
 ('A day at the market', "Every Saturday my mother goes to the market. She buys vegetables, fruit and bread. The seller knows her and always says hello. My mother likes fresh apples, but she does not like expensive things. I often help her carry the bags.", "Har shanba kuni onam bozorga boradi. U sabzavot, meva va non sotib oladi. Sotuvchi uni taniydi va doim salom beradi. Onam yangi olmani yaxshi ko'radi, lekin qimmat narsalarni yoqtirmaydi. Men ko'pincha unga sumkalarni ko'tarishda yordam beraman.",
  [("When does the mother go to the market?", "Every Saturday."), ("What does she buy?", "Vegetables, fruit and bread."), ("Who helps her carry the bags?", "The child (I) often helps her.")]))

E['m3'] = L('Buying stationery',
 [('A', 'Excuse me, do you have a notebook?', "Kechirasiz, daftaringiz bormi?"),
  ('B', 'Yes, we have notebooks and pens.', "Ha, bizda daftar va ruchkalar bor."),
  ('A', 'I need a pen and an eraser.', "Menga ruchka va o'chirg'ich kerak."),
  ('B', 'Here is a blue pen and an eraser.', "Mana ko'k ruchka va o'chirg'ich."),
  ('A', 'And two notebooks, please.', "Va ikkita daftar, iltimos."),
  ('B', 'The notebooks are on the shelf.', "Daftarlar javonda."),
  ('A', 'Thank you. I take an orange pen too.', "Rahmat. Apelsin rangli ruchka ham olaman."),
  ('B', 'Of course. Anything else?', "Albatta. Yana biror narsa?")],
 [('a yoki an?', "Undosh tovush bilan boshlanuvchi so'z oldidan 'a', unli tovush bilan boshlansa 'an' ishlatiladi. Muhimi yozuv emas, tovush: 'an hour' (h o'qilmaydi), 'a university' (y tovushi).", [("a book, a pen", "kitob, ruchka"), ("an apple, an hour", "olma, soat")]),
  ('Ko\'plikning qoidasiz shakllari', "Ba'zi otlar -s olmaydi: man → men, woman → women, child → children, foot → feet, tooth → teeth, person → people. Ularni yodlab oling.", [("two children and three women", "ikki bola va uch ayol"), ("My feet are cold.", "Oyoqlarim sovuq.")])],
 ('The new classroom', "Our classroom is new. There are twenty chairs, ten tables and a big board. There is an old clock on the wall. Every student has a notebook and a pen. The teacher has an orange bag and a lot of books.", "Bizning sinfimiz yangi. Yigirmata stul, o'nta stol va katta doska bor. Devorda eski soat bor. Har bir o'quvchida daftar va ruchka bor. O'qituvchining apelsin rangli sumkasi va ko'p kitoblari bor.",
  [("How many chairs are there?", "There are twenty chairs."), ("What is on the wall?", "An old clock."), ("What does the teacher have?", "An orange bag and a lot of books.")]))

E['m17'] = L('Talking about a house',
 [('A', 'Where do you live?', "Qayerda yashaysiz?"),
  ('B', 'I live in a big house with my family.', "Men oilam bilan katta uyda yashayman."),
  ('A', 'How many rooms are there?', "Nechta xona bor?"),
  ('B', 'There are five rooms and a garden.', "Beshta xona va bog' bor."),
  ('A', 'Is your bedroom big?', "Yotoqxonangiz kattami?"),
  ('B', 'No, it is small, but it is comfortable.', "Yo'q, kichik, lekin qulay."),
  ('A', 'Who lives with you?', "Siz bilan kim yashaydi?"),
  ('B', 'My parents, my brother and my grandmother.', "Ota-onam, akam va buvim.")],
 [('There is / There are', "Biror narsaning borligini aytish uchun: there is (birlik), there are (ko'plik). Inkori: there is not (isn't), there are not (aren't). Savol: Is there...? Are there...?", [("There is a sofa in the room.", "Xonada divan bor."), ("Are there any chairs?", "Stullar bormi?")]),
  ('Egalik: \'s', "Ega ismiga 's qo'shilsa 'kimning' ma'nosi chiqadi: my brother's room (akamning xonasi). Ko'plikda s dan keyin faqat apostrof: my parents' house.", [("This is Ali's book.", "Bu Alining kitobi."), ("my parents' car", "ota-onamning mashinasi")])],
 ('My grandmother', "My grandmother lives with us. She is seventy years old. She wakes up early and makes tea for everybody. In the evening she tells stories to the children. Her room is next to the kitchen. We love her very much.", "Buvim biz bilan yashaydi. U yetmish yoshda. U erta turadi va hamma uchun choy damlaydi. Kechqurun u bolalarga ertak aytib beradi. Uning xonasi oshxonaning yonida. Biz uni juda yaxshi ko'ramiz.",
  [("How old is the grandmother?", "She is seventy."), ("What does she do in the evening?", "She tells stories to the children."), ("Where is her room?", "Next to the kitchen.")]))

E['m18'] = L('Which colour do you like?',
 [('A', 'What colour is your new bag?', "Yangi sumkangiz qanday rangda?"),
  ('B', 'It is dark green. I love green.', "To'q yashil. Men yashilni yaxshi ko'raman."),
  ('A', 'Is it a big bag or a small one?', "U katta sumkami yoki kichikmi?"),
  ('B', 'It is a medium round bag.', "O'rtacha yumaloq sumka."),
  ('A', 'My favourite colour is blue, like the sky.', "Mening sevimli rangim ko'k, osmondek."),
  ('B', 'Blue is nice. Do you like red too?', "Ko'k chiroyli. Qizilni ham yoqtirasizmi?"),
  ('A', 'Not really. Red is too bright for me.', "Unchalik emas. Qizil men uchun juda yorqin."),
  ('B', 'I understand. Everybody has a different taste.', "Tushunaman. Har kimning didi har xil.")],
 [('Sifat otdan oldin keladi', "Ingliz tilida sifat otdan oldin turadi va o'zgarmaydi: a red car, red cars. Sifat ko'plikka qo'shimcha olmaydi.", [("a small white cat", "kichkina oq mushuk"), ("two big blue boxes", "ikkita katta ko'k quti")]),
  ('Ranglarni tasvirlash', "Rangni ochiq/to'q qilish uchun light va dark so'zlari rang oldiga qo'yiladi: light blue, dark green. Shakl: round (yumaloq), square (kvadrat), long (uzun).", [("a light blue shirt", "och ko'k ko'ylak"), ("a round table", "yumaloq stol")])],
 ('Colours around us', "The sky is blue and the grass is green. The sun is yellow and the snow is white. In my room the walls are light yellow, and the carpet is brown. I like bright colours because they make me happy.", "Osmon ko'k, maysa yashil. Quyosh sariq, qor oq. Mening xonamda devorlar och sariq, gilam esa jigarrang. Men yorqin ranglarni yoqtiraman, chunki ular meni xursand qiladi.",
  [("What colour is the sky?", "Blue."), ("What colour are the walls in the room?", "Light yellow."), ("Why does the writer like bright colours?", "They make him/her happy.")]))

E['m19'] = L('Booking a table',
 [('Guest', 'Hello, I would like to book a table for four.', "Salom, to'rt kishilik stol band qilmoqchiman."),
  ('Waiter', 'Certainly. For what time?', "Albatta. Soat nechaga?"),
  ('Guest', 'For seven o\'clock this evening.', "Bugun kechqurun soat yettiga."),
  ('Waiter', 'Could I have your name, please?', "Ismingizni aytsangiz?"),
  ('Guest', 'Yes, it is Rustam Aliyev.', "Ha, Rustam Aliyev."),
  ('Waiter', 'Would you like a table by the window?', "Deraza yonidagi stolni xohlaysizmi?"),
  ('Guest', 'Yes, that would be lovely.', "Ha, juda yaxshi bo'lardi."),
  ('Waiter', 'Perfect. See you at seven.', "Ajoyib. Soat yettida kutamiz.")],
 [('Would like va Can/Could', "'I would like...' — 'Men ... xohlardim' degan xushmuomala shakl. 'Could I have...?' va 'Can I have...?' — iltimos qilish. Could — yanada xushmuomala.", [("I would like a cup of tea.", "Men bir piyola choy xohlardim."), ("Could I have the menu, please?", "Menyuni berolasizmi?")]),
  ('Sanaladigan va sanalmaydigan otlar', "Sanaladigan: apple, egg (a/an, -s). Sanalmaydigan: water, rice, bread (ko'plik yo'q). Ular bilan some/much, sanaladiganlar bilan many ishlatiladi.", [("some water and a salad", "bir oz suv va salat"), ("How much rice? How many eggs?", "Qancha guruch? Nechta tuxum?")])],
 ('Dinner at a restaurant', "On Friday we went to a nice restaurant. The waiter brought the menu. I ordered soup and grilled chicken, and my sister ordered a salad. For dessert we had ice cream. The food was delicious and the service was very polite.", "Juma kuni biz chiroyli restoranga bordik. Ofitsiant menyuni olib keldi. Men sho'rva va grilda tovuq buyurtma qildim, singlim esa salat buyurtma qildi. Desertga muzqaymoq yedik. Ovqat mazali va xizmat juda xushmuomala edi.",
  [("What did the writer order?", "Soup and grilled chicken."), ("What did the sister order?", "A salad."), ("How was the service?", "Very polite.")]))

E['m20'] = L('What is your daily routine?',
 [('A', 'What time do you get up?', "Soat nechada turasiz?"),
  ('B', 'I get up at six thirty.', "Men oltida o'ttizda turaman."),
  ('A', 'What do you do after breakfast?', "Nonushtadan keyin nima qilasiz?"),
  ('B', 'I go to work at eight o\'clock.', "Soat sakkizda ishga boraman."),
  ('A', 'When do you have lunch?', "Tushlikni qachon qilasiz?"),
  ('B', 'At one o\'clock, usually with my colleagues.', "Soat birda, odatda hamkasblarim bilan."),
  ('A', 'And when do you go to bed?', "Qachon uxlaysiz?"),
  ('B', 'Around eleven. I am always tired in the evening.', "Soat o'n bir atrofida. Kechqurun doim charchagan bo'laman.")],
 [('Chastota ravishlari', "always (doim), usually (odatda), often (tez-tez), sometimes (ba'zan), never (hech qachon). Ular odatda asosiy fe'ldan oldin, 'to be' dan keyin keladi.", [("I usually drink tea in the morning.", "Men odatda ertalab choy ichaman."), ("She is never late.", "U hech qachon kechikmaydi.")]),
  ('Vaqt predloglari', "at + soat (at 7:00), on + kun (on Monday), in + kun qismi (in the morning), lekin at night. 'half past six' = 6:30, 'quarter to seven' = 6:45.", [("at half past six", "oltida o'ttizda"), ("in the evening, at night", "kechqurun, kechasi")])],
 ('A busy day', "Karim has a busy day. He gets up at six, has breakfast and goes to the university at eight. His classes finish at three. Then he goes to the gym for an hour. In the evening he does his homework and reads a book. He goes to bed at eleven.", "Karimning kuni band. U oltida turadi, nonushta qiladi va sakkizda universitetga ketadi. Darslari uchda tugaydi. Keyin bir soat sport zaliga boradi. Kechqurun uy vazifasini bajaradi va kitob o'qiydi. U o'n birda uxlaydi.",
  [("When does Karim get up?", "At six."), ("What does he do after classes?", "He goes to the gym."), ("When does he go to bed?", "At eleven.")]))
