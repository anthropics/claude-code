# 🚀 Termux Deployment - Quick Start Guide

Deploy your publishing platform from your Android phone in just 15 minutes!

## Prerequisites

### Required
- ✅ Android device (phone or tablet)
- ✅ Termux app installed ([F-Droid](https://f-droid.org/packages/com.termux/) or [GitHub](https://github.com/termux/termux-app/releases))
- ✅ Internet connection (WiFi or mobile data)
- ✅ ~500MB free storage

### Accounts (All FREE)
- ✅ Email address
- ✅ GitHub account
- ✅ Stripe account
- ✅ Railway account

## Step-by-Step Tutorial

### 1️⃣ Install Termux

**Option A: F-Droid (Recommended)**
```
1. Install F-Droid from https://f-droid.org
2. Search for "Termux"
3. Install Termux
```

**Option B: GitHub**
```
1. Go to https://github.com/termux/termux-app/releases
2. Download latest APK
3. Install (enable "Install from unknown sources")
```

### 2️⃣ Set Up Termux

Open Termux and run:

```bash
# Grant storage permission (important!)
termux-setup-storage

# Update packages
pkg update && pkg upgrade -y

# Grant necessary permissions when prompted
```

### 3️⃣ Download the Script

```bash
# Option 1: Using curl
curl -O https://raw.githubusercontent.com/LOUSTA79/claude-code/main/scripts/termux-deploy.sh
chmod +x termux-deploy.sh

# Option 2: Using wget
wget https://raw.githubusercontent.com/LOUSTA79/claude-code/main/scripts/termux-deploy.sh
chmod +x termux-deploy.sh

# Option 3: Clone entire repo
pkg install git -y
git clone https://github.com/LOUSTA79/claude-code.git
cd claude-code/scripts
chmod +x termux-deploy.sh
```

### 4️⃣ Prepare Your Accounts

#### GitHub Account
```
1. Open browser: https://github.com/join
2. Sign up with your email
3. Verify email
4. Remember your username!
```

#### Stripe Account
```
1. Open browser: https://dashboard.stripe.com/register
2. Sign up with your email
3. Complete business information
4. Activate your account
5. Get API keys:
   - Go to: https://dashboard.stripe.com/apikeys
   - Switch to "Live mode" (for real money) or use "Test mode"
   - Copy "Secret key" (sk_live_... or sk_test_...)
   - Copy "Publishable key" (pk_live_... or pk_test_...)
```

#### Railway Account
```
1. Open browser: https://railway.app
2. Sign up with GitHub (easiest)
3. Verify email
4. You're ready!
```

### 5️⃣ Run the Deployment

```bash
./termux-deploy.sh
```

The script will guide you through:

1. **Personalization** (~1 min)
   - Your email
   - Your name
   - Business/project name

2. **Package Installation** (~3-5 min)
   - Node.js
   - Git
   - OpenSSL
   - Dependencies

3. **API Keys Setup** (~5 min)
   - Stripe keys (live or test)
   - Google Gemini (optional)
   - GitHub credentials

4. **Project Creation** (~1 min)
   - Generate project files
   - Install npm packages
   - Configure environment

5. **GitHub Push** (~2 min)
   - Create repository
   - Push code
   - Set up git

6. **Railway Deployment** (~3-5 min)
   - Deploy from GitHub
   - Configure environment variables
   - Get live URL

7. **Webhook Setup** (~1 min)
   - Configure Stripe webhook
   - Test connection

## 📱 Example Session

```bash
$ ./termux-deploy.sh

╔════════════════════════════════════════════════════════╗
║    📱 TERMUX AUTONOMOUS DEPLOYMENT v2.0 📱           ║
╚════════════════════════════════════════════════════════╝

📋 Let's personalize your deployment!

📧 Enter your email address: yourname@gmail.com
✅ Email valid: yourname@gmail.com

👤 Enter your full name: John Doe
✅ Name: John Doe

🏢 Enter your business/project name (default: Publishing Empire): My Awesome Books
✅ Business: My Awesome Books

📦 Project name: my-awesome-books
📁 Project directory: /data/data/com.termux/files/home/my-awesome-books

Looks good? (y/n): y

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 STEP 1: Installing Requirements (3-5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Installing Node.js (attempt 1/3)...
✅ Node.js installed

...continues...
```

## 🎯 After Deployment

Once completed, you'll receive:

### Your Live Site
```
🌐 https://your-app-name.up.railway.app

Test with:
- Homepage: https://your-app-name.up.railway.app
- Health: https://your-app-name.up.railway.app/health
```

### Deployment Files
```
~/your-project-name/
├── server.js                 # Main application
├── package.json             # Dependencies
├── .env                     # Configuration (secrets)
├── Procfile                 # Railway config
├── README.md                # Project documentation
├── DEPLOYMENT_INFO.txt      # Deployment details
└── .gitignore              # Git ignore rules
```

### Quick Reference
```bash
# View deployment info
cat ~/your-project-name/DEPLOYMENT_INFO.txt

# View quick summary
cat ~/publishing-empire-deployed.txt

# Go to project directory
cd ~/your-project-name

# Check git status
git status

# View logs (if running locally)
npm start
```

## 🔄 Making Updates

After deployment, to make changes:

```bash
# 1. Navigate to project
cd ~/your-project-name

# 2. Make your changes
nano server.js  # or use your preferred editor

# 3. Test locally (optional)
npm start

# 4. Commit and push
git add .
git commit -m "Description of changes"
git push

# Railway automatically deploys your changes!
```

## 🧪 Test Mode vs Production Mode

### Test Mode (Recommended for First Time)
```
- Use Stripe test keys (sk_test_...)
- No real money charged
- Test unlimited
- Safe to experiment
```

### Production Mode (For Real Money)
```
- Use Stripe live keys (sk_live_...)
- Real money charged
- Monitor closely
- Business compliance required
```

## 💡 Tips & Tricks

### Keep Termux Awake
```bash
# Prevent Termux from sleeping during deployment
termux-wake-lock
# After deployment:
termux-wake-unlock
```

### Better Keyboard
```
Settings → Termux → Enable "Extra keys"
```

### Copy/Paste
```
Long-press screen → More → Copy/Paste
or
Use Volume Up + Q for special keys
```

### Save API Keys Securely
```bash
# Create a secure notes file
nano ~/secure-notes.txt
# Add your keys
# Protect it
chmod 600 ~/secure-notes.txt
```

## 🐛 Common Issues

### "Permission Denied"
```bash
chmod +x termux-deploy.sh
```

### "Command Not Found"
```bash
pkg update
pkg install git curl wget -y
```

### "Network Error"
```bash
# Check connectivity
ping -c 3 google.com

# Switch networks (WiFi ↔ Mobile data)
# Restart Termux
```

### "Git Push Failed"
```bash
# Check GitHub credentials
git config --global user.name "YourUsername"
git config --global user.email "your@email.com"

# Try push again
git push -u origin main
```

### "Package Installation Failed"
```bash
pkg clean
pkg update
pkg upgrade -y
# Then re-run script
```

## 📚 Resources

### Official Documentation
- **Termux**: https://wiki.termux.com
- **Node.js**: https://nodejs.org/docs
- **Stripe**: https://stripe.com/docs
- **Railway**: https://docs.railway.app
- **Express**: https://expressjs.com

### Support
- **Script Issues**: https://github.com/LOUSTA79/claude-code/issues
- **Termux Help**: https://gitter.im/termux/termux
- **Stripe Support**: https://support.stripe.com
- **Railway Discord**: https://discord.gg/railway

## 🎓 Next Steps

After successful deployment:

1. **Test Your Site**
   - Open the Railway URL
   - Check all pages work
   - Test payment flow (test mode)

2. **Secure Your App**
   - Review environment variables
   - Set up Stripe webhooks
   - Configure custom domain (optional)

3. **Monitor Performance**
   - Check Railway logs
   - Monitor Stripe dashboard
   - Track error rates

4. **Go Live**
   - Switch to Stripe live keys
   - Test with small real payment
   - Announce your platform!

## 🎉 Success Checklist

- [ ] Termux installed and updated
- [ ] Script downloaded and executable
- [ ] All accounts created (GitHub, Stripe, Railway)
- [ ] API keys collected and secured
- [ ] Script completed successfully
- [ ] Site accessible via Railway URL
- [ ] Health check endpoint working
- [ ] Stripe webhook configured
- [ ] Deployment info saved
- [ ] First test payment completed

## 💪 You're Ready!

You've successfully deployed a production-grade application from your phone!

**Time invested:** ~15 minutes
**Money invested:** $0
**Value created:** Priceless 🚀

---

**Questions?** Check the [full README](README.md) or [troubleshooting guide](TROUBLESHOOTING.md)

**Happy deploying!** 📱💰
