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

---

## Frontend

### 20. Red syntax errors across JSX/TSX elements in VS Code
- **Problem:** Opening `.tsx` files in VS Code displayed syntax errors and missing types on all standard HTML elements (`<div>`, `<h1>`, `Link`).
- **Cause:** The repository was freshly cloned on a Windows host without installing local dependencies, so `node_modules` and React/Next.js type declarations (`@types/react`) were missing locally.
- **Fix:** Either run `npm install` inside `frontend/` locally to populate type definitions, or rely on containerized builds where dependencies are managed inside the container via `Containerfile`.

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
