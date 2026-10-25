# DATABASE COMPATIBILITY REPORT

19 أكتوبر 2026. **Production deployment version not verified.** لم يُتصل بـSupabase/PostgreSQL ولم تُقرأ سجلات حية أو تُشغّل migrations. ما يلي schema O المتاح: ORM + Alembic 0001، ونفس الملفات في N. المخطط الحي وalembic_version وRLS والنسخ الاحتياطي الفعلي = NOT_VERIFIED.

## 1. الجداول الموجودة بالمصدر

| الجدول | مفاتيح/حقول مهمة | دعم الرحلة الجديدة |
|---|---|---|
| users | BigInteger identity، email unique، password_hash، role buyer/seller/admin، is_active | حسابات وأدوار مخزنة، لكن لا auth/session API أو policy تنفيذ |
| products | seller_id FK users، name/category/description، base_price، min_acceptable_price، stock_quantity، image_url | **قائمة مملوكة لبائع بالفعل**، لا shared catalog/variant ID. تعدد المنتجات ممكن، تجميع نفس النوع غير مضمون |
| seller_rules | seller_id، product_id unique، min_price/max_discount/max_rounds/auto_accept_threshold | قاعدة واحدة لكل legacy product؛ لا enabled/delivery/concession/strategy/version snapshot |
| negotiation_sessions | buyer_id، product_id واحد، max_budget، mode، status أربعة فقط، round_count | one-to-one parent على منتج واحد؛ لا multiple participants/requirements كاملة |
| offers | session_id، offered_by buyer/seller/system، price، conditions JSONB، status، round_number، created_at | تاريخ عروض جزئي؛ لا Seller thread/listing reference أو أنواع event/acceptance structured |
| deals | session_id unique، final_price، final_conditions JSONB، closed_by/closed_at، payment_status | صف deal واحد لجلسة قديمة؛ لا quantity/selected seller/listing/explicit approvals structured |
| ratings | deal_id/rater_id/rated_id/score/comment/time | تقييم legacy deal؛ لا API مثبت أو ربط competitive Agreement |
| audit_logs | session_id optional، user_id optional، action/details/created_at | audit rows قابلة للتعديل؛ ليست immutable ledger لمجرد وجود table |

الأدلة: O/backend/app/models/{user,product,negotiation}.py وalembic/versions/0001_initial_schema.py. لا توجد Storefront table في المصدر؛ لا حاجة لإسقاط كيان متجر حتى نحقق النموذج الجديد. legacy storefrontKey داخل N مجرد identifier محاكاة، لا مخطط إنتاج.

## 2. تغطية المتطلبات

| المتطلب | المصدر الحالي | التوافق | المطلوب / النوع |
|---|---|---|---|
| Users/roles/Sellers | users.role + is_active | PARTIALLY_READY / REAL schema | auth + RBAC + منع owner spoofing |
| Catalog products/variants | غير موجودة | BLOCKED / MISSING | canonical catalogs/variants مع exact identity موثقة |
| Seller-owned listings | products.seller_id + سعر ومخزون | PARTIALLY_READY / REAL | إضافة catalog_variant_id والحفاظ على listing ID |
| Independent prices/stock | لكل product row | PARTIALLY_READY / REAL | لا دمج بالاسم؛ private owner DTO؛ stock concurrency |
| Delivery terms | JSONB conditions في offer/deal فقط | BLOCKED / MISSING listing fields | delivery estimate/terms على القائمة وعلى snapshot |
| Product Agent settings | seller_rules جزئية | PARTIALLY_READY / REAL | declared floor/discount/effective floor/rounds/strategy/concession/enabled/version |
| Buyer requirements | max_budget ومود فقط | BLOCKED / MISSING rest | quantity/target/unit max/deadline/max rounds/authorization mode snapshot |
| Competitive parent/participants/threads | غير موجود | BLOCKED / MISSING | parent + per-listing thread snapshot + owner references |
| Messages/rounds/final offers | offers history جزئي | PARTIALLY_READY / REAL | typed messages/events، thread sequence، accepted pair/final eligibility |
| Session statuses | active/completed/failed/cancelled فقط | BLOCKED للتدفق الجديد / REAL partial | awaiting approval/rejected/parent versus thread status، pending commands |
| Agreements | deals legacy | PARTIALLY_READY / REAL | selected exact offer/thread/listing، qty/unit/total/delivery، approval actor/time |
| Notifications/read | لا جدول | BLOCKED / MISSING | scoped durable records/read_at |
| Reports | لا جدول/queries API خاصة | BLOCKED / MISSING API | authorized queries؛ تقرير audit ID/as_of اختياري؛ لا table مطلوبة لكل report |
| Audit | audit_logs | PARTIALLY_READY / REAL | append-only permissions/redaction وتوسيع reference/event semantics |
| Worker retries/outbox | لا persistence لتنسيق المهام | BLOCKED / MISSING | transaction outbox + idempotency/version/locks |

