// backend/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  txHash: { type: String, required: true, unique: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  amount: { type: String, required: true },
  tokenSymbol: { type: String, required: true },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'success', 'failed'], // Only allow these values
    default: 'pending'
  },
  timestamp: { type: Date, default: Date.now },
});

// Mongoose will create a collection named "transactions" (plural and lowercase)
// from the model named "Transaction".
const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;