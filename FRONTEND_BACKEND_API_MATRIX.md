# FRONTEND / BACKEND API MATRIX

19 أكتوبر 2026. **Production deployment version not verified.** inventory أدناه مستخرج من O/backend (نسخته في N مطابقة)، لا OpenAPI حي. P لكل endpoint = NOT_VERIFIED. لا استدعاء endpoints الإنتاج أو قراءة سجلات قاعدة بيانات.

## 1. كل المسارات الموجودة والمثبتة

FastAPI root_path=/api لا يضيف prefix إلى router definitions داخليًا. Nginx يزيل `/api/` عند proxy. لذلك الطلب الداخلي `/products` والطلب العام المتوقع `/api/products`. مطابقة Nginx الحي NOT_VERIFIED. main.py يسجل routers products وdashboard فقط. كل الطرق أدناه GET؛ لا POST/PATCH/DELETE أعمال متاح.

| method / route داخلي (عام متوقع) | request | response المثبت بالمصدر | auth / authorization | DB | frontend consumer | الحالة |
|---|---|---|---|---|---|---|
| GET /products (/api/products) | query category?: string، equality فقط؛ لا body | list[ProductPublic] مرتبة id | لا auth؛ public response allowlist | products، optional category predicate | lib/api.ts getProducts؛ app/products/page.tsx | موجود؛ FULLY_COMPATIBLE للقراءة العامة البسيطة فقط؛ runtime P NOT_VERIFIED |
| GET /products/{product_id} | int path؛ لا body | ProductPublic؛ 404 Product not found؛ validation 422 | لا auth؛ public DTO | products by PK | getProduct؛ app/products/[id]/page.tsx | موجود؛ FULLY_COMPATIBLE لتفاصيل legacy product فقط |
| GET /dashboard/seller | query seller_id:int default1 | seller{id,name,email}; stats{total_products,active_negotiations,completed_deals}; products[]{id,name,category,base_price,min_acceptable_price,stock_quantity,has_rules,auto_accept_threshold,max_rounds}; recent_sessions[]{id,product_id,buyer_id,status,mode,started_at} آخر10 | لا current-user guard؛ يفحص أن target User.role=seller؛ ليس authorization | users/products/seller_rules/negotiation_sessions | getSellerDashboard؛ seller root real branch | PARTIALLY_COMPATIBLE؛ لا publish قبل auth/ownership؛ floor متاح لمستدعي غير موثق |
| GET /dashboard/buyer | query buyer_id:int default4 | buyer{id,name,email}; stats{active_negotiations,completed_deals,total_sessions}; sessions[]{session_id,product_id,product_name,base_price,max_budget,status,mode,started_at}; deals[]{deal_id,session_id,final_price,agreed_conditions,buyer_confirmed,seller_confirmed,created_at} | يفحص target role فقط؛ لا caller authorization | users/negotiation_sessions/products/deals | getBuyerDashboard؛ buyer root real branch | PARTIALLY_COMPATIBLE؛ تسرب budget عبر target ID لو شُغّل كما هو؛ Deal response mismatch |
| GET /dashboard/admin | لا request schema/body | metrics{total_users,total_buyers,total_sellers,total_products,total_sessions,active_sessions,completed_deals}; users[]{id,name,email,phone,role,is_active,registered_at}; recent_audit_logs[]{id,user_id,action,details,timestamp} آخر15 | لا auth ولا Admin guard | users/products/sessions/deals/audit_logs | getAdminDashboard؛ admin root real branch | PARTIALLY_COMPATIBLE؛ بيانات حسابات بلا صلاحية بالمصدر، AuditLog mismatch |
| GET /health | لا body | {status:"ok",db:"ok" أو "down"} | عام | SELECT 1 فقط | deploy workflow curl، لا UI telemetry موثوق | PARTIALLY_COMPATIBLE للreadiness؛ يرجع HTTP200 حتى db down |

