# Countdown

Pick a date and time you're waiting for, and see how much time is left in **weeks, days, hours, minutes and seconds**. You can also set a reminder and turn the countdown into a **wallpaper**.

This is one web app that works on **iPhone, Android and desktop**. You can install it to your home screen, where it looks and works like a normal app, even offline.

## Features

- Add as many countdowns as you want, each with a name, a date, a time and a color style.
- The countdown ticks live, showing weeks, days, hours, minutes and seconds, plus totals ("75 days · 1,806 hours · 108,396 minutes").
- **Full-screen mode:** tap a countdown to open it full screen. The buttons fade away and the screen stays on, so an old phone or tablet can show it like a clock.
- **Reminders:**
  - The app shows a notification while it is open.
  - **Alarm (.ics)** adds the event to the phone's calendar (Apple Calendar or Google Calendar) with an alert. Use this if you want an alarm that goes off even when the app is closed.
- **Wallpaper image:** saves a PNG at the exact size of your phone (or iPhone, Android or desktop presets).
- **Share:** sends a link, and opening it adds the same countdown on another phone.
- Your countdowns are saved on your device. There is no account and no server.

## Run it

It's a plain static site with no build step:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

To use it on your phone, put it online for free with **GitHub Pages**. In the repo, go to Settings → Pages → Deploy from branch → pick this branch and `/ (root)`. You'll get a link like `https://<user>.github.io/work/`. Netlify, Vercel or Cloudflare Pages also work: just drag and drop the folder.

### Install it as an app

- **iPhone (Safari):** tap Share → **Add to Home Screen**.
- **Android (Chrome):** tap ⋮ → **Install app** (or **Add to Home screen**).

## How to make it your wallpaper

### 1. Still wallpaper (easy, works on every phone)

Open a countdown → **Wallpaper** → pick a size → **Save image**.

- **iPhone:** in the share sheet tap **Save Image**. Then go to Photos → open the image → Share → **Use as Wallpaper**. Pick **Lock screen (below clock)** in the app so the clock doesn't cover the numbers.
- **Android:** save the image, then long-press it in Gallery or Photos → **Set as wallpaper**.

A picture can't change by itself. To keep the numbers correct, save a new one now and then, or use one of the auto-updating options below.

### 2. iPhone: wallpaper that updates every day (Shortcuts)

Apple doesn't let apps make a live, ticking wallpaper. What does work is an iPhone Shortcut that rebuilds the wallpaper every morning:

1. Open the **Shortcuts** app → **Automation** → **+** → **Time of Day** (e.g. 6:00 AM, Daily) → **Run Immediately**.
2. Add these actions:
   1. **Date**: set it to your target date (e.g. `25 Dec 2026 10:30`).
   2. **Get Time Between Dates**: from *Current Date* to *Date*, in **Days**.
   3. **Text**: `Trip to Goa — [Time Between Dates] days to go`.
   4. **Get Images** (or **Select Photos**): pick a background, such as a wallpaper you saved from this app.
   5. **Overlay Text** on that image, using the Text from step 3.
   6. **Set Wallpaper**: Lock Screen, and turn off *Show Preview*.
3. Every morning your lock screen shows the new number of days left.

### 3. Android: a real live wallpaper

Android allows live wallpapers, but a website can't install one by itself. You have two options:

- **No coding:** install **KLWP (Kustom Live Wallpaper)** and add a text element that uses its `tf()` (time-span) function with your target date. KLWP's built-in formula help has countdown examples. It updates live on your home screen.
- **Our own app:** wrap this site in a small native Android app with a `WallpaperService` that draws the same countdown (see roadmap below).

### 4. Always-on display (any device)

Open a countdown full screen and tap once to hide the buttons. The screen stays awake (it uses the Wake Lock API), so a spare phone, tablet or monitor works as a live countdown display.

## Roadmap: real App Store / Play Store apps

The web app covers both phones today. To publish real store apps and get features only native apps can have:

| Feature | How |
| --- | --- |
| Store apps for iPhone and Android | Wrap this code with **Capacitor** (`npx cap add ios`, `npx cap add android`) |
| Alarms that fire with the app closed | Capacitor **Local Notifications** plugin |
| iPhone lock-screen / home-screen countdown | **WidgetKit** widget (Swift). This is Apple's way to show a live countdown on the lock screen |
| Android live wallpaper | `WallpaperService` in Kotlin that draws the countdown |
| Android home-screen widget | App widget, or a Glance widget in Kotlin |

## Files

```
index.html            page layout
styles.css            styling
app.js                countdowns, reminders, wallpaper image, sharing
sw.js                 offline support
manifest.webmanifest  makes it installable
icons/                app icons
```
