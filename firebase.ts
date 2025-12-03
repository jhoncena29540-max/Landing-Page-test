
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDcVcM2V1DyKFZSNUBzmNP4EDUR5u82PD8",
  authDomain: "landing-page-1719a.firebaseapp.com",
  projectId: "landing-page-1719a",
  storageBucket: "landing-page-1719a.firebasestorage.app",
  messagingSenderId: "379762134890",
  appId: "1:379762134890:web:e533f94a8c69a43ae3df13",
  measurementId: "G-NFRXCY4KWD"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// Analytics is optional for functionality but initialized
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };
