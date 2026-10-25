# FRONTEND INTEGRATION TASKS — المطور A

19 أكتوبر 2026. **Production deployment version not verified.** هذه قائمة عمل مقترحة وليست تنفيذًا. O/N معرفان في التقرير الرئيسي. الهدف الاحتفاظ بتصميم N، وتبديل مصادر البيانات والأفعال دون إعادة الواجهة إلى O القديمة.

## 1. ترتيب العمل والمسؤولية

A مسؤول عن frontend/types/adapters/states/tests فقط. B مسؤول API/auth/schema/worker/authorization. لا يبدأ A باختراع endpoints أو محاكاة نجاح أمر إنتاجي. كل PROPOSED file/route أدناه يحتاج عقدًا من B قبل التنفيذ.

| ID / Priority | المهمة والملفات | الاعتماد | معيار القبول | المسؤول |
|---|---|---|---|---|
| A00 P0 | تثبيت snapshots للواجهة وعقود old/new؛ frontend/components/{site-shell,competitive-negotiation,seller-session-view,approved-visuals}.tsx + app/globals.css | مصدر release الحقيقي من مرحلة SSH | UI baseline محفوظ؛ لا نقل CSS قديم فوق الجديد؛ no app edits في هذا التدقيق | A مع B |
| A01 P0 | عقد DTO والـIDs/money/status/errors؛ lib/api.ts وPROPOSED lib/contracts.ts | B01/B02/B03 | explicit public/owner/Admin DTO، Decimal strings، IDs آمنة، حالات parent/thread منفصلة | A+B |
| A02 P0 | Production client باستخدام fetch الحالي؛ PROPOSED lib/http.ts/adapters.ts | auth/API contract | timeout AbortController، HTTP status mapping، request ID، abort/race handling؛ لا fixtures عند أي failure | A |
| A03 P0 | Auth UI/provider؛ demo-pages AccountScreen، site-shell، app/login/register/profile/layout | B02 auth/me/logout | server current user، cookies مناسبة، 401 expiry، no role switching في production، no tokens/local secrets in storage | A |
| A04 P1 | Catalog/detail/public listings؛ components/products.tsx، app/products/page.tsx و[id]/page.tsx | B04 catalog/listing API | real catalog variants، search/pagination، image fallback، لا synthetic Seller generation | A |
| A05 P1 | Seller Products & Agent Settings؛ components/storefront-manager.tsx وdemo-pages ProductForm/RulesForm | B05 owned writes/rules | only owned listings؛ submit busy/error/version conflict؛ enable/disable real، no other Seller private payload | A |
| A06 P1 | بدل provider محلي بproduction adapter؛ competitive-provider.tsx وPROPOSED production-provider.tsx | B06 snapshots/commands | نفس view model للـBuyer/Seller/Admin؛ لا تحميل raw private inventory للعميل | A |
| A07 P1 | Start requirements؛ competitive-negotiation.tsx/products.tsx | B06 start + eligibility | request authenticated + idempotency، accepted session ID، no local attempt fabrication، واضحة excluded reasons | A |
| A08 P1 | Live snapshot/events/polling؛ competitive-negotiation.tsx/seller-competitive.tsx/unified-workspace.tsx | B07 events/worker | رسائل progressive منالخادم، dedup/cursor، reconnect/resync؛ tab لا ينفذ جولة | A |
| A09 P1 | decisions/Agreement؛ competitive-negotiation.tsx/agreement-links.tsx/unified-workspace.tsx | B08 transactional commands | approve/reject/cancel يطابق جواب الخادم؛ 409 محفوظة؛ الزر لا يسجل نجاحًا قبل commit | A |
| A10 P1 | Shared history/metrics؛ unified-workspace.tsx وroot dashboard page.tsx الثلاثة | B09 role-scoped read models | إزالة fallback إلى لوحات O القديمة مع الاحتفاظ بعقد legacy؛ نوعا التفاوض وسجلاتهما الحقيقية | A |
| A11 P2 | Notifications/count/read؛ unified-workspace.tsx/site-shell/demo-pages Notifications | B10 notification API | list/count/read consistent across reload، no global local fixture alerts | A |
| A12 P2 | Reports؛ admin-reports.tsx/lib/integrated-reports.ts/lib/reports.ts/report-download.ts/text-report-pdf.ts | B11 authorized report DTO | preview/PDF/CSV من query scope موثق، no private limits، report ID/as_of، no fabricated missing values | A |
| A13 P2 | Admin actions/audit/system؛ demo-pages/unified-workspace | B12 authorized Admin APIs | real account status، permissions ليست demo authority، no fake telemetry، منع فقد العزل عند direct URL | A |
| A14 P1–P2 | Loading/error/empty/accessibility/mobile؛ ui.tsx وapp/error/loading/not-found.tsx + shell | جميع العقود | English/LTR ثابتة، keyboard focus/dialog، 401/403/404/409/offline/timeout حالات مميزة | A |
| A15 P0 قبل release | production source boundary؛ app/layout.tsx وproviders/lib/api.ts وbuild config review | A02–A13 | NODE_ENV=production لا يحمّل/يعرض fixtures أو selector؛ لا force development لإظهار التصميم | A |
| A16 P0 قبل release | frontend contract/E2E tests؛ frontend/tests + PROPOSED integration fixtures | B staging جاهز وE2E plan | no backend writes في production tests، payload privacy assertions، same design، CI type/build passes | A+B |
| A17 P0 قبل release | build artifact/evidence handoff؛ frontend/Containerfile/next.config.ts/package manifests review فقط ضمن خطة لاحقة | staging/sign-off/verified deployment method | Node container parity، standalone assets/media/API URL، no env credentials/local artifacts in image | A+B/ops |

