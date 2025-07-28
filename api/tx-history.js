import mongoose from 'mongoose';
import Transaction from '../model/Transaction.js';

async function connectToDatabase() {
  if (mongoose.connection.readyState >= 1) return;
  return mongoose.connect(process.env.MONGO_URI);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  
  try {
    await connectToDatabase();
    const { txHash, from, to, amount, tokenSymbol, status } = req.body;
    const newTransaction = new Transaction({ txHash, from, to, amount, tokenSymbol, status });
    await newTransaction.save();
    res.status(201).json({ message: "Transaction saved successfully." });
  } catch (error) {
    console.error("Error saving transaction:", error);
    res.status(500).json({ message: "Server error while saving transaction." });
  }
}