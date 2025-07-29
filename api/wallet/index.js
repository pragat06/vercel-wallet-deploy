// /api/wallet/index.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
// Make sure this path is correct for your 'model' folder
import Wallet from '../../model/Wallet.js';

async function connectToDatabase() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  return mongoose.connect(process.env.MONGO_URI);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await connectToDatabase();
    const { username, password, address, privateKey, mnemonic } = req.body;

    const existingUser = await Wallet.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const newWallet = new Wallet({
      username,
      password: hashedPassword,
      address,
      privateKey,
      mnemonic,
    });

    await newWallet.save();
    res.status(201).json({ message: "Wallet created and saved successfully!" });

  } catch (error) {
    console.error("CRASH REPORT in /api/wallet/index.js:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
}