ProductPublic بالضبط: id:int، seller_id:int، name:str، description:str|null، category:str، base_price:Decimal (JSON string متوقع من serialization)، stock_quantity:int، image_url:str|null، created_at:datetime. لا min_acceptable_price. واجهة Product TypeScript تطابق قراءة هذه الحقول، لكن IDs numbers تحتاج حسمًا مع BigInteger عند scale.

Dashboard responses هي dict[str,Any] بلا response_model محدد؛ لا توجد Pydantic schemas لrequests تفاوض/قواعد/اتفاقيات. HTTP404 للـBuyer/Seller المفقود أو اختلاف target role ليس HTTP403 لحماية caller. لا cookie/token dependency أو Depends(get_current_user) في routers المتاحة.

FastAPI يولد كذلك docs/OpenAPI/ReDoc/Swagger redirect تلقائيًا؛ هذه ليست business APIs ولا دليل auth. إبقاء docs عامة/محجوبة قرار نشر لاحق، ولا يجري تغييره هنا.

### عيوب العقد المؤكدة بالمصدر

- dashboard.py:139–142 يقرأ Deal.agreed_conditions/buyer_confirmed/seller_confirmed/created_at، بينما models/negotiation.py:55–70 يعرّف final_conditions/closed_at ولا confirmation flags. الاستجابة مع deals غير فارغة معرضة AttributeError. لا نختلق confirmation من status دون policy.
- dashboard.py:199 يقرأ AuditLog.timestamp، والموديل يستخدم created_at:97؛ يظهر الخلل عند وجود صف audit.
- Seller/Buyer stats.completed_deals محسوب من sessions completed، بينما Admin يعد Deal rows. يلزم توحيد التعريف، لا مساواة غير مبررة.
- لا timeout أو typed error mapping أو auth forwarding في lib/api.ts؛ fetch cache:no-store محفوظ. client browser مستقبلًا يستخدم same-origin /api، SSR يستخدم API_INTERNAL_URL داخل الشبكة.

## 2. مصفوفة التوافق للواجهة الجديدة

التقييم ضد O، وليس P. Owner: A Frontend، B Backend، A+B عقد مشترك. FULLY_COMPATIBLE لا يعني آمنًا أو متحققًا حيًا خارج نطاق الصف المحدد.

