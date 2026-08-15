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
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
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
    app = initializeApp(firebaseConfig);
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
      ignoreUndefinedProperties: true,
    });
    auth = getAuth(app);
  }
  return { app, db, auth };
}

export { getFirebase };
