# NEW VS PRODUCTION — مقارنة المصدر الجديد والإنتاج

تاريخ التدقيق: 19 أكتوبر 2026، Asia/Riyadh. تدقيق قراءة فقط؛ المخرجات الوحيدة المضافة في هذه المهمة هي التقارير العشرة. لا تنفيذ تكامل أو نشر.

**Production deployment version not verified.**

## 1. مصادر الحقيقة وحدود المقارنة

| الرمز | المصدر | ما تم إثباته | ما لا يثبته |
|---|---|---|---|
| N | `<LOCAL_USER_HOME>\OneDrive\Documents\grad\autonegotiater-main\autonegotiater-multi-seller-demo` | المصدر المحلي الجديد المفضّل، اختبارات المحاكاة، إعدادات الربط المتاحة | تشغيل هذه الميزات ببيانات إنتاج |
| O | `<LOCAL_USER_HOME>\OneDrive\Documents\grad\autonegotiater-main\autonegotiater-main` | المستودع الأصلي المتاح محليًا، Backend وORM وAlembic وإعدادات نشر | أنه نفس الإصدار المنشور على AWS |
| P | `https://autonegotiater.com` والإصدار الموجود على EC2 | وصف المستخدم أنه الموقع الحالي ذو بيانات حقيقية | commit، image digest، الكود الفعلي، مخطط Supabase، الضوابط التشغيلية: جميعها NOT_VERIFIED |
| U | الطلب وتوضيح المستخدم | الإنتاج وفق المستخدم يستخدم Supabase، وأُجيز SSH المقيّد للقراءة | اعتماد معلومات البنية دون معاينة |
| T | إعادة تشغيل الاختبارات أثناء هذا التدقيق | سبع مجموعات اختبارات محلية وTypeScript نجحت | اتصال FastAPI حقيقي أو اختبار إنتاج أو شهادة أمنية |

المجلد التنفيذي الابتدائي هو O؛ فُحصت الملفات في O وN بطرق قراءة فقط. كلا المجلدين لا يحتوي `.git`، وأوامر Git في O أعادت not a git repository. لذلك branch وcommit وremote/history في النسختين **غير متاحة**؛ لا يجوز اختلاق commit أو اعتبار ملفات O نسخة الإنتاج. لا توجد عملية Git fetch/push أو إنشاء مستودع.

أُجيز SSH للقراءة فقط، لكن لا يوجد إعداد Host أو مفتاح افتراضي جاهز على هذا الجهاز. طلب المستخدم متابعة التدقيق المحلي حتى إعداد اتصال مقيّد. لم تُجرَّب مصادقة كلمة مرور ولم يُطلب محتوى مفتاح. مرحلة SSH **مؤجلة ومطلوبة**، وليست ملغاة. يجب تحديث هذه التقارير عند نجاحها.

### سجل الأدلة

| الدليل | الملفات/الأسطر التي فُحصت | النتيجة |
|---|---|---|
| E01 | O وN: `frontend/lib/api.ts:3–74` | خمس دوال API قراءة؛ Mock محصور development + USE_MOCK_DATA=true؛ الملف متطابق بين النسختين |
| E02 | O: `backend/app/main.py:9–32` و`routers/products.py:9–25` و`routers/dashboard.py:17–203` | ستة مسارات أعمال/صحة GET، دون اعتماد مصادقة في المسارات |
| E03 | O: `models/user.py:9–23`, `models/product.py:12–45`, `models/negotiation.py:15–98` | ثمانية جداول، ملكية منتج لبائع واحد، تفاوض مرتبط بمنتج واحد، ولا جلسة منافسة متعددة المشاركين |
| E04 | O: `alembic/versions/0001_initial_schema.py:27–140` | migration واحدة متاحة؛ حالة القاعدة الحية غير معروفة |
| E05 | O: `backend/app/worker.py:5–10`, `security.py:1–11` | Celery ping فقط؛ دوال hash/verify فقط، وليست login/JWT/authorization |
| E06 | N: `components/competitive-negotiation.tsx:40–71`, `lib/competitive.ts:81–194` | محاكاة حتمية وجولات تظهر بمتصفح المشتري، لا تنفيذ AI/خلفية |
| E07 | N: `lib/demo-integration.ts:12–88,120–132`, `components/competitive-provider.tsx:14–38` | قوائم مستقلة، سجلات محلية، قرارات واتفاقيات وإشعارات؛ لا كتابة Backend |
| E08 | N: `lib/demo-storage.ts:3–7`, `components/local-demo-state.tsx:4–8` | localStorage إصدار 4 مع قبول/ترحيل v3 |
| E09 | N: `components/site-shell.tsx`, `storefront-manager.tsx`, `seller-session-view.tsx` | تنقل موحد وإدارة Seller-owned listings؛ مفاتيح قديمة داخلية للتوافق |
| E10 | N: `components/admin-reports.tsx:10–40`, `lib/integrated-reports.ts`, `text-report-pdf.ts` | تقارير Mock مشتقة من سجلات محلية، PDF/CSV فعليان، لا Reporting API |
| E11 | O: `infra/compose.yaml`, `infra/nginx/default.conf`, `.github/workflows/deploy.yml`, `frontend/Containerfile`, `backend/Containerfile` | إعداد نشر محلي موثق، لا إثبات مطابقته للحاويات الجارية |
| E12 | O: `docs/STAKEHOLDERS_JOURNEYS.md:19–35,48–60,73–87`, `docs/PLAN.md:28,31–32,150–158` | متطلبات وليست دليل تنفيذ؛ PLAN يقول Supabase dropped، خلاف وصف الإنتاج الحالي |