كل وصف REAL أعلاه عن schema repository فقط؛ التنفيذ المنشور P كله NOT_VERIFIED.

## 3. تصميم مقترح يحافظ على السجلات — PROPOSED

اختيار محافظ: **إبقاء products كقوائم Seller** بدل إعادة ترقيمها. إضافة catalogs + catalog_variants، ثم FK nullable products.catalog_variant_id. كل Product.id يبقى listing ID وكل seller_id يبقى كما هو. يمكن لاحقًا تسمية DTO listing دون rename table. لا تجعل catalog price/stock الخاصين مشتركين بين Sellers.

- catalog_products: الهوية العامة/الفئة؛ catalog_variants: exact SKU/specification/condition variant/attributes. المواصفات الجوهرية التي تميز المنتج تحدد matching، لا similarity في الاسم.
- products: الحقول الحالية + catalog_variant_id + delivery estimate + agent status/public metadata/version وفق العقد؛ تفاصيل floor تبقى private.
- seller_rules: توسعة enabled، concession strategy/amount، max rounds، declared floor، discount cap، optimistic version، updated_at. توحيد مصدر floor بين Product.min_acceptable_price وSellerRule.min_price بسياسة موثقة دون إسقاط أحدهما أولًا. لا قاعدة مالكها يختلف عن مالك المنتج.
- competitive_sessions: buyer_id، catalog_variant_id، quantity/target/max unit price/private authorization، delivery deadline، max rounds، mode، lifecycle/version/start/end/decision؛ budget محمي.
- competitive_threads: parent_session_id، listing_id FK products، seller_id، listing/rule snapshot، status/current/final offer؛ UNIQUE(parent_session_id,listing_id). Seller واحد قد يملك قائمتين؛ لا دمج تلقائي لهما، ولا thread مكرر للقائمة نفسها.
- competitive_offers/agent_messages: thread FK، agent/action/price/quantity/delivery/round/created_at/message_id/sequence. price agreements تستند إلى قبولين لنفس offer terms، لا مجرد تجاوز/تلاقي رقمين.
- competitive_agreements: UNIQUE(parent_session_id)، selected_thread_id/selected_offer_id/listing_id/seller_id/buyer_id/variant_id، unit price/quantity/total/delivery/status/approval actor/time. يجري إنشاؤها في transaction واحدة مع event/outbox. deals القديمة باقية؛ API Agreements يوحد النوعين بمراجع namespaced دون تغيير DB IDs القديمة.
- notifications: recipient_user_id، safe event type/ref، created_at/read_at؛ no global private payload.
- negotiation_events/outbox/command_idempotency: durable ordered cursor، scoped payload، publication status، dedup key. Redis ليس source of truth.

الجداول والأسماء أعلاه اقتراح وليس وصفًا لـSupabase. إن كشف SSH أن الإنتاج يملك بعض هذه البنى، يلزم mapping وreuse بدل إنشاء duplicates.

## 4. قيود سلامة وFKs

