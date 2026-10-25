# BACKEND REQUIREMENTS FOR TEAMMATE — المطور B

19 أكتوبر 2026. **Production deployment version not verified.** متطلبات مستنتجة من O المحلي وN المعتمد، لا تصريح تعديل أو تنفيذ. لا تغيير Backend/DB/infra أُجري بهذا التدقيق. لا تفترض غياب بند حيًا قبل فحص المصدر المنشور لاحقًا.

## 1. قائمة التنفيذ المقترحة

| ID / Priority | المهمة | الملفات الحالية/المقترحة | الاعتماد | معيار القبول | المسؤول |
|---|---|---|---|---|---|
| B00 P0 | إثبات release وschema الفعليين | deployed git/build metadata/images + source؛ لا env values أو DB records | SSH مقيّد يعده المستخدم | frontend/backend commit أو artifact hashes موثقة؛ المقارنة P محدثة، no service changes | B/ops مع A |
| B01 P0 | إصلاح source contract bugs وتثبيت schema responses | routers/dashboard.py، schemas PROPOSED dashboard.py | deployed diff + tests | Deal mapping صحيح بلا flags مختلقة؛ Audit created_at؛ metrics definitions واحدة؛ populated fixtures لا AttributeError | B |
| B02 P0 | auth/session/RBAC/ownership | security.py، config.py، PROPOSED routers/auth.py/dependencies/auth.py؛ session schema | agreed cookie/API policy | login/me/logout/expiry؛ 401/403؛ لا Admin self-role؛ لا query identity كصلاحية؛ private APIs كلها guarded | B |
| B03 P0 | expand-only catalog/listing schema | models/product.py، negotiation.py، Alembic revisions PROPOSED | schema P confirmed | preserve existing IDs/rows؛ exact variant FK؛ owner invariant؛ constraints/money precision | B |
| B04 P1 | public catalog/listing read/search | routers/products.py أو PROPOSED routers/catalog.py، public schemas | B03 | public DTO بلا floors/rules، filters/pagination/cursor وeligibility reasons، no name matching | B |
| B05 P1 | seller owned CRUD/rules | PROPOSED routers/seller_listings.py، SellerRule schemas | B02/B03 | كل listing مستقل، floor/discount/enabled/delivery/concession/round validation، expected version، owner checked server | B |
| B06 P1 | parent/thread lifecycle/snapshots/start | PROPOSED routers/competitive.py، models + service state_machine.py | B02–B05 | unique parent-listing thread؛ persistent requirements/rule snapshot؛ idempotent start؛ failed/excluded reasons | B |
| B07 P1 | Celery engine/events | worker.py، PROPOSED services/negotiation_engine.py/tasks/competitive.py، outbox model | B06 | proceeds with browser closed، retries idempotent، fair prior-round competition، price constraints/terminal checks، ordered events | B |
| B08 P1 | final approval/Agreement transaction | PROPOSED services/agreements.py، routers/agreements.py | B07 + stock policy | same accepted terms، listing ownership/expiry/stock recheck، one Agreement، atomic state+stock+audit+outbox، reject/cancel no sale | B |
| B09 P1 | role read models/history | dashboard.py أو PROPOSED routers/session_reads.py | B06/B08 | Buyer own parent/all threads، Seller own only، Admin permitted operational DTO، no private-limit exposure | B |
| B10 P2 | notifications + read state | PROPOSED models/notification.py/routers/notifications.py | outbox/auth | exactly-once logical notification/dedup، recipient only، persisted unread/read، no secret payload | B |
| B11 P2 | Buyer/Seller/session reports | PROPOSED services/reporting.py/routers/admin_reports.py | B09/B10 | authorized filters/as_of/report ID، reproducible metrics، actual prices/messages/decision times، no budgets/floors/credentials | B |
| B12 P2 | Admin governance/audit/metrics | PROPOSED routers/admin.py، audit model/policy | B02 + operational schema | server Admin guard، suspension effective، immutable-by-policy event history، paginated/restricted reads، no fabricated telemetry | B |
| B13 P0 قبل release | transactional/idempotent worker hardening | DB constraints/outbox/task retry + service tests | engine/Agreement | duplicate task/approve لا duplicates، crash recovery، cancel race safe، bounded concurrency وstuck detection | B |
| B14 P0 قبل release | schema/data migration rehearsal وbackup restore | reviewed revisions + staging operational runbook | provider/schema verified | counts/FKs/mappings reconciled، no seeds/fixture import، backward-compatible reads، tested restore | B/ops |
| B15 P0 قبل release | security/contract/E2E gates | backend tests PROPOSED + A E2E | B01–B14 | negative access/payload tests، DB persistence، no live-data audit access، successful staged acceptance | B مع A |
| B16 P2 بعد parity | Gemini/NLP optional | PROPOSED server provider only؛ dependencies لاحقًا | privacy/cost/timeout policy | validated structured outputs، no browser keys/private limits in prompts، deterministic fallback policy؛ ليس بديلًا عن state machine | B |

