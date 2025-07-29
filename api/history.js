// /api/tx-history.js
import mongoose from 'mongoose';
import Transaction from '../models/Transaction'; // Tells it where the model is

// This function connects to the database
async function connectToDatabase() {
  // Check if we have a cached connection
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  // If not, create a new one
  return mongoose.connect(process.env.MONGO_URI);
}

export default async function handler(req, res) {
  // This code runs when your frontend calls /api/tx-history
  await connectToDatabase();

  // This is the SAME logic from your old server.js file
  try {
    const { txHash, from, to, amount, tokenSymbol, status } = req.body;
    const newTransaction = new Transaction({ txHash, from, to, amount, tokenSymbol, status });
    await newTransaction.save();
    res.status(201).json({ message: "Transaction saved successfully." });
  } catch (error) {
    console.error("Error saving transaction:", error);
    res.status(500).json({ message: "Server error while saving transaction." });
  }
}