- Check quantity>0، unit prices>0، stock>=0، discount 0–100، delivery 1–365، supported rounds، concession>0، floor<=opening؛ Decimal/halalas لا float.
- Numeric(10,2) الحالي لا يكفي لكل totals المسموحة محليًا: 1,000,000 SAR × 10,000 units = 10,000,000,000 SAR. حسم business caps أو precision أكبر مثل Numeric(18,2) للحقول الجديدة مع tests overflow. لا تغيير فعلي الآن.
- max budget عند Buyer وحده؛ Seller private snapshot عند المالك/worker فقط؛ لا public catalog joins تعيدها.
- selected thread يجب أن ينتمي لنفس parent، listing للبائع نفسه، accepted offer من thread ذاته. استخدم FK/composite constraints أو transactional assertions، لا frontend checks.
- status في DB القديم varchar15/check أربعة values؛ local review/approved/rejected/paused ليست SQL values صالحة تلقائيًا. canonical state machine مطلوبة، مع legacy adapter وعدم truncation.
- ondelete CASCADE الحالي من users/products إلى التاريخ خطر على متطلبات حفظ السجلات إذا استُخدم حذف فعلي. soft-disable/archive/restrict سياسة أفضل للتاريخ، مع مراجعة retention؛ لا حذف أو cascade نفذ في التدقيق.
- approval: lock parent + listing/stock أو reservation، validate current offer/version/deadline/account status، create unique Agreement، update stock/reservation حسب policy، write audit/outbox، commit. إخفاق أي شرط = rollback/409 دون deal جزئي.

## 5. ترتيب ترحيل البيانات المقترح فقط

1. قبل التصميم النهائي: إثبات release والمخطط الفعلي وprovider/version/schema-only metadata بواسطة المسؤول المصرح؛ لا استنتاج Supabase من compose.
2. على staging معزول: baseline schema، row/FK counts من نسخة اختبار مصرح بها، جرد consumers، ونسخة احتياطية قابلة للاستعادة. لا بيانات حية نُقلت في هذه المهمة.
3. Expand: جداول جديدة وnullable FKs/indexes؛ القديمة وواجهات القراءة تبقى تعمل. migration مراجعة من B، ومراقبة lock duration.
4. Catalog backfill: لكل legacy listing catalog mapping صريح. افتراضيًا لا توحيد بالاسم؛ تبقى قائمة غير مصنفة خارج المنافسة إلى اعتماد variant mapping. لا تغيير seller/price/private floor/stock التاريخية.
5. قواعد قديمة ناقصة delivery/strategy/enabled: لا تخمين تشغيلي. تعيين disabled/pending_configuration حتى يوافق المالك على settings، مع preserving old one-to-one behavior عبر versioned adapter.
6. Session/deal history: إبقاء IDs وFKs ورسائل وتواريخ قديمة كما هي؛ UI يعرض legacy نوعًا منفصلًا. لا توليد chronology/approval غير مسجلة. يمكن append references مُثبتة فقط.
7. Validate: owner matches، orphan checks، duplicate mappings، totals/precision/status counts، unique Agreement، reports reconciliation، rerun قابل للتكرار. مراجعة mapping يدوي للمنتجات used/condition variants.
8. Dual-compatible reads/controlled writes بإشارة feature flag؛ expand migrations تعمل مع release القديم والجديد.
9. بعد نجاح restore/E2E: rollout تدريجي. contract cleanup/drop مؤجل لإصدار مستقل بعد نافذة احتفاظ وbackup معتمد؛ ليس جزءًا من هذا الدمج.

لا seed.py ولا import_products.py ضمن خطة نشر الإنتاج. حتى لو كان seed يتوقف عند وجود users في المصدر، هو كود كتابة؛ ليس وسيلة مزامنة أو backup. لا تحميل Mock/localStorage إلى production.

## 6. Supabase مقابل PostgreSQL المحلي

U يذكر Supabase؛ O/docs/PLAN.md:28 يقول Supabase dropped وO/infra/compose.yaml:5–16 يعرّف postgres container. كلاهما لا يثبت الواقع. script pg-backup.sh يعمل على autoneg-postgresql فقط؛ قد ينسخ قاعدة غير المستخدمة لو الإنتاج يستخدم Supabase. يلزم خطة backup/restore خاصة بالـprovider الفعلي، دون كشف URLs/credentials أو تشغيلها في هذا التدقيق.

