// /api/wallet/fetch.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
// This path must match your folder structure exactly.
// Your folder is named 'model' (singular), not 'models'.
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
    console.error("CRASH REPORT:", error); // Added a more obvious log message
    res.status(500).json({ message: "Server crashed", error: error.message });
  }
}