# AutoNegotiater — توثيق إعداد السيرفر

> آخر تحديث: 2026-09-29
> الملف هذا يوثق كل الخطوات اللي تمت على سيرفر الإنتاج. **ما فيه أي باسوردات أو مفاتيح خاصة.**

---

## معلومات السيرفر

| البند | القيمة |
|---|---|
| النظام | AlmaLinux 10.2 (Lavender Lion) |
| المنطقة | AWS eu-central-1 (Frankfurt) |
| IP العام | `63.187.47.83` |
| الكيرنل | `6.12.0-211.56.1.el10_2` |
| SELinux | Enforcing |
| الدومين | `autonegotiater.com` (عبر Cloudflare، Proxied) |
| الريبو | `github.com/Faisal-Hamad/autonegotiater` (Public) |
| مجلد التطبيق | `/var/www/autonegotiater` |

### قاعدة العمل
| المستخدم | يستخدم لـ |
|---|---|
| `ec2-user` | أي أمر فيه `sudo` (تثبيت، إعدادات النظام، firewall) |
| `deploy` | `git` و `podman` و `podman-compose` — **بدون باسورد وبدون sudo** |

الانتقال لـ `deploy` (في سطر لحاله قبل أي أوامر ثانية):
```bash
sudo -iu deploy
```

---

## 1. الدخول بالباسورد عبر SSH

الإعداد الافتراضي كان `PasswordAuthentication no` في مكانين:
- `/etc/ssh/sshd_config` (سطر 131)
- `/etc/ssh/sshd_config.d/50-cloud-init.conf`

sshd يأخذ **أول قيمة** يقراها، وملفات `sshd_config.d/` تنقرا بالترتيب الأبجدي قبل الملف الرئيسي. عشان كذا أنشأنا ملف `00-` يسبق الكل:

```bash
sudo passwd ec2-user
echo 'PasswordAuthentication yes' | sudo tee /etc/ssh/sshd_config.d/00-password-auth.conf
sudo sshd -t && sudo systemctl restart sshd
```

**الحالة:** `passwordauthentication yes` ، `pubkeyauthentication yes`

---

## 2. مستخدم deploy ومجلد التطبيق

```bash
sudo dnf install -y git
sudo useradd -m -s /bin/bash deploy
sudo mkdir -p /var/www/autonegotiater
sudo chown deploy:deploy /var/www/autonegotiater
sudo loginctl enable-linger deploy
```

- `enable-linger`: يخلي containers حق `deploy` تكمل شغالة بعد تسجيل الخروج وتقوم مع الـ reboot.
- `subuid/subgid` انضافت تلقائيًا (`589824:65536`) — مطلوبة لـ rootless Podman.

**الحالة:** `uid=1001(deploy)` ، `Linger=yes` ، المجلد ملك `deploy:deploy`

---

## 3. ربط الريبو (Deploy Key للقراءة فقط)

الكود يجي من GitHub **فقط**، فالسيرفر يقدر يسحب لكن ما يقدر يرفع.

كـ `deploy`:
```bash
ssh-keygen -t ed25519 -C "deploy@autonegotiater" -f ~/.ssh/autonegotiater_deploy -N ""

cat > ~/.ssh/config <<'EOF'
Host github-autonegotiater
    HostName github.com
    User git
    IdentityFile ~/.ssh/autonegotiater_deploy
    IdentitiesOnly yes
EOF
chmod 700 ~/.ssh && chmod 600 ~/.ssh/config
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts
```

- بصمة GitHub المتحقق منها: `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`
- بصمة مفتاح النشر: `SHA256:yIrQPanuBeQ4qaX/7aS2WPhPdPr5CS/J52FoHvjgcvU`
- في GitHub: **Settings → Deploy keys** → `ec2-autonegotiater` — **Allow write access: غير مفعّل**

الاستنساخ والربط:
```bash
cd /var/www/autonegotiater
git clone github-autonegotiater:Faisal-Hamad/autonegotiater.git .
git pull origin main
git branch -u origin/main
```

**الحالة:** البرانش `main` يتبع `origin/main`. التحديث من الحين: `git pull`

---

## 4. Podman (rootless)

```bash
sudo dnf install -y podman                 # podman 5.8.2
sudo dnf install -y epel-release
sudo dnf install -y podman-compose         # podman-compose 1.5.0 (من EPEL)
```