حتى مع Supabase، frontend لا يتصل مباشرة بجداول private؛ FastAPI يتحقق من الهوية والملكية. سياسة RLS الحالية NOT_VERIFIED؛ لا نفترض أن وجود Supabase يحمي SQLAlchemy APIs تلقائيًا. approved catalog/listing model لا يحتاج Storefront entity جديدة أو إسقاط كيان قائم دون دليل.


---

## تحديث الأدلة AWS-R1 — 19 أكتوبر 2026

**هذا ملحق جديد؛ النص السابق محفوظ كتاريخ للتدقيق، وتُقدَّم نتائج هذا الملحق عند تعارضها معه.** N هو العرض المحلي متعدد البائعين، وO المصدر المحلي القديم، وR المصدر المنسوخ من AWS في `<LOCAL_USER_HOME>\Documents\autoneg-production-reference`. تم فحص R محليًا للقراءة فقط. عبارة SOURCE_VERIFIED تعني وجود السلوك في المصدر، ولا تعني أنه يعمل في الحاوية المنشورة. بيانات الخادم التشغيلية أدناه من توثيق المستخدم؛ لم ننفذ اتصال AWS أو قاعدة بيانات.

الفرع المبلغ عنه `main`، والالتزام `0be5da348fd7c38da41f1628a4420135e02e2cd8`، مع تعديلات محلية على الخادم وعدم وجود Git revision label لصورة الواجهة. لذلك تطابق R مع صورة التشغيل، وDDL الفعلي، ونسخة migrations، وصلاحيات التشغيل، ونجاح التدفقات الحقيقية تظل **NOT_VERIFIED**. لا يجوز نسبة تعديلات working tree تلقائيًا إلى ذلك الالتزام.


### ما ثبت عن قاعدة البيانات وما لم يثبت

نماذج ORM المنسوخة في R مطابقة لنماذج O: users،products،seller_rules،negotiation_sessions،offers،deals،ratings،audit_logs. هذا يثبت شكل المصدر فقط، وليس DDL أو alembic head في PostgreSQL. لم تصل migrations أو schema dump أو إعداد اتصال فعلي؛ جميعها NOT_VERIFIED. لم تُقرأ سجلات الإنتاج.

الجديد أن workspace يكتب فعلًا لهذه النماذج، فلا يصح وصفها بأنها قراءة فقط. يحمل AuditLog حاليًا scenario وprivateLimits وui_status وenabled؛ وتحمل Offer.conditions معلومات فعل/شرح، وDeal.final_conditions بيانات شروط ومعرفات. يجب الحفاظ على هذه البيانات عند النقل، وعدم اعتبار timestamps البديلة الحالية وقتًا تاريخيًا صحيحًا أو confirmations=true موافقات مثبتة.

| المتطلب | الوضع في R | Migration/قرار مقترح للزميل |
|---|---|---|
| ملكية Seller للمنتج | product.seller_id موجود | الحفاظ على الملكية؛ لا Storefront table |
| المنتج نفسه عبر عدة listings | لا catalog مشترك موثوق | catalog_products/variants + FK nullable أولًا، backfill مراجَع دون fuzzy matching |
| stock/delivery لكل listing | stock موجود؛ لا تعاقد تنافسي كامل | delivery lead time وسياسة المخزون/حجز الكمية؛ تحقق >=0 |
| قواعد Seller | minimum/discount/rounds موجودة؛ enabled مشتق من audit | enabled ونسخة قواعد دائمة وقيود مجال؛ عدم كشفها في public DTO |
| متطلبات Buyer | budget في جلسة ثنائية | parent competitive session: quantity,target,max,deadline,mode,maxRounds، مع حفظ القديم |
| محادثات مستقلة | offers تابعة لجلسة ثنائية | threads تربط parent+seller listing؛ events/offers منظمة وtimestamps وتسلسل واضح |
| نهاية المحاولة/الموافقة | Deal مربوط بجلسة قديمة | Agreements/approval events بمعرفات ومفاتيح فريدة؛ حفظ Deal IDs والشروط القديمة |
| التزامن | خصم وحدة داخل helper؛ لا أقفال واضحة | transactions، row locks أو optimistic version، reservations/idempotency/unique keys |
| إشعارات | مشتقة ومعاد توليدها read=false | notifications/read-state + outbox موثوق |
| السجلات والخصوصية | audit عام وقد يحتوي privateLimits | إبقاؤه محميًا؛ DTO audit منقح بدل إرساله كله |

