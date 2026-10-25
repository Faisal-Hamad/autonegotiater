# END-TO-END TEST PLAN

19 أكتوبر 2026. **Production deployment version not verified.** هذه خطة قبول مستقبلية، لا نتائج E2E حي. تُنفذ على staging مع DB/Redis/media/accounts اصطناعية معزولة بعد بناء APIs. المسارات `/v2` أدناه **PROPOSED وغير موجودة في O**؛ داخليًا /v2، وخارجيًا /api/v2. فقط GET products/dashboard موثقة حاليًا. A Frontend وB Backend، ops مسؤول بيئة الاختبار عند الحاجة.

## 1. الشروط العامة

- release/frontend/backend digests موثقة وstaging منفصل قطعًا عن credentials/queues/DB الإنتاج.
- NODE_ENV=production وMock معطل؛ لا fixtures frontend أو identity selector. backend test fixtures مسموحة في staging فقط، عبر setup معتمد من B، لا استيراد localStorage إلى production.
- ثلاثة Sellers بملكية مستقلة لنفس exact variant، مع listings مستقلة floor/discount/stock/delivery/enabled؛ Buyerان وAdmin معروفون. الأسعار والحسابات اختبارية وليست business records.
- مثال Dell quantity10/target4000/max4300/deadline7، مع Seller قادرين وآخر late/low-stock، وحالة no-overlap؛ إمكانية expected result مستقلة موثقة للـserver policy.
- consent/mode/status definitions، stock reservation policy، event cursor/error DTO/idempotency/version agreed. يمكن للbackend تنفيذ deterministic policy v1؛ لا يلزم Gemini لإثبات persistence/privacy.

## 2. اختبارات القبول العشرون المطلوبة