| Feature | New Frontend Requirement | Existing Backend Endpoint | Compatibility | Required Change | Owner |
|---|---|---|---|---|---|
| Public products | قائمة حقول Product الحالية | GET /products | FULLY_COMPATIBLE | adapter واختبار payload حقيقي في staging | A |
| Public detail | legacy product fields و404 | GET /products/{id} | FULLY_COMPATIBLE | mapper، أخطاء الشبكة، توثيق Decimal/media | A |
| Catalog search/pagination | query/sort/category/cursor/variant | category فقط | PARTIALLY_COMPATIBLE | PROPOSED catalog paginated API | A+B |
| Multiple Seller listings | exact catalog ID، listing ID، Seller public DTO | products seller_id فقط | PARTIALLY_COMPATIBLE | catalog association + listing DTO/eligibility | B ثم A |
| Login/logout/registration/me | verified identity/session/expiry | لا route؛ security hash helpers فقط | MISSING | PROPOSED auth endpoints + cookies | B ثم A |
| Seller product CRUD | owned listing create/update | GETs فقط | MISSING | PROPOSED seller listing commands | B ثم A |
| Product-specific Agent settings | private floor/discount/delivery/rounds/concession/enabled/version | SellerRule read جزئي عبر dashboard | PARTIALLY_COMPATIBLE | private owner DTO + settings writes | B ثم A |
| Buyer/Seller/Admin overview | secure normalized history/metrics | dashboard GETs | PARTIALLY_COMPATIBLE | auth، contract bugs، combined read model | B+A |
| Start competitive session | requirements + listing selection + idempotency | لا route | MISSING | PROPOSED session create | B+A |
| Session/own thread messages | snapshot + ordered cursor | dashboard summaries فقط | MISSING | PROPOSED scoped details/messages/events | B+A |
| Independent agents/competition | worker decisions وإشارات anonymous | Celery ping فقط | MISSING | server engine/tasks/events | B |
| Approve/reject/cancel | valid state commands وإعادة تحقق | لا route | MISSING | PROPOSED transaction commands | B+A |
| Pause/resume | معنى تنفيذ خلفية مقابل playback | لا route | MISSING | حسم requirement؛ لا نسخ pause المتصفح تلقائيًا | A+B |
| Agreement history/details | seller/listing/catalog/unit/qty/total/approval | buyer dashboard deal read جزئي | PARTIALLY_COMPATIBLE | typed durable Agreement read/write؛ إصلاح contract | B+A |
| Notifications/read | scoped records/read state/counts | لا route أو table | MISSING | PROPOSED notifications APIs/outbox | B+A |
| Admin users/actions/audit | RBAC/filter/pagination/suspension/audit policy | /dashboard/admin read جزئي | PARTIALLY_COMPATIBLE | explicit Admin endpoints/guards | B+A |
| Reports/PDF/CSV | authorized scoped aggregates/history | لا reporting API | MISSING | PROPOSED report JSON، ثم reuse preview/export | B+A |
| Current deployment contracts | real deployed OpenAPI/commit | غير متاح حاليًا | NOT_VERIFIED | SSH read-only artifacts؛ لا private API probing | B/ops + A |

## 3. عقود مقترحة — ليست endpoints موجودة

اقتراح `/v2` داخلي = `/api/v2` خارجي لمنع كسر المسارات القديمة قبل انتقال المستهلكين. IDs الجديدة strings، أموال Decimal strings بوحدة SAR، أوقات UTC ISO8601، cursor/limit bounded، optimistic version. لا اعتماد للعقود قبل اتفاق المطورين.

| PROPOSED methods / route | Scope / purpose |
|---|---|
| POST /v2/auth/login, POST /v2/auth/logout, POST /v2/auth/register | حسابات وصلاحيات؛ no Admin self-registration |
| GET /v2/me, PATCH /v2/me | بيانات الذات المسموحة؛ session expiry |
| GET /v2/catalog, GET /v2/catalog/{variant_id} | public variants/search/cursor |
| GET /v2/catalog/{variant_id}/listings | public Seller/listing/price/stock/delivery/eligible reason، بلا floors |
| GET/POST /v2/seller/listings | owned list/create؛ owner from identity |
| GET/PATCH /v2/seller/listings/{listing_id} | private owned detail/settings + expected_version |
| POST /v2/competitive-sessions | idempotent start، validated private Buyer requirements |
| GET /v2/competitive-sessions, GET /v2/competitive-sessions/{id} | role-specific parent summary/snapshot |
| GET /v2/competitive-sessions/{id}/threads/{thread_id} | Buyer owns parent أو Seller owns thread؛ Admin policy allowlist |
| GET /v2/competitive-sessions/{id}/events?after=... | authorized ordered incremental updates/polling |
| POST /v2/competitive-sessions/{id}/approve | explicit selected offer/listing، transactional recheck + unique Agreement |
| POST /v2/competitive-sessions/{id}/reject, .../cancel | allowed transitions، retained history، idempotency |
| GET /v2/agreements, GET /v2/agreements/{id} | party/Admin allowlist، no private limits |
| GET /v2/notifications, PATCH /v2/notifications/{id}/read | scoped current user + read timestamp |
| GET /v2/admin/users, PATCH /v2/admin/users/{id}/status | Admin + governance audit، منع رفع دور عبر input |
| GET /v2/admin/sessions, .../agreements, .../audit, .../metrics | operational scopes، pagination، تعريف KPIs |
| GET /v2/admin/reports/{type}/{entity_id} | authorized report sections/filters/generated_at/as_of/report_id |
| GET /v2/meta/version | public/non-sensitive release SHA/build ID فقط إذا وافق الفريق؛ لا env values |

