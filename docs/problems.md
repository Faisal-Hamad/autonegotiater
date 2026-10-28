# AutoNegotiater — Problems Log

A shared log of the problems we ran into and how we fixed them. Add new entries under the matching section, using the same format:

```markdown
### N. Short title
- **Problem:** what went wrong (include the error message)
- **Cause:** why it happened
- **Fix:** what solved it
```

---

## Server

### 1. Changing `PasswordAuthentication` in `sshd_config` had no effect
- **Problem:** Editing `PasswordAuthentication` in `/etc/ssh/sshd_config` did not change the SSH behavior.
- **Cause:** The file `sshd_config.d/50-cloud-init.conf` is read before the main file, and sshd uses the first value it finds.
- **Fix:** Create a new file `sshd_config.d/00-password-auth.conf`, which is read before all the others.

### 2. Commands pasted after `sudo -iu deploy` did not run as `deploy`
- **Problem:** Commands pasted together with `sudo -iu deploy` were not executed as the `deploy` user.
- **Cause:** `sudo -iu` opens a new shell, and the lines pasted after it are lost.
- **Fix:** Run `sudo -iu deploy` on its own line first, then paste the rest of the commands.

### 3. `systemctl --user` fails with "Failed to connect to bus"
- **Problem:** `systemctl --user` returns `Failed to connect to bus` when run as `deploy`.
- **Cause:** `sudo -iu` does not set `XDG_RUNTIME_DIR`.
- **Fix:** Add `export XDG_RUNTIME_DIR=/run/user/$(id -u)` to `~/.bashrc`.

### 4. `sudo` asks for a password as `deploy`
- **Problem:** Running `sudo` as `deploy` prompts for a password that does not exist.
- **Cause:** `deploy` has no password and no sudo rights. This is intentional.
- **Fix:** Run `sudo` commands as `ec2-user` only.

### 5. Rootless Podman cannot bind ports 80 and 443
- **Problem:** The nginx container could not listen on ports 80/443 under rootless Podman.
- **Cause:** Linux reserves ports below 1024 for root.
- **Fix:** Set `net.ipv4.ip_unprivileged_port_start=80` in a file under `/etc/sysctl.d/`.

### 6. `curl` returns an empty response right after starting a container
- **Problem:** `curl` returned nothing when run immediately after starting the container.
- **Cause:** nginx had not finished starting yet.
- **Fix:** Wait a few seconds (`sleep 3`) before testing.

### 7. `nano` is not available as `deploy`
- **Problem:** `nano` is not installed, so files could not be edited as `deploy`.
- **Cause:** The editor is not installed, and `deploy` has no sudo rights to install it.
- **Fix:** Write files with a heredoc: `cat > file <<'EOF' ... EOF`.

### 8. The container cannot read the certificate files
- **Problem:** nginx inside the container could not read the mounted TLS certificate files.
- **Cause:** SELinux blocks containers from reading files in a user's home directory.
- **Fix:** Add `:Z` to the volume mount, for example `~/certs:/etc/nginx/certs:ro,Z`.

### 9. `curl https://localhost` fails with a TLS connect error
- **Problem:** `curl https://localhost` returned `TLS connect error (SSL_ERROR_SYSCALL)`.
- **Cause:** `curl` tries IPv6 first, and nginx was listening on IPv4 only. The nginx image script that normally adds IPv6 could not edit the config because it was mounted read-only.
- **Fix:** Add `listen [::]:443 ssl;` to the nginx config.

### 10. `curl -4 https://autonegotiater.com` could not resolve the host
- **Problem:** `curl -4 https://autonegotiater.com` returned `Could not resolve host` from the server.
- **Cause:** Negative DNS caching in AWS. The first lookup happened before the record was added in Cloudflare.
- **Fix:** Wait for the cache to expire. The site was already working from the browser.

### 11. `curl -6` from the server fails immediately
- **Problem:** `curl -6` fails right away when run on the server.
- **Cause:** The server has no IPv6 address.
- **Fix:** None needed. Cloudflare talks to the server over IPv4, so visitors are not affected.

### 18. Nginx returns `502 Bad Gateway` after recreating an upstream container
- **Problem:** Requests to `https://autonegotiater.com/api/docs` returned `502 Bad Gateway` after recreating the `fastapi` container.
- **Cause:** Nginx resolves and caches upstream container IP addresses at startup. When `fastapi` was recreated, Podman assigned it a new internal IP address, leaving Nginx attempting to connect to the stale IP.
- **Fix:** Restart Nginx using `podman restart autoneg-nginx` after recreating any upstream container.