### خطة ترحيل إضافية تحافظ على السجلات

1. إثبات provider الفعلي وDDL/head ونسخة backup واستعادتها في staging بإذن منفصل؛ وجود حاوية PostgreSQL لا يكفي.
2. إضافة جداول/أعمدة اختيارية وقيود متوافقة أولًا؛ لا drop/truncate/reset ولا demo seeds على الإنتاج.
3. backfill الملكية/catalog وlegacy linkage على staging مع تقرير ambiguous/unmapped، دون تخمين أن أسماء متشابهة هي المنتج نفسه.
4. تحويل قراءة النظام إلى دعم legacy والجديد معًا؛ عدم إعادة إنشاء الاتفاقيات أو تغيير IDs أو أسعارها أو عروضها التاريخية.
5. تخزين قرار الموافقة ومصدر payment status بوضوح؛ القيمة completed القديمة لا تثبت عملية دفع خارجية، ولا تُعاد كتابة التاريخ لتجميله.
6. اختبار atomic approval للكمية المطلوبة، conflict/retry، snapshots وتغيّر الحدود، ثم إصدار migration مُراجع. rollback للتطبيق لا يعني حذف Agreements الجديدة أو إسقاط schema.

أولوية فورية قبل استعمال workspace: فصل `ensure_initial_workspace_data` عن GET bootstrap. المنطق الحالي قد يضيف بيانات تجريبية واتفاقية حتى إلى قاعدة موجودة وفق الشروط؛ المعالجة مستقبلًا تفصل التهيئة، ولا تحذف تلقائيًا أي سجل قائم يُشتبه أنه تجريبي. هذا التقرير لم ينفذ migration أو seed أو أي تعديل.


---

## AWS-R2 — تجهيز Frontend محليًا، 19 أكتوبر 2026

نُفذ تكامل المنتجات العامة مع تحقق الاستجابة والأخطاء، وأضيفت حدود typed/fail-closed للعقود الخاصة القائمة؛ لا bootstrap أو كتابة غير مخولة ولا fallback تجريبي في الإنتاج. تصاميم الأدوار وملكية Seller والمحاكاة محفوظة. نجحت 8 مجموعات اختبارات وTypeScript والبناء وstatic contract validation واختبار standalone على loopback. لا يثبت ذلك تشغيل FastAPI أو DB أو صورة AWS الفعلية؛ القرار NO-GO للنشر العام باقٍ.

النتائج وقائمة الملفات وقرارات الميزات: [FINAL_FRONTEND_INTEGRATION_REPORT.md](FINAL_FRONTEND_INTEGRATION_REPORT.md). الحزمة وأوامر staging والرجوع المعدة للموافقة فقط: [FRONTEND_STAGING_PLAN.md](FRONTEND_STAGING_PLAN.md). لم يُنفذ اتصال AWS أو نقل أو deploy أو تغيير قاعدة بيانات؛ تاريخ هذا التقرير السابق محفوظ.


## New evidence — 26 October 2026

This document preserves the earlier audit history. For the current authenticated production integration and model/storage matching, see docs/releases/PRODUCTION_RELEASE_REPORT_20261025.md and docs/releases/MODEL_MATCHING_RELEASE_20261025.md. Earlier NOT_VERIFIED/NO-GO statements must be interpreted with the later evidence; the copied AWS source was not proof of an identical running image. Production mock data is disabled. No staging fixtures are promoted.