قورنت ملفات backend وinfra بين O وN: لا اختلافات في الملفات المصدرية المتاحة. ملف workflow موجود في O وغير موجود في N. لا يعني هذا أن Backend الإنتاج مطابق لأي منهما.

## 2. تصنيف القراءة

في الجداول: **P=NOT_VERIFIED في كل صف** حتى فحص SSH. عمود O دليل مصدر فقط. READY تعني جاهزية الجزء المحدد، لا تصريح نشر شامل. REAL تعني مسارًا حقيقيًا أو واجهة منفذة، ولا تثبت مصدر بيانات الإنتاج؛ MOCK/MIXED/MISSING تصف التنفيذ.

### الواجهة العامة

| الميزة | N | O المتاح | P | جاهزية الإنتاج / النوع |
|---|---|---|---|---|
| Landing page | ثابتة، وصف التجربة | نفسها تقريبًا؛ متطابقة مصدرًا | NOT_VERIFIED | PARTIALLY_READY / REAL؛ تدقيق نصوص Demo قبل الإطلاق |
| Header/Sidebar | SiteShell مشترك وأيقونات ونشاط متداخل وقائمة جوال | غلاف مشترك أبسط؛ النشاط exact path؛ لا كل روابط Admin | NOT_VERIFIED | READY للعرض / REAL، ربط الهوية BLOCKED |
| ألوان/خطوط/RTL | English/LTR، Tailwind + CSS + SVG محلي | English/LTR أيضًا؛ CSS أقل | NOT_VERIFIED | READY للعرض / REAL |
| تسجيل الدخول/التسجيل/Profile | هوية صناعية بلا password/session حقيقي | Mock مماثل؛ BackendPending بالوضع الحقيقي | NOT_VERIFIED | BLOCKED / MOCK |
| حالات التحميل/الخطأ/الفراغ | Next boundaries + استعادة تخزين + تنبيهات فشل الحفظ | Next boundaries وحالات محلية أبسط | NOT_VERIFIED | PARTIALLY_READY / MIXED؛ لا timeout/retry موحد |
| Forms/tables/dialogs/toasts | تحقق محلي وdialogs قرار ومعاينة تقارير | نماذج وfeedback محلي؛ لا تدفق منافسة | NOT_VERIFIED | PARTIALLY_READY / MOCK في الأفعال |
| Responsive/accessibility | shell موحد، collapse، aria-current، تخطيطات محتوى | responsive سابق بلا تحسينات shell الجديدة | NOT_VERIFIED | PARTIALLY_READY / REAL؛ فحص أجهزة/قارئ شاشة شامل غير منفذ |
| استعادة البيانات | v4 + ترحيل v3 وسجلات ثابتة | useState؛ تُفقد عند refresh | NOT_VERIFIED | BLOCKED للاستدامة الإنتاجية / MOCK |

### Buyer