## 2. API/state mapping المطلوب

- Product الحالي في lib/api.ts يمثل legacy Seller listing؛ لا تستعمله وحده كcatalog identity. mapper يستقبل catalog variant + listing ID + public Seller identity ويفصل route catalog ID عن listing selection.
- Buyer view يستقبل متطلباته الخاصة وعروضه؛ Seller يستقبل own thread فقط وrequirements العامة ولا maximum؛ Admin لا يحصل private budgets/floors افتراضيًا.
- لا اعتبار thread.agreed = parent completed. provisional accepted pair → awaiting Buyer approval؛ فقط Agreement committed يعرض completed/recorded. nonselected/excluded/failed أسباب مستقلة.
- الأموال تأتي decimal strings؛ لا JSON float arithmetic للtotal authoritative. display SAR كما هو؛ server total مرجع، frontend الحساب للمساعدة فقط.
- Dates UTC ISO؛ عرض English بتوقيت معلن ومتسق، لا invent timestamps للlegacy events.
- رسالة/event لها ID/cursor/version؛ state reducer للعرض فقط لا يحدد السعر أو هوية المستخدم أو transition نهائي.
- Server validates start eligibility وapproval recheck؛ لا يحوّل empty eligibility إلى mock sellers.

## 3. التعامل مع الفشل والاتصال

loading skeleton بنفس cards؛ empty state يفرّق no matching products عن no eligible Seller وعن unauthorized/unavailable. 404 حقيقي، 401 sign-in، 403 access denied، 409 reload/latest offer، 422 field errors، timeout/offline مع retry للقراءة. mutation retry بنفس idempotency key فقط، لا إعادة أمر مجهول النتيجة بمفتاح جديد. disable duplicate submit واستخدم get command outcome/snapshot بعد timeout.

Polling أولًا؛ visibility يقلل استهلاك العرض لا يوقف Celery. بعد reconnect استعادة snapshot/cursor وdedup، no optimistic fake accepted price. لا WebSocket/library جديدة مطلوبة دون حاجة وموافقة.

## 4. إعدادات البيئة

API_INTERNAL_URL للسيرفر داخل الشبكة، browser same-origin /api؛ لا expose host داخلي عبر NEXT_PUBLIC. لا DATABASE_URL/JWT_SECRET/Gemini credentials في frontend أو image/client bundle. USE_MOCK_DATA يستمر dev-only كما هو؛ env إنتاج لا يحوله إلى true ولا NODE_ENV=development. .env.local/caches/verification تُستثنى من release artifact في مرحلة التحضير اللاحقة، لا تغييرات الآن.

## 5. ما لا يجب على المطور A تنفيذه منفردًا

لا SQL/migrations أو DB credentials، لا direct Supabase queries، لا Gemini browser call، لا worker/stock reservation من React، لا auth عبر seller_id query، لا نسخ localStorage إلى DB. محاكاة السعر fixtures للاختبار فقط. لا استبدال backend APIs بأسماء الأمثلة المقترحة قبل اتفاق B.

التسليم بين A وB: OpenAPI/payload أمثلة منزوع منها أي سر، role-scoped snapshots، status transition diagram، idempotency/errors/version policy، test fixtures وحدود المال/الوقت، staging route/base URL. ثم acceptance E2E وليس screenshots وحدها.


---

## تحديث الأدلة AWS-R1 — 19 أكتوبر 2026

**هذا ملحق جديد؛ النص السابق محفوظ كتاريخ للتدقيق، وتُقدَّم نتائج هذا الملحق عند تعارضها معه.** N هو العرض المحلي متعدد البائعين، وO المصدر المحلي القديم، وR المصدر المنسوخ من AWS في `<LOCAL_USER_HOME>\Documents\autoneg-production-reference`. تم فحص R محليًا للقراءة فقط. عبارة SOURCE_VERIFIED تعني وجود السلوك في المصدر، ولا تعني أنه يعمل في الحاوية المنشورة. بيانات الخادم التشغيلية أدناه من توثيق المستخدم؛ لم ننفذ اتصال AWS أو قاعدة بيانات.