| ID | الشروط المسبقة | الخطوات | النتيجة المتوقعة | Required API | الجاهزية الحالية | المسؤول |
|---|---|---|---|---|---|---|
| E01 Buyer authenticates | حساب Buyer staging وauth server | login ثم me ثم route Buyer؛ انتهاء جلسة/logout وإعادة الطلب | هوية verified، cookie policy، 401 بعد expiry/logout، لا role query spoof | PROPOSED auth/login/me/logout | BLOCKED؛ UI Mock فقط؛ P NOT_VERIFIED | B auth + A UI |
| E02 Products from DB | schema/products fixtures staging | فتح Browse Products، مقارنة IDs/fields باستجابة fixture المعتمدة، search/page/category/404 | بيانات API فعلية، Decimal/media mapping، no silent fixtures | GET /products/{id} و/products موجودان؛ PROPOSED catalog | PARTIALLY_READY للقراءة؛ DB runtime NOT_VERIFIED | A+B |
| E03 Multiple Sellers same product | exact variant مع 3 listings وعينة similar-name مختلفة | فتح details ثم listings؛ تغيير catalog | فقط exact variant، listing IDs distinct، owner/prices محفوظة؛ unrelated item لا يظهر | PROPOSED catalog/{variant}/listings | BLOCKED؛ Mock matching tests PASS فقط | B schema + A cards |
| E04 Seller-specific settings | SellerA/B وقواعد مختلفة | كل Seller يقرأ ويعدل قائمته/Agent؛ اطلب foreign listing | الخاص ينجح، الأجنبي 403/404، private rules لا تظهر للBuyer؛ settings version محفوظ | PROPOSED seller/listings GET/PATCH | BLOCKED؛ local rules فقط | B guards + A editor |
| E05 Start competitive | Buyer موثق، eligible lists | إدخال qty/target/max/deadline ثم Start مرة وإعادة نفس request key | accepted parent واحد/threads unique، owner من session، snapshots requirements/rules محفوظة | PROPOSED POST competitive-sessions | BLOCKED؛ local start PASS | A+B |
| E06 Independent background agents | parent running وworker staging | متابعة جولة، إغلاق tab، انتظار تنفيذ worker ثم إعادة الدخول من browser آخر | الرسائل/الجولات استمرت في DB بلا timer frontend، استقلال كل thread وتاريخ كامل | PROPOSED session snapshot/events + Celery tasks | BLOCKED؛ المصدر worker ping | B engine + A viewer |
| E07 Confidential bounds | fixtures مع limits معروفة لـtest service فقط | افحص public/Buyer/Seller/Admin report payloads/events/errors/log redaction؛ عروض عبر الجولات | Buyer max لا يصل Seller؛ Seller floor لا يصل Buyer/other Seller/reports؛ server offers ضمن الحدود | role-specific DTOs/commands/events | BLOCKED API؛ local privacy PASS ليست auth | B security + A payload tests |
| E08 Live updates | running task وcursor | polling/events، duplicate delivery، out-of-order/stale event، status changes | تظهر progressive دون local advance، dedup ID، coherent round/status، final view لا يسبق review | PROPOSED GET events?after + snapshot | BLOCKED | B events + A reducer |
| E09 Seller own conversation | SellerA/B في parent نفسه | افتح SellerA threads ثم direct URL لـSellerB وأعد query بID آخر | own messages/settings فقط؛ foreign denied server؛ anonymous signals بلا identity | PROPOSED threads/{id} + scoped session reads | BLOCKED API؛ local direct denial PASS | A+B |
| E10 Compare eligible offers | جولة نهائية، successful وexcluded/late/failed threads | افتح comparison وبدّل الاختيار | eligible agreed offers فقط قابلة للاختيار؛ السعر ثم delivery ترتيب موثق؛ current quote ليست final Agreement | PROPOSED session final offers snapshot | BLOCKED | B final eligibility + A comparison |
| E11 Buyer approval | final pair accepted وoffer version صالح | Review ثم Confirm؛ double click/retry same key؛ stale version case | success واحد بعد commit؛ stale/changed terms=409 بلا fake success؛ اختيار أي عرض eligible | PROPOSED POST session/{id}/approve | BLOCKED؛ local idempotence PASS | A+B |
| E12 Agreement persisted | successful approval | اقرأ Agreement API من session أخرى/بعد refresh؛ تحقق atomic DB state في staging test فقط | seller/listing/catalog/qty/unit/total/delivery/time/selected offer صحيح؛ unique parent Agreement؛ stock policy atomic | PROPOSED GET agreements/{id} + DB service assertions staging | BLOCKED | B transaction + A display |
| E13 Seller sees Agreement | Agreement selected SellerA | دخول SellerA ثم SellerB؛ افتح own/foreign Agreement | منتخب يرى سجله؛ غير منتخب not-selected دون بيانات sale الآخر الخاصة؛ source links صحيحة | PROPOSED agreements list/detail | BLOCKED | A+B |
| E14 Admin monitors completion | Admin active وcompleted session | دخول Admin sessions/Agreement ثم محاولة نفس endpoint من Buyer | overview/threads operational fields والقرار متسقة؛ Admin-only denied لغيره؛ no private limits | PROPOSED admin/sessions/agreements | BLOCKED؛ admin read جزئي غير guarded O | B auth/read models + A |
| E15 Reports actual records | fixtures نتائجها معروفة تشمل فشل/رفض/legacy/completed | Seller/Buyer/session report مع filters؛ preview وPDF وCSV ومقارنة IDs/totals/denominator | actual query scope/as_of، no fictional timestamps/paid sales، privacy محفوظ، actual downloads English/LTR | PROPOSED admin/reports/{type}/{id} | BLOCKED data APIs؛ export unit tests PASS | B queries + A export/QA |
| E16 Notifications/read state | أحداث start/offer/review/Agreement committed | اقرأ كBuyer/Seller/Admin حسب policy؛ mark read؛ refresh/new browser | recipient فقط، no duplicate logical event، badge/list متطابقان وحالة القراءة persistent | PROPOSED notifications + read | BLOCKED | B outbox/records + A UI |
| E17 Refresh restores | session في mid-round ومعرّفات events ثابتة | refresh/إزالة browser demo keys في staging فقط؛ تسجيل دخول من جهاز جديد | authoritative session/history/Agreements تعود من DB، لا localStorage requirement ولا duplicate task | PROPOSED session/history/agreements + auth | BLOCKED للسيرفر؛ local v4 restore PASS | A+B |
| E18 Reconnection | running worker وnetwork fault staging | قطع اتصال viewer، أكمل worker، reconnect بعد cursor gap/expiry | offline banner ثم resync snapshot/events، no missing/duplicated messages/false Agreement، execution لا يتوقف | PROPOSED events after + snapshot | BLOCKED | A+B |
| E19 Invalid/unauthorized access | test identities وrequest harness staging | anonymous/foreign IDs/role spoof/disabled user، negative/overflow price/qty/deadline، expired offer | 401/403/404/409/422 حسبالعقد، no data leak أو writes، no private values in error | كل private read/command APIs | BLOCKED؛ source guards ناقصة | B security + A states |
| E20 No production Mock | production-mode staging artifact | حاول USE_MOCK_DATA=true مع NODE_ENV production؛ network failure؛ ابحث runtime UI/payloads عن fixtures/selector | Mock guard يظل false، no fallback synthetic records، approved UI متصل فعليًا ولا BackendPending للميزة المعلنة | build config + production providers + real contracts | PARTIALLY_READY للguard الذي نجح محليًا؛ باقي الرحلة BLOCKED | A+B/ops |

