# HealthApp MVP

A premium, calm, and confident React Native tracking utility application built with Expo and Supabase.
This MVP implements a "Warm-Neutral" design language, prioritizing minimal friction, fast text-based input, voice transcriptions, and clean typography.

## Prerequisites

Before running the application, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [npm](https://www.npmjs.com/)
- An Android Emulator (via Android Studio) or an iOS Simulator (via Xcode on macOS)

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Expo development server:
   ```bash
   npx expo start
   ```
   *If you are using custom native modules and need the dev-client, run:*
   ```bash
   npx expo start --dev-client
   ```

## Running on Simulators / Emulators

Once the development server is running (`npm start`), you can easily boot the app on a connected emulator:

### 📱 iOS Simulator (macOS only)
1. Ensure Xcode is installed and open the iOS Simulator `open -a Simulator`.
2. While `npm start` is running in your terminal, press **`i`** on your keyboard.
*Alternatively, start directly via:*
```bash
npm run ios
```

### 🤖 Android Emulator
1. Open Android Studio -> Virtual Device Manager and boot up an Android Virtual Device (AVD).
2. While `npm start` is running in your terminal, press **`a`** on your keyboard.
*Alternatively, start directly via:*
```bash
npm run android
```

### 🌐 Web Browser
Press **`w`** in the terminal running Expo or start directly via:
```bash
npm run web
```

## Development Commands

Ensure code consistency and correctness before committing:

- Typecheck TypeScript (no strict emit): `npm run typecheck`
- Lint files: `npm run lint`
- Format code: `npm run format`
- Run the full verification suite (tests + lints): `npm run verify`

## Design System

The application uses a strictly unified `Warm-Neutral` design system built around tokens defined in `src/ui/theme.ts`.
Do not use raw `<Text>`, raw inline typography styling, or raw React Native primitive containers that interfere with spacing. Always utilize the established components (e.g., `<ScreenContainer>`, `<AppText>`, `<PrimaryButton>`).
