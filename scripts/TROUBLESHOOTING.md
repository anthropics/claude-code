# 🔧 Troubleshooting Guide

Complete guide to fixing common issues with the Termux deployment script.

## Table of Contents
1. [Installation Issues](#installation-issues)
2. [Network Problems](#network-problems)
3. [Git Issues](#git-issues)
4. [Package Manager Issues](#package-manager-issues)
5. [Deployment Failures](#deployment-failures)
6. [Stripe Issues](#stripe-issues)
7. [Railway Issues](#railway-issues)
8. [Runtime Errors](#runtime-errors)
9. [Performance Issues](#performance-issues)
10. [Emergency Recovery](#emergency-recovery)

---

## Installation Issues

### Script Won't Run

**Error:** `./termux-deploy.sh: Permission denied`

**Solution:**
```bash
chmod +x termux-deploy.sh
./termux-deploy.sh
```

---

**Error:** `./termux-deploy.sh: bad interpreter`

**Solution:**
```bash
# Check shebang
head -1 termux-deploy.sh

# Should be: #!/data/data/com.termux/files/usr/bin/bash
# If different, fix it:
sed -i '1s|.*|#!/data/data/com.termux/files/usr/bin/bash|' termux-deploy.sh
```

---

### Command Not Found

**Error:** `bash: git: command not found`

**Solution:**
```bash
pkg update
pkg install git nodejs openssl curl wget -y
```

---

**Error:** `npm: command not found`

**Solution:**
```bash
# Node.js includes npm
pkg install nodejs -y
node --version
npm --version
```

---

## Network Problems

### No Internet Connection

**Error:** `Failed to connect` or `Network unreachable`

**Diagnosis:**
```bash
# Test connectivity
ping -c 3 8.8.8.8

# Test DNS
ping -c 3 google.com

# Check network interface
ifconfig
```

**Solutions:**

1. **Switch Networks**
   ```
   - If on WiFi, try mobile data
   - If on mobile data, try WiFi
   - Move closer to router
   ```

2. **Restart Network**
   ```bash
   # Toggle airplane mode
   # OR restart phone
   ```

3. **Check Termux Permissions**
   ```
   Settings → Apps → Termux → Permissions
   Enable: Storage, Network
   ```

4. **Use Proxy (if behind firewall)**
   ```bash
   export http_proxy=http://proxy:port
   export https_proxy=https://proxy:port
   ```

---

### Slow Downloads

**Symptoms:** Package installation taking very long

**Solutions:**

1. **Switch to Better Mirror**
   ```bash
   termux-change-repo
   # Select mirror closest to you
   ```

2. **Use Mobile Data Instead of WiFi**
   ```
   Some WiFi networks throttle package downloads
   ```

3. **Download During Off-Peak Hours**
   ```
   Try early morning or late night
   ```

---

### SSL Certificate Errors

**Error:** `SSL certificate problem`

**Solutions:**
```bash
# Update CA certificates
pkg install ca-certificates -y

# Force update
pkg upgrade openssl ca-certificates -y

# If still failing, temporary workaround (NOT recommended for production):
# git config --global http.sslVerify false
```

---

## Git Issues

### Authentication Failed

**Error:** `Authentication failed for 'https://github.com/...'`

**Solutions:**

1. **Check Username/Email**
   ```bash
   git config --global user.name "YourGitHubUsername"
   git config --global user.email "your@email.com"
   ```

2. **Use Personal Access Token**
   ```bash
   # Generate token at: https://github.com/settings/tokens
   # Use token as password when prompted
   ```

3. **Use SSH Instead**
   ```bash
   # Generate SSH key
   pkg install openssh -y
   ssh-keygen -t ed25519 -C "your@email.com"

   # Copy public key
   cat ~/.ssh/id_ed25519.pub

   # Add to GitHub: https://github.com/settings/keys

   # Use SSH URL
   git remote set-url origin git@github.com:username/repo.git
   ```

---

### Push Rejected

**Error:** `! [rejected] main -> main (fetch first)`

**Solutions:**
```bash
# Option 1: Pull first
git pull origin main --rebase
git push origin main

# Option 2: Force push (CAREFUL - destroys remote history)
git push -f origin main

# Option 3: Create new branch
git checkout -b main-new
git push -u origin main-new
```

---

### Repository Not Found

**Error:** `repository not found`

**Checklist:**
- [ ] Repository exists on GitHub?
- [ ] Repository URL correct?
- [ ] Repository is public?
- [ ] GitHub username correct?

**Verify:**
```bash
# Check remote URL
git remote -v

# Fix if wrong
git remote set-url origin https://github.com/username/correct-repo.git
```

---

## Package Manager Issues

### Package Manager Locked

**Error:** `Could not get lock /data/data/com.termux/files/usr/var/lib/dpkg/lock`

**Solutions:**

1. **Wait for Other Process**
   ```bash
   # Check if pkg/apt is running
   ps aux | grep -E 'pkg|apt|dpkg'

   # If found, wait for it to complete
   ```

2. **Force Unlock**
   ```bash
   # Kill conflicting processes
   pkill -9 dpkg
   pkill -9 apt

   # Remove locks
   rm -f $PREFIX/var/lib/dpkg/lock*
   rm -f $PREFIX/var/cache/apt/archives/lock

   # Reconfigure
   dpkg --configure -a
   ```

3. **Clean and Retry**
   ```bash
   pkg clean
   pkg update
   ```

---

### Disk Space Full

**Error:** `No space left on device`

**Check Space:**
```bash
df -h $PREFIX
du -sh ~/*/
```

**Solutions:**

1. **Clean Package Cache**
   ```bash
   pkg clean
   apt autoremove -y
   ```

2. **Remove Old Backups**
   ```bash
   rm -rf ~/*.backup.*
   rm -rf ~/.npm/_cacache
   ```

3. **Clear Termux Cache**
   ```bash
   cd /data/data/com.termux/cache
   rm -rf *
   ```

4. **Move to External Storage**
   ```bash
   # Backup project
   tar -czf /sdcard/backup.tar.gz ~/your-project

   # Work from external storage
   cd /sdcard
   tar -xzf backup.tar.gz
   ```

---

### Broken Packages

**Error:** `dpkg: error processing package`

**Solutions:**
```bash
# Fix broken installations
dpkg --configure -a
apt --fix-broken install -y

# Force reinstall
pkg reinstall package-name

# Last resort: clear everything
pkg clean
pkg update
pkg upgrade -y
```

---

## Deployment Failures

### npm install Failed

**Error:** `npm ERR! code ELIFECYCLE`

**Solutions:**

1. **Clear npm Cache**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Use Different Registry**
   ```bash
   npm config set registry https://registry.npmjs.org/
   # OR use a mirror
   npm config set registry https://registry.npmmirror.com/
   ```

3. **Install One by One**
   ```bash
   # Find which package fails
   npm install express
   npm install pg
   # etc...
   ```

4. **Check Node Version**
   ```bash
   node --version  # Should be >= 18

   # Update if needed
   pkg upgrade nodejs -y
   ```

---

### Script Exits Unexpectedly

**Error:** Script stops without clear error

**Diagnosis:**
```bash
# Run with debug mode
bash -x termux-deploy.sh

# Check exit code
echo $?
```

**Solutions:**

1. **Disable exit-on-error temporarily**
   ```bash
   # Edit script, comment out:
   # set -e
   ```

2. **Check Specific Error Line**
   ```bash
   # Script shows line numbers on error
   # Look at that specific line
   sed -n 'LINE_NUMBERp' termux-deploy.sh
   ```

---

## Stripe Issues

### Invalid API Keys

**Error:** `Invalid API Key provided`

**Checklist:**
- [ ] Copied entire key (starts with sk_live_ or sk_test_)
- [ ] No extra spaces or newlines
- [ ] Live and test keys not mixed
- [ ] Keys from correct Stripe account
- [ ] Keys not expired

**Verify:**
```bash
# Test key format
echo $STRIPE_SECRET_KEY | wc -c  # Should be ~100 characters

# Test key validity (in deployed app)
curl -u sk_test_xxx: https://api.stripe.com/v1/charges
```

**Get New Keys:**
```
1. Visit: https://dashboard.stripe.com/apikeys
2. Click "Create secret key"
3. Copy immediately (shown only once!)
4. Update Railway environment variables
```

---

### Webhook Not Receiving Events

**Symptoms:** Payments work but webhooks don't fire

**Checklist:**
- [ ] Webhook URL correct (https://your-app.railway.app/api/webhook)
- [ ] Webhook events selected (payment_intent.succeeded, etc.)
- [ ] STRIPE_WEBHOOK_SECRET set in Railway
- [ ] App is running (check Railway logs)

**Test Webhook:**
```bash
# Send test event from Stripe dashboard
# Check Railway logs for receipt
```

**Debug:**
```bash
# Check webhook endpoint
curl -X POST https://your-app.railway.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Should return 400 (signature invalid) but proves endpoint works
```

---

## Railway Issues

### Deployment Failed

**Error:** Build failed on Railway

**Check Logs:**
```
Railway Dashboard → Your Project → Deployments → View Logs
```

**Common Causes:**

1. **Missing Environment Variables**
   ```
   Variables tab → Add:
   - STRIPE_SECRET_KEY
   - STRIPE_PUBLISHABLE_KEY
   - PRODUCTION_MODE
   - ADMIN_EMAIL
   ```

2. **Wrong Node Version**
   ```json
   // In package.json
   "engines": {
     "node": ">=18.x"
   }
   ```

3. **Missing Procfile**
   ```
   # Ensure Procfile exists with:
   web: node server.js
   ```

---

### App Crashes on Startup

**Error:** `Application failed to start`

**Debug:**
```
1. Check Railway logs
2. Look for specific error
3. Common issues:
   - Port not set: Use process.env.PORT
   - Missing env var: Check all required vars set
   - Syntax error: Test locally first
```

**Test Locally:**
```bash
cd ~/your-project
cp .env.example .env
# Edit .env with your keys
PORT=3000 node server.js
```

---

### Domain Not Working

**Issue:** Railway domain not accessible

**Solutions:**

1. **Wait for DNS Propagation**
   ```
   Can take 5-10 minutes after deployment
   ```

2. **Generate New Domain**
   ```
   Settings → Domains → Generate Domain
   ```

3. **Check Deployment Status**
   ```
   Deployments tab → Should show "Success"
   ```

4. **Test Health Endpoint**
   ```bash
   curl https://your-app.railway.app/health
   ```

---

## Runtime Errors

### Server Won't Start Locally

**Error:** `Error: listen EADDRINUSE`

**Solution:**
```bash
# Port already in use
pkill -f "node server.js"

# Or use different port
PORT=3001 node server.js
```

---

**Error:** `MODULE_NOT_FOUND`

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

---

### Payment Endpoint Failing

**Error:** `500 Internal Server Error` on /api/payment

**Debug:**
```javascript
// Add logging in server.js
app.post('/api/payment', async (req, res) => {
  console.log('Payment request:', req.body);
  try {
    // ... existing code
  } catch (error) {
    console.error('Payment error:', error);
    // ... existing code
  }
});
```

**Check:**
- [ ] Stripe keys set correctly
- [ ] Amount is valid number
- [ ] Currency is valid (usd, eur, etc.)
- [ ] Not in test mode with live keys (or vice versa)

---

## Performance Issues

### Slow Response Times

**Solutions:**

1. **Check Railway Region**
   ```
   Settings → Select region closest to users
   ```

2. **Add Caching**
   ```javascript
   // In server.js
   app.use((req, res, next) => {
     res.set('Cache-Control', 'public, max-age=300');
     next();
   });
   ```

3. **Monitor Resource Usage**
   ```
   Railway Dashboard → Metrics
   ```

---

### Memory Issues

**Error:** `JavaScript heap out of memory`

**Solutions:**

1. **Increase Memory Limit** (Railway)
   ```
   Settings → Resources → Increase memory
   ```

2. **Optimize Code**
   ```javascript
   // Clear large objects
   // Use streams for large data
   // Close database connections
   ```

---

## Emergency Recovery

### Complete Reset

If everything is broken:

```bash
# 1. Backup your keys
cat ~/.gitconfig
cat ~/your-project/.env > ~/keys-backup.txt

# 2. Clean Termux
pkg clean
rm -rf $PREFIX/var/cache/*

# 3. Remove project
rm -rf ~/your-project

# 4. Re-download script
curl -O https://raw.githubusercontent.com/LOUSTA79/claude-code/main/scripts/termux-deploy.sh
chmod +x termux-deploy.sh

# 5. Start fresh
./termux-deploy.sh
```

---

### Restore from Backup

If you have a backup:

```bash
# Extract backup
tar -xzf ~/backup.tar.gz

# Restore environment
cd ~/your-project
cp .env.backup .env

# Reinstall dependencies
npm install

# Test locally
npm start

# Push to GitHub
git push origin main
```

---

## Getting Help

### Before Asking for Help

Collect this information:

```bash
# System info
uname -a
pkg list-installed | grep -E "node|git"

# Error logs
./termux-deploy.sh 2>&1 | tee error.log

# Upload error.log when asking for help
```

### Support Channels

1. **GitHub Issues**
   ```
   https://github.com/LOUSTA79/claude-code/issues
   ```

2. **Termux Community**
   ```
   https://gitter.im/termux/termux
   https://reddit.com/r/termux
   ```

3. **Stack Overflow**
   ```
   Tag: [termux] [node.js] [deployment]
   ```

### Provide Details

When asking for help, include:
- [ ] Termux version
- [ ] Node.js version
- [ ] Full error message
- [ ] Steps to reproduce
- [ ] What you've already tried
- [ ] Script version (v2.0)

---

## Prevention Tips

### Regular Maintenance

```bash
# Weekly
pkg update && pkg upgrade -y
npm outdated  # Check for updates

# Monthly
pkg clean
rm -rf ~/.npm/_cacache

# Before deployment
git status  # Check for uncommitted changes
npm test    # If you have tests
```

### Best Practices

1. **Keep Backups**
   ```bash
   # Backup before major changes
   tar -czf ~/backup-$(date +%Y%m%d).tar.gz ~/your-project
   ```

2. **Use Version Control**
   ```bash
   # Commit frequently
   git add .
   git commit -m "Description"
   git push
   ```

3. **Test Locally First**
   ```bash
   # Test changes before deploying
   npm start
   # Test in browser
   # Then push to production
   ```

4. **Monitor Logs**
   ```
   Check Railway logs daily
   Set up alerts for errors
   ```

---

**Still stuck?** Open an issue with full details: https://github.com/LOUSTA79/claude-code/issues/new
