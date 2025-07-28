import mongoose from 'mongoose';
import Transaction from '../model/Transaction.js';

async function connectToDatabase() {
  if (mongoose.connection.readyState >= 1) return;
  return mongoose.connect(process.env.MONGO_URI);
}

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await connectToDatabase();
    const { txHash, status } = req.body;

    if (!txHash || !status || !['success', 'failed'].includes(status)) {
      return res.status(400).json({ message: "Invalid parameters provided." });
    }

    const updatedTransaction = await Transaction.findOneAndUpdate(
      { txHash: txHash.toLowerCase() },
      { status: status },
      { new: true }
    );

    if (!updatedTransaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    res.status(200).json({ message: "Status updated successfully." });
  } catch (error) {
    console.error("Error updating transaction status:", error);
    res.status(500).json({ message: "Server error while updating status." });
  }
}