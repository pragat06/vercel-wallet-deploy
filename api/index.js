// backend/server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { ethers } = require("ethers");

// --- Define Mongoose Schemas and Models ---

// Wallet Schema (from Wallet.js)
const walletSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  address: String,
  privateKey: String,
  mnemonic: String,
});
const Wallet = mongoose.model('Wallet', walletSchema);


// Transaction Schema (from Transaction.js)
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
const Transaction = mongoose.model('Transaction', transactionSchema);


// --- Initialize Express App ---
const app = express();

// --- CORS Configuration ---
// This is the likely fix for the "Failed to fetch" error.
// It explicitly allows your React app (running on localhost:3000)
// to make requests to this server (running on localhost:5000).
const corsOptions = {
  origin: "http://localhost:3000", // The origin of your frontend app
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // Allowed request methods
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));


app.use(express.json()); // Middleware to parse JSON bodies

// --- Define constants and the Ethers provider ---
const RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// --- ABI and signature needed to understand token transfers ---
const erc20ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function transfer(address, uint256)",
];
const ERC20_TRANSFER_SIGNATURE = "0xa9059cbb";


// --- Connect to MongoDB ---
mongoose.connect("mongodb+srv://pragatchari06:LRmzbYUjkpif0nhc@cluster0.ghbszlz.mongodb.net/Web3", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});


// --- API Endpoints ---

// POST: Save a new wallet
app.post("/api/wallet", async (req, res) => {
  try {
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
    res.status(500).json({ message: "Server error", error });
  }
});

// POST: Fetch wallets for a user
app.post("/api/wallet/fetch", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await Wallet.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    const userWallets = await Wallet.find({ username });
    const walletsToSend = userWallets.map(w => ({
        username: w.username,
        address: w.address,
        privateKey: w.privateKey,
        mnemonic: w.mnemonic
    }));
    res.json(walletsToSend);
  } catch (error) {
    res.status(500).json({ message: "Error fetching wallets", error });
  }
});

// POST: Verify a transaction
app.post("/api/verify-tx", async (req, res) => {
  const { txHash, adminWalletAddress } = req.body;

  if (!txHash || !adminWalletAddress) {
    return res.status(400).json({ isValid: false, message: "Error: Missing parameters." });
  }

  try {
    const tx = await provider.getTransaction(txHash);

    if (!tx) {
      return res.status(404).json({ isValid: false, message: "Transaction hash not found." });
    }

    const isFromAdmin = tx.from.toLowerCase() === adminWalletAddress.toLowerCase();

    let txDetails = {};

    if (tx.value > 0) {
      txDetails = {
        from: tx.from,
        to: tx.to,
        amount: ethers.formatEther(tx.value),
        tokenSymbol: "BNB",
      };
    }
    else if (tx.data && tx.data.startsWith(ERC20_TRANSFER_SIGNATURE)) {
      try {
        const iface = new ethers.Interface(erc20ABI);
        const decodedData = iface.parseTransaction({ data: tx.data });

        if (decodedData && decodedData.name === "transfer") {
          const tokenContract = new ethers.Contract(tx.to, erc20ABI, provider);

          const [tokenSymbol, tokenDecimals] = await Promise.all([
            tokenContract.symbol(),
            tokenContract.decimals()
          ]).catch(() => ['Unknown Token', 18]);

          txDetails = {
            from: tx.from,
            to: decodedData.args[0],
            amount: ethers.formatUnits(decodedData.args[1], tokenDecimals),
            tokenSymbol: tokenSymbol,
          };
        } else {
          throw new Error("Decoded but not a simple transfer function.");
        }
      } catch (innerError) {
        console.error("Could not parse as ERC20 transfer, falling back:", innerError.message);
        txDetails = {
          from: tx.from,
          to: tx.to,
          amount: "N/A",
          tokenSymbol: "Complex Interaction",
        };
      }
    }
    else {
      txDetails = {
        from: tx.from,
        to: tx.to,
        amount: "N/A",
        tokenSymbol: "Contract Interaction",
      };
    }

    res.json({
      isValid: isFromAdmin,
      message: isFromAdmin
        ? "✅ SUCCESS: Transaction was sent from the specified admin wallet."
        : "❌ FAILED: This transaction was NOT sent by the specified admin wallet.",
      details: txDetails,
    });

  } catch (error) {
    console.error("Main verification handler error:", error);
    res.status(500).json({
      isValid: false,
      message: "An internal server error occurred during verification.",
    });
  }
});

// POST: Save transaction history
app.post("/api/tx-history", async (req, res) => {
  try {
    const { txHash, from, to, amount, tokenSymbol } = req.body;

    if (!txHash || !from || !to || !amount || !tokenSymbol) {
      return res.status(400).json({ message: "Missing required transaction fields." });
    }

    const newTransaction = new Transaction({
      txHash,
      from,
      to,
      amount,
      tokenSymbol
    });

    await newTransaction.save();
    res.status(201).json({ message: "Transaction saved successfully.", transaction: newTransaction });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "This transaction hash has already been saved." });
    }
    console.error("Error saving transaction:", error);
    res.status(500).json({ message: "Server error while saving transaction." });
  }
});

// GET: Fetch transaction history for a user
app.get("/api/tx-history/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const userWallets = await Wallet.find({ username });

    if (!userWallets || userWallets.length === 0) {
      return res.status(404).json({ message: "No wallets found for this user." });
    }
    const userAddresses = userWallets.map(w => w.address);
    const transactions = await Transaction.find({
      from: { $in: userAddresses }
    }).sort({ timestamp: -1 }); // Sort by newest first

    res.status(200).json(transactions);

  } catch (error) {
    console.error("Error fetching transaction history:", error);
    res.status(500).json({ message: "Server error while fetching transaction history." });
  }
});

// PUT: Update the status of a transaction
app.put("/api/tx-status", async (req, res) => {
  try {
    const { txHash, status } = req.body;

    if (!txHash || !status) {
      return res.status(400).json({ message: "Transaction hash and status are required." });
    }
    if (!['success', 'failed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status provided." });
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
});


// --- Start Server ---
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Robust verification endpoint is live at POST /api/verify-tx");
});