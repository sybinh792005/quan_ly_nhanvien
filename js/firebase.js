import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAMBjurHmxrvgnmIqTOsFoDU-lGdU2ive4",
    authDomain: "quanlynhanvien-976f1.firebaseapp.com",
    projectId: "quanlynhanvien-976f1",
    storageBucket: "quanlynhanvien-976f1.firebasestorage.app",
    messagingSenderId: "555341626552",
    appId: "1:555341626552:web:9b09f6dab687e67fc3484d"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);