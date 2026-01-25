// Firebase configuration for Green Wave Leaderboard
// Replace these placeholder values with your actual Firebase project credentials
// Get these from: Firebase Console > Project Settings > Your apps > Web app

const firebaseConfig = {
  apiKey: "AIzaSyAZRpJQk90fqwMFpQnAZLA-c7JHUd9S6p0",
  authDomain: "green-wave-game.firebaseapp.com",
  databaseURL: "https://green-wave-game-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "green-wave-game",
  storageBucket: "green-wave-game.firebasestorage.app",
  messagingSenderId: "476917104609",
  appId: "1:476917104609:web:60fd6de9f46d1b62bb9ca0"
};

// Initialize Firebase
let db = null;
let firebaseAvailable = false;

try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    firebaseAvailable = true;
    console.log('Firebase initialized successfully');
} catch (error) {
    console.warn('Firebase initialization failed. Leaderboard features will be disabled.', error);
    firebaseAvailable = false;
}
