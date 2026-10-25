# FRONTEND DIFFERENCES — الفروق ومصادر البيانات

19 أكتوبر 2026. **Production deployment version not verified.** N وO معرفان بمساريهما الكاملين في NEW_VS_PRODUCTION_COMPARISON.md. جميع الفروق هنا N مقابل O المتاح محليًا؛ النسخة المنشورة P = NOT_VERIFIED حتى SSH. لا استبدال للتصميم الجديد بالقديم.

## 1. ما يجب نقله وما يجب فصله

انقل التصميم/routes/components المشتركة كوحدة متماسكة بعد الدمج في release branch منفصل مع API adapters حقيقية. لا تنقل frontend/ وحدها وتفترض أن تغيير البيئة كافٍ. لا تنقل node_modules أو .next أو .npm-cache أو verification أو checkpoints أو .env.local أو localStorage أو fixtures إلى قاعدة حقيقية.

ملفات API/package/lock وroot dashboard pages متطابقة بين N وO؛ لذا بقاء branch الإنتاج القديم داخل dashboard pages لا يختفي بنقل الجديد. يجب تعديل هذه الفروع لاحقًا لتعرض المكونات المعتمدة ببيانات API. لا تفك production Mock guard كحل للتكامل.

## 2. مخزون كل صفحة ومصدرها الحالي

المصادر مسارات نسبية إلى frontend/. REAL_API يصف الفرع الموجود في الكود، لا نجاح اتصال حي. MIXED يعني وجود فرع حقيقي وآخر محلي، وليس مزج fixtures بصمت عند فشل الشبكة.

| الملف / routes | المصدر والتصنيف | ما يلزم للتكامل |
|---|---|---|
| app/page.tsx — / | STATIC_DATA: landing وتسلسل توضيحي، بلا fetch مباشر | الحفاظ على العرض وتدقيق نصوص Demo/AI بحسب الإمكانات الحقيقية |
| app/products/page.tsx — /products | MIXED: getProducts → REAL_API أو MOCK_DATA؛ catalog يختار state.products في Mock | تحميل pagination/search/filter حقيقية دون fallback fixtures |
| app/products/[id]/page.tsx | MIXED: getProduct، 404 حقيقي، أو LocalProductDetails | catalog/detail DTO + listing eligibility؛ فصل catalog ID عن legacy product ID |
| app/products/[id]/competitive/page.tsx | SIMULATED_ENGINE + LOCAL_STORAGE؛ BackendPending خارج Mock | authenticated snapshot/commands + background event subscription |
| app/products/[id]/negotiate/page.tsx | MOCK_DATA + SIMULATED_ENGINE عبر NegotiationSetup | API إنشاء جلسة one-to-one مع budget خاص |
| app/dashboard/buyer/page.tsx | MIXED: DemoScreen محلي أو getBuyerDashboard القديم | اعتماد UnifiedWorkspace ببيانات الجلسات الحقيقية، current user بدل ID4 |
| app/dashboard/seller/page.tsx | MIXED: DemoScreen أو getSellerDashboard بquery ID + selector ثابت | authenticated owned listings، إلغاء الهوية من query |
| app/dashboard/admin/page.tsx | MIXED: DemoScreen أو getAdminDashboard القديم | authorize Admin وDTOs آمنة ومقاييس موثقة |
| app/dashboard/buyer/[...segments]/page.tsx | LOCAL_STORAGE/SIMULATED_ENGINE؛ negotiations/deals/competitive/agreements/notifications؛ backend pending في الحقيقي | قائمة/تفاصيل/قرارات/history عبر API |
| app/dashboard/seller/[...segments]/page.tsx | LOCAL_STORAGE؛ products، legacy edit/rules/new، alias storefronts، own threads/Agreements | owned listing/rule APIs وصلاحيات server؛ alias قديم فقط |
| app/dashboard/admin/[...segments]/page.tsx | LOCAL_STORAGE/MOCK_DATA؛ users/sellers/products/sessions/deals/reports/audit/system/permissions/notifications | endpoints إدارية مصرح بها؛ permissions الحالية توضيح لا محرر حقيقي |
| app/login/page.tsx | MOCK_DATA/LOCAL_STORAGE: AccountScreen | cookie/session login، 401/expiry، لا demo selector في production |
| app/register/page.tsx | MOCK_DATA/LOCAL_STORAGE: synthetic account فقط | تسجيل ومصادقة تحقق حقيقي؛ لا passwords في localStorage |
| app/profile/page.tsx | LOCAL_STORAGE: اسم/email صناعي وGuest/reset | GET/PATCH me، logout آمن وحذف بيانات عرض حساسة |
| app/notifications/page.tsx | LOCAL_STORAGE: UnifiedNotifications | scoped paginated API + read state persisted |
| app/layout.tsx | STATIC shell + MOCK providers عند development؛ products=[] خارج Mock | اختيار data provider حقيقي دون تغيير SiteShell المعتمد |
| app/loading.tsx / error.tsx / not-found.tsx | STATIC_DATA ورسائل framework | توسيع timeout/retry/request ID/401/403 مع بقاء نفس التصميم |