### 19. `podman rm -f` fails due to container dependencies
- **Problem:** Running `podman rm -f autoneg-nextjs` failed with `Error: container ... has dependent containers which must be removed before it: ... (autoneg-nginx)`.
- **Cause:** In `compose.yaml`, `autoneg-nginx` depends on `autoneg-nextjs`. Podman enforces dependency integrity and prevents removing an upstream service while dependent downstream containers exist.
- **Fix:** Use `podman-compose -f infra/compose.yaml down && podman-compose -f infra/compose.yaml up -d` to stop and recreate services in topological order, or remove dependent containers simultaneously.

### 25. Frontend changes do not appear after rebuilding the image
- **Problem:** The frontend image was rebuilt successfully, but the website continued displaying the previous interface.
- **Cause:** The running `autoneg-nextjs` container was still using the old image ID, even though `localhost/autoneg-frontend:latest` pointed to the newly built image.
- **Fix:** Compare the running container image ID using `podman inspect autoneg-nextjs --format '{{.Image}}'` with the latest image ID using `podman image inspect localhost/autoneg-frontend:latest --format '{{.Id}}'`. Recreate the Next.js container to use the updated image.

### 26. Podman cannot recreate Next.js because of dependent containers
- **Problem:** Running `podman-compose -f infra/compose.yaml up -d --no-deps --force-recreate nextjs` failed with `container has dependent containers which must be removed before it` and `container name "autoneg-nextjs" is already in use`.
- **Cause:** The `autoneg-nginx` container depended on `autoneg-nextjs`. Podman prevented replacing Next.js while its dependent container still existed.
- **Fix:** Stop and remove `autoneg-nginx`, then stop and remove `autoneg-nextjs`. Recreate Next.js using `podman-compose -f infra/compose.yaml up -d --no-deps nextjs`, followed by recreating Nginx using `podman-compose -f infra/compose.yaml up -d --no-deps nginx`. The backend and database containers were left untouched.

### 27. Website temporarily unavailable during frontend container replacement
- **Problem:** Replacing the Next.js container required stopping and removing the Nginx container, temporarily interrupting website access.
- **Cause:** Nginx was the public-facing reverse proxy and had a Podman dependency on Next.js.
- **Fix:** Start the updated Next.js container first, then recreate Nginx. Verify the deployment using `curl -k -I https://127.0.0.1`, which returned `HTTP/2 200`. The updated frontend image was confirmed to be running.

### 29. `autoneg-fastapi` cannot be removed because of old renamed containers
- **Problem:** After removing `autoneg-nginx` and `autoneg-nextjs`, `podman rm -f autoneg-fastapi` still failed with `has dependent containers which must be removed before it: 0658c2b..., ae82141...`.
- **Cause:** The original Next.js and Nginx containers had been renamed to `autoneg-nextjs-quarantine` and `autoneg-nginx-backup` instead of being removed. They were stopped, so they did not appear in `podman ps`, but they still depended on `autoneg-fastapi`.
- **Fix:** Find them with `podman ps -a --format '{{.ID}}  {{.Names}}' | grep <id>` and remove them with `podman rm` (without `-f`, so it refuses a running container). They held no data: the database and media live in volumes, and the nginx config comes from the repository. Do not rename project containers; remove them instead.

### 30. `podman rm` with two dependent containers removes only one
- **Problem:** `podman rm autoneg-nextjs-quarantine autoneg-nginx-backup` removed `autoneg-nginx-backup` but failed on `autoneg-nextjs-quarantine` with `has dependent containers`.
- **Cause:** Podman processes the names in order. When it reached the first one, the second still depended on it.
- **Fix:** Run `podman rm autoneg-nextjs-quarantine` again, or list the dependent container first.





### 31. 

# Production Deployment Issue – Stale Frontend Containers

## Problem

After pushing the latest AutoNegotiater changes to GitHub, the EC2 server repository was already on the newest commit:

`223991c – Implement AI negotiation system and add project instructions`

However, the public website was still showing the old frontend interface.

The backend was updated correctly and already contained the new AI negotiation files, including:

- `buyer_agent.py`
- `seller_agent.py`
- `engine.py`
- `gemini_service.py`

Gemini was also configured correctly on the production backend.

## Root Cause

The server had several old frontend and backend containers from previous staging and release deployments.

The current production `autoneg-nextjs` container had been recreated, but it was still using an old frontend image created on October 21.

Therefore:

`Latest Git code ≠ Latest running frontend image`

The source code on the server was current, but the frontend container image had not been rebuilt from that source.

## Fix

