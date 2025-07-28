import mongoose from 'mongoose';
import Transaction from '../../model/Transaction.js';
import Wallet from '../../model/Wallet.js';

async function connectToDatabase() {
  if (mongoose.connection.readyState >= 1) return;
  return mongoose.connect(process.env.MONGO_URI);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await connectToDatabase();
    const { username } = req.query;
    const userWallets = await Wallet.find({ username });

    if (!userWallets || userWallets.length === 0) {
      return res.status(200).json([]); // Return empty array if no wallets
    }

    const userAddresses = userWallets.map(w => w.address);
    const transactions = await Transaction.find({
      $or: [
        { from: { $in: userAddresses } },
        { to: { $in: userAddresses } }
      ]
    }).sort({ timestamp: -1 });

    res.status(200).json(transactions);

  } catch (error) {
    console.error("Error fetching transaction history:", error);
    res.status(500).json({ message: "Server error while fetching history." });
  }
}