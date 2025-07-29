// /api/tx-history/[username].js
import mongoose from 'mongoose';
// Adjust the path to go up two directories to find the model folder.
import Transaction from '../../model/Transaction.js'; 
import Wallet from '../../model/Wallet.js';

async function connectToDatabase() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  return mongoose.connect(process.env.MONGO_URI);
}

export default async function handler(req, res) {
  // ✅ THE FIX: This is a GET request, so we must check for it.
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await connectToDatabase();
    
    // Get the username from the URL (e.g., /api/tx-history/pragat)
    const { username } = req.query; 

    // Find all wallets for that username to get their addresses
    const userWallets = await Wallet.find({ username });
    if (!userWallets || userWallets.length === 0) {
      // It's okay if a user has no wallets, just return an empty array.
      return res.status(200).json([]); 
    }

    const userAddresses = userWallets.map(w => w.address);

    // Find all transactions where the 'from' address is one of the user's addresses
    const transactions = await Transaction.find({
      from: { $in: userAddresses }
    }).sort({ timestamp: -1 }); // Sort by newest first

    res.status(200).json(transactions);

  } catch (error) {
    console.error("Error fetching transaction history:", error);
    res.status(500).json({ message: "Server error while fetching transaction history." });
  }
}