| الميزة | N | O المتاح | P | جاهزية الإنتاج / النوع |
|---|---|---|---|---|
| Dashboard | نموذج قراءة موحد للتفاوضين في Mock؛ fallback API القديم | API GET dashboard أو Mock قديم | NOT_VERIFIED | PARTIALLY_READY / MIXED |
| Browse Products | API الحقيقي محفوظ، أو fixtures محلية | نفس API والكتالوج الأساسي | NOT_VERIFIED | PARTIALLY_READY / MIXED |
| Product Details / الصور | API أو Mock؛ إعداد منافسة ورسوم عند غياب الصور | تفاصيل API/Mock بلا منافسة | NOT_VERIFIED | PARTIALLY_READY / MIXED |
| البحث/التصنيف/المخزون/الترتيب | داخل القائمة المحمّلة، مقارنة حتى 3 منتجات | موجودة محليًا كذلك | NOT_VERIFIED | PARTIALLY_READY / MIXED؛ لا pagination/search server |
| عدة بائعين لنفس variant | matching بمعرّف صريح وقوائم مستقلة | لا catalog identity جامع في schema؛ منتجات منفصلة | NOT_VERIFIED | BLOCKED / MOCK |
| Target / Maximum / Quantity / Delivery | متطلبات منافسة محلية، Maximum خاص بالمشتري | budget/شروط one-to-one محلية؛ DB budget فقط | NOT_VERIFIED | BLOCKED / MOCK |
| بدء منافسة | تأكيد المستخدم ثم attempt ثابت | غير موجود في API أو واجهة O | NOT_VERIFIED | BLOCKED / MOCK |
| Buyer Agent وSeller Agents | histories مستقلة، messages progressive | two-agent one-to-one محلي فقط | NOT_VERIFIED | BLOCKED / MOCK |
| Anonymous competition | إشارات أسعار محلية دون هويات في النص | غير موجود | NOT_VERIFIED | BLOCKED / MOCK |
| الجولات والتقدم/الإيقاف/الاستئناف | playback بمتصفح المشتري | تقدم one-to-one يدوي محلي | NOT_VERIFIED | BLOCKED / MOCK |
| مقارنة العروض النهائية | تصنيف بالوحدة ثم delivery، Agreement ثنائي قبل الاختيار | لا final competitive comparison | NOT_VERIFIED | BLOCKED / MOCK |
| الموافقة/الرفض/الإلغاء | سجلات قرارات واتفاقية Demo واحدة | one-to-one محلي؛ لا command API | NOT_VERIFIED | BLOCKED / MOCK |
| سجل التفاوض | موحد مع stable IDs ومحفوظ محليًا | API snapshot قراءة أو useState محلي | NOT_VERIFIED | BLOCKED للتدفق الكامل / MIXED |
| Agreements | shared local records وتفاصيل وربط للجلسة | deals من API read أو Mock محلي | NOT_VERIFIED | BLOCKED / MIXED |
| Notifications/read | سجلات محلية scoped | Mock notices، لا DB/API إشعارات | NOT_VERIFIED | BLOCKED / MOCK |
| Buyer Profile | تعديل صناعي محفوظ في المتصفح | تعديل محلي مؤقت | NOT_VERIFIED | BLOCKED / MOCK |

### Seller

| الميزة | N | O المتاح | P | جاهزية الإنتاج / النوع |
|---|---|---|---|---|
| Dashboard | موحد حسب Seller + API fallback قديم | GET seller query ID + Mock | NOT_VERIFIED | PARTIALLY_READY / MIXED |
| My Products & Agent Settings | صفحة واحدة لقوائم المالك مع بحث وصورة وحالة | Products وRules منفصلان في Mock؛ API يعرض الجدول فقط | NOT_VERIFIED | BLOCKED للكتابة الحقيقية / MOCK |
| ملكية القائمة | ownerSellerId + listingId + catalogId، قوائم متعددة مستقلة | Product.seller_id حقيقي على مستوى منتج واحد | NOT_VERIFIED | PARTIALLY_READY / MIXED |
| إضافة/تعديل منتج | قائمة لنفس catalog أو variant جديد، محلي | Forms محلية؛ لا POST/PATCH | NOT_VERIFIED | BLOCKED / MOCK |
| السعر والمخزون | مستقلان، seed alternatives مثبتة؛ snapshot محفوظ | أعمدة DB وGET؛ كتابة Mock فقط | NOT_VERIFIED | PARTIALLY_READY للقراءة / MIXED |
| Delivery terms | لكل listing محلي | لا حقل listing delivery | NOT_VERIFIED | BLOCKED / MOCK |
| قواعد Agent / Enabled / strategy | floor/discount/rounds/concession/enabled لكل listing | seller_rules جزئية: floor/discount/rounds/threshold بلا كتابة API | NOT_VERIFIED | BLOCKED / MIXED |
| مراقبة الجلسات والمحادثة | projection لنفس جلسة Buyer، لا simulation جديد | one-to-one محلي؛ seller GET لا يعرض offers/history | NOT_VERIFIED | BLOCKED / MOCK |
| إنفاذ الحد الأدنى | clamp حتمي في المتصفح | DB check min<=base فقط؛ worker ليس محركًا | NOT_VERIFIED | BLOCKED إنتاجيًا / MIXED |
| عزل البائعين/الدخول المباشر | منع واجهة ومنظورات DTO محلية | فلترة واجهة؛ GET seller بلا auth | NOT_VERIFIED | BLOCKED / MOCK |
| Agreements/Notifications/Profile | مشتركة محلية حسب الهوية | جزئية محلية، لا APIs تشغيل كاملة | NOT_VERIFIED | BLOCKED / MOCK |
| Storefront | أزيل من UI؛ legacy IDs مخزنة فقط | لا Storefront table أصلًا | NOT_VERIFIED | READY لمفهوم الملكية / REAL؛ لا حذف سجلات مطلوب |

