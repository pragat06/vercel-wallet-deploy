// /api/tx-status.js
import mongoose from 'mongoose';
// Make sure this path points to your model file.
// Your folder is named 'model' (singular), so this path is correct.
import Transaction from '../model/Transaction.js'; 

async function connectToDatabase() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  return mongoose.connect(process.env.MONGO_URI);
}

export default async function handler(req, res) {
  // ✅ THE FIX: This function MUST allow the 'PUT' method.
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await connectToDatabase();
    const { txHash, status } = req.body;

    // Validation
    if (!txHash || !status) {
      return res.status(400).json({ message: "Transaction hash and status are required." });
    }

    const updatedTransaction = await Transaction.findOneAndUpdate(
      { txHash: txHash.toLowerCase() },
      { status: status },
      { new: true } // Return the updated document
    );

    if (!updatedTransaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    res.status(200).json({ message: "Status updated successfully.", transaction: updatedTransaction });

  } catch (error) {
    console.error("Error updating transaction status:", error);
    res.status(500).json({ message: "Server error while updating status." });
  }
}