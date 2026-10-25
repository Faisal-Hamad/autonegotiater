# SAFE DEPLOYMENT PLAN — خطة تحقق ودمج ونشر آمن

19 أكتوبر 2026. **Production deployment version not verified.** هذه خطة مستقبلية فقط؛ لم يُنفَّذ أي deploy/SSH/service restart/migration أو database access. المستخدم يجهز SSH مقيّدًا، وبعد نجاحه يجب تحديث التقارير قبل اعتماد الخطة النهائية. كل تغيير إنتاجي يحتاج تكليفًا منفصلًا؛ الإذن الحالي تدقيق قراءة فقط.

## 1. ما تثبته إعدادات المصدر المتاحة O

| العنصر | دليل المصدر | السلوك المعرّف | واقع الإنتاج |
|---|---|---|---|
| frontend build | frontend/package.json:5–8، Containerfile:1–20 | npm ci ثم npm run build؛ Node22 Alpine | NOT_VERIFIED |
| Next output | frontend/next.config.ts:3–5 | standalone، ليس static export | NOT_VERIFIED |
| frontend runtime | Containerfile:15–21 | node server.js، NODE_ENV production، HOSTNAME 0.0.0.0، port3000، non-root node | NOT_VERIFIED |
| Node requirement | installed next/package.json engines | ^18.18.0 أو ^19.8.0 أو >=20؛ project engines غير مصرّح | AWS runtime NOT_VERIFIED؛ local24 لا يثبت Node22 image |
| API URL | lib/api.ts:3 وinfra/nginx/default.conf:27–34 | SSR API_INTERNAL_URL، افتراضي localhost8000؛ browser /api؛ proxy strips prefix | env values غير مقروءة، لا نفترض صحتها |
| backend runtime | backend/Containerfile:15 | alembic upgrade head قبل uvicorn port8000 | NOT_VERIFIED؛ startup migration خطر يجب عزله قبل rollout |
| broker/worker | compose:18–48، worker.py | Redis7، Celery concurrency2، ping task فقط بالمصدر | NOT_VERIFIED |
| database | compose:5–16 وdocs/PLAN.md:28 | PostgreSQL17 local volume؛ PLAN يقول Supabase dropped | المستخدم يقول Supabase؛ لا حسم دون دليل |
| reverse proxy/TLS | nginx/default.conf | HTTP→HTTPS؛ Next3000، FastAPI8000، /media volume، Cloudflare origin certificate | NOT_VERIFIED؛ لا فحص cert/key |
| exposed ports | compose:59–72 | Nginx80/443 فقط؛ backend/Redis/DB داخليًا | firewall/bindings actual NOT_VERIFIED |
| env names | .env.example keys فقط | DATABASE_URL، REDIS_URL، JWT_SECRET، CORS_ORIGINS، API_INTERNAL_URL وPostgres vars | القيم/الأسرار لا تعرض ولا تنسخ |
| health/deploy check | main.py:24–32، workflow:102 | HTTP200 حتى db=down؛ curl -k localhost | gate غير كافٍ؛ لا نعتبره readiness ناجحة |
| logs | uvicorn/Celery container output، audit model | لا structured redaction/request IDs مثبتة | log contents لم تُقرأ؛ قد تحتوي أسرار/PII |
| deploy mechanism | .github/workflows/deploy.yml:5–8,80–102 | push main/manual trigger، fetch/reset، force-recreate، nginx restart، image prune | لا استعمال له في التدقيق؛ actual workflow version NOT_VERIFIED |
| backup | pg-backup.sh:8–11/systemd timer | pg_dump لcontainer local، يحتفظ آخر7 ملفات | لا يثبت backup Supabase أو نجاح restore |

لا تُستنتج حالة الخدمات من وجود YAML. لا تعتبر package.version=0.1.0 أو Next version هو application release SHA.

## 2. مرحلة SSH المقيّدة المطلوبة لاحقًا — READ ONLY