## 2. ضوابط لا تقبل التعويض بالواجهة

- لا يعتبر seller_id أو buyer_id المرسل من المستخدم إثبات هوية. الاستعلام/الكتابة يضيف شرط authorized current_user وowner؛ لا تجلب row ثم تعيد private fields إلى العميل للفلترة.
- private Seller floor/discount/threshold/strategy snapshot للمالك والengine فقط؛ private Buyer maximum للمشتري وخدمة القرار فقط. Admin report DTO لا يشملهما. security.py hash_password وحدها لا تنفذ هذه الضوابط.
- كل أوامر المال/الحالة تحقّق cent precision، positive bounds وversion والحدود المخولة. no float-based totals ولا trusted frontend calculation.
- distinct Seller competition policy: لا competitor identity/other messages/minima، ولا احتساب قائمة المالك نفسه منافسًا دون قرار صريح. لا إشارات من disabled/declined/expired/ineligible offers.
- الاحتفاظ بالسجلات historical snapshots؛ settings edits لا تغيّر active/completed sessions. لا إسقاط products/deals القديمة أو rename IDs بلا mapping.

## 3. جلسات واتفاقيات وتقارير حقيقية

نموذج البيانات والـFKs المقترحان في DATABASE_COMPATIBILITY_REPORT.md. الاتفاقية النهائية تسجل buyer/seller/listing/catalog/selected offer/qty/unit price/total/delivery/status/actor/time. مصدرها transaction، لا شراء أو دفع من browser. يجب تحديد policy stock reservation/reduction والمنافسة بين عدة Buyers قبل Go Live.

notifications ناتجة من events committed وليست UI toast فقط؛ read state لكل recipient. reports queries تعطي only permitted fields ونافذة زمنية وتعريف denominator. completed sessions ليست بالضرورة عدد deals أو payments. لا تسمية totals أرباحًا أو مبيعات مدفوعة دون evidence. legacy missing timestamps/approval = unavailable، لا backfill وهمي.

## 4. الأوضاع والمتطلبات غير المحسومة

المنافسة الجديدة تتطلب final Buyer approval، بينما docs تسمح automated في الرحلة العامة. v1 يجب أن يحدد mode في العقد؛ automated لا يعمل إلا بتفويض موثق سابقًا ضمن limits/state policy. pause tab لا يعني توقف worker. warranty/delivery multiattribute scoring غير منفذ في demo؛ لا تدّع وجود Boulware/Gemini لأن الوثيقة تذكرها.

## 5. التعاون والتسليم للمطور A

قبل تنفيذ UI APIs: OpenAPI مصادق عليه + mock contract fixtures لا actual records، أمثلة success/error/401/403/409، ID/money/date formats، canonical statuses، required approval semantics، idempotency/version/events cursor، public/Buyer/Seller/Admin field allowlists. A يحتفظ بـN components ولا يعيد O dashboard design.

الترتيب: B00/B01/B02 → B03–B05 بالتوازي مع A contracts → B06/B07 → B08/B09 → B10–B12 → B13–B15 → rollout مستقل الموافقة. وجود Redis وCelery حاويتين ليس acceptance للمحرك؛ المطلوب إثبات persistence عند إغلاق tab وقتل/restart worker في staging فقط.

مرحلة SSH الحالية لا تشمل قراءة بيانات DB أو migration execution. إذا احتاج التحقق schema catalog query أو privilege جديد لاحقًا، يلزم موافقة منفصلة. أي secret يبقى عند المسؤول ولا يُنسخ إلى تقارير أو frontend.


---

## تحديث الأدلة AWS-R1 — 19 أكتوبر 2026

**هذا ملحق جديد؛ النص السابق محفوظ كتاريخ للتدقيق، وتُقدَّم نتائج هذا الملحق عند تعارضها معه.** N هو العرض المحلي متعدد البائعين، وO المصدر المحلي القديم، وR المصدر المنسوخ من AWS في `<LOCAL_USER_HOME>\Documents\autoneg-production-reference`. تم فحص R محليًا للقراءة فقط. عبارة SOURCE_VERIFIED تعني وجود السلوك في المصدر، ولا تعني أنه يعمل في الحاوية المنشورة. بيانات الخادم التشغيلية أدناه من توثيق المستخدم؛ لم ننفذ اتصال AWS أو قاعدة بيانات.

