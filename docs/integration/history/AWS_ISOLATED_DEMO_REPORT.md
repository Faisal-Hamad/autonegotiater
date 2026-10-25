# AutoNegotiater — Isolated AWS Demo Preparation

تاريخ الإعداد: 19 أكتوبر 2026. **النسخة جاهزة للمراجعة المحلية؛ لم تُنشر ولم يُفتح اتصال AWS أو تُعدّل حاوية staging.**

## ما تم تجهيزه

حزمة Frontend منفصلة تشمل جميع app routes وcomponents وlib وpublic لواجهات Buyer/Seller/Admin. تعمل بالبيانات والمحاكاة الحالية: المنتجات، التفاوض الثنائي والمتعدد، جلسة Seller المشتركة مع Buyer، الإدارة والتقارير PDF/CSV والإشعارات والاتفاقيات المحلية. لم تُضف خدمات Backend أو Storefronts أو وظائف خادم غير موجودة.

حُفظت CSS والرسومات والمكونات المعتمدة ومحرك التفاوض كما هي. تعديل العرض الوحيد هو تسمية الشريط القائم **DEMO MODE** بدل LOCAL DEMO. اختيار الهوية تجريبي، والتخزين في localStorage لكل متصفح؛ لا مصادقة حقيقية أو مشاركة بين أجهزة مختلفة أو حفظ PostgreSQL أو دفع أو طلب حقيقي.

## الفصل بين Demo والإصدار الحقيقي

- مفتاح AUTONEG_ISOLATED_DEMO_BUILD=true يُستخدم عند بناء حزمة Demo فقط. Next يثبت NEXT_PUBLIC_AUTONEG_DEMO_BUILD=true في artifact؛ بناء الإنتاج العادي يثبت false.
- بناء Demo يعمل تحت NODE_ENV=production مع كل المحاكاة. لا يُعتمد على USE_MOCK_DATA وحده لتجاوز حماية الإصدار العادي.
- اختُبر Demo مع متغيرات runtime تحاول تعطيله، واختُبر الإصدار العادي مع متغيرات تحاول تفعيله: لم يتغير اختيار أي منهما المثبت بالبناء.
- preload باسم demo-network-guard.cjs يمنع اتصالات التطبيق الصادرة عبر TCP/TLS/HTTP/fetch قبل تحميل Next؛ يستمر استقبال HTTP الوارد.
- CSP في Demo يحصر اتصالات المتصفح في نفس origin ويمنع تحميل الصور الخارجية. لا proxy إلى API، ولا إعداد اتصال DB أو API production ولا credentials أو ملفات بيئة في الحزمة.
- لا يُقدَّم هذا كـfirewall على المضيف؛ هو منع داخل عملية Demo مع إعداد شبكة منفصل. لا تُزل guard أو تضف ملفات أسرار أو شبكة/مجلدات production.

## إصلاح Containerfile

في frontend/release/Containerfile كانت مرحلة build تنسخ node_modules فقط من مرحلة deps، ثم تطلب npm run build دون package.json. أُضيف نسخ package.json وpackage-lock.json قبل البناء. هذا خلل مثبت في الملف يكفي لفشل الأمر؛ لم نفحص سجل build سابقًا على AWS ولا نفترض أنه السبب الوحيد لأي خطأ غير مرسل.

أُنشئ Containerfile منفصل في frontend/release/aws-demo/Containerfile مع نفس التصحيح، npm ci --include=dev في مرحلة dependencies، نسخ صريح للمصدر، build مخصص لـDemo، تشغيل standalone كمستخدم node، وhealthcheck يتحقق من mode=demo. لم نغير أو نستبدل حاوية staging أو حزمة staging التاريخية السابقة.

## ملفات التسليم

- frontend/release/aws-demo/artifacts/autonegotiater-isolated-demo-r1.zip
- frontend/release/aws-demo/artifacts/autonegotiater-isolated-demo-r1.zip.sha256
- frontend/release/aws-demo/Containerfile
- frontend/release/aws-demo/DEPLOYMENT_COMMANDS.md

SHA-256:

`85ebd2ac366fd8be46141ad7d7196ff83943e88ead35eb75a6f4353a755fcf8f`

ZIP يحوي 61 مدخلًا، منها manifest ببصمات الملفات، ولا يتضمن .env أو node_modules أو .next أو backend أو infra أو tests أو caches أو credentials. config المحمول لا يشير إلى types الخاصة ببناء Windows القديم. الفحص النمطي للأسرار لم يرصد الأنماط المحددة؛ ليس ضمانًا لكل شكل ممكن من الأسرار. تطابقت بصمة ZIP بعد إعادة توليده وحُققت ملفات manifest.

## نتائج التحقق الفعلية

