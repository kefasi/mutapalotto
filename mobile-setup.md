# Mutapa Lottery Mobile App Setup Guide

## Overview
This guide helps you convert the Mutapa Lottery web app into native mobile apps for Android and iOS using Capacitor.

## Prerequisites
- Android Studio (for Android development)
- Xcode (for iOS development - macOS only)
- Your server URL for the backend API

## Configuration Steps

### 1. Update Server URL
Edit `capacitor.config.json` and `client/src/lib/config.ts` and replace `https://your-server-url.replit.app` with your actual server URL.

**Required:** Please provide your server URL to complete the mobile app configuration.

### 2. Build the Web App
```bashr
npm run build:mobile
```r

### 3. Add Mobile Platforms
```bash
# Add Android platform
npx cap add android

# Add iOS platform (macOS only)
npx cap add ios
```

### 4. Sync the Project
```bash
npx cap sync
```

### 5. Open in Native IDEs
```bash
# Open Android project in Android Studio
npx cap open android

# Open iOS project in Xcode (macOS only)
npx cap open ios
```

## Mobile Features
- **Offline Support**: App works offline with cached data
- **Push Notifications**: Receive lottery results and alerts
- **Native UI**: Platform-specific design and interactions
- **Secure Storage**: Encrypted local storage for sensitive data
- **Background Sync**: Updates when app returns to foreground

## Development Commands
- `npm run cap:build:android` - Build and run on Android
- `npm run cap:build:ios` - Build and run on iOS (macOS only)
- `npm run cap:live` - Live reload development mode
- `npx cap sync` - Sync web assets to native projects

## Server Configuration
The app automatically detects if it's running as a mobile app and connects to your configured server URL instead of localhost.

## Deployment
1. Build the app using the native IDEs
2. Sign and publish to Google Play Store (Android) or App Store (iOS)
3. Ensure your server supports HTTPS for production builds