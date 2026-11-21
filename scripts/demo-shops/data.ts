// Шесть вымышленных демо-магазинов: типичный малый бизнес Казахстана. Совпадения с реальными магазинами случайны.
// Цены ориентировочные (тенге, ноябрь 2026). Витрина сама помечает их как демо по адресу demo-….
// Фото со стока Pexels (лицензия Pexels: бесплатно, в том числе для коммерции, без указания автора), без чужих брендов.
import type { Art } from "./art";

export type DemoProduct = {
  title: string;
  category: string;
  price: number;
  price_mode: "fixed" | "from" | "request";
  description_ru: string;
  description_kz: string;
  art: Art;
  accent?: string;
  /** Фото с Pexels (бесплатная лицензия, без указания автора): адрес https://www.pexels.com/photo/<photo>/. */
  photo: string;
};

export type DemoShop = {
  slug: string;
  name: string;
  city: string;
  address: string;
  hours: string;
  about: string;
  lead_days: number;
  /** Условия оплаты и доставки (видны покупателям, до 300 символов). */
  payment: string;
  delivery: string;
  bg: string;
  /** Аватар магазина: фото Pexels, как у товаров. */
  avatar: string;
  products: DemoProduct[];
};

// Пометку «демо» показывает сама витрина для адресов demo-… (src/components/demo-notice.tsx).