## 3. مخزون كل ملف مكونات

| المكونات / الملف | التصنيف الفعلي في N | حدود النقل / المصدر البديل |
|---|---|---|
| SiteShell — site-shell.tsx | MIXED: UI ثابت + هوية/notices محلية | حفظ shell/styles؛ auth me + unread count من API |
| DemoProvider / useDemo — demo-provider.tsx | MOCK_DATA + LOCAL_STORAGE + SIMULATED_ENGINE | إبقاؤه dev/test فقط؛ production User/Listing/Session providers منفصلة |
| CompetitiveProvider/hooks — competitive-provider.tsx | LOCAL_STORAGE + SIMULATED_ENGINE | تحويل واجهة المنظورات/actions إلى API adapter؛ لا إرسال raw store للعميل |
| useLocalDemoState — local-demo-state.tsx | LOCAL_STORAGE | تفضيلات عرض غير حساسة فقط لاحقًا، لا authoritative sessions/rules |
| ProductImage / ProductCatalog / ProductDetails — products.tsx | MIXED: REAL_API props أو Mock state، بحث client-side | media URLs آمنة، catalog/listing DTO، pagination؛ نفس cards/details |
| CompetitiveSetup / CompetitiveNegotiation / CompetitiveExperience — competitive-negotiation.tsx | SIMULATED_ENGINE + LOCAL_STORAGE، timer 650ms | بدل timer advancing: backend snapshot/event progression؛ حفظ cards/chat/comparison/dialogs |
| SellerSessionView / gallery/metrics — seller-session-view.tsx | LOCAL_STORAGE snapshot + STATIC illustrations | own thread DTO فقط؛ العرض الحالي محفوظ |
| SellerCompetitiveSessions / Updates — seller-competitive.tsx | LOCAL_STORAGE، data shared مع Buyer | API scoped threads/notifications؛ لا محرك بائع مستقل في browser |
| UnifiedWorkspace / CompetitiveDetail / AgreementDetail / Notifications / Picker — unified-workspace.tsx | LOCAL_STORAGE وaggregates محسوبة | read models موحدة من API، stable IDs، page/error/reconnect states |
| AgreementLinks — agreement-links.tsx | LOCAL_STORAGE | lookup/links لاتفاقيات authorized من backend |
| SellerProductsManager / AdminProductListings / ListingImage — storefront-manager.tsx | LOCAL_STORAGE + MOCK fixtures؛ لا Storefront UI | نقل الواجهة وإزالة persistence/actions المحلية من production adapter؛ اسم الملف القديم ليس business entity |
| DemoScreen / ProductForm / RulesForm / DealDetail / AccountScreen — demo-pages.tsx | MOCK_DATA + LOCAL_STORAGE؛ mutations محلية وBackendPending | تفكيك تدريجي حسب feature، ربط CRUD/Auth/ratings الحقيقي، دون نسخ العرض القديم |
| NegotiationSetup / SessionDetail — negotiation.tsx | SIMULATED_ENGINE/LOCAL_STORAGE؛ notes component state | one-to-one session/offer/approval APIs؛ لا تحليل Gemini داخل frontend |
| AdminReports — admin-reports.tsx | MOCK_DATA/LOCAL_STORAGE + real client file generation | reporting JSON مصرح به؛ لا تحميل قاعدة البيانات كلها لبناء تقارير |
| DesignIcon / BrandMark / StoreMark / ProductIllustration — approved-visuals.tsx | STATIC_DATA، SVG محلي لا icon package جديد | ينقل كما هو؛ استبدال illustration بصورة حقيقية عند توفرها فقط |
| Heading / Badge / Empty / Stats / BackendPending — ui.tsx | STATIC_DATA + values من caller | إعادة الاستخدام؛ لا hardcoded KPI داخل Stats نفسه |

## 4. طبقة المكتبات ومصادر الوهم المحتملة