### Admin

| الميزة | N | O المتاح | P | جاهزية الإنتاج / النوع |
|---|---|---|---|---|
| Dashboard/metrics | نتائج محلية لكلا التفاوضين؛ API fallback قديم | GET admin DB counts + Mock | NOT_VERIFIED | PARTIALLY_READY / MIXED |
| Users / Sellers / suspension | بحث/تبديل نشاط محلي | GET users عبر dashboard؛ suspension Mock | NOT_VERIFIED | BLOCKED للحوكمة / MIXED |
| Product monitoring | جميع القوائم العامة مع Seller/listing/catalog IDs | منتجات فقط؛ private floor غير public DTO | NOT_VERIFIED | PARTIALLY_READY / MIXED |
| Sessions / monitoring | توحيد/history ومحادثات تشغيلية بلا حدود خاصة | GET summary فقط؛ Mock one-to-one | NOT_VERIFIED | BLOCKED / MIXED |
| Agreements | القائمة والتفاصيل لجميع سجلات Demo | قراءة deals جزئية؛ لا workflow إنشاء | NOT_VERIFIED | BLOCKED / MIXED |
| Notifications | رابط موحد وحالة قراءة محلية | لا backend notification | NOT_VERIFIED | BLOCKED / MOCK |
| Seller/Buyer/Session Reports | mock builders مشتركة، IDs وأسعار/إحصاءات متاحة | Mock reports موجودة للـone-to-one أيضًا | NOT_VERIFIED | BLOCKED للبيانات الرسمية / MOCK |
| PDF/CSV | actual files، English text PDF + fallback | CSV وPDF صور سابقًا | NOT_VERIFIED | PARTIALLY_READY / REAL export over MOCK data |
| Audit Logs | دمج logs محلية mutable | AuditLog DB + GET به mismatch + Mock | NOT_VERIFIED | BLOCKED للموثوقية / MIXED |
| Permissions | مصفوفة توضيحية؛ ليست تعديل صلاحيات | توضيح محلي بلا enforcement | NOT_VERIFIED | BLOCKED / MISSING backend |
| System settings/health | مؤشرات محلية، بلا ادعاء telemetry حقيقي | health DB SELECT 1؛ لا مراقبة worker/UI فعلية | NOT_VERIFIED | PARTIALLY_READY / MIXED |

## 3. ما هو مشترك وما هو مختلف؟

مشترك مثبت بالمصدر: Next15/React19/TypeScript/Tailwind، English/LTR، landing/catalog/details، API reads، one-to-one demo، نماذج الهوية/المنتج والقواعد، Admin mock reports/CSV/PDF. لا تنسب هذه الميزات تلقائيًا إلى الإنتاج.

خاص بـN مقارنة بـO: منافسة متعددة القوائم، رسوم Buyer/Seller المعتمدة، private per-listing settings، final comparison، unified persistent history/Agreements، v4 storage/migration، shared icons/nested shell، text PDF، اختبارات إضافية.

موجود في O وغير منقول كملف إلى N: workflow نشر GitHub. مسارات قراءة API والـBackend ليست خاصة بـO؛ نسختها في N متطابقة أيضًا. **لا يمكن إثبات ميزة خاصة بالإنتاج الفعلي قبل SSH.**

## 4. أهم الاستنتاجات

1. نقل الملفات أو إطفاء USE_MOCK_DATA لا يحول المحاكاة إلى نظام حقيقي. production يعطّل Mock، وتظهر BackendPending لرحلات جديدة بينما تستخدم root dashboards الفروع القديمة.
2. يمكن إعادة استخدام public product GETs مع توثيق DTO وربط auth لبقية المسارات؛ لا توجد في المصدر المتاح أوامر تفاوض/منتجات/قواعد/اتفاقيات/إشعارات.
3. يلزم schema يدعم catalog variants + seller listings + parent session + threads + events + agreement lifecycle. لا نُسقط جداول الإنتاج أو نستبدلها بfixtures.
4. blockers أمنية في O: query identity غير موثوقة، لا guards، تسرب floors/budgets/account data عبر dashboards لغير المصرح لو استُخدمت كما هي. لم يُجر اختبار استغلال ضد الموقع.
5. dashboard buyer يستخدم Deal.agreed_conditions/confirmation flags/created_at غير الموجودة في ORM؛ admin يستخدم AuditLog.timestamp بدل created_at. أخطاء مصدر مشروطة بوجود صفوف، لا تقرير عطل حي.
6. لا Gemini في worker/dependencies/config المتاحة. وجود Celery/Redis والبنود في الوثائق لا يثبت محركًا.
7. لا نشر آمن للرحلة الجديدة اليوم بناءً على الدليل الحالي. هذا حكم جاهزية تكامل وليس ادعاء أن الموقع الحالي متوقف.