| الاختبار | النتيجة |
|---|---|
| مجموعات verify-*.cjs التسع | PASS |
| TypeScript --noEmit --incremental false | PASS |
| محرك التنافس والخصوصية والتكامل | PASS: 114 محاكاة، 7 منتجات، 424 tick تدريجي؛ ومحاكاة ثنائية وحالات فشل/رفض/إلغاء |
| PDF/CSV واللغة والملكية والتنقل | PASS |
| منع اتصالات Demo الصادرة | PASS: TCP/TLS/HTTP/fetch ممنوعة في اختبار مستقل وتشغيل standalone بنفس guard |
| Demo production build (.next-demo) | PASS؛ standalone كامل يعمل محليًا |
| Standard production build (.next-release) | PASS؛ Mock بقي false رغم متغيرات runtime true |
| بناء محتوى ZIP المستخرج دون .env | compilation/type checks PASS؛ تحذير Windows junction في نسخ traced dependencies؛ أُعيد بناء standalone مقابل dependencies الحقيقية ونجح بلا ذلك التحذير |
| HTTP smoke | PASS: 24 route لـDemo، health وCSP وCSS، وعزل الوضع عن standard artifact |
| Browser smoke | PASS: Browse→Dell→بدء التنافس→تحسن عروض وإعلانات مجهولة→مقارنة؛ ثم Seller يرى الجلسة نفسها، ثم Admin Reports preview وأزرار التنزيل |
| Podman image build/run على Linux/Node22 | NOT_RUN؛ لا Podman/Docker متوفرين محليًا |
| AWS / production API / PostgreSQL / staging container | NOT_ACCESSED |

استُخدم Node 24.21.0 محليًا؛ Containerfile يستخدم Node22-alpine مثل خط الأساس. لا نزعم نجاح تشغيل صورة Linux لم تُبنَ. أوامر البناء والتشغيل المستقبلية وفحوص health أُعدّت لتكون نقطة تحقق بعد الموافقة، لا حالة PASS حالية. لم تُثبَّت مكتبات أو تُحدّث lockfiles.

## الملفات التي تغيّرت في هذه الجولة

داخل frontend:

- lib/api.ts: تمييز artifact المخصص لـDemo ومنع public API requests فيه.
- next.config.ts: تثبيت مفتاح البناء، CSP المخصص وdistDir للتحقق المنفصل.
- components/site-shell.tsx: DEMO MODE label فقط.
- app/api/health/route.ts: معلومات Demo وحفظه المحلي دون فحص Backend.
- release/Containerfile: إصلاح manifests لمرحلة build.
- tsconfig.json وnext-env.d.ts: تحديثات Next التلقائية لمسارات البناء.

أُنشئت:

- release/aws-demo/Containerfile
- release/aws-demo/demo-network-guard.cjs
- release/aws-demo/package-demo.py
- release/aws-demo/DEPLOYMENT_COMMANDS.md
- release/aws-demo/artifacts/autonegotiater-isolated-demo-r1.zip
- release/aws-demo/artifacts/autonegotiater-isolated-demo-r1.zip.sha256
- tests/verify-isolated-demo.cjs
- tests/smoke-isolated-demo.py

هذا المستند جديد في جذر النسخة المعزولة. مخرجات .next-demo/.next-release ومجلد .verification/aws-demo-r1-20261019 مولدة للتحقق المحلي وليست ضمن ZIP. وصلة node_modules في مجلد التحقق تعيد استخدام dependencies الموجودة ولا تثبت حزمًا. لا حذف لملفات المستخدم أو تغيير للأصل أو مرجع AWS.

فُحصت بصمات 83 ملفًا أساسيًا: تغيّرت الملفات الأربعة المتوقعة ضمن تلك العينة فقط؛ CSS والرسومات ومحرك التفاوض وBackend وinfra وحزمة staging السابقة لم تتغير. next.config وملفات Next المولدة مذكورة منفصلة أعلاه. تطابقت أيضًا بصمات المصدر الأصلي ومرجع AWS المفحوصين.

## الأوامر ونقطة الموافقة

الأوامر الكاملة في [DEPLOYMENT_COMMANDS.md](frontend/release/aws-demo/DEPLOYMENT_COMMANDS.md):

- حساب deploy غير الجذر؛ دليل جديد /home/deploy/autoneg-frontend-demo-r1.
- صورة localhost/autoneg-frontend-demo:r1.
- حاوية جديدة autoneg-nextjs-demo-r1.
- منفذ **127.0.0.1:33117 → 3000**، منفصل عن staging السابق.
- لا Nginx أو DNS أو production routing أو اتصالات/volumes إنتاجية.
- فحص التصادمات، SHA، build، run، health، ثم إيقاف Demo وحده كخطة رجوع.

اسم SSH الفعلي وأمر النقل/النفق يحتاجان مراجعة منفصلة عند توفير الوجهة، ولم يُخترعا أو يُنفذا. **التوقف الآن للموافقة على الأوامر.** لم نصل AWS أو GitHub ولم ننفذ Podman أو ننقل ملفًا أو نعدّل staging. أُوقفت خوادم الاختبار المحلية 3117 و3118 بعد التحقق من هويتها. هذه موافقة Demo فقط عند منحها؛ لا تسمح باستبدال الإنتاج الحقيقي أو بياناته بـMock.


## New evidence — 26 October 2026

This document preserves the earlier audit history. For the current authenticated production integration and model/storage matching, see docs/releases/PRODUCTION_RELEASE_REPORT_20261025.md and docs/releases/MODEL_MATCHING_RELEASE_20261025.md. Earlier NOT_VERIFIED/NO-GO statements must be interpreted with the later evidence; the copied AWS source was not proof of an identical running image. Production mock data is disabled. No staging fixtures are promoted.