| الملف | البيانات/الوظيفة | التصنيف | إجراء production المطلوب |
|---|---|---|---|
| lib/api.ts | 5 fetch functions، cache no-store، API_INTERNAL_URL، guard | MIXED | typed client auth/timeout/errors + adapters للعقود الجديدة؛ لا silent Mock fallback |
| lib/mock-data.ts | سبعة منتجات صناعية وأسماء مستخدمين وdashboard fixtures | MOCK_DATA | dev/test entrypoints فقط؛ لا DB import |
| lib/demo-model.ts | demoUsers، sessions/deals/rules/notices/audit الابتدائية؛ legacy two-agent logic | MOCK_DATA + SIMULATED_ENGINE | لا مصدر إنتاج؛ فقط fixtures/oracle لاختبارات معتمدة |
| lib/competitive.ts | catalog IDs ثابتة، seller inventory مولّد، concessions وrounds وacceptance | SIMULATED_ENGINE + MOCK_DATA | التنفيذ والحدود خلف API/worker؛ نقل السلوك بعقد واختبارات لا نسخ private inputs للbrowser |
| lib/demo-integration.ts | Attempt/Agreement lifecycle، listingCatalog/customListings/settings/snapshots | LOCAL_STORAGE + SIMULATED_ENGINE | server persistence/state machine/transactions؛ الاحتفاظ فقط بـDTO mapping في frontend |
| lib/demo-storage.ts | v4 + v3 migration؛ ثلاثة مفاتيح browser | LOCAL_STORAGE | dev-only؛ لا ترحيل هذه السجلات إلى production DB |
| lib/reports.ts / integrated-reports.ts | aggregations من records المتاحة، allowlist خاص | MOCK_DATA/LOCAL_STORAGE | authoritative authorized report DTO/query، تعريف المقاييس والنافذة الزمنية |
| lib/report-download.ts / text-report-pdf.ts | Blob CSV/PDF ببيانات report | STATIC rendering فوق MOCK data | reusable فقط بعد جلب report authorized؛ English text PDF، fallback غير tagged PDF |

الإحصاءات الجديدة عادةً محسوبة وليست أرقامًا عشوائية، لكنها محسوبة من **بيانات محاكاة**. dashboard fixtures في mock-data تُنشئ أرقامًا ثابتة/مشتقة من fixtures. لا نسميها مبيعات فعلية أو real profit. Landing graphs/illustrations لا توثق سوقًا حقيقيًا. لا توجد جداول reports/notifications في ORM المتاح.

## 5. خريطة التحويل دون تغيير التصميم

1. طبقة ProductionApi مستقلة عن fixtures؛ تصدّر public/owner/admin DTOs مختلفة.
2. Session read model يحوّل status/ID/message fields إلى النموذج المستخدم بالواجهة؛ الأسماء المحلية ليست API contracts.
3. API يقول current user؛ UI لا يحدد buyer_id/seller_id لإثبات الهوية. retain route link فقط بعد server authorization.
4. snapshot أولي + event cursor؛ resync بعد reconnect؛ الرسالة تأتي من backend مرة واحدة بمعرّف ثابت.
5. Start/approve/reject/cancel ترسل command idempotent، تعرض busy/error/409، ولا تسجل Agreement قبل جواب الخادم.
6. Forms تكتب owned listing/settings بمراجعة optimistic version؛ snapshots القديمة تبقى كما هي.
7. Reports تستقبل بيانات authorized وتعيد استخدام preview/download؛ لا تحميل private inventory/global users لتوليد التقرير.
8. Mock guard يبقى development-only، لا تحويل NODE_ENV إلى development على السيرفر لإظهار الواجهة. لا fake data عند 5xx أو timeout.

## 6. فروق الملفات الفعلية

SHA-256 قورن محليًا. excluded: caches/.next/node_modules/verification/environment files. هذه قائمة source/tests وليست diff ضد P.