## 5. التحقق المنفذ والتالي

أُعيدت سبع suites وTypeScript بنجاح في هذا التدقيق؛ تفاصيلها في PRODUCTION_READINESS_AUDIT.md. لم يُعَد build أثناء التدقيق لتجنب تعديل output الخاص بالمعاينة العاملة؛ build ناجح موثق في مرحلة التنفيذ السابقة، وليس اختبارًا جديدًا للإنتاج.

SSH لاحقًا: تثبيت release SHA/image digests، مقارنة كود frontend/backend الفعلي، route definitions، migration artifacts ومستوى التشغيل، دون database records أو env values أو تغيير services. لا يكفي HTML أو عنوان الموقع لإثبات commit. إن غابت بيانات release، نستخدم read-only hashes لملفات منشورة مع بيان أنها ليست Git provenance.

## 6. ملخص تنفيذي وخطة الأولويات

| السؤال | الإجابة |
|---|---|
| هل frontend متوافق بالكامل؟ | لا؛ public reads جزئية، معظم الرحلة الجديدة محلية |
| ما الذي يعمل فعليًا ببيانات DB؟ | O ينفذ GET products/dashboard queries؛ تشغيل الإنتاج وبياناته NOT_VERIFIED، وبعض DTOs بها أخطاء |
| ما الذي Mock؟ | الهويات، القوائم البديلة، agents، القرارات، Agreements، notices وتقارير المنافسة |
| APIs المعاد استخدامها؟ | GET products/detail، وإعادة تصميم آمن لـdashboard reads مع الحفاظ على contract compatibility عند الحاجة |
| APIs الناقصة؟ | Auth، owned listing CRUD/rules، competitive commands/snapshots/events، Agreement، notifications، authorized reports/admin actions |
| هل يلزم migrations؟ | نعم وفق schema O؛ الفروق الفعلية ضد Supabase NOT_VERIFIED |
| مسؤولية Frontend؟ | الاحتفاظ بالتصميم، adapters/types، auth UI، async state/error/reconnect، منع fixtures في الإنتاج |
| مسؤولية Backend؟ | عقود وصلاحيات، schema، agents/worker، persistence/transactions، أحداث وتقارير |
| أسلم دمج؟ | عقود أولًا ثم staging ببيانات اصطناعية منفصلة وexpand/backfill/validate مع rollback |
| ترتيب التنفيذ؟ | إثبات P → auth/DTO → catalog/listings → session engine → approval/Agreement → events/notices → reports/admin → staging/rollout |
| قبل النشر؟ | security/data migration/worker retries/idempotency/E2E/backup restore/canary acceptance |
| هل يُنشر الجديد اليوم؟ | لا؛ BLOCKED للتدفق الإنتاجي الكامل، مع الحفاظ على الموقع الحالي |
| غير المتحقق؟ | live commit/schema/authorization/Gemini/worker/runtime/backup behavior/real-data end-to-end |

الخطوات والأدوار والعقود المقترحة، وليست موجودة بالفعل، موزعة في التقارير التسعة الأخرى.

## 7. فهرس التقارير والضمان المحلي

- [FRONTEND_DIFFERENCES.md](FRONTEND_DIFFERENCES.md)
- [PRODUCTION_READINESS_AUDIT.md](PRODUCTION_READINESS_AUDIT.md)
- [FRONTEND_BACKEND_API_MATRIX.md](FRONTEND_BACKEND_API_MATRIX.md)
- [DATABASE_COMPATIBILITY_REPORT.md](DATABASE_COMPATIBILITY_REPORT.md)
- [NEGOTIATION_ENGINE_GAP_ANALYSIS.md](NEGOTIATION_ENGINE_GAP_ANALYSIS.md)
- [FRONTEND_INTEGRATION_TASKS.md](FRONTEND_INTEGRATION_TASKS.md)
- [BACKEND_REQUIREMENTS_FOR_TEAMMATE.md](BACKEND_REQUIREMENTS_FOR_TEAMMATE.md)
- [SAFE_DEPLOYMENT_PLAN.md](SAFE_DEPLOYMENT_PLAN.md)
- [END_TO_END_TEST_PLAN.md](END_TO_END_TEST_PLAN.md)

