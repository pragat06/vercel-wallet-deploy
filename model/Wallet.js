// backend/Wallet.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const walletSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  address: String,
  privateKey: String,
  mnemonic: String,
});

// Mongoose will create a collection named "wallets" from the model "Wallet".
const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;