التحقق كـ `deploy`:
```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)
podman info --format '{{.Host.Security.Rootless}} | cgroup={{.Host.CgroupsVersion}} | driver={{.Store.GraphDriverName}}'
# true | cgroup=v2 | driver=overlay
```

`XDG_RUNTIME_DIR` مطلوب لأن `sudo -iu` ما يعطي جلسة systemd. نحفظه دايم:
```bash
echo 'export XDG_RUNTIME_DIR=/run/user/$(id -u)' >> ~/.bashrc
```

### ليش Podman؟
- بديل لـ Docker (نفس الـ images ونفس الأوامر تقريبًا)
- بدون daemon يشتغل كـ root
- containers تشتغل كمستخدم عادي (`deploy`) — لو انخترق container، المهاجم يطلع `deploy` مو root
- مدمج في AlmaLinux ويشتغل مع SELinux و systemd

---

## 5. السماح لـ rootless بالبورتات 80/443

Linux يمنع غير root من البورتات تحت 1024.

```bash
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/99-unprivileged-ports.conf
sudo sysctl -p /etc/sysctl.d/99-unprivileged-ports.conf
```

**الحالة:** `net.ipv4.ip_unprivileged_port_start = 80` — تم اختبار nginx على 80 كـ `deploy` ← `HTTP/1.1 200 OK`

---

## 6. تحديث النظام و reboot

```bash
sudo dnf update -y
sudo dnf needs-restarting -r
sudo reboot
```

**بعد الـ reboot تم التحقق:** الكيرنل الجديد، الخدمات شغالة، الـ sysctl ثابت، الـ linger ثابت.

---

## 7. firewalld

```bash
sudo dnf install -y firewalld
sudo systemctl enable --now firewalld
sudo firewall-cmd --permanent --add-service={ssh,http,https}
sudo firewall-cmd --permanent --remove-service={cockpit,dhcpv6-client}
sudo firewall-cmd --reload
```

**الحالة:** `http https ssh` فقط

---

## 8. fail2ban

```bash
sudo dnf install -y fail2ban
sudo tee /etc/fail2ban/jail.d/sshd.local >/dev/null <<'EOF'
[sshd]
enabled  = true
backend  = systemd
maxretry = 5
findtime = 10m
bantime  = 1h
EOF
sudo systemctl enable --now fail2ban
```

- 5 محاولات خاطئة خلال 10 دقائق ← حظر ساعة (عبر firewalld)
- فك حظر: `sudo fail2ban-client set sshd unbanip <IP>`
- الحالة: `sudo fail2ban-client status sshd`
- ملاحظة: التثبيت سحب `exim` كتبعية (للتنبيهات بالإيميل) — غير مستخدم

---

## 9. الدومين — Cloudflare DNS

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `autonegotiater.com` | `63.187.47.83` | Proxied 🟠 |
| CNAME | `www` | `autonegotiater.com` | Proxied 🟠 |

مع Proxied، الدومين يرجع IPs حق Cloudflare (مثل `2a06:98c1:...` أو `104.x`) مو IP السيرفر — هذا طبيعي، و IP السيرفر مخفي.

---

## 10. شهادة SSL — Cloudflare Origin Certificate

**Cloudflare → SSL/TLS → Origin Server → Create Certificate**
- Generate private key and CSR with Cloudflare — RSA (2048)
- Hostnames: `*.autonegotiater.com` ، `autonegotiater.com`
- Validity: 15 years

حفظها على السيرفر كـ `deploy` (برا الريبو):
```bash
mkdir -m 700 ~/certs
cat > ~/certs/origin.pem <<'EOF'
... Origin Certificate ...
EOF
cat > ~/certs/origin.key <<'EOF'
... Private Key ...
EOF
chmod 600 ~/certs/origin.*
```

| البند | القيمة |
|---|---|
| المسار | `/home/deploy/certs/origin.pem` ، `/home/deploy/certs/origin.key` |
| الانتهاء | `Sep 25 2041` |
| تطابق المفتاح والشهادة | ✅ (نفس hash المفتاح العام) |

**Cloudflare → SSL/TLS → Overview → Configure → Custom SSL/TLS → Full (Strict)**

**الاختبار:** `https://autonegotiater.com` ← `autonegotiater TLS OK` ✅