تحقق SHA-256 قبل/بعد التدقيق: **83 ملفًا** من O و**102 ملف مصدر/تهيئة/اختبار/توثيق** من N لم يتغير أي منها ولم يُضف إليها source جديد. نطاق البصمة يستبعد secrets/env/caches/generated output وroot التقارير الجديدة؛ لا ادعاء hash لكل ملف شخصي/مُولد. أُنشئت التقارير العشرة فقط؛ لم تُعدّل مستندات الرحلات القديمة أو كود التطبيق. لا build/restart/SSH/DB/network production operation في هذه المرحلة.

### بصمات مصدر مختارة لاستكمال مقارنة SSH

هذه بصمات ملفات محلية وليست commit أو دليل deployment. لا تقارن TSX بـbundle مُجمّع على أنهما نفس artifact.

| المصدر والملف | SHA-256 |
|---|---|
| O/`backend/app/main.py` | `3300ed81acd126127fdb1e91023fc026d26ec0a671d9c41ce144af8180be7669` |
| O/`backend/app/routers/products.py` | `39b7f5325cd64d6dc45254d5afae1f0c7728763b3de7989f35309eeb164d9ac0` |
| O/`backend/app/routers/dashboard.py` | `d8d6f66fff6d16db7c434b7a571c7b3b33877c07101d4d3c46c4f9d36bd119f9` |
| O/`backend/app/models/product.py` | `d7e019ddbb3bdaa01f7984a25778ab7977ee49c3adadebc707b61147e302edb8` |
| O/`backend/app/models/negotiation.py` | `aff0b1e856f04d7cc852f4533513a3e3ba78c55c67beb7fd4f6ba80fd99c9754` |
| O/`backend/app/worker.py` | `85c88e4cbb7c7c29e918d1372ea513bcc0f73959223a3d1c7d7ba9d454a32da5` |
| O/`backend/alembic/versions/0001_initial_schema.py` | `eae397f814b8b00d55f4c2f9d38d4e0cf8bd46a6be86fa408f17f4eca5fb4800` |
| O/`infra/compose.yaml` | `c5a57b763c643099ce370b60cb1091297f88baa7e6015d80ecadcd570afe6e03` |
| O/`infra/nginx/default.conf` | `d04b1851275e0b98dd7a0f58ebb842a8fe00fe3df8850724a675c809fe200544` |
| O/`.github/workflows/deploy.yml` | `01ad4f24edb47dbbcc69b6199ef0b83fca041f0513b979528e2876c5d5a4e41c` |
| N/`frontend/lib/api.ts` | `7a98375c465ff27d1f946db700af2bdd0e932a8c01ff2ce62a2ff247b99bbf1f` |
| N/`frontend/lib/competitive.ts` | `408cfa4783d0a508b5fe63074ca7e7367d0d682e32d3c059f2da2e4fb302e32d` |
| N/`frontend/lib/demo-integration.ts` | `d9d3df43e3fb2af763e24f15ee5b2634b37839098378edcec9d3eccfb36077d5` |
| N/`frontend/components/site-shell.tsx` | `9d86fb2779369c32bff34b6df209c54f3aa17b1ca4c459966f9fe199c071e617` |
| N/`frontend/components/competitive-provider.tsx` | `d32b65abb8e423a64f65ede55747a2d42eb0fd36b8c24c93f59c64cc490d885f` |
| N/`frontend/app/layout.tsx` | `0bb875f2512a3f8787cdb5bf6fa8316510c788aed306a215ca4c27140d137623` |
| N/`frontend/Containerfile` | `a2511bf20f244e232d42025f8255b35d0e85761912156d1209d294d620d30dfe` |
| N/`frontend/package-lock.json` | `4bba0d6ffbc421c6e54a9cf2825e4167aa11b2fdcb71afad30abd1fbb67243b3` |

**المرحلة التالية المفتوحة:** تزويد اتصال SSH المقيّد وفحص deployment artifacts وفق SAFE_DEPLOYMENT_PLAN، ثم تحديث P في جميع التقارير. لا إغلاق لهذه المرحلة تلقائيًا ولا افتراض أن مقارنة O تعادل مقارنة الإنتاج.


---

## تحديث الأدلة AWS-R1 — 19 أكتوبر 2026

**هذا ملحق جديد؛ النص السابق محفوظ كتاريخ للتدقيق، وتُقدَّم نتائج هذا الملحق عند تعارضها معه.** N هو العرض المحلي متعدد البائعين، وO المصدر المحلي القديم، وR المصدر المنسوخ من AWS في `<LOCAL_USER_HOME>\Documents\autoneg-production-reference`. تم فحص R محليًا للقراءة فقط. عبارة SOURCE_VERIFIED تعني وجود السلوك في المصدر، ولا تعني أنه يعمل في الحاوية المنشورة. بيانات الخادم التشغيلية أدناه من توثيق المستخدم؛ لم ننفذ اتصال AWS أو قاعدة بيانات.

