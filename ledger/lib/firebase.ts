"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDdQzI5cwHCqWHFuCzorw_OpkOWxtQhuF0",
  authDomain: "business-59424.firebaseapp.com",
  projectId: "business-59424",
  storageBucket: "business-59424.firebasestorage.app",
  messagingSenderId: "400770277605",
  appId: "1:400770277605:web:1013515143c0c706af340c",
  measurementId: "G-Q3SK467EGZ"
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

// Firestore is initialized once with persistent local-cache (IndexedDB) turned on.
// This is the "memory optimized strategy" for a Firebase-backed SPA: reads for
// products/purchases/sales/expenses are served from IndexedDB after the first
// load, snapshot listeners only ship deltas over the wire, and the app keeps
// working (read-only) offline. Multi-tab manager avoids duplicate listeners
// when the user has the app open in two tabs.
//
// ignoreUndefinedProperties: true — several entities have genuinely optional
// fields (Product.orderingCost, Loan.lender, Expense.endDate, etc.) that get
// written as `undefined` when left blank in a form. Firestore's SDK rejects
// `undefined` outright ("Unsupported field value: undefined") unless this is
// set, so this is required, not optional, given how the forms are written.
function getFirebase() {
  if (!getApps().length) {
    // A missing/empty .env.local is the single most common reason this app
    // "does nothing" after a fresh checkout — Firebase's own errors for a
    // bad config (e.g. "auth/invalid-api-key") surface deep inside an auth
    // listener callback with no context, which used to just look like a
    // silently blank page. Fail loudly and specifically instead, right at
    // startup — app/error.tsx and app/global-error.tsx will display this
    // message rather than showing a blank screen.
    const missing = Object.entries(firebaseConfig)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length > 0) {
      throw new Error(
        `Firebase isn't configured: missing ${missing
          .map((k) => `NEXT_PUBLIC_FIREBASE_${k.replace(/[A-Z]/g, (c) => "_" + c).toUpperCase()}`)
          .join(", ")}. Copy .env.local.example to .env.local and fill in your Firebase project's web config, then restart the dev server.`
      );
    }

    app = initializeApp(firebaseConfig);

    // Persistent (IndexedDB) local cache is preferred, but isn't available
    // everywhere — Safari private browsing, some in-app/embedded webviews,
    // and locked-down corporate browsers can all throw here. Rather than
    // let that exception take down the whole app (which is what used to
    // happen — every onSnapshot call downstream would then throw too, and
    // the page would render its shell with no data and no explanation),
    // fall back to Firestore's default in-memory cache: the app keeps
    // working, it just won't survive a refresh while offline.
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
        ignoreUndefinedProperties: true,
      });
    } catch (err) {
      console.warn(
        "Persistent local cache unavailable (falling back to in-memory Firestore cache):",
        err
      );
      db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    }

    auth = getAuth(app);
  }
  return { app, db, auth };
}

export { getFirebase };