الفرع المبلغ عنه `main`، والالتزام `0be5da348fd7c38da41f1628a4420135e02e2cd8`، مع تعديلات محلية على الخادم وعدم وجود Git revision label لصورة الواجهة. لذلك تطابق R مع صورة التشغيل، وDDL الفعلي، ونسخة migrations، وصلاحيات التشغيل، ونجاح التدفقات الحقيقية تظل **NOT_VERIFIED**. لا يجوز نسبة تعديلات working tree تلقائيًا إلى ذلك الالتزام.


### لا تبدأ من الصفر: قدرات موجودة يجب تأمينها

R يحتوي تسجيلًا وprofile/status وproducts/rules وثنائي sessions/advance/approve/end وrating. العمل الأول تقوية هذه المسارات والمحافظة على البيانات، لا إعادة بنائها أو نسخ backend القديم من O فوقها. تصحيحات dashboard mappings موجودة في R، فلا تسجلها كإصلاح غائب دون دليل runtime.

| الأولوية | المطلوب من الزميل | السبب/معيار القبول |
|---|---|---|
| P0 | مصادقة وجلسة حقيقية + RBAC + ownership | منع الاعتماد على buyer_id/seller_id من body أو identity selector |
| P0 | استبدال global bootstrap بإسقاطات حسب الدور | لا Buyer budgets لـSeller، ولا Seller floors/محادثات الآخرين لـBuyer |
| P0 | إزالة auto-seeding من طلبات القراءة | GET لا يكتب؛ سياسة fixtures منفصلة للتطوير، دون حذف السجلات القائمة |
| P0 | validation للمبالغ/الكمية/mode/rounds وtransition guards | منع approve بعد تغير الشروط ومنع end لتراجع صفقة مكتملة |
| P0 | transaction/idempotency/stock concurrency | موافقة واحدة موثوقة لا تؤدي لبيع فوق المخزون |
| P0 | مراجعة defaults والأسرار وpayment/confirmation semantics | لا كلمات مرور افتراضية أو تأكيدات ودفع غير مثبت |
| P1 | catalog exact identity وseller-owned listings/delivery/rules persistence | لا Storefronts ولا fuzzy name matching |
| P1 | parent competitive session + threads/events/orchestrator | تنافس مستقل، عروض مؤهلة، anonymous price، توقف وموافقة |
| P1 | migrations إضافية وlegacy mapping | حفظ Users/Products/Offers/Deals/Agreements/Audit القائمة |
| P2 | notification state/outbox وتقارير مخولة | IDs ثابتة، read-state، إحصاءات موثقة وصادرات خالية من الأسرار |
| P2 | snapshots/cursors/reconnect وعقود أخطاء وإصدار API | مزامنة واجهات Buyer/Seller/Admin دون local truth |

يتطلب تطوير التنافس endpoints جديدة؛ انظر ملحق API matrix. تقوية CRUD والثنائي الحاليين لا تستلزم إعلان كل العقود الحالية مفقودة. تسليم Backend المطلوب: OpenAPI مُراجع، أمثلة DTO لكل دور، أخطاء وحالات انتقال، migration/backfill/rollback مُجرَّبة على staging، واختبارات خصوصية وتزامن. لا نحتاج Gemini frontend؛ أي AI لاحقًا يكون من الخادم بعد استقرار القيود.


---

## AWS-R2 — تجهيز Frontend محليًا، 19 أكتوبر 2026

نُفذ تكامل المنتجات العامة مع تحقق الاستجابة والأخطاء، وأضيفت حدود typed/fail-closed للعقود الخاصة القائمة؛ لا bootstrap أو كتابة غير مخولة ولا fallback تجريبي في الإنتاج. تصاميم الأدوار وملكية Seller والمحاكاة محفوظة. نجحت 8 مجموعات اختبارات وTypeScript والبناء وstatic contract validation واختبار standalone على loopback. لا يثبت ذلك تشغيل FastAPI أو DB أو صورة AWS الفعلية؛ القرار NO-GO للنشر العام باقٍ.

النتائج وقائمة الملفات وقرارات الميزات: [FINAL_FRONTEND_INTEGRATION_REPORT.md](FINAL_FRONTEND_INTEGRATION_REPORT.md). الحزمة وأوامر staging والرجوع المعدة للموافقة فقط: [FRONTEND_STAGING_PLAN.md](FRONTEND_STAGING_PLAN.md). لم يُنفذ اتصال AWS أو نقل أو deploy أو تغيير قاعدة بيانات؛ تاريخ هذا التقرير السابق محفوظ.


## New evidence — 26 October 2026

This document preserves the earlier audit history. For the current authenticated production integration and model/storage matching, see docs/releases/PRODUCTION_RELEASE_REPORT_20261025.md and docs/releases/MODEL_MATCHING_RELEASE_20261025.md. Earlier NOT_VERIFIED/NO-GO statements must be interpreted with the later evidence; the copied AWS source was not proof of an identical running image. Production mock data is disabled. No staging fixtures are promoted.
