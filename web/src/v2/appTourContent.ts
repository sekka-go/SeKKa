/** Context-specific, bilingual walkthroughs for the real PWA (not the dev gallery).
 * Selectors are resolved only against visible, rendered DOM; optional controls
 * are omitted when the associated real data or permission isn't present.
 */
export type GuidedRole='rider'|'captain'|'admin';
export type TourPage={tab:string;view:number;section?:'bookings'|'requests'};
export type TourSpec={
 id:string;
 selectors:string[];
 arTitle:string;enTitle:string;
 arBody:string;enBody:string;
 group?:boolean;
};
const step=(id:string,selectors:string[],arTitle:string,enTitle:string,
 arBody:string,enBody:string,group=false):TourSpec=>({id,selectors,arTitle,enTitle,arBody,enBody,group});
const header=(ar:string,en:string):TourSpec=>step('overview',
 ['.rs3__head','.rf3__hero','.rr3-hero','.rd3__hero','.rb3__hero',
  '.rbk3-hero','.rh-hero','.cj-home-welcome','.captain-onboarding-header',
  '.ad-heading','.ad-top','.live-route-list>h2','.sekka-mobile-card h1',
  '.live-notifications>h2','.live-profile>h2','main h1','main h2'],
 ar,en,'هنا عنوان القسم الحالي. هنعرّفك بسرعة على أهم الخطوات المتاحة.',
 'This is your current section. Here is a quick guide to the available actions.');
const menu=()=>step('menu',['.sekka-floating-actions .sekka-fab-menu'],
 'القائمة','Menu','من هنا تقدر تتنقل بين أقسام التطبيق وتراجع إعداداتك.',
 'Open the menu to switch sections or change your preferences.');
const riderTabs=()=>step('navigation',['.rh-tabs__inner','.rh-tabs'],
 'التنقل السريع','Quick navigation','اختار الرئيسية أو البحث أو الحجوزات من هنا.',
 'Move between Home, Search and Bookings here.',true);