### قبل الاتصال

المستخدم يوفر host/user/port واتصالًا محكومًا/agent أو path لمفتاح موجود، دون إرسال private key contents/password. تحقق host fingerprint عبر قناة موثوقة. لا password auth أو known-host bypass أو حفظ مفتاح/تعديل SSH config بواسطة التدقيق. إن لزم sudo أو Docker group أو صلاحيات إضافية: توقف واسأل، لا ترفع الامتيازات تلقائيًا.

يمكن إعداد client invocation من المستخدم بخيارات BatchMode=yes وPasswordAuthentication=no وKbdInteractiveAuthentication=no وStrictHostKeyChecking=yes و-T. لا تنفذه هنا بلا اتصال مُعدّ. Forced-command أو allowlist يحدد المسموح؛ لا نتحايل عليه.

### الأدلة المطلوب جمعها، بأوامر قراءة محددة فقط

1. pwd/id ومعلومات OS غير الحساسة لتحديد المسار والمستخدم؛ لا تصفح home/private directories عشوائيًا.
2. داخل release path الموافق: `git --no-optional-locks rev-parse HEAD` و`git --no-optional-locks branch --show-current` وstatus short إن سمح. لا fetch/pull/reset/checkout/config edits. إذا لم يوجد Git نعلن ذلك.
3. Podman على نفس المستخدم المصرح: names/image/status فقط للحاويات الخاصة بالمشروع؛ selected fields من inspect (ID/image digest/OCI revision labels)، **لا inspect JSON كامل** لأنه يحتوي Env وربما أسرارًا.
4. ربط image digest وOCI revision بـcheckout SHA؛ current checkout وحده لا يثبت كود الحاوية الجارية. frontend/backend قد يختلفان؛ تحقق كل واحد منفصلًا.
5. frontend artifact read: package.json dependency versions، .next/BUILD_ID وselected artifact hashes. compiled standalone لا يحتفظ بكل TSX؛ hashes للـbundle وحدها ليست إثبات commit بلا provenance/build manifest.
6. backend source hashes للملفات المسموح بها main/routers/models/worker/schemas/requirements/migration artifacts؛ قراءة نص code محدد دون import app أو تشغيله. إذا exec container غير مسموح، تُطلب artifact manifest من المسؤول بدل توسيع الصلاحية.
7. configuration files المسموح بها: Containerfiles/compose/Nginx source بعد استبعاد أي literal secret. لا قراءة key/cert private content، .env، /proc/*/environ أو printenv. لا نسخ مجلد المشروع كاملًا حيث قد يحتوي env/credentials.
8. migration **files** فقط؛ لا alembic current/upgrade/downgrade أو psql/DB queries في الإذن الحالي. live schema/provider يحتاج sanitized schema-only export من المسؤول أو موافقة منفصلة، دون records.

ممنوع أثناء التحقق: install/build/start/stop/restart/reload، compose up/down، Celery task/ping/inspect تطبيقي غير مصرح، docker/podman cp لمجلد كامل، raw logs، private API calls أو DB records، تعديل أو إنشاء ملف server حتى مؤقتًا. لا session recording يحتوي أسرارًا. الوصول الاعتيادي قد يسجله sshd تلقائيًا؛ لا نصدر أي أمر كتابة.

### جدول تحديث المصادر بعد نجاح SSH

| العنصر | الآن | ما يحوّله إلى VERIFIED |
|---|---|---|
| deployed frontend commit | NOT_VERIFIED | digest + OCI SHA/build provenance وربط المصدر |
| deployed backend commit/routes | NOT_VERIFIED | image/source manifest + route code whitelist |
| schema / provider | NOT_VERIFIED | export schema/config metadata مُنقح ومعتمد، لا records |
| actual Nginx/runtime/ports | NOT_VERIFIED | read-only effective artifact evidence ضمن allowlist |
| real worker behavior/API E2E | NOT_VERIFIED | لا يكفي SSH/source؛ staging tests ثم إذن تحقق تشغيل منفصل |
| production backups/restore | NOT_VERIFIED | operator evidence/restore rehearsal معتمد؛ لا تشغيل restore بالتدقيق |

تحدّث التقارير العشرة بعناوين evidence/time/digest وسياق كل نتيجة، ولا تمسح الفجوات التي لم يغطها الفحص.

## 3. خطة staging والدمج — لا تنفيذ الآن

| المرحلة | العمل المقترح | Gate / حفظ البيانات | المسؤول |
|---|---|---|---|
| 0 | إثبات P وخريطة consumer/schema | منع تطبيق migration من O على نسخة P مختلفة | B/ops + A |
| 1 | اعتماد contracts والمخطط والأوضاع | public/private DTO، price/quantity/mode policy | A+B |
| 2 | auth وcatalog/listings وengine persistence | Backend tasks B01–B09 واختبارات negative/race | B |
| 3 | ربط UI N عبر adapters، لا تغيير التصميم | Frontend tasks A01–A15؛ production no fixtures | A |
| 4 | staging مع isolated DB/Redis/media/env | لا DATABASE_URL أو broker إنتاج؛ labels واضحة؛ synthetic users فقط | B/ops |
| 5 | expand migrations على staging وإعادة backfill | IDs/FKs preserved، mapping بلا fuzzy merge؛ seed ليس migration | B |
| 6 | tests E2E/security/reconnect/closed-tab | END_TO_END_TEST_PLAN؛ no fake Agent/Agreement data | A+B |
| 7 | build image بنفس Node22 المثبت أو runtime المعتمد | reproducible artifact، OCI revision/digests، no .env.local/cache/verification/keys | A+B/ops |
| 8 | staging proxy/media/auth/health validation | same-origin /api وSSR internal URL، HTTPS cookies، no old UI fallbacks | A+B/ops |
| 9 | rehearsal backup/restore/rollback | provider الفعلي وtest restore مع counts/consistency، old artifact retention | B/ops |
| 10 | قرار Go/No-Go وموافقة مستقلة | gates كلها خضراء؛ current site يبقى حيًا أثناء التحضير | مسؤول الإصدار |

Mock يبقى محصور local development/tests؛ لا secret DB/Gemini/JWT في frontend bundle. يجب مراجعة container context لأن .containerignore الحالية لا تستبعد env.local/.npm-cache. لا تعديل هذا الملف في التدقيق.

## 4. rollout إنتاجي مستقبلي متحكم به

- خذ snapshot للإصدار الجاري (digests/source/config metadata) ونسخة DB/media مناسبة من المسؤول المخول مع اختبار restore. الأسرار تُدار في نظامها ولا تُنسخ للتقارير.
- طبّق **expand-compatible** schema release منفصلًا بعد approval ومراقبة locks؛ لا hidden auto-migration عند إعادة تشغيل خدمة. لا contract cleanup أو data drop في نفس rollout.
- ابنِ immutable frontend/backend images مع version labels، وانشر parallel/blue-green أو canary إن البنية تدعمه؛ تحتاج تهيئة يراجعها B/ops لاحقًا، وليست قدرة موجودة مثبتة الآن.
- حافظ على legacy reads إلى اكتمال نقل consumers، مع shared authorization. لا تتطلب الواجهة الجديدة hard-reset لبيانات المستخدمين.
- بدّل traffic تدريجيًا بقرار مستقل، وراقب errors/latency/queue/failed commands/Agreement uniqueness/stock conflicts/privacy، ثم توسع إذا نجحت gates.
- health gate يجمع liveness وDB-aware readiness semantic status وworker execution evidence، مع public HTTPS validation؛ curl exit0 أو شاشة كتالوج لا تثبت الرحلة.
- لا تنفذ smoke يخلق production records بدون إذن جديد/حسابات اختبار معتمدة؛ plan tests تنفذ أساسًا في staging. فحوص production الأولى غير mutating وبنطاق معتمد.

## 5. rollback وخطوط الإيقاف

Rollback triggers: 401/403 regression، أي cross-Seller/private-field exposure، قبول/stock مكرر، 5xx مستمرة، workers لا تتقدم/تكرر الجولة، فقد historical Agreements، unexpected Mock/legacy UI fallback.

أوقف rollout لا current service عشوائيًا، وأعد routing إلى immutable previous image/config release وفق runbook الذي يراجعه ops. الاحتفاظ بالـold image ضروري؛ workflow image prune الحالي يحتاج مراجعة، وليس خطة rollback.

schema الإضافية تبقى متوافقة مع الإصدار السابق؛ لا alembic downgrade/drop للتراجع عن frontend. restore DB ليس rollback اعتياديًا لأنه قد يفقد writes لاحقة؛ disaster recovery يحتاج قرارًا منفصلًا وpoint-in-time/data reconciliation. لا down -v ولا reset seeds ولا استبدال real rows بـMock.

## 6. ترتيب التنفيذ الموصى به

إثبات deployment → auth/DTO fixes → catalog/listings/rules → durable competitive engine → atomic Agreement/stock → events/history/notifications → reports/Admin → production frontend integration → staging/E2E/restore → controlled rollout. التصميم المعتمد يبقى ثابتًا طوال التحويل. اليوم لا يوجد دليل كافٍ لإطلاق الرحلة الجديدة، ويستمر الموقع الحالي دون تغيير.


---

## تحديث الأدلة AWS-R1 — 19 أكتوبر 2026

**هذا ملحق جديد؛ النص السابق محفوظ كتاريخ للتدقيق، وتُقدَّم نتائج هذا الملحق عند تعارضها معه.** N هو العرض المحلي متعدد البائعين، وO المصدر المحلي القديم، وR المصدر المنسوخ من AWS في `<LOCAL_USER_HOME>\Documents\autoneg-production-reference`. تم فحص R محليًا للقراءة فقط. عبارة SOURCE_VERIFIED تعني وجود السلوك في المصدر، ولا تعني أنه يعمل في الحاوية المنشورة. بيانات الخادم التشغيلية أدناه من توثيق المستخدم؛ لم ننفذ اتصال AWS أو قاعدة بيانات.

الفرع المبلغ عنه `main`، والالتزام `0be5da348fd7c38da41f1628a4420135e02e2cd8`، مع تعديلات محلية على الخادم وعدم وجود Git revision label لصورة الواجهة. لذلك تطابق R مع صورة التشغيل، وDDL الفعلي، ونسخة migrations، وصلاحيات التشغيل، ونجاح التدفقات الحقيقية تظل **NOT_VERIFIED**. لا يجوز نسبة تعديلات working tree تلقائيًا إلى ذلك الالتزام.


### تصحيح خط الأساس للنشر

المصدر المنسوخ R من working tree عليه تعديلات؛ Git commit وحده لا يمثل هذه التعديلات. الهدف المبلغ عنه للواجهة **autoneg-nextjs-secure** وليس الاسم القديم المفترض. لا توجد revision label للصورة؛ لذلك لا تُبنى خطة rollback على SHA وحده، ولا يُنسخ N كاملًا فوق working tree أو backend الحالي.

### بوابات الخطة الآمنة — تنفيذ مستقبلي بإذن منفصل

1. **إثبات artifacts:** جمع image digests وbuild provenance وconfiguration versions المنقحة، وربطها بالمصدر العامل بما فيه التعديلات المحلية. وصف Nginx/compose/lockfiles غير مرفق؛ نسخ O القديمة ليست دليلًا على إعداد الإنتاج. يتم ذلك لاحقًا بوسيلة مأذونة؛ لا اتصال AWS في هذه المهمة.
2. **مصالحة source:** دمج قدرات R الحقيقية مع UI المعتمد من N في إصدار مستقل مُراجع؛ عدم فقد workspace CRUD/legacy agreements وعدم نسخ global bootstrap أو fallback غير الآمن كما هو.
3. **بوابة أمن وسلامة:** auth/RBAC/ownership وserver DTO، GET بلا seeding، إلغاء synthetic success في real mode، حماية terminal states وlimits والمخزون. المحافظة على DB integration؛ Mock غير مسموح بديلًا في إنتاج.
4. **قاعدة البيانات:** تأكيد provider/DDL/migration head، backup مُختبر restore، staging منفصل ببيانات منقحة، migration إضافية مُراجعة وقياس integrity. لا reset/drop/truncate ولا seeds ولا استبدال records.
5. **عقود التنافس:** catalog/listings/threads/events/atomic approval جاهزة واختبارات E2E للأدوار وlegacy contracts ناجحة. UI تبقى Buyer/Seller/Admin المعتمدة بلا Storefronts.
6. **إصدار تدريجي:** بناء artifact قابل للتتبع في مسار نشر معتمد لاحقًا، Mock off وفحص fail-closed، feature flag للتنافس حتى نجاح staging، لا تبديل target بناءً على اسم مفترض.
7. **Rollback:** حفظ digests والإعدادات الحالية وإمكانية إعادة التطبيق؛ schema متوافقة مع النسختين. إيقاف ميزة جديدة عند الخلل لا يعني حذف اتفاقيات حدثت أو الرجوع الأعمى بقاعدة البيانات إلى backup يفقدها.
8. **قبول وتشغيل:** تحقق حقيقي من privacy/legacy data/errors/health في نافذة معتمدة، مع مراقبة منقحة من الأسرار. موافقة أصحاب النظام قبل أي تشغيل نشر أو migration.

هذه خطة فقط؛ لم ننفذ أي بند تشغيلي. تبقى runtime/image parity وlive schema وrestore readiness وفعالية proxy/auth **NOT_VERIFIED**. المعلومات الجديدة لا تسمح بإعلان GO أو استبدال image دون بوابات السلامة أعلاه.


---

## AWS-R2 — تجهيز Frontend محليًا، 19 أكتوبر 2026

نُفذ تكامل المنتجات العامة مع تحقق الاستجابة والأخطاء، وأضيفت حدود typed/fail-closed للعقود الخاصة القائمة؛ لا bootstrap أو كتابة غير مخولة ولا fallback تجريبي في الإنتاج. تصاميم الأدوار وملكية Seller والمحاكاة محفوظة. نجحت 8 مجموعات اختبارات وTypeScript والبناء وstatic contract validation واختبار standalone على loopback. لا يثبت ذلك تشغيل FastAPI أو DB أو صورة AWS الفعلية؛ القرار NO-GO للنشر العام باقٍ.

النتائج وقائمة الملفات وقرارات الميزات: [FINAL_FRONTEND_INTEGRATION_REPORT.md](FINAL_FRONTEND_INTEGRATION_REPORT.md). الحزمة وأوامر staging والرجوع المعدة للموافقة فقط: [FRONTEND_STAGING_PLAN.md](FRONTEND_STAGING_PLAN.md). لم يُنفذ اتصال AWS أو نقل أو deploy أو تغيير قاعدة بيانات؛ تاريخ هذا التقرير السابق محفوظ.


## New evidence — 26 October 2026

This document preserves the earlier audit history. For the current authenticated production integration and model/storage matching, see docs/releases/PRODUCTION_RELEASE_REPORT_20261025.md and docs/releases/MODEL_MATCHING_RELEASE_20261025.md. Earlier NOT_VERIFIED/NO-GO statements must be interpreted with the later evidence; the copied AWS source was not proof of an identical running image. Production mock data is disabled. No staging fixtures are promoted.
