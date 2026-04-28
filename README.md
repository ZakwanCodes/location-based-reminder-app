# Location-Based Reminder App

This is a location-based reminder mobile application built with React Native and Expo (TypeScript). It was developed for CMPS 285 – Mobile Development (Spring 2026).

## Theme
Location-based Reminder App — create reminders that trigger when you arrive near a saved location and at the scheduled date.

## Features
- User authentication (Firebase Authentication)
- Create / Read / Update / Delete reminders (Firestore)
- Attach a location to a reminder via an interactive map search
- Local notifications when reminders are due and within a proximity radius
- Profile screen with permission status and statistics
- Responsive UI with SafeArea handling

## Tech stack
- React Native (Expo)
- TypeScript
- Firebase (Authentication + Firestore)
- expo-location, expo-notifications
- react-native-maps
- react-native-safe-area-context

## Project structure (high level)
- `src/screens/` — app screens (reminders, details, profile, auth)
- `src/components/` — shared UI components (e.g., LocationSearchModal)
- `src/services/` — Firebase, notifications, location helpers
- `assets/` — icons and images

## Requirements
- Node.js, npm or yarn
- Expo CLI
- Firebase project credentials (set in `.env`)

## Environment variables
Create a `.env` file (not committed) with your Firebase values, for example:

```
EXPO_PUBLIC_API_KEY=...
EXPO_PUBLIC_AUTH_DOMAIN=...
EXPO_PUBLIC_PROJECT_ID=...
EXPO_PUBLIC_STORAGE_BUCKET=...
EXPO_PUBLIC_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_APP_ID=...
```

## Install and run

```
npm install
npm run start
```

Run on a device or emulator via the Expo dev tools. Note: remote push notifications require a development build (EAS / dev-client); Expo Go cannot receive remote push tokens on newer SDKs.

## Notes for graders
- The app uses `react-native-safe-area-context` for SafeArea handling.
- TypeScript `strict` mode is enabled in `tsconfig.json`.
- Firebase is used for authentication and Firestore for reminders storage.

## Testing / Manual QA
- Test authentication (register / login)
- Create reminders with and without attached location
- Verify local notifications: scheduled notifications and proximity-based notifications (requires app foreground or map refresh scan)

## Files to check
- `src/screens/reminders.tsx` — main UI and create form
- `src/services/databaseService.tsx` — Firestore CRUD
- `src/services/notificationService.tsx` — scheduling and storage

## Contact / Submission
See `TASK_DISTRIBUTION.md` for the team submission contact.