export const DEMO_SHOPS: DemoShop[] = [
  {
    slug: "demo-bauyrsak",
    name: "Бауырсақ үйі",
    city: "Алматы",
    address: "Ауэзовский район, самовывоз",
    hours: "Каждый день 8:00–20:00",
    about: "Домашняя выпечка по семейным рецептам: баурсаки, самса, табанан и торты к празднику.",
    lead_days: 0,
    payment: "Kaspi-перевод или наличными при получении",
    delivery: "По городу от 1000 ₸, самовывоз бесплатно",
    bg: "#f3e2cf",
    avatar: "lepeshka-uzbek-bread-20045238",
    products: [
      { title: "Баурсаки, 1 кг", category: "Выпечка", price: 3500, price_mode: "fixed", art: "baursak", photo: "traditional-fried-bread-on-outdoor-picnic-table-30696373",
        description_ru: "Пышные баурсаки на молоке, жарим утром в день заказа. Хорошо держат форму и на второй день.",
        description_kz: "Сүтке иленген үлпілдек бауырсақ, тапсырыс күні таңертең пісіреміз. Келесі күні де жұмсақ болады." },
      { title: "Самса с говядиной", category: "Выпечка", price: 700, price_mode: "fixed", art: "samsa", photo: "baked-goods-on-plate-19441250",
        description_ru: "Слоёное тесто, рубленая говядина с луком. Цена за штуку, от 10 штук скидка 10%.",
        description_kz: "Қатпарлы қамыр, пияз қосылған туралған сиыр еті. Бағасы бір данаға, 10 данадан бастап 10% жеңілдік." },
      { title: "Табанан", category: "Хлеб", price: 400, price_mode: "fixed", art: "flatbread", photo: "lepeshka-uzbek-bread-20045238",
        description_ru: "Круглая лепёшка из печи, около 400 г. Свежая каждое утро.",
        description_kz: "Пештен шыққан дөңгелек нан, шамамен 400 г. Күнде таңертең жаңа піседі." },
      { title: "Тоқаш с изюмом, 6 шт", category: "Выпечка", price: 2400, price_mode: "fixed", art: "chakchak", photo: "baked-rolled-buns-with-raisin-4315283",
        description_ru: "Сдобные булочки с изюмом, мягкие и ароматные. Хорошо к чаю.",
        description_kz: "Мейізі бар тәтті тоқаштар, жұмсақ әрі хош иісті. Шайға жақсы." },
      { title: "Медовик, 1 кг", category: "Торты", price: 9000, price_mode: "fixed", art: "layercake", photo: "delicious-honey-cake-slice-on-a-plate-30254427",
        description_ru: "Восемь медовых коржей и сметанный крем. Заказ лучше оформить за день.",
        description_kz: "Сегіз балды қабат және қаймақ кремі. Тапсырысты бір күн бұрын берген дұрыс." },
      { title: "Торт на заказ", category: "Торты", price: 0, price_mode: "request", art: "gift", photo: "chocolate-cake-nuts-and-strawberries-12616001", accent: "#c0392b",
        description_ru: "Торт к той, дню рождения или юбилею. Вес, начинку и оформление обсудим в WhatsApp.",
        description_kz: "Тойға, туған күнге немесе мерейтойға торт. Салмағын, ішін және безендірілуін WhatsApp-та келісеміз." },
    ],
  },
  {
    slug: "demo-gulzar",
    name: "Гүлзар",
    city: "Астана",
    address: "Район Есиль, доставка по городу",
    hours: "Пн–Вс 9:00–21:00",
    about: "Свежие цветы и комнатные растения, соберём букет к нужному часу.",
    lead_days: 0,
    payment: "Kaspi-перевод, предоплата 50% за букет на заказ",
    delivery: "Доставка по городу 1500 ₸, бесплатно от 25 000 ₸",
    bg: "#f7e1e6",
    avatar: "vibrant-bouquet-of-red-roses-and-baby-s-breath-35568784",
    products: [
      { title: "Букет из 25 роз", category: "Букеты", price: 27000, price_mode: "fixed", art: "roses", photo: "red-roses-bouquet-on-table-22604232",
        description_ru: "Красные розы 50 см в крафтовой упаковке с лентой. Открытка в подарок.",
        description_kz: "50 см қызыл раушандар, ленталы крафт орауышта. Ашықхат сыйлыққа беріледі." },
      { title: "Тюльпаны, 15 шт", category: "Букеты", price: 12000, price_mode: "fixed", art: "tulips", photo: "vibrant-yellow-tulip-bouquet-on-display-35012875",
        description_ru: "Жёлтые или смешанные тюльпаны, цвет уточним при заказе.",
        description_kz: "Сары немесе аралас қызғалдақтар, түсін тапсырыс кезінде нақтылаймыз." },
      { title: "Букет полевых цветов", category: "Букеты", price: 9500, price_mode: "fixed", art: "wildflowers", photo: "vibrant-wildflower-bouquet-in-natural-light-38973947",
        description_ru: "Сборный букет из ромашек, хризантем и зелени. Каждый немного разный.",
        description_kz: "Түймедақ, хризантема және жасыл шөптерден құралған гүлшоқ. Әрқайсысы сәл өзгеше." },
      { title: "Цветы в коробке", category: "Композиции", price: 15000, price_mode: "from", art: "flowerbox", photo: "elegant-floral-arrangement-in-white-hat-box-35285625",
        description_ru: "Композиция в шляпной коробке, не нужна ваза. Размер и цвета на ваш выбор.",
        description_kz: "Қорапшадағы гүл композициясы, ваза қажет емес. Өлшемі мен түсін өзіңіз таңдайсыз." },
      { title: "Букет невесты", category: "Композиции", price: 20000, price_mode: "from", art: "gift", photo: "elegant-bride-holding-baby-s-breath-bouquet-31046060", accent: "#e8a0b4",
        description_ru: "Соберём под платье и стиль тоя. Заказ за 3 дня, бутоньерка для жениха в комплекте.",
        description_kz: "Көйлекке және той стиліне сай жинаймыз. Тапсырыс 3 күн бұрын, күйеу жігітке бутоньерка қоса беріледі." },
      { title: "Монстера в горшке", category: "Растения", price: 14000, price_mode: "fixed", art: "plant", photo: "elegant-monstera-leaf-in-modern-ceramic-pot-34642839",
        description_ru: "Высота около 60 см, керамический горшок. Расскажем, как ухаживать.",
        description_kz: "Биіктігі шамамен 60 см, керамика құмыра. Қалай күтуді айтып береміз." },
    ],
  },
  {
    slug: "demo-oyu",
    name: "Ою сувенир",
    city: "Шымкент",
    address: "Центр, самовывоз из мастерской",
    hours: "Пн–Сб 10:00–19:00",
    about: "Сувениры и подарки с казахским орнаментом ручной работы.",
    lead_days: 1,
    payment: "Kaspi-перевод, наличными при самовывозе",
    delivery: "Самовывоз из мастерской; по Казахстану отправляем почтой",
    bg: "#e3ecf5",
    avatar: "kazakh-dombyra-with-traditional-ornamentation-30472401",
    products: [
      { title: "Кесе с росписью, 6 шт", category: "Посуда", price: 12000, price_mode: "fixed", art: "cups", photo: "vibrant-traditional-uzbek-ceramic-pottery-display-40336773",
        description_ru: "Керамические кесе ручной росписи, 200 мл. Узор на каждой немного свой. В подарочной коробке.",
        description_kz: "Қолмен боялған керамика кеселер, 200 мл. Әрқайсысының өрнегі сәл өзгеше. Сыйлық қорапшасында." },
      { title: "Войлочные тапочки", category: "Войлок", price: 8500, price_mode: "fixed", art: "slippers", photo: "handcrafted-colorful-felt-wool-slippers-39833055",
        description_ru: "Натуральная шерсть, вышитый орнамент. Размеры 36–45, укажите в комментарии.",
        description_kz: "Табиғи жүн, кестеленген ою. Өлшемі 36–45, пікірде көрсетіңіз." },
      { title: "Сувенирная домбыра, 40 см", category: "Сувениры", price: 15000, price_mode: "fixed", art: "dombra", photo: "traditional-kazakh-dombra-on-ornate-surface-29430293",
        description_ru: "Настоящее дерево и струны, но для интерьера, а не для игры. Можно нанести имя.",
        description_kz: "Нағыз ағаш пен ішек, бірақ ойнауға емес, интерьерге арналған. Есім жазуға болады." },
      { title: "Тақия с орнаментом", category: "Сувениры", price: 7500, price_mode: "fixed", art: "shanyrak", photo: "traditional-hat-design-25912225",
        description_ru: "Национальная шапочка с вышивкой и золотой тесьмой. Размеры 54–60, укажите в комментарии.",
        description_kz: "Кестеленген, алтын баулы ұлттық тақия. Өлшемі 54–60, пікірде көрсетіңіз." },
      { title: "Ковёр с орнаментом, 60×90 см", category: "Текстиль", price: 28000, price_mode: "fixed", art: "rug", photo: "vibrant-traditional-market-display-with-rugs-35769465",
        description_ru: "Тканый коврик с традиционным узором. Ручная работа, срок 5 дней.",
        description_kz: "Дәстүрлі өрнекті тоқыма кілемше. Қолдан жасалған, мерзімі 5 күн." },
      { title: "Подарочный набор на заказ", category: "Подарки", price: 0, price_mode: "request", art: "gift", photo: "two-gift-boxes-13975271", accent: "#1f6fb2",
        description_ru: "Соберём набор для гостей, коллег или иностранных партнёров под ваш бюджет.",
        description_kz: "Қонақтарға, әріптестерге немесе шетелдік серіктестерге бюджетіңізге сай жиынтық құрастырамыз." },
      { title: "Домбыра ученическая", category: "Музыка", price: 45000, price_mode: "fixed", art: "dombra", photo: "traditional-kazakh-dombyra-on-white-background-30472406",
        description_ru: "Настоящая домбыра для занятий: ель и орех, роспись на деке. Подходит детям и начинающим.",
        description_kz: "Сабаққа арналған нағыз домбыра: шырша мен жаңғақ ағашы, қақпағында өрнек. Балалар мен жаңадан үйренушілерге лайық." },
      { title: "Шёлковый платок с орнаментом", category: "Текстиль", price: 9500, price_mode: "fixed", art: "rug", photo: "colorful-geometric-patterned-silk-scarf-36455708",
        description_ru: "Натуральный шёлк, 90×90 см. Яркий геометрический узор, в подарочной коробке.",
        description_kz: "Табиғи жібек, 90×90 см. Ашық геометриялық өрнек, сыйлық қорапшасында." },
      { title: "Расписная тарелка, 26 см", category: "Посуда", price: 7000, price_mode: "fixed", art: "shanyrak", photo: "handcrafted-blue-and-white-ornate-ceramic-plate-31000471",
        description_ru: "Ручная роспись по керамике. Можно повесить на стену или поставить на дастархан.",
        description_kz: "Керамикаға қолмен салынған сурет. Қабырғаға ілуге немесе дастарханға қоюға болады." },
      { title: "Серебро с орнаментом", category: "Украшения", price: 6000, price_mode: "from", art: "shanyrak", photo: "close-up-of-silver-antique-accessories-12685978",
        description_ru: "Подвески и браслеты из серебра 925 пробы с казахским орнаментом. Цена зависит от изделия.",
        description_kz: "Қазақ өрнегі бар 925 сынамалы күмістен алқалар мен білезіктер. Бағасы бұйымға байланысты." },
      { title: "Войлочная игрушка", category: "Войлок", price: 3500, price_mode: "fixed", art: "slippers", photo: "colorful-wool-felt-cat-toys-in-a-basket-40987769",
        description_ru: "Котики и зверята из шерсти, ручная валка, около 12 см. Для детей от 3 лет.",
        description_kz: "Жүннен басылған мысықтар мен аңдар, қолдан жасалған, шамамен 12 см. 3 жастан асқан балаларға." },
    ],
  },
  {
    slug: "demo-taza-uy",
    name: "Таза Үй",
    city: "Караганда",
    address: "Выезд по Караганде и Темиртау",
    hours: "Пн–Сб 8:00–20:00",
    about: "Уборка квартир и домов, химчистка мебели и ковров на дому. Своя химия и техника.",
    lead_days: 1,
    payment: "Kaspi-перевод после выполнения работ",
    delivery: "Выезжаем по городу, стоимость выезда входит в услугу",
    bg: "#dff1f0",
    avatar: "person-cleaning-window-with-squeegee-and-gloves-31435403",
    products: [
      { title: "Генеральная уборка квартиры", category: "Уборка", price: 25000, price_mode: "from", art: "bucket", photo: "woman-cleaning-the-living-room-27176673", accent: "#2e86c1",
        description_ru: "Кухня, санузел, полы, пыль, двери и плинтусы. Цена за 1-комнатную, точную назовём по площади.",
        description_kz: "Ас үй, жуынатын бөлме, еден, шаң, есік пен плинтус. Баға 1 бөлмелі пәтерге, нақтысын ауданы бойынша айтамыз." },
      { title: "Уборка после ремонта", category: "Уборка", price: 35000, price_mode: "from", art: "bucket", photo: "photo-of-vacuum-cleaner-on-floor-3616746", accent: "#d68910",
        description_ru: "Строительная пыль, следы краски и затирки, мытьё окон. Два-три специалиста за один день.",
        description_kz: "Құрылыс шаңы, бояу мен сылақ іздері, терезе жуу. Екі-үш маман бір күнде бітіреді." },
      { title: "Поддерживающая уборка", category: "Уборка", price: 12000, price_mode: "from", art: "bucket", photo: "a-person-wiping-the-surface-of-a-gas-stove-9462304", accent: "#48c9b0",
        description_ru: "Раз в неделю или две: полы, пыль, кухня и санузел.",
        description_kz: "Аптасына немесе екі аптада бір рет: еден, шаң, ас үй және жуынатын бөлме." },
      { title: "Химчистка дивана", category: "Химчистка", price: 12000, price_mode: "from", art: "sofa", photo: "efficient-sofa-cleaning-with-handheld-vacuum-30238384",
        description_ru: "Экстрактором на дому, высыхает за 4–6 часов. Цена за двухместный диван.",
        description_kz: "Үйде экстрактормен тазалаймыз, 4–6 сағатта кебеді. Баға екі орындық диванға." },
      { title: "Мойка окон (за створку)", category: "Окна", price: 1500, price_mode: "from", art: "window", photo: "person-cleaning-window-with-squeegee-and-gloves-31435403",
        description_ru: "С двух сторон, рамы и подоконники. Балкон считаем отдельно.",
        description_kz: "Екі жағынан, рамалары мен терезе алды. Балкон бөлек есептеледі." },
      { title: "Чистка ковра (за м²)", category: "Химчистка", price: 900, price_mode: "from", art: "carpet", photo: "black-vacuum-cleaner-on-area-rug-4107284",
        description_ru: "На дому или заберём в цех. Убираем пятна и запахи.",
        description_kz: "Үйде немесе цехқа алып кетеміз. Дақ пен иісті кетіреміз." },
    ],
  },
  {
    slug: "demo-ak-aru",
    name: "Ақ Ару косметика",
    city: "Алматы",
    address: "Бостандыкский район, доставка по Казахстану",
    hours: "Пн–Пт 10:00–19:00",
    about: "Натуральная косметика ручной работы: мыло на верблюжьем молоке, кремы и скрабы.",
    lead_days: 0,
    payment: "Kaspi-перевод или наличными",
    delivery: "Самовывоз или курьер по городу 1200 ₸",
    bg: "#f4ece4",
    avatar: "stack-of-natural-soaps-placed-on-table-6621497",
    products: [
      { title: "Мыло на верблюжьем молоке", category: "Мыло", price: 2200, price_mode: "fixed", art: "soap", photo: "stack-of-natural-soaps-placed-on-table-6621497",
        description_ru: "Холодный способ, без отдушек, 100 г. Подходит для сухой кожи.",
        description_kz: "Суық әдіспен жасалған, хош иіссіз, 100 г. Құрғақ теріге жарайды." },
      { title: "Крем для рук с облепихой", category: "Уход", price: 3500, price_mode: "fixed", art: "tube", photo: "person-holding-a-hand-cream-6925488", accent: "#e67e22",
        description_ru: "Масло облепихи и ши, быстро впитывается. Тюбик 75 мл.",
        description_kz: "Шырғанақ және ши майы, тез сіңеді. Түтікше 75 мл." },
      { title: "Кофейный скраб, 200 г", category: "Уход", price: 4200, price_mode: "fixed", art: "jar", photo: "bowl-with-coffee-scrub-placed-on-marble-table-6621340", accent: "#6e2c00",
        description_ru: "Молотый кофе, тростниковый сахар и кокосовое масло.",
        description_kz: "Үгітілген кофе, қамыс қанты және кокос майы." },
      { title: "Бальзам для губ, 3 шт", category: "Уход", price: 1500, price_mode: "fixed", art: "balm", photo: "lip-balms-in-can-containers-6187571",
        description_ru: "Пчелиный воск и масла. Набор из трёх вкусов: вишня, ваниль, мята.",
        description_kz: "Балауыз және майлар. Үш дәмнен жиынтық: шие, ваниль, жалбыз." },
      { title: "Масло для лица с шиповником, 30 мл", category: "Уход", price: 5200, price_mode: "fixed", art: "bottle", photo: "amber-glass-bottle-with-dropper-pipette-29336392", accent: "#a04000",
        description_ru: "Масла шиповника и жожоба, флакон с пипеткой. Пара капель на ночь.",
        description_kz: "Итмұрын және жожоба майы, тамызғышы бар құты. Түнге бірнеше тамшы." },
      { title: "Набор мыла «Ару»", category: "Наборы", price: 6500, price_mode: "fixed", art: "gift", photo: "box-of-green-soaps-tied-with-a-ribbon-7460109", accent: "#c39bd3",
        description_ru: "Три куска мыла ручной работы в крафтовой коробке с лентой. Готовый подарок.",
        description_kz: "Қолдан жасалған үш сабын ленталы крафт қорапта. Дайын сыйлық." },
    ],
  },
  {
    slug: "demo-auyl",
    name: "Ауыл өнімдері",
    city: "Павлодар",
    address: "Доставка по Павлодару по субботам",
    hours: "Заказы до четверга",
    about: "Фермерские продукты из аула: конина, молочное и мёд. Привозим раз в неделю.",
    lead_days: 2,
    payment: "Kaspi-перевод, наличными при встрече",
    delivery: "Доставка по городу 1500 ₸, в другие города транспортной компанией",
    bg: "#eef0dc",
    avatar: "honey-in-glass-jars-5865194",
    products: [
      { title: "Говядина, 1 кг", category: "Мясо", price: 4800, price_mode: "fixed", art: "kazy", photo: "fresh-raw-ribeye-beef-on-cutting-board-33157191",
        description_ru: "Мякоть молодого бычка из аула, без костей. Привозим охлаждённой.",
        description_kz: "Ауылда өсірілген жас бұқаның сүйексіз еті. Салқындатылған күйде әкелеміз." },
      { title: "Шұжық, 1 кг", category: "Мясо", price: 7500, price_mode: "fixed", art: "shuzhuk", photo: "displayed-salami-sausages-8250416",
        description_ru: "Колбаса из конины по домашнему рецепту, вяленая.",
        description_kz: "Үй рецептімен жасалған жылқы етінен шұжық, сүрленген." },
      { title: "Курт солёный, 500 г", category: "Молочное", price: 3000, price_mode: "fixed", art: "kurt", photo: "kazakhstan-traditional-kurt-cheese-in-bag-29630765",
        description_ru: "Сушёный на солнце, в меру солёный.",
        description_kz: "Күнге кептірілген, тұзы қалыпты." },
      { title: "Ірімшік, 500 г", category: "Молочное", price: 3500, price_mode: "fixed", art: "irimshik", photo: "photo-of-a-cottage-cheese-on-a-white-plate-11281296",
        description_ru: "Сладкий творожный ірімшік к чаю.",
        description_kz: "Шайға арналған тәтті ірімшік." },
      { title: "Кумыс, 1 л", category: "Молочное", price: 2500, price_mode: "fixed", art: "kumys", photo: "bottle-of-kumis-on-straw-bale-for-fermented-drink-32255753",
        description_ru: "Свежий кумыс, хранить в холодильнике до 3 дней.",
        description_kz: "Жаңа сауылған қымыз, тоңазытқышта 3 күнге дейін сақталады." },
      { title: "Сметана, 0,5 л", category: "Молочное", price: 1800, price_mode: "fixed", art: "smetana", photo: "wooden-bowl-of-sour-cream-with-spoon-on-table-7144518",
        description_ru: "Густая домашняя сметана, жирность около 30%.",
        description_kz: "Қою үй қаймағы, майлылығы шамамен 30%." },
      { title: "Мёд, 1 кг", category: "Мёд", price: 6000, price_mode: "fixed", art: "honey", photo: "honey-on-glass-jars-13246534",
        description_ru: "Разнотравье с собственной пасеки, урожай 2026 года.",
        description_kz: "Өз омартамыздан алынған әр түрлі шөп балы, 2026 жылғы өнім." },
    ],
  },
];