الفرع المبلغ عنه `main`، والالتزام `0be5da348fd7c38da41f1628a4420135e02e2cd8`، مع تعديلات محلية على الخادم وعدم وجود Git revision label لصورة الواجهة. لذلك تطابق R مع صورة التشغيل، وDDL الفعلي، ونسخة migrations، وصلاحيات التشغيل، ونجاح التدفقات الحقيقية تظل **NOT_VERIFIED**. لا يجوز نسبة تعديلات working tree تلقائيًا إلى ذلك الالتزام.


### ما تغيّر في الاستنتاج السابق؟

| الاستنتاج التاريخي من O | الدليل الجديد من R | النتيجة الحالية |
|---|---|---|
| ست واجهات GET فقط | تسجيل workspace في `backend/app/main.py:21`؛ 12 مسارًا إضافيًا في `routers/workspace.py` | 18 مسار أعمال/صحة في المصدر؛ وجودها في runtime غير متحقق |
| لا توجد عمليات كتابة لمساحة العمل | تسجيل المستخدم وتحريره وتعطيله، منتجات وقواعد وجلسات وموافقات وتقييمات | موجودة جزئيًا؛ يلزم تأمينها ودمجها، وليس إعادة بنائها كلها |
| لا يوجد تفاوض محفوظ في Backend | `workspace.py:730` ينفذ أدوار تفاوض ثنائي ويحفظ Offers وDeals | محرك حتمي ثنائي معتمد على الطلب؛ لا تفاوض تنافسي متعدد البائعين |
| تعارض حقول dashboard يؤدي إلى أخطاء ORM | `dashboard.py:147–154,213–214` يستخدم final_conditions وclosed_at وcreated_at | التصحيح مؤكد في R؛ لا نؤكد تحديث الصورة المشغلة |
| جميع واجهات الدور مجرد Mock | layout وDemoProvider في R يتصلان بـworkspace ويقرآن قاعدة البيانات | تدفق مختلط: بيانات DB مع fallback محلي مصطنع عند الخطأ |
| الإشعارات والتقارير غير موصولة بأي بيانات فعلية | notices مشتقة من الجلسات والصفقات، والتقارير تستخدم state المسترجع | ليست خدمة تقارير مخوّلة أو إشعارات دائمة؛ read=false يعاد توليده |
| إصدار الإنتاج مجهول تمامًا | معلومات المستخدم تحدد branch/commit والمسار وأسماء الحاويات | هوية المصدر المبلغ عنها معلومة؛ تطابق المصدر/الصورة ما زال NOT_VERIFIED |

### نطاق المصدر والأدلة

وجدت المجلدات الأربعة المطلوبة و47 ملفًا: 31 ملف واجهة و16 ملف Python. لا تتضمن النسخة package manifests أو lockfile أو infra أو migrations أو Git metadata أو وصف صورة التشغيل. لذلك لا تنقل استنتاجات تبعيات O أو N إلى R دون دليل.

بصمات SHA-256 لربط الملاحظات بالنسخة المفحوصة:

| الملف داخل R | SHA-256 |
|---|---|
| backend/app/routers/workspace.py | `58b2992f1adcd557456a0276457ce73b36320171b73560371bdf2fed96d7040b` |
| backend/app/routers/dashboard.py | `2cea6035f1f2a1e6beee4d193a1659287e076cdd4bf089aa5343f5108c725002` |
| frontend/lib/api.ts | `c039af31d74e814f63f922554c8e4c29981a8f374d237be32989e0d328bbabaa` |
| frontend/components/demo-provider.tsx | `06184fe2e45e7f855e841814b872d9e62439a3877ace90ffc2c945dcf05bb9a5` |

### صورة التشغيل المبلغ عنها

النطاق `autonegotiater.com`؛ المسار `/var/www/autonegotiater`؛ Nginx هو `autoneg-nginx`، وهدف الواجهة **`autoneg-nextjs-secure`**، والخلفية `autoneg-fastapi`، وقاعدة البيانات `autoneg-postgresql`، وRedis `autoneg-redis`، وCelery `autoneg-celery`. تُصحح هذه المعلومة افتراض الهدف القديم `autoneg-nextjs`. وجود PostgreSQL لا يثبت وحده عنوان قاعدة البيانات المستخدم فعليًا أو صحة اتصالها؛ لم تُقرأ متغيرات البيئة أو السجلات الحية.

### مخاطر مؤكدة في المصدر، وليست ادعاء استغلال حي

