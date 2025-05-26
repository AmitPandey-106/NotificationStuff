const admin = require("firebase-admin");
const express = require("express");
const fs = require("fs");
const path = require("path");
require('dotenv').config();

const app = express();
app.use(express.json());

// Initialize Firebase Admin SDK
let serviceAccount;
try {
  // Check if running on Render (production)
  if (fs.existsSync('/etc/secrets/firebase-admin-key.json')) {
    serviceAccount = require('/etc/secrets/firebase-admin-key.json');
    console.log('Using Firebase credentials from /etc/secrets/');
  } else {
    // Local development
    serviceAccount = require('./firebase-admin-key.json');
    console.log('Using local Firebase credentials');
  }
} catch (error) {
  console.error('Error loading Firebase credentials:', error);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});


app.post("/send", async (req, res) => {
  const { title, body } = req.body;

  try {
    const tokensSnapshot = await admin.database().ref('admin_tokens').once('value');
    const tokensData = tokensSnapshot.val();
    
    if (!tokensData) {
      return res.status(400).send({ success: false, error: "No tokens found in database." });
    }
    
    const tokens = Object.values(tokensData);
    console.log(`Sending notification to ${tokens.length} tokens`);
    
    const successfulSends = [];
    const failedSends = [];
    
    // Send notifications to all tokens
    for (const token of tokens) {
      const message = {
        notification: { title, body },
        token,
      };
      
      try {
        const response = await admin.messaging().send(message);
        successfulSends.push(response);
      } catch (err) {
        console.error(`Error sending message to token ${token}:`, err);
        failedSends.push({ token, error: err.message });
      }
    }
    
    res.send({ 
      success: true, 
      successCount: successfulSends.length,
      failureCount: failedSends.length,
      successfulSends,
      failedSends
    });
  } catch (err) {
    console.error("Error processing send request:", err);
    res.status(500).send({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FCM server running on port ${PORT}`));
