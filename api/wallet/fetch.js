// /api/wallet/fetch.js

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
// The path is now corrected to match your folder structure
import Wallet from '../../model/Wallet.js'; 

// Helper to connect to the database
async function connectToDatabase() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  return mongoose.connect(process.env.MONGO_URI);
}

export default async function handler(req, res) {
  // This function only allows POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // This is your logic for fetching wallets
  try {
    await connectToDatabase();
    const { username, password } = req.body;
    const user = await Wallet.findOne({ username });

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const userWallets = await Wallet.find({ username }).select('-password');
    res.status(200).json(userWallets);

  } catch (error) {
    console.error("Error fetching wallets:", error);
    res.status(500).json({ message: "Error fetching wallets" });
  }
}