لا يُقترح endpoint لتغيير هوية المستخدم من query، أو لإرجاع global private inventory، أو لتقديم seller floor إلى Buyer/Admin report. Upload API إن احتاجه المنتج يضاف بعقد media validation مستقل، وليس endpoint مثبتًا الآن.

### مثال إنشاء منافسة (بيانات توضيحية فقط)

```json
{
  "catalog_variant_id": "variant-example",
  "requirements": {
    "quantity": 10,
    "target_unit_price": "4000.00",
    "maximum_unit_price": "4300.00",
    "delivery_within_days": 7,
    "max_rounds": 6,
    "mode": "semi_automated"
  },
  "idempotency_key": "client-command-example"
}
```

owner/buyer_id من authenticated session لا body. maximum يُخزن خاصًا ولا يخرج في Seller DTO/notifications/LLM context. قبول start يعيد مثلًا 202 `{session_id,status,version,event_cursor}`؛ Celery يبدأ من persisted command/outbox، لا من tab timer.

### مثال Seller thread DTO مسموح

```json
{
  "session_id": "session-example",
  "thread_id": "thread-example",
  "listing_id": "listing-example",
  "catalog_variant_id": "variant-example",
  "requirements": {"quantity":10,"public_target_unit_price":"4000.00","delivery_within_days":7},
  "status":"negotiating",
  "current_offer":{"unit_price":"4250.00","delivery_days":5,"round":2},
  "messages":[],
  "version":12
}
```

لا maximum ولا competitor thread/identity. own private settings تُطلب من owner-only settings API منفصل، ولا تُرسل للagent الآخر.

### مثال الموافقة

طلب `{offer_id,listing_id,expected_version,idempotency_key}`؛ response Agreement `{id,session_id,selected_thread_id,listing_id,seller_id,catalog_variant_id,quantity,unit_price,total_amount,delivery_terms,status,approved_at}`. نفس المفتاح يعيد النتيجة نفسها. العرض المنتهي/تغير المخزون يعيد 409 ولا يُنشئ سجلًا ثانيًا.

الأخطاء المقترحة: 401 غير موثق، 403 ممنوع، 404 scoped unavailable حسب policy، 409 stale/state/stock conflict، 422 validation، 429 rate limit، 503 worker/service unavailable. شكل موحد `{code,message,request_id,field_errors,retryable}` بلا stack/secret. لا تسمح لـ5xx أن يعيد fixtures.


---

## تحديث الأدلة AWS-R1 — 19 أكتوبر 2026

**هذا ملحق جديد؛ النص السابق محفوظ كتاريخ للتدقيق، وتُقدَّم نتائج هذا الملحق عند تعارضها معه.** N هو العرض المحلي متعدد البائعين، وO المصدر المحلي القديم، وR المصدر المنسوخ من AWS في `<LOCAL_USER_HOME>\Documents\autoneg-production-reference`. تم فحص R محليًا للقراءة فقط. عبارة SOURCE_VERIFIED تعني وجود السلوك في المصدر، ولا تعني أنه يعمل في الحاوية المنشورة. بيانات الخادم التشغيلية أدناه من توثيق المستخدم؛ لم ننفذ اتصال AWS أو قاعدة بيانات.

الفرع المبلغ عنه `main`، والالتزام `0be5da348fd7c38da41f1628a4420135e02e2cd8`، مع تعديلات محلية على الخادم وعدم وجود Git revision label لصورة الواجهة. لذلك تطابق R مع صورة التشغيل، وDDL الفعلي، ونسخة migrations، وصلاحيات التشغيل، ونجاح التدفقات الحقيقية تظل **NOT_VERIFIED**. لا يجوز نسبة تعديلات working tree تلقائيًا إلى ذلك الالتزام.


