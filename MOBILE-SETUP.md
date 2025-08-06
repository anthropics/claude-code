# Claude Code Extended - Mobile Apps Setup Guide

## Quick Start

### 1. Start the Backend Server

```bash
# Navigate to the project directory
cd /Users/jfuginay/Documents/dev/claude-code

# Run the development server
./start-dev.sh
```

The server will start on port 7331 and display your local IP address for mobile connections.

### 2. iOS App Setup

#### Requirements
- Xcode 15.0 or later
- iOS 17.0+ device or simulator
- macOS Sonoma or later

#### Building the iOS App

1. Open the iOS project:
```bash
cd claude-code-ios
open ClaudeCodeExtended.xcodeproj
```

2. Configure the server URL:
   - Open `ClaudeCodeExtended/Services/APIClient.swift`
   - Update the base URL with your server's IP address from step 1

3. Select your target device/simulator

4. Build and run (⌘+R)

#### Testing on Physical Device

1. Connect your iPhone/iPad via USB
2. Select your device in Xcode
3. Trust the developer certificate on your device:
   - Settings → General → Device Management → Developer App → Trust
4. Run the app

### 3. Android App Setup

#### Requirements
- Android Studio Hedgehog or later
- Android device/emulator with API 24+ (Android 7.0+)
- JDK 17

#### Building the Android App

1. Open the Android project:
```bash
cd claude-code-android
# Open in Android Studio
```

2. Configure the server URL:
   - Open `app/src/main/java/com/anthropic/claudecode/network/ApiClient.kt`
   - Update the BASE_URL with your server's IP address

3. Sync project with Gradle files

4. Run the app on your device/emulator

#### Testing on Physical Device

1. Enable Developer Options on your Android device
2. Enable USB Debugging
3. Connect via USB and authorize the computer
4. Run the app from Android Studio

## Features Walkthrough

### Session Management

1. **Create a Session**
   - Tap the + button
   - Enter session name and working directory
   - The session syncs across all your devices

2. **Switch Sessions**
   - Swipe left on a session to activate it
   - Or tap the session and select "Activate"

3. **Handoff Support** (iOS)
   - Sessions automatically appear in Handoff
   - Continue working on Mac/iPad seamlessly

### Terminal Access

1. Open an active session
2. Navigate to the Terminal tab
3. Type commands and see real-time output
4. Terminal state persists across app launches

### File Management

1. Browse files in your working directory
2. Edit files with syntax highlighting
3. Changes sync in real-time
4. Git integration shows file status

### Offline Mode

1. The app automatically detects network status
2. Commands and edits are queued when offline
3. Changes sync automatically when connection restored
4. See pending changes count in the session list

## Advanced Configuration

### Using Tailscale (Recommended for Remote Access)

1. Install Tailscale on your server:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

2. Configure in `.env`:
```env
TAILSCALE_ENABLED=true
TAILSCALE_AUTH_KEY=your-auth-key
TAILSCALE_HOSTNAME=claude-code-server
```

3. Connect mobile devices to same Tailscale network

4. Use Tailscale hostname instead of IP address

### SSL/TLS Setup

1. Generate certificates:
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

2. Configure in `.env`:
```env
SSL_ENABLED=true
SSL_CERT_PATH=./cert.pem
SSL_KEY_PATH=./key.pem
```

3. Update mobile apps to use `https://` and `wss://`

### Push Notifications (iOS)

1. Configure Apple Push Notification Service
2. Add push certificate to server
3. Update `Info.plist` with notification permissions
4. Notifications work for:
   - Long-running command completion
   - Session handoff requests
   - File change alerts

## Troubleshooting

### Connection Issues

**Problem**: Mobile app can't connect to server

**Solutions**:
1. Ensure devices are on same network
2. Check firewall settings (port 7331)
3. Verify server is running (`./start-dev.sh`)
4. Try using IP address instead of hostname
5. Check server logs for errors

### iOS Specific

**Problem**: "Untrusted Developer" error

**Solution**: 
Settings → General → Device Management → Trust the developer certificate

**Problem**: WebSocket disconnects frequently

**Solution**:
1. Enable Background App Refresh
2. Check Low Power Mode is disabled
3. Ensure Wi-Fi Assist is enabled

### Android Specific

**Problem**: Network permission denied

**Solution**:
Add to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

**Problem**: Cleartext traffic error (Android 9+)

**Solution**:
For development only, add to `AndroidManifest.xml`:
```xml
<application
    android:usesCleartextTraffic="true"
    ...>
```

## Testing Checklist

- [ ] Server starts successfully
- [ ] Mobile app connects to server
- [ ] Can create new session
- [ ] Can switch between sessions
- [ ] Terminal input/output works
- [ ] File browsing works
- [ ] Offline mode queues changes
- [ ] Changes sync when reconnected
- [ ] Session persists across app restarts
- [ ] Handoff works (iOS)
- [ ] Push notifications work
- [ ] Git operations work

## Development Tips

1. **Use Charles Proxy or similar** to debug network requests
2. **Enable verbose logging** in development mode
3. **Test on real devices** for accurate performance
4. **Test offline scenarios** using Airplane Mode
5. **Monitor memory usage** for terminal output buffers

## Security Notes

⚠️ **Development Setup Only**

The default configuration is for development only. For production:

1. Use strong JWT secrets
2. Enable SSL/TLS
3. Implement proper authentication
4. Use certificate pinning in mobile apps
5. Enable rate limiting
6. Audit all file system operations
7. Implement session timeouts
8. Use encrypted storage for sensitive data

## Support

For issues or questions:
1. Check server logs: `~/.claude-code-extended/logs/`
2. Check mobile app logs in Xcode/Android Studio
3. Review the troubleshooting section
4. Open an issue on GitHub

---

**Happy Coding! 🚀**