### إعداد nginx المطلوب للشهادة
```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name autonegotiater.com www.autonegotiater.com;
    ssl_certificate     /etc/nginx/certs/origin.pem;
    ssl_certificate_key /etc/nginx/certs/origin.key;
}
```
والـ mount في compose:
```yaml
volumes:
  - /home/deploy/certs:/etc/nginx/certs:ro,Z
```

---

## القرارات المتخذة

| القرار | الاختيار | السبب |
|---|---|---|
| قاعدة البيانات | **PostgreSQL في Podman** — Supabase ملغي | الفرونت ما يكلم الداتابيس مباشرة (NFR-03)، والمشاريع المجانية في Supabase تتوقف لو ما انستخدمت |
| تشغيل الـ stack | **podman-compose** | ملف `compose.yaml` واحد، أسهل للبداية. الانتقال لـ Quadlet ممكن لاحقًا |
| البورتات المنخفضة | **sysctl** بدل إعادة توجيه | سطر واحد، بدون صيانة |
| شهادة SSL | **Cloudflare Origin Certificate** بدل certbot | 15 سنة بدون تجديد، IP السيرفر مخفي، حماية DDoS. **تغيير عن الخطة — يُذكر في الفصل 5** |
| CI/CD | **GitHub Actions عبر SSH** كـ `deploy` | الـ push على `main` ينشر تلقائيًا، ويبني بس الخدمات اللي تغيّرت |
| دخول SSH | **باسورد** | قرار المسؤول |
| الريبو | **Public** | مشروع تخرج |

---

## سجل المشاكل (بصيغة problems.md)

```
[2026-09-29] Faisal | server
Problem: تعديل PasswordAuthentication في sshd_config ما يأثر
Cause:   ملف sshd_config.d/50-cloud-init.conf يسبقه، و sshd يأخذ أول قيمة
Fix:     ملف جديد 00-password-auth.conf يُقرا قبل الكل

[2026-09-29] Faisal | server
Problem: أوامر بعد sudo -iu deploy ما تنفذ كـ deploy
Cause:   sudo -iu يفتح shell جديد والأسطر الملصوقة بعده تضيع
Fix:     sudo -iu deploy في سطر لحاله، بعدين الصق باقي الأوامر

[2026-09-29] Faisal | server
Problem: systemctl --user يعطي "Failed to connect to bus" كـ deploy
Cause:   sudo -iu ما يضبط XDG_RUNTIME_DIR
Fix:     export XDG_RUNTIME_DIR=/run/user/$(id -u) في ~/.bashrc

[2026-09-29] Faisal | server
Problem: sudo يطلب باسورد لـ deploy
Cause:   deploy بدون باسورد وبدون sudo (مقصود)
Fix:     أوامر sudo تنفذ كـ ec2-user فقط

[2026-09-29] Faisal | server
Problem: rootless Podman ما يقدر يستخدم بورت 80/443
Cause:   Linux يحجز البورتات تحت 1024 لـ root
Fix:     net.ipv4.ip_unprivileged_port_start=80 في /etc/sysctl.d/

[2026-09-29] Faisal | server
Problem: curl يرجع فاضي بعد تشغيل container مباشرة
Cause:   nginx ما لحق يشتغل
Fix:     sleep 3 قبل الاختبار

[2026-09-29] Faisal | server
Problem: nano غير موجود كـ deploy
Cause:   غير مثبت، و deploy ما عنده sudo
Fix:     لصق الملفات بـ cat > file <<'EOF' ... EOF

[2026-09-29] Faisal | server
Problem: container ما يقدر يقرا ملفات الشهادة
Cause:   SELinux يمنع الـ containers من ملفات المستخدم
Fix:     :Z في آخر الـ volume mount (مثال: ~/certs:/etc/nginx/certs:ro,Z)

[2026-09-29] Faisal | server
Problem: curl https://localhost → TLS connect error (SSL_ERROR_SYSCALL)
Cause:   curl يجرب IPv6 أول، و nginx يسمع IPv4 فقط. سكربت nginx
         اللي يضيف IPv6 ما قدر يعدل الإعداد لأنه mounted read-only
Fix:     إضافة listen [::]:443 ssl; للإعداد

[2026-09-29] Faisal | server
Problem: curl -4 https://autonegotiater.com → Could not resolve host
Cause:   كاش DNS سلبي في AWS (أول فحص كان قبل إضافة السجل في Cloudflare)
Fix:     ينتظر انتهاء الكاش — الموقع كان يشتغل من المتصفح

[2026-09-29] Faisal | server
Problem: curl -6 من السيرفر يفشل فورًا
Cause:   السيرفر بدون IPv6
Fix:     لا شيء — Cloudflare يكلم السيرفر على IPv4، والزوار ما يتأثرون
```

