# Us: a small private app for two

Location (while the app is open), status, schedule, cycle dates, special dates and shared notes.
Runs as a website on GitHub Pages, with a free Firebase project as the shared whiteboard.

## Files

| File | What it is |
|---|---|
| index.html, style.css, app.js, logic.js | The app itself |
| firebase-config.js | **The one file you edit**: paste your Firebase settings here |
| firestore.rules | The lock on your data. Paste into Firebase (step 3) |
| manifest.webmanifest, sw.js, *.png | Lets the site install like an app on both phones |

## Setup (about 20 minutes)

1. **Firebase project** (console.firebase.google.com): Create project → name it → turn Google Analytics off.
   - Build → **Authentication** → Get started → Sign-in method → **Email/Password** → Enable.
   - Build → **Firestore Database** → Create database → pick the Mumbai region (asia-south1) → start in **production mode**.
   - Project settings (gear) → Your apps → **Web (`</>`)** → register an app → copy the `firebaseConfig` values.
2. **firebase-config.js**: replace each `PASTE_...` value with your values (keep the quotes).
3. **Rules**: Firestore Database → **Rules** tab → delete everything → paste the contents of `firestore.rules` → **Publish**.
4. **GitHub**: New repository (public) → upload *the files inside this folder* (not the folder itself, so `index.html` sits at the top).
   Settings → **Pages** → Source: *Deploy from a branch* → `main` / `/ (root)` → Save. After a minute your link appears.
5. **Firebase → Authentication → Settings → Authorized domains**: add `yourusername.github.io` if it isn't listed.
6. **Open the link on both phones**, then Android: Chrome ⋮ → *Add to Home screen*; iPhone: Safari Share → *Add to Home Screen*.
   First person: sign up → *Create our space* → send the 8-letter code. Second person: sign up → *Join with a code*.

## Good to know

- Location updates when the app is opened (and every 5 minutes while it stays open). Either person can switch it off.
- The cycle section is an estimate from past dates, not medical advice. The owner decides whether the partner can see it.
- The website address is public, but nobody can see any data without signing in as one of the two of you.
- Never put passwords or secret keys in the code files. The Firebase config values are fine to be public.