| الملف | الحالة N مقابل O | النقل |
|---|---|---|
| `frontend/app/globals.css` | CHANGED | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/app/layout.tsx` | CHANGED | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/app/products/[id]/competitive/page.tsx` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/admin-reports.tsx` | CHANGED | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/agreement-links.tsx` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/approved-visuals.tsx` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/competitive-negotiation.tsx` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/competitive-provider.tsx` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/demo-pages.tsx` | CHANGED | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/demo-provider.tsx` | CHANGED | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/local-demo-state.tsx` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/products.tsx` | CHANGED | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/seller-competitive.tsx` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/seller-session-view.tsx` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/site-shell.tsx` | CHANGED | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/storefront-manager.tsx` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/components/unified-workspace.tsx` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/lib/competitive.ts` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/lib/demo-integration.ts` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/lib/demo-model.ts` | CHANGED | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/lib/demo-storage.ts` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/lib/integrated-reports.ts` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/lib/mock-data.ts` | CHANGED | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/lib/report-download.ts` | CHANGED | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/lib/reports.ts` | CHANGED | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/lib/text-report-pdf.ts` | NEW | ينقل بعد فصل/ربط مصدر البيانات حسب الجدول أعلاه |
| `frontend/tests/verify-competitive.cjs` | NEW | اختبار محلي؛ لا runtime نقل |
| `frontend/tests/verify-demo.cjs` | CHANGED | اختبار محلي؛ لا runtime نقل |
| `frontend/tests/verify-integration.cjs` | NEW | اختبار محلي؛ لا runtime نقل |
| `frontend/tests/verify-listing-navigation.cjs` | NEW | اختبار محلي؛ لا runtime نقل |
| `frontend/tests/verify-reports.cjs` | CHANGED | اختبار محلي؛ لا runtime نقل |
| `frontend/tests/verify-seller-ownership.cjs` | NEW | اختبار محلي؛ لا runtime نقل |

لا ملفات مصدر محذوفة من frontend مقارنة بـO. api.ts وpackage.json وpackage-lock.json وnext.config.ts وContainerfile وroot dashboards والـnegotiation.tsx القديمة متطابقة؛ API contracts لم تتغير. backend/infra متطابقان بين النسختين، workflow النشر موجود فقط في O. لا تنسخ workflow لتشغيله؛ يجب مراجعته قبل أي release.

## 7. حدود ما تم اختباره

الاختبارات المحلية تغطي العرض/المحاكاة والعزل البنيوي، لا مصادقة API حقيقية. لا يكفي وجود زر أو route. تحويل العرض إلى REAL يتطلب تنفيذ Backend المسؤول عنه المطور B، ثم integration/E2E في staging. لا يثبت build ناجح صحة البيانات أو الملكية.


---

## تحديث الأدلة AWS-R1 — 19 أكتوبر 2026

**هذا ملحق جديد؛ النص السابق محفوظ كتاريخ للتدقيق، وتُقدَّم نتائج هذا الملحق عند تعارضها معه.** N هو العرض المحلي متعدد البائعين، وO المصدر المحلي القديم، وR المصدر المنسوخ من AWS في `<LOCAL_USER_HOME>\Documents\autoneg-production-reference`. تم فحص R محليًا للقراءة فقط. عبارة SOURCE_VERIFIED تعني وجود السلوك في المصدر، ولا تعني أنه يعمل في الحاوية المنشورة. بيانات الخادم التشغيلية أدناه من توثيق المستخدم؛ لم ننفذ اتصال AWS أو قاعدة بيانات.

الفرع المبلغ عنه `main`، والالتزام `0be5da348fd7c38da41f1628a4420135e02e2cd8`، مع تعديلات محلية على الخادم وعدم وجود Git revision label لصورة الواجهة. لذلك تطابق R مع صورة التشغيل، وDDL الفعلي، ونسخة migrations، وصلاحيات التشغيل، ونجاح التدفقات الحقيقية تظل **NOT_VERIFIED**. لا يجوز نسبة تعديلات working tree تلقائيًا إلى ذلك الالتزام.


### مقارنة الواجهة N مقابل R الفعلي المنسوخ

في مجلدات app/components/lib المقدمة: **15 ملفًا في N فقط، و16 ملفًا مشتركًا مختلفًا، ولا ملف واجهة في R فقط**. هذه ليست مقارنة كل المستودع؛ ملفات التبعيات والنشر غير مرفقة في R.

| المجموعة | الملفات داخل frontend |
|---|---|
| جديد في N: route | app/products/[id]/competitive/page.tsx |
| جديد في N: components | agreement-links.tsx، approved-visuals.tsx، competitive-negotiation.tsx، competitive-provider.tsx، local-demo-state.tsx، seller-competitive.tsx، seller-session-view.tsx، storefront-manager.tsx، unified-workspace.tsx |
| جديد في N: lib | competitive.ts، demo-integration.ts، demo-storage.ts، integrated-reports.ts، text-report-pdf.ts |
| مختلف: app | dashboard/admin/page.tsx، dashboard/buyer/page.tsx، dashboard/seller/page.tsx، globals.css، layout.tsx |
| مختلف: components | admin-reports.tsx، demo-pages.tsx، demo-provider.tsx، negotiation.tsx، products.tsx، site-shell.tsx |
| مختلف: lib | api.ts، demo-model.ts، mock-data.ts، report-download.ts، reports.ts |

اسم storefront-manager.tsx ومفاتيح ترحيل قديمة لا يبرران إعادة مفهوم Storefront إلى المنتج: المطلوب ملكية قائمة المنتج للبائع نفسه، وربطها بمنتج catalog مطابق.

### الاختلاف الحاسم في مسار البيانات

R: `app/layout.tsx:17–20` يجلب workspace ويهيئ DemoProvider enabled=true. صفحات dashboards الثلاث تعيد DemoScreen مباشرة. المتصفح يعيد GET `/api/workspace/bootstrap`، ثم ينفذ POST/PUT/PATCH لعمليات DB. تسمية DemoProvider لا تجعل هذا المسار Mock فقط. `projectDemoState` يحدث بعد استلام state العام، فلا يمنع تسرب البيانات المرسلة.

N: الوضع التجريبي المحلي المحمي بشرط التطوير، التخزين المحلي المشترك ومحرك التنافس والمشاهد المعتمدة. مسار التنافس غير موصول بإنتاج FastAPI. لذلك **نسخ N فوق R قد يفقد عمليات DB، ونسخ R فوق N قد يكسر التصميم والخصوصية**.

| الجزء | التكامل المطلوب دون تغيير التصميم |
|---|---|
| createNegotiation/saveProduct/saveRules/profile وغيرها | توحيد واجهات async ونتيجة نجاح/فشل صريحة؛ R يستخدم وعودًا واستجابات state/ID، فلا تُفترض تواقيع N متطابقة |
| approve/end/advance | إظهار pending ثم تأكيد server؛ rollback عند الفشل، لا Agreement وهمي محلي في إنتاج |
| root bootstrap | بيانات محدودة بالهوية الموثقة من الخادم؛ لا إرسال كل budgets/floors إلى HTML أو المتصفح |
| Buyer/Seller sessions | ربط views المعتمدة بـDTO خاص بالدور والجلسة؛ لا محاكاة مستقلة للبائع |
| التقارير | إعادة استخدام العرض وPDF/CSV؛ بيانات مخوّلة من API، إظهار مصدرها وحدودها، دون تعويض النقص ببيانات تجريبية |
| الانتقال بين الأدوار | selector في N للعرض فقط؛ الإنتاج يعتمد هوية وصلاحيات الخادم |

المظهر الحالي والألوان والتنقل والتصميم المعتمد تبقى أساس الدمج. production يجب أن يبقى متصلًا بقاعدة البيانات الحقيقية؛ فشل الشبكة يعرض خطأ قابلًا لإعادة المحاولة، وليس تبديلًا صامتًا إلى Mock. الصفحة الرئيسية نفسها قد تكون بسيطة لكن root layout في R يستدعي bootstrap، لذلك لا يصح نفي اتصالها استنادًا إلى page.tsx وحده.


---

## AWS-R2 — تجهيز Frontend محليًا، 19 أكتوبر 2026

نُفذ تكامل المنتجات العامة مع تحقق الاستجابة والأخطاء، وأضيفت حدود typed/fail-closed للعقود الخاصة القائمة؛ لا bootstrap أو كتابة غير مخولة ولا fallback تجريبي في الإنتاج. تصاميم الأدوار وملكية Seller والمحاكاة محفوظة. نجحت 8 مجموعات اختبارات وTypeScript والبناء وstatic contract validation واختبار standalone على loopback. لا يثبت ذلك تشغيل FastAPI أو DB أو صورة AWS الفعلية؛ القرار NO-GO للنشر العام باقٍ.

النتائج وقائمة الملفات وقرارات الميزات: [FINAL_FRONTEND_INTEGRATION_REPORT.md](FINAL_FRONTEND_INTEGRATION_REPORT.md). الحزمة وأوامر staging والرجوع المعدة للموافقة فقط: [FRONTEND_STAGING_PLAN.md](FRONTEND_STAGING_PLAN.md). لم يُنفذ اتصال AWS أو نقل أو deploy أو تغيير قاعدة بيانات؛ تاريخ هذا التقرير السابق محفوظ.


## New evidence — 26 October 2026

This document preserves the earlier audit history. For the current authenticated production integration and model/storage matching, see docs/releases/PRODUCTION_RELEASE_REPORT_20261025.md and docs/releases/MODEL_MATCHING_RELEASE_20261025.md. Earlier NOT_VERIFIED/NO-GO statements must be interpreted with the later evidence; the copied AWS source was not proof of an identical running image. Production mock data is disabled. No staging fixtures are promoted.