---

## الحالة الحالية

| البند | الحالة |
|---|---|
| SSH بالباسورد | ✅ |
| مستخدم deploy + المجلد + linger | ✅ |
| Deploy key + الريبو مربوط | ✅ |
| Podman rootless + podman-compose | ✅ |
| البورتات 80/443 لـ rootless | ✅ |
| تحديث النظام + reboot | ✅ |
| firewalld | ✅ |
| fail2ban | ✅ |
| الدومين على Cloudflare | ✅ |
| Origin Certificate + Full (Strict) | ✅ |
| كود التطبيق (frontend / backend / infra) | ✅ هيكل الأسبوع 2 في الريبو |
| `.env` على السيرفر | ⏳ |
| CI/CD (SSH) | ✅ الـ Secrets مضافة والـ workflow في الريبو |
| نسخ احتياطي لـ PostgreSQL (`pg_dump` يومي) | ⏳ |
| تشغيل الـ stack تلقائيًا مع الـ reboot | ⏳ |

---

## فهم البيئة الحالية

### مسار الطلب
```
الزائر (IPv4 أو IPv6)
   │  HTTPS — شهادة Cloudflare العامة
   ▼
Cloudflare (Proxied 🟠) — يخفي IP السيرفر + حماية DDoS
   │  HTTPS — Origin Certificate — وضع Full (Strict) — IPv4
   ▼
EC2 63.187.47.83  (AWS Security Group ← firewalld: http https ssh)
   │
   ▼
Podman rootless كـ deploy
   └── nginx :80/:443  (الشهادة من /home/deploy/certs)
         ├── /       → nextjs   :3000
         ├── /api    → fastapi  :8000 ──┬── postgresql :5432 (داخلي فقط)
         │                              └── redis :6379 (داخلي فقط)
         │                                     ▲
         │                              celery-worker (مهام التفاوض بالخلفية)
         └── /media  → volume الصور
```

### الطبقات ومين مسؤول عن وش
| الطبقة | الأداة | الحالة |
|---|---|---|
| DNS + حماية الحافة | Cloudflare | ✅ جاهز |
| الشبكة الخارجية | AWS Security Group | يُراجع لاحقًا |
| جدار ناري على السيرفر | firewalld | ✅ http https ssh |
| حماية SSH | fail2ban | ✅ |
| تشغيل الـ containers | Podman rootless كـ deploy | ✅ جاهز، ما فيه containers شغالة حاليًا |
| تعريف الخدمات | `infra/compose.yaml` في الريبو | ✅ |
| الكود | الريبو على GitHub | ✅ |
| الأسرار | `.env` على السيرفر (ما ينرفع للريبو أبدًا) | ⏳ |

### نقاط مهمة عن البيئة
- **ما فيه Node.js ولا Python على السيرفر ولا يحتاجهم.** كل خدمة تنبني داخل container من `Containerfile` في الريبو.
- **الكود يجي من GitHub فقط.** السيرفر يسحب بمفتاح قراءة فقط ولا يقدر يرفع.
- **السيرفر بدون IPv6**، لكن nginx لازم يسمع على `[::]` بعد، لأن Podman يمرر اتصالات IPv6 المحلية للـ container.
- **SELinux مفعّل:** أي volume mount يحتاج `:Z` (أو `:z` لو مشترك بين أكثر من container).
- **postgresql و redis ما ينفتح لهم أي بورت** على السيرفر. يتواصلون مع باقي الخدمات عبر شبكة Podman الداخلية بأسماء الخدمات (مثل `postgresql:5432`).
- **الشهادة تشتغل فقط مع Cloudflare Proxied.** لو تحوّل السجل لرمادي، المتصفحات بترفض الموقع.

---

## الخطوات المتبقية (بالترتيب)

### 1. هيكل الريبو — ✅ تم
الريبو فيه الحين `backend/` و `frontend/` و `infra/` و `.github/workflows/deploy.yml`.

