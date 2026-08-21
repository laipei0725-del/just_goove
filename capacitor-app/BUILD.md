# JUST GROOVE — React + Capacitor

## Web development

```bash
cd capacitor-app
npm install
npm run dev
```

## Create and run the iOS app

```bash
cd capacitor-app
npm run ios:sync
npx cap open ios
```

In Xcode, select your **Personal Team** under **Signing & Capabilities**, select your iPhone, then press `⌘R`.

After changing web code, always run `npm run ios:sync` before reopening or building the iOS app.

## Production archive

Open `capacitor-app/ios/App/App.xcworkspace` after `npm run ios:sync`, then use **Product → Archive** in Xcode.