We rebuilt only the Next.js frontend image from the latest source code:

```bash
podman-compose -f infra/compose.yaml build --no-cache nextjs
```

Then recreated the frontend container:

```bash
podman-compose -f infra/compose.yaml up -d --force-recreate nextjs
```

Nginx was restarted afterward:

```bash
podman restart autoneg-nginx
```

The website then displayed the latest frontend correctly.

## Container Cleanup

Several old staging/release containers were also still running.

They were stopped and removed after confirming they were not used by the production Nginx configuration.

The final production stack was reduced to:

```text
autoneg-postgresql
autoneg-redis
autoneg-fastapi
autoneg-celery
autoneg-nextjs
autoneg-nginx
```

## Result

The production server now:

- runs the latest frontend and backend
- contains the new AI negotiation architecture
- has Gemini configured
- contains the expanded iPhone catalog
- uses only the required production containers
- no longer runs unnecessary old staging containers

## Lesson Learned

Pulling the latest Git commit is not enough when using containers.

After code changes, the affected container image must also be rebuilt and the container recreated so the running application uses the latest source code.

---

## Backend

### 12. `pip` refuses to install `requirements.txt`
- **Problem:** `pip install -r requirements.txt` failed with `requirements are unsatisfiable`.
- **Cause:** `celery[redis]==5.5.3` needs `redis<=5.2.1`, but we had pinned `redis==6.2.0`.
- **Fix:** Remove `redis` from `requirements.txt`. `celery[redis]` installs a compatible version itself.

### 13. `alembic upgrade head` fails with `No module named 'app'`
- **Problem:** `alembic upgrade head` raised `ModuleNotFoundError: No module named 'app'`.
- **Cause:** The `alembic` command does not add the project folder to `sys.path`.
- **Fix:** Add `prepend_sys_path = .` to `alembic.ini`.

### 32. Database seeding skipped on running server
- **Problem:** Multi-seller listings for iPhone 15 Pro, PS5, and S24 did not appear after updating `seed.py`.
- **Cause:** `seed.py` skips execution when users already exist in the database.
- **Fix:** Added automatic synchronization in `ensure_initial_workspace_data` (`workspace.py`) to insert missing listings and rules on startup.

---

## Frontend

### 20. Red syntax errors across JSX/TSX elements in VS Code
- **Problem:** Opening `.tsx` files in VS Code displayed syntax errors and missing types on all standard HTML elements (`<div>`, `<h1>`, `Link`).
- **Cause:** The repository was freshly cloned on a Windows host without installing local dependencies, so `node_modules` and React/Next.js type declarations (`@types/react`) were missing locally.
- **Fix:** Either run `npm install` inside `frontend/` locally to populate type definitions, or rely on containerized builds where dependencies are managed inside the container via `Containerfile`.

### 31. Browser API calls fail when the frontend image runs without nginx
- **Problem:** Running the frontend image locally with `API_INTERNAL_URL=http://<api-container>:8000`, pages rendered, but browser calls to `/api/workspace/...` returned `500` and the logs showed `ECONNREFUSED 127.0.0.1:8000`.
- **Cause:** The `/api` rewrite in `next.config.ts` is fixed when the image is built, and `API_INTERNAL_URL` is not set at build time, so it points to `localhost:8000`. In production this does not matter because nginx sends `/api/` straight to FastAPI.
- **Fix:** Test through nginx, or send `/api` requests straight to the API, as nginx does. Setting `API_INTERNAL_URL` when the container starts only affects server-side rendering.

### 23. Git commit fails with Author identity unknown
- **Problem:** Running `git commit` on Windows failed with `Author identity unknown` and `fatal: unable to auto-detect email address`.
- **Cause:** Git did not have a configured username and email address for the local repository.
- **Fix:** Configure the repository identity using `git config user.name "Rayan-Alharbi1"` and `git config user.email "r.alhrbi@outlook.sa"`, then run the commit again.

### 24. Git warns about LF being replaced by CRLF
- **Problem:** Running `git add frontend/` displayed multiple warnings: `LF will be replaced by CRLF the next time Git touches it`.
- **Cause:** Git detected differences between Unix (LF) and Windows (CRLF) line-ending conventions.
- **Fix:** Treat these messages as line-ending warnings rather than commit errors. The files were staged and committed successfully without changing the application code.

### 33. Multi-seller selection pulled in unrelated products
- **Problem:** Starting a multi-seller negotiation for iPhone 15 Pro selected 5 listings, mixing in Samsung Galaxy phones.
- **Cause:** The competitor query fell back to the entire `Electronics` category to fill 4 slots.
- **Fix:** Restricted competitor selection in `products.tsx` to match only the specific product model when competing listings exist.

