# Building Mutapa Lottery Mobile App

## Prerequisites
Before building the mobile app, you need to provide your server URL.

## Steps to Complete Mobile App Setup

### 1. Provide Server URL
Please provide your server URL (the one currently hosting your backend) so I can update the mobile app configuration.

### 2. Update Configuration Files
Once you provide the URL, I will update:
- `capacitor.config.json` - Capacitor mobile app configuration
- `client/src/lib/config.ts` - API configuration for mobile/web detection

### 3. Build and Deploy
After configuration:
```bash
# Build the web app for mobile
npm run build

# Initialize Capacitor (if not done)
npx cap init "Mutapa Lottery" "com.mutapalottery.app"

# Add platforms
npx cap add android
npx cap add ios  # macOS only

# Sync web assets to mobile
npx cap sync

# Open in IDEs for final build
npx cap open android    # Android Studio
npx cap open ios        # Xcode (macOS only)
```

## Current Mobile Features Implemented
✅ Mobile detection and configuration
✅ Offline network status indicators  
✅ Native app styling and behavior
✅ Server URL switching for mobile vs web
✅ Mobile-specific hooks and utilities
✅ PWA banner disabled in mobile app
✅ Trilingual support across all platforms

## Next Steps
**Please provide your server URL to complete the mobile app configuration.**