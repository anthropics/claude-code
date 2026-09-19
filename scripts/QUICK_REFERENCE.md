# 📝 Quick Reference Card

One-page guide for common tasks and commands.

## 🚀 First Time Setup

```bash
# 1. Test environment
./test-deployment.sh

# 2. Run deployment
./termux-deploy.sh

# 3. Follow prompts!
```

---

## 📱 Essential Commands

### Package Management
```bash
# Update packages
pkg update && pkg upgrade -y

# Install essentials
pkg install nodejs git openssl -y

# Clean cache
pkg clean

# Fix broken packages
dpkg --configure -a
```

### Git Operations
```bash
# Configure git
git config --global user.name "Your Name"
git config --global user.email "you@example.com"

# Check status
git status

# Make changes
git add .
git commit -m "Description"
git push

# View log
git log --oneline -10
```

### Project Navigation
```bash
# Go to project
cd ~/your-project-name

# List files
ls -lah

# View deployment info
cat DEPLOYMENT_INFO.txt

# Check environment
cat .env
```

---

## 🔧 Troubleshooting Quick Fixes

### Network Issues
```bash
# Test connectivity
ping -c 3 8.8.8.8
ping -c 3 google.com

# Check DNS
nslookup google.com
```

### Package Manager Locked
```bash
# Kill processes
pkill -9 dpkg apt

# Remove locks
rm -f $PREFIX/var/lib/dpkg/lock*

# Reconfigure
dpkg --configure -a
```

### Git Push Failed
```bash
# Check remote
git remote -v

# Re-add remote
git remote set-url origin https://github.com/user/repo.git

# Force push (careful!)
git push -f origin main
```

### Out of Space
```bash
# Check space
df -h $HOME

# Clean cache
pkg clean
apt autoremove -y
rm -rf ~/.npm/_cacache

# Remove old backups
rm -rf ~/*.backup.*
```

---

## 🌐 Important URLs

### Accounts
- **GitHub:** https://github.com
- **Stripe:** https://dashboard.stripe.com
- **Railway:** https://railway.app
- **Google AI:** https://makersuite.google.com

### Documentation
- **Termux Wiki:** https://wiki.termux.com
- **Node.js Docs:** https://nodejs.org/docs
- **Stripe API:** https://stripe.com/docs
- **Express:** https://expressjs.com

### Your Deployment
- **Live Site:** `https://your-app.railway.app`
- **Health Check:** `https://your-app.railway.app/health`
- **GitHub Repo:** `https://github.com/your-username/your-repo`

---

## 🔑 API Keys Locations

### Stripe Keys
```
Dashboard → Developers → API keys
- Test: Switch to "Test mode"
- Live: Switch to "Live mode"
- Copy "Secret key" (sk_xxx)
- Copy "Publishable key" (pk_xxx)
```

### Stripe Webhook
```
Dashboard → Developers → Webhooks
- Click "Add endpoint"
- URL: https://your-app.railway.app/api/webhook
- Events: payment_intent.succeeded, payment_intent.payment_failed
- Copy "Signing secret" (whsec_xxx)
```

### Google Gemini
```
https://makersuite.google.com/app/apikey
- Click "Create API key"
- Copy key
- Free tier: 60 req/min
```

---

## 📊 Monitoring Commands

### Check App Status
```bash
# Test health endpoint
curl https://your-app.railway.app/health

# View Railway logs
# (Use Railway dashboard)

# Check Stripe events
# (Use Stripe dashboard)
```

### Local Testing
```bash
cd ~/your-project
npm start
# Open another terminal
curl http://localhost:3000/health
```

---

## 🔄 Update Workflow

```bash
# 1. Make changes
cd ~/your-project
nano server.js

# 2. Test locally (optional)
npm start

# 3. Commit
git add .
git commit -m "Description of changes"

# 4. Push (Railway auto-deploys)
git push

# 5. Verify
curl https://your-app.railway.app/health
```

---

## 🆘 Emergency Commands

### Complete Reset
```bash
# Backup keys first!
cat ~/.gitconfig > ~/git-backup.txt
cat ~/project/.env > ~/env-backup.txt

# Clean everything
pkg clean
rm -rf ~/your-project

# Re-run deployment
./termux-deploy.sh
```

### Rollback Deployment
```
Railway Dashboard → Deployments →
Select previous working deployment → Rollback
```

### Stop Everything
```bash
# Kill running processes
pkill node

# Exit Termux
exit
```

---

## 💡 Pro Tips

### Keep Termux Awake
```bash
termux-wake-lock    # Keep running
termux-wake-unlock  # Allow sleep
```

### Copy/Paste in Termux
```
Long-press screen → More → Copy/Paste
or
Volume Up + Q (special keys)
```

### Better Keyboard
```
Settings → Termux → Enable "Extra keys"
```

### Save Commands
```bash
# Create aliases
echo 'alias deploy="cd ~/project && git push"' >> ~/.bashrc
source ~/.bashrc
```

### Secure Notes
```bash
# Store sensitive info securely
nano ~/secure-notes.txt
chmod 600 ~/secure-notes.txt
```

---

## 📋 Test Card Numbers

For Stripe test mode:

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Auth required: 4000 0025 0000 3155

- CVV: Any 3 digits
- Expiry: Any future date
- ZIP: Any 5 digits
```

---

## 🔢 Exit Codes

```bash
# Check last command status
echo $?

0  = Success
1  = General error
2  = Misuse
127 = Command not found
130 = Ctrl+C pressed
```

---

## 📞 Support Contacts

### Community Help
- **Termux:** https://gitter.im/termux/termux
- **Railway:** https://discord.gg/railway
- **Stack Overflow:** Tag [termux] [node.js]

### Official Support
- **Stripe:** https://support.stripe.com
- **Railway:** https://railway.app/help
- **Node.js:** https://nodejs.org/en/docs

### This Project
- **Issues:** https://github.com/LOUSTA79/claude-code/issues
- **Docs:** See scripts/README.md
- **Troubleshooting:** See scripts/TROUBLESHOOTING.md

---

## 🎯 Checklist: Going Live

```
Pre-Launch:
□ Test mode working perfectly
□ All features tested
□ Error handling verified
□ Documentation complete

Switch to Live:
□ Get Stripe live keys
□ Update PRODUCTION_MODE=true
□ Update all environment variables
□ Configure webhook with live endpoint
□ Test health check

First Transaction:
□ Make small test purchase
□ Verify in Stripe dashboard
□ Check webhook received
□ Verify funds appear

Monitor:
□ Watch Railway logs
□ Check Stripe dashboard daily
□ Monitor error rates
□ Respond to issues promptly
```

---

## 📊 Key Metrics to Monitor

```
Daily:
- Transaction volume
- Error rates
- Response times
- Failed payments

Weekly:
- Total revenue
- User growth
- Performance trends
- Security events

Monthly:
- Dependency updates
- Security patches
- Backup verification
- Disaster recovery test
```

---

## 🔐 Security Checklist

```
□ Never commit .env to git
□ Use strong, unique secrets
□ Enable HTTPS (automatic on Railway)
□ Restrict CORS to your domains
□ Keep dependencies updated
□ Monitor for suspicious activity
□ Rotate secrets regularly
□ Use rate limiting
□ Enable security headers
□ Log security events
```

---

**Keep this reference handy! Bookmark or print for quick access.**

**For detailed help, see:**
- QUICKSTART.md - Full tutorial
- TROUBLESHOOTING.md - Problem solutions
- README.md - Complete documentation