export function specsForPage(page:TourPage,role:GuidedRole):TourSpec[]{
 const {tab,view,section}=page;
 const all:TourSpec[]=[];
 if(tab==='home'){
  if(role==='captain'){
   all.push(step('welcome',['.cj-home-welcome','#cj-home-greeting'],'أهلًا يا كابتن','Welcome Captain',
    'ده ملخص رحلة الكابتن في PoNo.','Your Captain journey starts here.'));
   all.push(step('create',['.cj-home-main-action'],'انشر رحلة','Publish a trip',
    'ابدأ تعريف مشوارك وخط السير من الزر ده.','Start setting up your route here.'));
   all.push(step('activity',['.cj-home-metrics','.cj-home-how'],'ملخص نشاطك','Your activity',
    'تابع خطوطك وحجوزاتك وتعليمات البدء.','Check your routes, bookings and getting-started guide.'));
  }else{
   all.push(step('welcome',['.rh-hero__copy','.rh-hero'],'أهلًا بيك في PoNo','Welcome to PoNo',
    'هنا بتبدأ مشوارك من غير تعقيد.','Your journey begins here.'));
   all.push(step('journey',['.rh-journey__fields'],'منين ولفين؟','Start and destination',
    'حدّد مكانك ووجهتك، واختار الوقت المناسب.','Choose your start, destination and preferred time.'));
   all.push(step('search',['.rh-button--primary'],'دوّر على رحلة','Find a ride',
    'اضغط علشان تشوف الرحلات الحقيقية المناسبة لبحثك.','Search for real published rides matching your route.'));
   all.push(step('extras',['.rh-pickup-actions'],'نقط الركوب والحجوزات','Pickup spots and bookings',
    'استكشف أماكن الركوب أو ارجع لحجوزاتك.','Explore pickup spots or open your bookings.'));
  }
  if(role!=='captain')all.push(riderTabs());
 }else if(tab==='search'&&view===9){
  all.push(step('places',['.rs3__places'],'حدّد مشوارك','Build your route',
   'اختار الانطلاق والوصول، والسهم الأصفر بيعكس الاتجاه.','Set your start and destination. The yellow arrow swaps them.'));
  all.push(step('map',['.rs3__optional-map-toggle'],'حدّد على الخريطة','Choose on map',
   'ممكن تختار مكانك على الخريطة بدل الكتابة.','You can select a place on the map instead of typing.'));
  all.push(step('schedule',['.rs3__times'],'اختار الميعاد','Pick a time',
   'حدّد ميعاد الذهاب، والعودة لو محتاجها.','Choose a departure time and optional return.'));
  all.push(step('search',['.rs3__submit'],'اعرض الرحلات','Search for rides',
   'هتشوف الرحلات المنشورة فعلًا، من غير نتائج تجريبية.','View real available route results, not demo listings.'));
 }else if(tab==='search'&&view===10){
  all.push(header('الفلاتر','Search filters'));
  all.push(step('category',['.rf3__categories'],'فئة العربية','Vehicle type',
   'حدد نوع العربية المناسب وعدد المقاعد.','Choose a vehicle category and seat capacity.'));
  all.push(step('preferences',['.rf3__choices'],'اختياراتك','Your preferences',
   'ظبط مدة الرحلة واتجاهها.','Refine trip period and direction.'));
  all.push(step('apply',['.rf3__apply'],'اعرض النتائج','Apply filters',
   'اضغط هنا لتطبيق الفلاتر على بحثك الحالي.','Apply these filters to your current search.'));
 }else if(tab==='search'&&view===11){
  all.push(step('results',['.rr3-hero','.sekka-live-results-toolbar'],'نتائج بحثك','Your results',
   'دي الرحلات اللي بتناسب البيانات اللي دخلتها.','These are the results for your search.'));
  all.push(step('offers',['.sekka-live-result','.sekka-no-match'],'كروت الرحلات','Ride cards',
   'شوف سعر المقعد ونقطة الركوب والمقاعد المتاحة. ولو مفيش نتائج هتلاقي خيار طلب مشوار.',
   'Compare seat price, pickup and availability. If none match, you can request a ride.'));
  all.push(step('sort',['.sekka-live-sort','.sekka-live-results-toolbar .d-outline'],'ترتيب النتائج','Sort and filter',
   'رتّب الخطوط أو عدّل الفلاتر حسب احتياجك.','Sort published routes or adjust your filters.'));
  all.push(step('details',['.sekka-live-result .d-offer-select'],'تفاصيل الرحلة','Ride details',
   'افتح تفاصيل الرحلة قبل حجز المقاعد.','Review trip details before booking.'));
 }else if(tab==='search'&&view===12){
  all.push(header('تفاصيل الرحلة','Ride details'));
  all.push(step('route',['.rd3__route'],'المسار','The route',
   'راجع بداية ونهاية الرحلة قبل ما تكمل.','Check the pickup and destination.'));
  all.push(step('stops',['.rd3__stops'],'نقط الركوب والنزول','Pickup and drop-off',
   'اختار نقطتي الركوب والنزول اللي يناسبوك.','Choose your pickup and drop-off stops.'));
  all.push(step('price',['.rd3__price'],'سعر المقعد','Seat price',
   'ده السعر المعروض للمقعد، مش سعر العربية بالكامل.','This is the per-seat price, not the whole-car price.'));
  all.push(step('book',['.rd3__primary'],'كمّل الحجز','Continue to booking',
   'اتأكد من التفاصيل وكمل للحجز.','Confirm your choices to continue.'));
 }else if(tab==='booking'){
  all.push(step('booking',['.rbk3-hero','.b-title'],'تأكيد الحجز','Booking',
   'راجع تفاصيل المشوار قبل التأكيد.','Review your trip before confirming.'));
  all.push(step('seats',['.b-seat-chooser','.b-seat-controls'],'عدد المقاعد','Seat count',
   'حدد عدد المقاعد المتاحة اللي محتاجها.','Select the available seats you need.'));
  all.push(step('summary',['.b-offer','.b-price-summary','.b-payment-explainer'],'التفاصيل والسعر','Summary and price',
   'راجع الحجز والتكلفة قبل التنفيذ.','Check the details and price first.'));
  all.push(step('confirm',['.b-primary:not(:disabled)'],'تأكيد الحجز','Confirm booking',
   'اضغط بعد ما تتأكد من كل البيانات.','Confirm once everything looks right.'));
 }else if(tab==='bookings'){
  all.push(step('switch',['.sekka-bookings-section-tabs'],'حجوزاتك وطلباتك','Bookings and requests',
   'تقدر تتنقل بين المقاعد المحجوزة وطلبات المشاوير.','Switch between seat bookings and trip requests.'));
  if(section==='requests'){
   all.push(step('requests',['.live-trip-requests>h2','.sekka-request-list'],'طلبات المشاوير','Trip requests',
    'دي الطلبات اللي اتسجلت في حسابك وحالاتها.','See your real requests and their statuses.'));
   all.push(step('requestActions',['.sekka-request-card__actions','.sekka-request-card'],'متابعة الطلب','Manage a request',
    'راجع العروض أو عدّل الطلب حسب حالته.','Check offers and edit requests where permitted.'));
  }else{
   all.push(step('filter',['.rb3__filters'],'فلترة الحجوزات','Booking filters',
    'اعرض الحجوزات الحالية أو السابقة.','View active or previous bookings.'));
   all.push(step('items',['.rb3__card','.rb3__empty'],'حجوزاتك الحقيقية','Your real bookings',
    'هنا هتلاقي حالة كل حجز محفوظ.','Track the status of each saved booking.'));
  }
 }else if(tab==='notifications'){
  all.push(step('updates',['.live-notifications>h2'],'التنبيهات','Notifications',
   'تابع أي تحديث يخص رحلاتك أو طلباتك.','Find updates about your rides and requests.'));
  all.push(step('notificationItems',['.live-notifications ul li','.live-notifications>button'],'الرسائل','Updates',
   'افتح الإشعار أو علّمه كمقروء.','Review alerts or mark them as read.'));
 }else if(tab==='profile'){
  all.push(step('account',['.live-profile>h2','.sekka-mobile-card h1'],'حسابك','Your account',
   'من هنا تراجع وتحدّث بياناتك.','Review and update your profile here.'));
  all.push(step('data',['.live-profile label','.live-profile input'],'بيانات الحساب','Account details',
   'تأكد من صحة المعلومات المسجلة.','Keep your profile information accurate.'));
  all.push(step('save',['.live-profile .d-primary','.live-profile button'],'حفظ التعديلات','Save changes',
   'احفظ البيانات بعد تعديلها.','Save updates once finished.'));
 }else if(tab==='captain-onboarding'){
  all.push(step('captainIntro',['.captain-onboarding-header','.c-canvas h1','.b-title'],
   'تسجيل الكابتن','Captain setup','هنمشي معاك في خطوات التسجيل والاعتماد.',
   'We will walk through registration and approval steps.'));
  all.push(step('captainProgress',['.captain-enrollment-progress','.c-steps'],
   'مراحل التسجيل','Registration stages','تابع المراحل المطلوبة لبدء نشر الرحلات.',
   'Follow the steps required before publishing trips.'));
  all.push(step('captainForm',['.w-field','.c-document','.c-check','.b-box'],
   'المعلومات والمستندات','Information and documents','املأ البيانات المطلوبة وارفع المستندات الحقيقية.',
   'Complete required information and upload genuine documents.'));
  all.push(step('captainNext',['.b-primary:not(:disabled)','.w-link','.phase-back'],
   'الخطوة التالية','Continue','راجع البيانات قبل الانتقال للخطوة اللي بعدها.',
   'Review each step before continuing.'));
 }else if(tab==='routes'){
  if(view===42){
   all.push(step('captainHello',['.cj-home-welcome','#cj-home-greeting'],
    'أهلًا يا كابتن','Welcome Captain','دي صفحة البداية الخاصة بالكابتن.',
    'This is your Captain dashboard.'));
   all.push(step('createTrip',['.cj-home-main-action','.cj-primary'],
    'أنشئ رحلة','Create a route','حدد خط السير والفئة والسعر الإجمالي.',
    'Define your stops, vehicle category and total price.'));
   all.push(step('captainSummary',['.cj-home-metrics','.cj-home-how'],
    'ملخص حسابك','Your overview','شوف نشاطك وخطوطك من هنا.','See your activity and routes.'));
  }else if(view===43){
   all.push(step('draftIntro',['.sekka-route-intro','.sekka-captain-route-wizard h2'],
    'أنشئ خط سير','Create a route','ابدأ بترتيب المحطات ثم الفئة والوقت والسعر.',
    'Set your stops, category, time and price.'));
   all.push(step('draftForm',['.sekka-route-step','.cj-easy-route-top','.sekka-route-field'],
    'بيانات الرحلة','Route information','أدخل تفاصيل كل مرحلة بعناية.',
    'Enter each stage accurately.'));
   all.push(step('draftNext',['.sekka-route-step-navigation','.sekka-route-next'],
    'تنقل بين المراحل','Step navigation','انتقل للخطوة التالية بعد إكمال البيانات.',
    'Complete each stage to continue.'));
  }else{
   all.push(step('captainRoutes',['.live-route-list>h2','.cj-hero','.cj-home-welcome','main h1'],
    'خطوطك','Your routes','هنا بتراجع خطوطك الفعلية وحالتها.',
    'Review your real routes and statuses.'));
   all.push(step('captainFilters',['.cj-filter-tabs','.cj-home-main-action'],
    'فلترة وإدارة','Filter and manage','تابع المنشور والمسودات أو ابدأ خط جديد.',
    'Switch between published routes and drafts.'));
   all.push(step('captainCards',['.live-route-list>ul>li','.cj-route-card','.cj-card-head'],
    'تفاصيل الخط','Route information','اعرف السعة والحجوزات وحالة كل خط.',
    'Check capacity, bookings and route state.'));
  }
 }else if(tab==='admin'&&role==='admin'){
  all.push(step('adminTitle',['.ad-heading','.ad-top','.ad-content h1'],
   'لوحة الإدارة','Administration','تابع البيانات التشغيلية في القسم الحالي.',
   'Monitor the real operational information in this section.'));
  all.push(step('adminNav',['.ad-sidebar nav','.ad-tools'],
   'التنقل الإداري','Admin navigation','تنقل بين المستخدمين والرحلات والطلبات حسب صلاحياتك.',
   'Switch between users, trips and requests with authorized access.'));
  all.push(step('adminData',['.ad-metrics','.ad-card','.ad-table-wrap','.ad-content'],
   'البيانات والمراجعة','Data and reviews','راجع تفاصيل السجلات قبل اتخاذ أي إجراء.',
   'Review records carefully before taking actions.'));
  all.push(step('adminControls',['.ad-filters','.ad-list-head','.ad-tools'],
   'بحث وفلاتر','Filters and search','استخدم البحث والفلاتر للوصول للسجل المطلوب.',
   'Use filters to find the record you need.'));
 }else{
  all.push(header('اكتشف الشاشة','Explore this screen'));
  all.push(step('mainContent',['#sekka-content article','#sekka-content section','#sekka-content form'],
   'محتوى الشاشة','Screen content','تابع البيانات المتاحة لك في القسم ده.',
   'Explore the information available here.'));
 }
 // All signed-in roles can find the menu; it is not shown during auth.
 if(!['login','captain-onboarding'].includes(tab))all.push(menu());
 return all;
}