P لكل صف = NOT_VERIFIED. أي PASS محلي في العمود السابق يتعلق بمحاكاة/code checks فقط، وليس نتيجة E2E الموضوعة في هذا الجدول.

## 3. اختبارات حالات الفشل والسباق الإضافية

| ID | Scenario / steps | Expected result | dependencies / owner |
|---|---|---|---|
| X01 | requirements ضمن نطاقين متداخلين وعدة eligible Sellers | أكثر من provisional Agreement ممكن؛ Buyer يختار واحدة فقط، nonselected reasons واضحة | engine/approval، B+A |
| X02 | maximum أدنى من كل effective floors أو round cap قصير | failed حقيقي بلا force Agreement؛ no sale/stock deduction | B policy، A failure state |
| X03 | final review ثم Reject all offers | retained rejected parent/history/decision timestamp، no Agreement | B command + A dialog |
| X04 | cancel أثناء task أو قبل approval، وأعد cancel | terminal retained؛ task لاحق لا يضيف offers/Agreement؛ idempotent response | B concurrency + A |
| X05 | Seller disabled/suspended، stock<quantity، delivery>deadline | exclusion مفصّل عند start؛ تغير فعال عند final recheck وفق snapshot policy | B eligibility + A reasons |
| X06 | Seller يملك قائمتين لنفس variant | لا merge أو duplicate لنفس listing؛ settings مستقلة؛ self-owner ليس competing Seller وفق policy المعتمدة | B schema/signals + A labels |
| X07 | settings edit أثناء جلسة running/completed | snapshots/old prices/messages لا تتبدل؛ future session وحدها تستخدم القيم الجديدة | B versions + A editor |
| X08 | Buyerان يوافقان على آخر10 وحدات في وقت واحد | stock لا يصبح سالبًا؛ Agreement واحدة بحسب الحجز المتاح، الثاني conflict/no false sale | B transaction/locks |
| X09 | worker crash بعد DB commit وقبل publish ثم retry | outbox يوصل حدثًا منطقيًا واحدًا، no duplicate round/offer/Agreement | B tasks/outbox + ops staging |
| X10 | approval timeout مجهول النتيجة ثم retry نفس command key | يعيد Agreement نفسها أو conflict موثق، لا double commit | B idempotency + A recovery |
| X11 | populated legacy Deal/Audit fixtures | dashboard responses لا AttributeError؛ fields الحقيقية/unknown approvals معروضة بصدق | B DTO + A mapping |
| X12 | decimal .01، floor/discount rounding، quantity/max monetary overflow | clamps server وفقpolicy، رفض invalid totals، لا float drift | B validation + A display |
| X13 | migrated old schema/sample history على staging | counts/IDs/ownership/FKs intact، rerun no duplicates، mapping ambiguous لا يدخل competition | B migrations + A legacy read |
| X14 | PDF/CSV long history/missing data/Unicode/formula-like content | actual file، English UI headings/date/RTL policy، no formula injection، fallback disclosed، no missing info fabrication | A export + B scoped payload |
| X15 | mobile/tablet/desktop keyboard navigation | one shell، active nested links، menu aria-expanded/controls، focus dialogs، no document overflow | A QA |
| X16 | production artifact startup/SSR/proxy/media/auth في staging | standalone assets صحيحة، API_INTERNAL_URL server-only، /api strip صحيح، HTTPS cookies، no env/cache leakage | A+B/ops |