- `workspace.py:226–455`: bootstrap يعيد جميع المستخدمين والقواعد والجلسات والسجلات، بما فيها ميزانيات وحدود خاصة؛ التصفية اللاحقة في React ليست صلاحية وصول.
- `workspace.py:88–227`: بناء workspace يستدعي تهيئة تكتب وتعمل commit، وقد تنشئ مستخدمين وقواعد وجلسات وDeal تجريبية بحسب البيانات القائمة. حتى GET bootstrap ليس قراءة مضمونة.
- `api.ts:73–89` و`demo-provider.tsx`: فشل الطلب قد يعود إلى initialDemoState أو يبقي موافقة/تعديلًا محليًا متفائلًا؛ قد يعرض نجاحًا لم يُحفظ.
- لا توجد مصادقة فعلية ومسارات login/session مخوّلة في الجزء المنسوخ؛ معرف المستخدم المرسل من المتصفح لا يثبت هويته.
- الإتمام يخصم وحدة واحدة ويضع payment_status=completed دون إثبات دفع؛ لا حجز كمية/أقفال/مفاتيح idempotency مكتملة للتنافس.

### فحص الأسرار

فحص محلي دون تضمين القيم في التقارير: إعداد قاعدة بيانات يحوي بيانات دخول افتراضية وJWT secret افتراضي في `backend/app/config.py:7,9`، وقيم كلمات مرور تجريبية ثابتة في `workspace.py:91,105,481`. هذه خمس مواقع مرشحة حساسة، وليست إثباتًا أنها أسرار التشغيل الفعلية. لم يرصد الفحص النمطي المحدود كتل private keys أو صيغ AWS/Gemini/GitHub tokens؛ لا يضمن ذلك خلو المصدر من كل سر. يلزم أن يعالج المسؤول القيم الافتراضية وسياسة الأسرار في إصدار مستقل، وتدوير أي قيمة إذا ثبت استعمالها فعليًا. لم نطبع القيم هنا أو ننقل ملفات البيئة.

### القرار المحدث

**NO-GO لنشر التدفق التنافسي الجديد كاملًا في الإنتاج.** سبب القرار أصبح أدق: توجد قدرات DB وثنائية حقيقية يمكن الاستفادة منها، لكن يلزم تأمينها وإزالة النجاح الوهمي والتهيئة التلقائية، وبناء عقود وكيانات التنافس. لا تعني النتيجة إيقاف الموقع الحالي. تصميم Buyer/Seller/Admin وملكية Seller المباشرة للمنتج محفوظان؛ لا Storefronts جديدة ولا استبدال قاعدة البيانات بـMock.

الملاحق AWS-R1 في التقارير التسعة المرتبطة أعلاه تحدّث المصفوفة، قاعدة البيانات، توزيع المسؤوليات وخطة النشر والاختبارات. التحقق من artifact التشغيل يبقى بوابة مفتوحة، دون طلب أو تنفيذ وصول AWS في هذه المهمة.


---

## AWS-R2 — تجهيز Frontend محليًا، 19 أكتوبر 2026

نُفذ تكامل المنتجات العامة مع تحقق الاستجابة والأخطاء، وأضيفت حدود typed/fail-closed للعقود الخاصة القائمة؛ لا bootstrap أو كتابة غير مخولة ولا fallback تجريبي في الإنتاج. تصاميم الأدوار وملكية Seller والمحاكاة محفوظة. نجحت 8 مجموعات اختبارات وTypeScript والبناء وstatic contract validation واختبار standalone على loopback. لا يثبت ذلك تشغيل FastAPI أو DB أو صورة AWS الفعلية؛ القرار NO-GO للنشر العام باقٍ.

النتائج وقائمة الملفات وقرارات الميزات: [FINAL_FRONTEND_INTEGRATION_REPORT.md](FINAL_FRONTEND_INTEGRATION_REPORT.md). الحزمة وأوامر staging والرجوع المعدة للموافقة فقط: [FRONTEND_STAGING_PLAN.md](FRONTEND_STAGING_PLAN.md). لم يُنفذ اتصال AWS أو نقل أو deploy أو تغيير قاعدة بيانات؛ تاريخ هذا التقرير السابق محفوظ.


## New evidence — 26 October 2026

This document preserves the earlier audit history. For the current authenticated production integration and model/storage matching, see docs/releases/PRODUCTION_RELEASE_REPORT_20261025.md and docs/releases/MODEL_MATCHING_RELEASE_20261025.md. Earlier NOT_VERIFIED/NO-GO statements must be interpreted with the later evidence; the copied AWS source was not proof of an identical running image. Production mock data is disabled. No staging fixtures are promoted.
