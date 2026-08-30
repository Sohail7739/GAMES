# Build and Prepare APK for Installation

The goal is to automate the build process and prepare the project so that the user only needs to perform the final "Build APK" step in Android Studio, as I cannot trigger the physical UI of Android Studio to click "Build APK" for them.

## User Review Required

> [!IMPORTANT]
> I will prepare all the files and run the build scripts, but you will still need to perform the final **"Build APK"** click in Android Studio because I don't have permission to control the Android Studio menus directly.

## Proposed Changes

### [Component Name] Client (Web & Android)

#### [MODIFY] [.env](file:///D:/Project/Backup/working%20area/GAMES/workspace/client/.env)
Ensure the environment variable `VITE_API_URL` is set to the correct local IP (`http://192.168.1.33:4000`) so the phone can connect.

#### [MODIFY] [AndroidManifest.xml](file:///D:/Project/Backup/working%20area/GAMES/workspace/client/android/app/src/main/AndroidManifest.xml)
Double-check that `android:usesCleartextTraffic="true"` is correctly placed.

## Verification Plan

### Automated Steps
1. Run `npm run build` in the `client` directory to generate the web assets.
2. Run `npx cap sync android` to copy assets to the Android project.
3. Verify that the `dist` folder is populated and assets are in the `android/app/src/main/assets/public` folder.

### Manual Verification
- After I finish, you will click **Build > Build Bundle(s) / APK(s) > Build APK(s)** in Android Studio.