لا worker crash أو network fault أو stock contention أُجري على الإنتاج. لا تُنفذ mutating smoke عليه ضمن إذن التدقيق الحالي.

## 4. دليل قبول يجب حفظه عند التنفيذ لاحقًا

release image digests/contract version، test run IDs وfixture manifest اصطناعي، sanitized request/response captures بلا tokens/budgets/floors لغيرمالكها، session/thread/Agreement IDs اختبارية، event cursors/versions، DB assertion output aggregated منstaging، screenshot للعرض، logs منقحة إن أجيزت، actual PDF/CSV filenames/checksums، negative/race outcomes. لا نسخ records الإنتاج لإثبات UI.

PASS suite محلية أو screenshot لا يحل محل هذا الدليل. أي test BLOCKED يبقى كذلك حتى تجهز API/DB/worker، لا يتحول SKIP إلى PASS. لا تُضاف test dependencies أثناء التدقيق؛ اختيار E2E runner/بيئة CI يكون لاحقًا بموافقة إذا احتاج package.

## 5. معايير Go/No-Go

نجاح E01–E20 وX01–X16 في staging المتفق عليه، وتطابق التصميم المعتمد، وإغلاق R00–R15 الحرجة في readiness audit، وحفظ خطة restore/rollback. فريق A يوقّع UI/contract flows، B يوقّع engine/privacy/data integrity، مسؤول النشر يوقّع runtime/backup/release. الإنتاج الحالي يبقى دون تغيير أثناء هذه المراحل.


---

## تحديث الأدلة AWS-R1 — 19 أكتوبر 2026

**هذا ملحق جديد؛ النص السابق محفوظ كتاريخ للتدقيق، وتُقدَّم نتائج هذا الملحق عند تعارضها معه.** N هو العرض المحلي متعدد البائعين، وO المصدر المحلي القديم، وR المصدر المنسوخ من AWS في `<LOCAL_USER_HOME>\Documents\autoneg-production-reference`. تم فحص R محليًا للقراءة فقط. عبارة SOURCE_VERIFIED تعني وجود السلوك في المصدر، ولا تعني أنه يعمل في الحاوية المنشورة. بيانات الخادم التشغيلية أدناه من توثيق المستخدم؛ لم ننفذ اتصال AWS أو قاعدة بيانات.

الفرع المبلغ عنه `main`، والالتزام `0be5da348fd7c38da41f1628a4420135e02e2cd8`، مع تعديلات محلية على الخادم وعدم وجود Git revision label لصورة الواجهة. لذلك تطابق R مع صورة التشغيل، وDDL الفعلي، ونسخة migrations، وصلاحيات التشغيل، ونجاح التدفقات الحقيقية تظل **NOT_VERIFIED**. لا يجوز نسبة تعديلات working tree تلقائيًا إلى ذلك الالتزام.


### تعديل خطة الاختبار وفق العقود الموجودة

اختبارات التدقيق القديمة المتعلقة بغياب endpoints تعاد تصنيفها: CRUD/profile/rules/rating والثنائي موجودة في R ويجب اختبار تأمينها وتكاملها؛ التنافس وauth الحقيقي وnotifications/report APIs الجديدة ما زالت تحتاج تطويرًا. لا تُنفَّذ الحالات التالية على production أو R؛ تستعمل staging مخصصًا بعد موافقة منفصلة.

