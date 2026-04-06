import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBZsNmumycpTXIshe1JvoEm7DhuQO4PiWw",
    authDomain: "chamconght-3df64.firebaseapp.com",
    databaseURL: "https://chamconght-3df64-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "chamconght-3df64",
    storageBucket: "chamconght-3df64.firebasestorage.app",
    messagingSenderId: "500919029656",
    appId: "1:500919029656:web:8f75866b38b83e096865ed"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);