### مصفوفة العقود الموجودة في R

المسارات أدناه داخل FastAPI؛ `root_path=/api` مضبوط في main. بادئة المتصفح المتوقعة `/api`، لكن قواعد Nginx الفعلية ليست ضمن النسخة فلا نجزم بإعادة الكتابة. return state يعني `build_workspace_state` العام الحالي؛ يلزم تغييره إلى projection مخوّل. كل العمليات التالية SOURCE_VERIFIED، وحالة تشغيلها الفعلي NOT_VERIFIED. لا يوجد في هذه المسارات اعتماد مصادقة سوى DB dependency؛ فحص buyer_id المرسل ليس authentication.

| الطريقة والمسار | المدخلات الأساسية | الاستجابة | السطر في workspace.py | الاستفادة/الفجوة |
|---|---|---|---|---|
| GET /workspace/bootstrap | لا هوية موثقة | state عام | 460 | إعادة تصميم scope وإزالة الكتابة/seed من GET |
| POST /workspace/users/register | name,email,role,password? | user_id,state | 465 | تسجيل موجود؛ ليس login أو session آمنة |
| PUT /workspace/users/{user_id} | name,email | state | 492 | profile موجود؛ يلزم own-user authorization |
| PATCH /workspace/users/{user_id}/status | active | state | 515 | موجود؛ يلزم Admin authorization |
| POST /workspace/products | seller_id,name,category,base_price,stock_quantity,description?,image_url? | product_id,state | 535 | CRUD إنشاء موجود؛ ملكية/validation/catalog ناقصة |
| PUT /workspace/products/{product_id} | نفس ProductPayload | state | 574 | تحديث موجود؛ لا تحقق مالك كافٍ |
| PUT /workspace/products/{product_id}/rules | seller_id,minimum,threshold,discount,rounds,enabled | state | 603 | موجود؛ enabled في audit وليس حالة دائمة موثوقة |
| POST /workspace/sessions | buyer_id,product_id,budget,mode,scenario,warranty,delivery | session_id,state | 647 | جلسة ثنائية بوحدة واحدة؛ لا quantity/target/deadline/catalog تنافسي |
| POST /workspace/sessions/{session_id}/advance | لا body مطلوب | state | 729 | خطوة حتمية محفوظة؛ ليست worker أو Gemini |
| POST /workspace/sessions/{session_id}/approve | لا body مطلوب | state | 905 | موافقة موجودة؛ تقوية الهوية وإعادة فحص الحدود/المخزون |
| POST /workspace/sessions/{session_id}/end | buyer_id,status | state | 936 | إلغاء/رفض موجودان؛ حماية terminal transitions |
| POST /workspace/deals/{deal_id}/rating | buyer_id,rating,feedback | state | 960 | تقييم موجود؛ يلزم التحقق من طرف الصفقة |

تضاف إلى GET `/health`, `/products`, `/products/{product_id}`, `/dashboard/seller`, `/dashboard/buyer`, `/dashboard/admin`: **18 مسارًا إجمالًا** دون docs/OpenAPI. تصحيح dashboard في R يستبدل أخطاء الحقول القديمة، لكن buyer_confirmed وseller_confirmed قيم ثابتة true وليستا دليل موافقة فعليًا.

### ما يحتاج endpoints جديدة فعلًا؟

هذه قدرات مطلوبة وليست أسماء عقود منفذة؛ تحدد التواقيع النهائية مع زميل Backend قبل برمجة adapter. أي `/v2` في التدقيق القديم اقتراح فقط.