الفرع المبلغ عنه `main`، والالتزام `0be5da348fd7c38da41f1628a4420135e02e2cd8`، مع تعديلات محلية على الخادم وعدم وجود Git revision label لصورة الواجهة. لذلك تطابق R مع صورة التشغيل، وDDL الفعلي، ونسخة migrations، وصلاحيات التشغيل، ونجاح التدفقات الحقيقية تظل **NOT_VERIFIED**. لا يجوز نسبة تعديلات working tree تلقائيًا إلى ذلك الالتزام.


### مهام Frontend المحدّثة بعد اكتشاف workspace

| الترتيب | مهمتك | يعتمد على زميل Backend | معيار القبول |
|---|---|---|---|
| F0 | تثبيت تصميم N ومسارات Buyer/Seller/Admin وseller-owned listings كمرجع | اتفاق DTO وإصدار release | لا إعادة Storefronts ولا تعديل UI المعتمد |
| F1 | فصل mock adapter المحلي عن API adapter الحقيقي | current-user وscope آمن | Mock للتطوير فقط؛ real API لا يقع إلى بيانات تجريبية |
| F2 | جرد ونقل سلوك R الفعلي بدل استبداله بـN provider | تأمين 12 workspace endpoints | profile/product/rules/rating والثنائي تستمر ببيانات DB |
| F3 | تحويل actions إلى async نتائج صريحة | أخطاء مستقرة ومعرفات وidempotency | pending/error/retry؛ فشل approve لا ينتج Agreement محليًا |
| F4 | ربط الحساب والتنقل بالهوية الحقيقية | login/logout/current-user | demo role selector ليس authorization |
| F5 | Browse/Details وeligible sellers | catalog/stock/delivery API | مطابقة exact identity، استبعاد مفسر |
| F6 | متطلبات وإنشاء ومتابعة تنافس | parent/thread/events/commands | حالة server مشتركة بين Buyer وSeller؛ لا simulation منفصلة |
| F7 | مقارنة وموافقة وتاريخ الاتفاقيات | atomic approval وlegacy mapping | تحديث القوائم من response المؤكد، بقاء IDs القديمة |
| F8 | notifications/reports/admin | durable notifications وتقارير مخولة | preview/download إنجليزيان، حقول مصرح بها فقط |
| F9 | اختبارات contract وE2E على staging | بيانات اختبار ومصادقة وmigration جاهزة | لا تشغيل اختبارات كتابة على production |

نقاط الدمج الحساسة: root layout،api.ts،demo-provider.tsx،negotiation.tsx تغيّرت بين N وR؛ لا تختزل الدمج في استبدال هذه الملفات. يجب المحافظة على API CRUD الموجودة، وتحديث async signatures واستجابات state/ID بوعي. لا تعرض أسرار ثم تخفيها بـCSS أو filter؛ الخادم يجب ألا يرسلها أصلًا.

ليس ضمن مسؤوليتك إنشاء migrations أو إصلاح transaction locking أو JWT guards أو تشغيل Celery أو نسخ قاعدة البيانات. يمكنك تجهيز types/adapters/UI mocks واختبارات عرض، لكن الربط النهائي ينتظر العقود الآمنة. لا تعوّض عدم جهوزية Backend بإدخال Mock إلى الإنتاج.


---

## AWS-R2 — تجهيز Frontend محليًا، 19 أكتوبر 2026

نُفذ تكامل المنتجات العامة مع تحقق الاستجابة والأخطاء، وأضيفت حدود typed/fail-closed للعقود الخاصة القائمة؛ لا bootstrap أو كتابة غير مخولة ولا fallback تجريبي في الإنتاج. تصاميم الأدوار وملكية Seller والمحاكاة محفوظة. نجحت 8 مجموعات اختبارات وTypeScript والبناء وstatic contract validation واختبار standalone على loopback. لا يثبت ذلك تشغيل FastAPI أو DB أو صورة AWS الفعلية؛ القرار NO-GO للنشر العام باقٍ.

النتائج وقائمة الملفات وقرارات الميزات: [FINAL_FRONTEND_INTEGRATION_REPORT.md](FINAL_FRONTEND_INTEGRATION_REPORT.md). الحزمة وأوامر staging والرجوع المعدة للموافقة فقط: [FRONTEND_STAGING_PLAN.md](FRONTEND_STAGING_PLAN.md). لم يُنفذ اتصال AWS أو نقل أو deploy أو تغيير قاعدة بيانات؛ تاريخ هذا التقرير السابق محفوظ.


## New evidence — 26 October 2026

This document preserves the earlier audit history. For the current authenticated production integration and model/storage matching, see docs/releases/PRODUCTION_RELEASE_REPORT_20261025.md and docs/releases/MODEL_MATCHING_RELEASE_20261025.md. Earlier NOT_VERIFIED/NO-GO statements must be interpreted with the later evidence; the copied AWS source was not proof of an identical running image. Production mock data is disabled. No staging fixtures are promoted.