### 34. Product condition notes hidden in negotiation views
- **Problem:** Buyers could not compare device condition or specs during listing ranking or inside the request overview table.
- **Cause:** `RequestSetup` and `RequestDetail` in `negotiation.tsx` displayed only the listing title and price.
- **Fix:** Added condition and specification snippets (`p.description`) to the ranking cards and the seller offers table.

### 35. Mock test data missing multi-seller products
- **Problem:** Offline test suites and mock mode did not reflect the new multi-seller variants.
- **Cause:** `mock-data.ts` only had single-seller items.
- **Fix:** Added matching multi-seller products to `mock-data.ts` while preserving legacy IDs for existing tests.

---

## CI/CD

### 14. `git push` rejected: token has no `workflow` scope
- **Problem:** `git push` failed with `refusing to allow a Personal Access Token to create or update workflow without workflow scope`.
- **Cause:** The Personal Access Token did not have permission to change files under `.github/workflows`.
- **Fix:** Add the workflow permission to the token. Classic token: tick `workflow`. Fine-grained token: set **Workflows** to *Read and write*.

### 15. GitHub Actions: `Host key verification failed`
- **Problem:** The deploy job failed at the SSH step with `Host key verification failed`.
- **Cause:** The `SSH_KNOWN_HOSTS` secret had not been added, so the runner's `known_hosts` file was empty.
- **Fix:** Add the `SSH_KNOWN_HOSTS` secret with the output of `ssh-keyscan <server-ip>`. Each line must start with the server IP.

### 16. `fatal: detected dubious ownership in repository`
- **Problem:** `git` on the server refused to run with `detected dubious ownership in repository`.
- **Cause:** `SSH_USER` was set to `ec2-user`, but the repository is owned by `deploy`.
- **Fix:** Set `SSH_USER=deploy`. We did not use `safe.directory`, because it only hides the problem.

### 17. `Permission denied (publickey,...)` when connecting as `deploy`
- **Problem:** The deploy job failed with `deploy@server: Permission denied (publickey,...)`.
- **Cause:** `github_actions.pub` was in the `authorized_keys` file of `ec2-user`, not `deploy`.
- **Fix:** Add the key to `/home/deploy/.ssh/authorized_keys`, run `chmod 600` on the file, then run `restorecon -Rv` on the folder (needed for SELinux).

### 21. `git pull` on server fails with divergent branches
- **Problem:** Running `git pull` on the production server failed with `fatal: Need to specify how to reconcile divergent branches`.
- **Cause:** The remote branch was updated with new commits or forced updates, causing the server's tracking branch to diverge from `origin/main`.
- **Fix:** Align the server working tree directly with the remote repository using `git fetch origin && git reset --hard origin/main`. Production servers should track origin without manual merges.

### 22. Deploy fails with `Connection timed out`, then `Host key verification failed`
- **Problem:** After the server was stopped and started, the deploy job failed with `ssh: connect to host ... Connection timed out`. After `SSH_HOST` was updated, it failed with `Host key verification failed`.
- **Cause:** The instance has no Elastic IP, so it got a new public IP when it started. `SSH_HOST` still pointed to the old IP, and after that was fixed, `SSH_KNOWN_HOSTS` still only had entries for the old IP.
- **Fix:** Update `SSH_HOST` to the new IP, and replace `SSH_KNOWN_HOSTS` with the output of `ssh-keyscan <new-ip>` (or `/etc/ssh/ssh_host_*_key.pub` on the server, each line prefixed with the IP). Run a new workflow, not a re-run of the failed one. To stop the IP from changing, attach an Elastic IP to the instance.

### 28. Deploy reports success but FastAPI keeps running the old code
- **Problem:** After a backend change, the deploy job finished, but the new API routes returned 404 and the database migration did not run. `podman ps` showed `autoneg-fastapi` still had last week's creation date, while `autoneg-celery` and `autoneg-nextjs` were new.
- **Cause:** `up -d --build --force-recreate --no-deps fastapi` failed with `has dependent containers which must be removed before it`, because `nextjs` and `nginx` depend on `fastapi` (same cause as 19 and 26). `podman-compose` does not return an error code for this, so the job still passed.
- **Fix:** The workflow now builds the images first, removes `nginx`, then the rebuilt services (and `nextjs` when `fastapi` is rebuilt), and recreates them in dependency order. To check a deploy, compare the `Created` column of `podman ps --format '{{.Names}}\t{{.Created}}'`.