| القدرة | إعادة استخدام/جديد | عقد الخادم المطلوب | مسؤولية Frontend |
|---|---|---|---|
| مصادقة وهوية حقيقية | جديد | login/logout/current-user وآلية جلسة آمنة وصلاحيات على كل مورد | forms وحالات expiry/denial |
| profile/status/register/products/rules/rating | موجود يحتاج تقوية/توسعة | العقود أعلاه مع ownership وvalidation وDTO محدود | adapter async دون fallback وهمي |
| catalog متطابق وبائعون مؤهلون | جديد أو توسعة products المعلنة | catalog/variant ID وعروض seller-owned وstock/delivery والاستبعاد | Browse/Details/Requirements |
| إنشاء تفاوض متعدد | جديد | parent attempt بquantity,target,max,deadline,mode,maxRounds، وإنشاء threads مؤهلة ومعرفات ثابتة | submit مرة واحدة وحالة بدء |
| قراءة الجلسات والأحداث لكل دور | جديد | lists/detail/events مع pagination/cursor وprojection Buyer/Seller/Admin | progress/reconnect وتحديد Seller واحد |
| start/pause/resume/cancel/retry للوالد | جديد | انتقالات وخطوات موثوقة مع idempotency | أزرار وحالات pending/error |
| اختيار Agreement نهائي متعدد | جديد | approve/reject يحدد attempt+thread+offer، يعيد فحص الشروط والمخزون، atomic | مقارنة ثم موافقة صريحة |
| تفاوض ثنائي قديم | موجود | تأمين advance/approve/end والمحافظة على IDs القديمة | المحافظة على المسار القديم |
| إشعارات دائمة | جديد | قائمة مخولة + mark-read مع IDs ثابتة | unread states |
| تقارير/إحصاءات مخولة | جديد | dataset/export أو job محدود الصلاحيات وحقول موثقة | preview وPDF/CSV من البيانات المصرح بها |
| تاريخ Offers | توسعة/قراءة جديدة | timestamps/action/round/thread/final approval موثقة؛ لا budgets/floors للطرف الآخر | conversation/history |

لا يلزم endpoint Gemini مباشر من المتصفح. تشغيل AI لاحقًا مسؤولية الخادم وحده مع حدود سرية وworker؛ هذا مستقل عن إثبات المحاكاة الحالية. لا تضف Order/payment API وهميًا لمجرد وجود Deal.


---

## AWS-R2 — تجهيز Frontend محليًا، 19 أكتوبر 2026

نُفذ تكامل المنتجات العامة مع تحقق الاستجابة والأخطاء، وأضيفت حدود typed/fail-closed للعقود الخاصة القائمة؛ لا bootstrap أو كتابة غير مخولة ولا fallback تجريبي في الإنتاج. تصاميم الأدوار وملكية Seller والمحاكاة محفوظة. نجحت 8 مجموعات اختبارات وTypeScript والبناء وstatic contract validation واختبار standalone على loopback. لا يثبت ذلك تشغيل FastAPI أو DB أو صورة AWS الفعلية؛ القرار NO-GO للنشر العام باقٍ.

النتائج وقائمة الملفات وقرارات الميزات: [FINAL_FRONTEND_INTEGRATION_REPORT.md](FINAL_FRONTEND_INTEGRATION_REPORT.md). الحزمة وأوامر staging والرجوع المعدة للموافقة فقط: [FRONTEND_STAGING_PLAN.md](FRONTEND_STAGING_PLAN.md). لم يُنفذ اتصال AWS أو نقل أو deploy أو تغيير قاعدة بيانات؛ تاريخ هذا التقرير السابق محفوظ.


## New evidence — 26 October 2026

This document preserves the earlier audit history. For the current authenticated production integration and model/storage matching, see docs/releases/PRODUCTION_RELEASE_REPORT_20261025.md and docs/releases/MODEL_MATCHING_RELEASE_20261025.md. Earlier NOT_VERIFIED/NO-GO statements must be interpreted with the later evidence; the copied AWS source was not proof of an identical running image. Production mock data is disabled. No staging fixtures are promoted.
