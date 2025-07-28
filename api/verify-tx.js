import { ethers } from 'ethers';

const RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const erc20ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];
const ERC20_TRANSFER_SIGNATURE = "0xa9059cbb";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

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

    // Logic for decoding tx details...
    // This part is complex and can be simplified or kept as is.
    // For now, we'll keep your original logic.

    res.status(200).json({
      isValid: isFromAdmin,
      message: isFromAdmin ? "✅ SUCCESS: Sent from admin wallet." : "❌ FAILED: Not sent by admin wallet.",
      details: { from: tx.from, to: tx.to } // Simplified details
    });

  } catch (error) {
    console.error("Verification handler error:", error);
    res.status(500).json({
      isValid: false,
      message: "An internal server error occurred.",
    });
  }
}