### 2. ملف `.env` (كـ deploy)
```bash
cd /var/www/autonegotiater && git pull
cp .env.example .env && chmod 600 .env
# عدّل الباسورد في POSTGRES_PASSWORD و DATABASE_URL (لازم يكونون نفس القيمة)
# و JWT_SECRET:  openssl rand -hex 32
```

### 3. أول تشغيل يدوي (كـ deploy)
```bash
cd /var/www/autonegotiater
podman-compose -f infra/compose.yaml up -d --build
podman ps
podman exec autoneg-fastapi python seed.py
curl -sk https://localhost/api/health          # {"status":"ok","db":"ok"}
```
- الـ migrations تشتغل تلقائيًا مع كل تشغيل للـ fastapi (`alembic upgrade head`).

### 4. CI/CD — GitHub Actions عبر SSH
الـ workflow يشتغل على سيرفرات GitHub، ويدخل السيرفر بـ SSH كـ `deploy` وينشر.

**GitHub Secrets** (Settings → Secrets and variables → Actions):
| Secret | القيمة |
|---|---|
| `SSH_HOST` | `63.187.47.83` |
| `SSH_PORT` | `22` |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | المفتاح الخاص `~/.ssh/github_actions` |
| `SSH_KNOWN_HOSTS` | بصمة السيرفر (ناتج `ssh-keyscan`) |
| `PROJECT_DIR` | `/var/www/autonegotiater` |

المفتاح العام `github_actions.pub` لازم يكون في `/home/deploy/.ssh/authorized_keys`.

**وش يسوي كل نشر** (`push` على `main`، أو تشغيل يدوي من تبويب Actions):
1. `git reset --hard origin/main` في `PROJECT_DIR`
2. يبني **بس الخدمات اللي تغيّر مجلدها**:
   | اللي تغيّر | اللي ينبني |
   |---|---|
   | `backend/` | `fastapi` + `celery-worker` |
   | `frontend/` | `nextjs` |
   | `infra/compose.yaml`، أو تشغيل يدوي | كل الخدمات |
   | `infra/nginx/` | إعادة تشغيل nginx بس |
   | `docs/` أو غيره | ولا شي، يسحب الكود بس |
3. `podman restart autoneg-nginx` بعد أي بناء
4. health check على `/api/health`

**ملاحظة:** ملف `.env` لازم يكون موجود على السيرفر قبل أول نشر، وإلا الـ containers ما بتشتغل.

### 5. التشغيل التلقائي مع الـ reboot (كـ deploy)
كل الخدمات فيها `restart: always`، و `podman-restart.service` يرجّعها بعد الإقلاع:
```bash
systemctl --user enable --now podman-restart.service
```

### 6. النسخ الاحتياطي (كـ deploy)
```bash
mkdir -p ~/.config/systemd/user
cp /var/www/autonegotiater/infra/systemd/pg-backup.* ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now pg-backup.timer
systemctl --user start pg-backup.service && ls ~/backups     # تجربة
```
الاسترجاع:
```bash
gunzip -c ~/backups/<file>.sql.gz | podman exec -i autoneg-postgresql sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

### 7. تحقق أسبوع 2 (من PLAN.md)
- [ ] `https://autonegotiater.com` يفتح صفحة Next.js
- [ ] `/api/health` يرجع ok مع فحص الداتابيس
- [ ] `/products` يعرض المنتجات **بدون** `min_acceptable_price`
- [ ] 5432 و 6379 غير متاحة من برا
- [ ] البيانات تبقى بعد `podman-compose down && up` وبعد `sudo reboot`
- [ ] الريبو فيه الهيكل + `problems.md`

### 8. لاحقًا
- مراجعة قواعد AWS Security Group
- تقييد 80/443 لـ IPs حق Cloudflare فقط (اختياري)
- تنظيف `tlstest` لو ما انحذف: `podman rm -f tlstest; podman rmi docker.io/library/nginx:alpine; rm -f ~/test-ssl.conf`

---

## أوامر مرجعية

```bash
# سحب آخر كود (كـ deploy)
cd /var/www/autonegotiater && git pull

# حالة الخدمات (كـ ec2-user)
systemctl is-active sshd firewalld fail2ban
sudo firewall-cmd --list-services
sudo fail2ban-client status sshd

# containers (كـ deploy)
podman ps -a
podman logs <name>

# فحص الشهادة (كـ deploy)
openssl x509 -in ~/certs/origin.pem -noout -subject -enddate -ext subjectAltName
```