| الاختبار المستقبلي | النتيجة المطلوبة |
|---|---|
| bootstrap لكل دور/مستخدم | DTO لا يحوي بيانات أو حدود الطرف الآخر حتى في HTML/network |
| GET على قاعدة اختبار فارغة أو قائمة | لا users/rules/sessions/Deal/commit ناشئ عن القراءة |
| تسجيل/profile/status | هوية حقيقية وAdmin guard؛ body IDs لا تسمح بانتحال طرف |
| own/foreign product + rules | المالك فقط؛ enabled دائم لا يسقط بعد حد audit |
| create/advance ثنائي قديم | التناوب والحدود والـIDs والتاريخ تستمر |
| approve بعد تغيير floor/stock/enabled | إعادة تحقق ذرية ورفض موضح، بلا Deal وهمي |
| end بعد completed أو تكرار approve | terminal state ثابت وAgreement واحدة |
| موافقات متزامنة على مخزون قليل | لا overselling، ولا خصم مزدوج أو ضياع وحدة |
| 4xx/5xx/timeout في register/save/approve | error واضح؛ لا local success ولا Mock fallback في real mode |
| Deal.completed وdashboard confirmations | لا عرض دفع أو موافقة مثبتة دون سجل موثوق |
| catalog متعدد listings | exact ID، كمية وتسليم مؤهلان، لا Storefronts |
| تاريخ التنافس وSeller scope | محادثة Seller نفسه، أسعار منافسة مجهولة فقط |
| تقارير/إشعارات | source واضح، read-state ثابت، لا private limits أو حقول مختلقة |
| migration/rollback على staging | حفظ السجلات والمعرفات والعروض والاتفاقيات القديمة والجديدة |
| provenance | المصدر العامل مرتبط بالـimage digest؛ لا اعتماد SHA clean مع dirty tree |

### ما نُفّذ بالفعل في AWS-R1

- نجحت مجموعات Node السبع وفحص TypeScript المحلي دون إصدار ملفات؛ تحقق محلي وليس live backend E2E.
- نجح فحص syntax عبر AST لجميع ملفات Python الستة عشر في المصدر R دون استيرادها أو تشغيلها.
- جرد المسارات ومقارنة الملفات ومراجعة الأسرار محليًا؛ لا طلب HTTP إلى production، حتى GET bootstrap قد يكتب فلا يجوز اعتباره اختبار قراءة آمنًا.
- لم تُنفذ اختبارات DB أو migrations أو worker أو build أو deployment؛ تبقى هذه بوابات مستقبلية وليست اختبارات ناجحة ضمنيًا.


---

## AWS-R2 — تجهيز Frontend محليًا، 19 أكتوبر 2026

نُفذ تكامل المنتجات العامة مع تحقق الاستجابة والأخطاء، وأضيفت حدود typed/fail-closed للعقود الخاصة القائمة؛ لا bootstrap أو كتابة غير مخولة ولا fallback تجريبي في الإنتاج. تصاميم الأدوار وملكية Seller والمحاكاة محفوظة. نجحت 8 مجموعات اختبارات وTypeScript والبناء وstatic contract validation واختبار standalone على loopback. لا يثبت ذلك تشغيل FastAPI أو DB أو صورة AWS الفعلية؛ القرار NO-GO للنشر العام باقٍ.

النتائج وقائمة الملفات وقرارات الميزات: [FINAL_FRONTEND_INTEGRATION_REPORT.md](FINAL_FRONTEND_INTEGRATION_REPORT.md). الحزمة وأوامر staging والرجوع المعدة للموافقة فقط: [FRONTEND_STAGING_PLAN.md](FRONTEND_STAGING_PLAN.md). لم يُنفذ اتصال AWS أو نقل أو deploy أو تغيير قاعدة بيانات؛ تاريخ هذا التقرير السابق محفوظ.


## New evidence — 26 October 2026

This document preserves the earlier audit history. For the current authenticated production integration and model/storage matching, see docs/releases/PRODUCTION_RELEASE_REPORT_20261025.md and docs/releases/MODEL_MATCHING_RELEASE_20261025.md. Earlier NOT_VERIFIED/NO-GO statements must be interpreted with the later evidence; the copied AWS source was not proof of an identical running image. Production mock data is disabled. No staging fixtures are promoted.
