// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBcQYeru6qMav8S2kIhW9p-loEa8C4Hfew",
  authDomain: "gruposos.firebaseapp.com",
  projectId: "gruposos",
  storageBucket: "gruposos.firebasestorage.app",
  messagingSenderId: "1074470248037",
  appId: "1:1074470248037:web:4ffce5edca080b2a48b08c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); 