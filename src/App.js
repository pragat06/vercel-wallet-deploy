// ✅ FIXED: Removed unused 'useEffect' import
import React, { useState } from "react";
import { ethers } from "ethers";

/* ---------------  ABI & CONSTANTS  --------------- */
const erc20ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];
const USDT_ADDRESS = "0x787a697324dba4ab965c58cd33c13ff5eea6295f";
const USDC_ADDRESS = "0x342e3aA1248AB77E319e3331C6fD3f1F2d4B36B1"; 
const RPC_URL = "https://data-seed-prebsc-1-s1.binance.org:8545";

/* ---------------  MAIN COMPONENT  --------------- */
export default function App() {
  /* ----------  Hooks  ---------- */
  const [txHash, setTxHash] = useState("");
  const [adminWalletAddress, setAdminWalletAddress] = useState("");
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [walletData, setWalletData] = useState([]);
  const [bnbBalances, setBnbBalances] = useState({});
  const [usdtBalances, setUsdtBalances] = useState({});
  const [usdcBalances, setUsdcBalances] = useState({});
  const [receiverAddress, setReceiverAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [qrVisibleAddress, setQrVisibleAddress] = useState(null);
  const [selectedToken, setSelectedToken] = useState("BNB");
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  /* ----------  Handlers (Corrected for Vercel Deployment) ---------- */
  const generateAndSaveWallet = async () => {
    if (!username || !password) return alert("Username and password are required!");
    try {
      const wallet = ethers.Wallet.createRandom();
      const newWallet = {
        username,
        password,
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic.phrase,
      };
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWallet),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || "Failed to create wallet.");
      }
      alert(result.message);
    } catch (error) {
      console.error("Wallet generation failed:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const fetchWallets = async () => {
    if (!username || !password) return alert("Username and password are required!");
    try {
      const res = await fetch(`/api/wallet/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid username or password.");
      }
      setWalletData(data);
      fetchTransactionHistory();
    } catch (error) {
      console.error("Failed to fetch wallets:", error);
      alert(error.message);
      setWalletData([]);
    }
  };

  const getBNBBalance = async (address) => {
    try {
      const balance = await provider.getBalance(address);
      setBnbBalances((p) => ({ ...p, [address]: ethers.formatEther(balance) }));
    } catch {
      setBnbBalances((p) => ({ ...p, [address]: "Error" }));
    }
  };

  const getTokenBalance = async (address, tokenAddress, setState) => {
    try {
      const contract = new ethers.Contract(tokenAddress, erc20ABI, provider);
      const [balance, decimals] = await Promise.all([
        contract.balanceOf(address),
        contract.decimals(),
      ]);
      const formatted = ethers.formatUnits(balance, decimals);
      setState((p) => ({ ...p, [address]: formatted }));
    } catch {
      setState((p) => ({ ...p, [address]: "Error" }));
    }
  };

  const sendBNB = async (pk) => {
    if (!receiverAddress || !amount) return alert("Enter address and amount");
    setIsSending(true);
    
    const wallet = new ethers.Wallet(pk, provider);
    let tx;

    try {
      tx = await wallet.sendTransaction({
        to: receiverAddress,
        value: ethers.parseEther(amount),
      });
      setSuccessMessage(`⏳ Transaction submitted! Waiting for confirmation... Hash: ${tx.hash.slice(0,10)}...`);
      await saveTransactionHistory({
        txHash: tx.hash,
        from: wallet.address,
        to: receiverAddress,
        amount: amount,
        tokenSymbol: 'BNB',
        status: 'pending',
      });
      fetchTransactionHistory();

      tx.wait()
        .then(async (receipt) => {
          setSuccessMessage(receipt.hash);
          await updateTransactionStatus(receipt.hash, 'success');
          getBNBBalance(wallet.address);
          fetchTransactionHistory();
        })
        .catch(async (error) => {
          console.error("BNB transaction failed to confirm:", error);
          if (tx) await updateTransactionStatus(tx.hash, 'failed');
          fetchTransactionHistory();
        });
    } catch (error) {
      alert("Transaction could not be submitted: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const sendToken = async (pk, tokenAddress, onCompleteRefresh) => {
    if (!receiverAddress || !amount) return alert("Enter address and amount");
    setIsSending(true);

    const wallet = new ethers.Wallet(pk, provider);
    let tx;

    try {
      const contract = new ethers.Contract(tokenAddress, erc20ABI, wallet);
      const decimals = await contract.decimals();
      const tokenSymbol = tokenAddress === USDT_ADDRESS ? 'USDT' : 'USDC';

      tx = await contract.transfer(receiverAddress, ethers.parseUnits(amount, decimals));
      setSuccessMessage(`⏳ Transaction submitted! Waiting for confirmation... Hash: ${tx.hash.slice(0,10)}...`);
      await saveTransactionHistory({
        txHash: tx.hash,
        from: wallet.address,
        to: receiverAddress,
        amount: amount,
        tokenSymbol: tokenSymbol,
        status: 'pending',
      });
      fetchTransactionHistory();

      tx.wait()
        .then(async (receipt) => {
          setSuccessMessage(receipt.hash);
          await updateTransactionStatus(receipt.hash, 'success');
          onCompleteRefresh(wallet.address, tokenAddress);
          fetchTransactionHistory();
        })
        .catch(async (error) => {
          console.error("Token transaction failed to confirm:", error);
          if (tx) await updateTransactionStatus(tx.hash, 'failed');
          fetchTransactionHistory();
        });
    } catch (error) {
      alert("Transaction could not be submitted: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = (privateKey) => {
    switch (selectedToken) {
      case "BNB":
        sendBNB(privateKey);
        break;
      case "USDT":
        sendToken(privateKey, USDT_ADDRESS, (addr, tokenAddr) => getTokenBalance(addr, tokenAddr, setUsdtBalances));
        break;
      case "USDC":
        sendToken(privateKey, USDC_ADDRESS, (addr, tokenAddr) => getTokenBalance(addr, tokenAddr, setUsdcBalances));
        break;
      default:
        alert("Invalid token selected.");
    }
  };

  const saveTransactionHistory = async (txDetails) => {
    try {
      const response = await fetch("/api/tx-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txDetails),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Failed to save transaction.");
      }
    } catch (error) {
      console.error("Error sending transaction history to server:", error.message);
    }
  };

  const handleCopyToClipboard = async (textToCopy) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      alert("Failed to copy to clipboard.");
    }
  };

  const handleVerification = async () => {
    if (!txHash || !adminWalletAddress) return alert("Please provide a transaction hash and an admin address.");
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const response = await fetch("/api/verify-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, adminWalletAddress }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "An error occurred from the server.");
      }
      setVerificationResult(result);
    } catch (error) {
      console.error("Verification failed:", error);
      setVerificationResult({
        isValid: false,
        message: `❌ CLIENT ERROR: ${error.message}`,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchTransactionHistory = async () => {
    if (!username) return;
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`/api/tx-history/${username}`);
      if (!res.ok) {
          if(res.status === 404) {
              setTransactionHistory([]);
              return;
          }
        throw new Error("Could not fetch history.");
      }
      const data = await res.json();
      setTransactionHistory(data);
    } catch (error) {
      console.error("Failed to fetch transaction history:", error);
      setTransactionHistory([]);
    } finally {
      setIsHistoryLoading(false); 
    }
  };

  const updateTransactionStatus = async (txHash, status) => {
    try {
      await fetch("/api/tx-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, status }),
      });
    } catch (error) {
      console.error(`Failed to update status for ${txHash}:`, error);
    }
  };
  
  /* ----------  Render  ---------- */
  return (
    <div className="app">
      {successMessage && (
        <div className="toast">
          <div className="toast-content">
            {successMessage.startsWith('0x') ? `✅ Transaction Confirmed!` : successMessage}
            {successMessage.startsWith('0x') && 
              <a href={`https://testnet.bscscan.com/tx/${successMessage}`} target="_blank" rel="noopener noreferrer">
                {successMessage.slice(0, 10)}…{successMessage.slice(-6)}
              </a>
            }
          </div>
          <div className="toast-actions">
            {successMessage.startsWith('0x') &&
              <button onClick={() => handleCopyToClipboard(successMessage)} className="toast-btn" disabled={isCopied}>
                {isCopied ? "Copied!" : "Copy Hash"}
              </button>
            }
            <button onClick={() => setSuccessMessage("")} className="toast-btn">OK</button>
          </div>
        </div>
      )}

      <h1 className="title">🌐 Web3 Wallet (BNB, USDT & USDC)</h1>

      <div className="controls">
        <div className="input-wrapper">
          <input type="text" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} className="input"/>
          {username.length > 0 && (<button onClick={() => setUsername("")} className="btn-clear">×</button>)}
        </div>
        
        <div className="input-wrapper">
          <input type={isPasswordVisible ? "text" : "password"} placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} className="input"/>
          <button onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="btn-toggle-visibility">{isPasswordVisible ? "Hide" : "Show"}</button>
          {password.length > 0 && (<button onClick={() => setPassword("")} className="btn-clear">×</button>)}
        </div>

        <button onClick={generateAndSaveWallet} className="btn primary">Generate Wallet</button>
        <button onClick={fetchWallets} className="btn secondary">Fetch My Wallets</button>
      </div>

     {walletData.length > 0 && (
        <div className="wallet-grid">
          <h3>Wallets for: {username}</h3>
          {walletData.map((w, i) => (
            <div key={i} className="wallet-card">
              <div className="address-row">
                <p><span>Address:</span> {w.address}</p>
                <button onClick={() => setQrVisibleAddress(qrVisibleAddress === w.address ? null : w.address)} className="btn ghost small">
                  {qrVisibleAddress === w.address ? "Hide QR" : "Show QR"}
                </button>
              </div>

              {qrVisibleAddress === w.address && (
                <div className="qr-code-display">
                  <img className="qr-code-image" src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${w.address}&qzone=1`} alt="Wallet Address QR Code"/>
                  <p className="qr-address-label">Scan to send funds to this address</p>
                </div>
              )}

              <p><span>Private Key:</span> {w.privateKey}</p>
              <div className="balance-row">
                <button onClick={() => getBNBBalance(w.address)} className="btn ghost">BNB Balance</button>
                <span>{bnbBalances[w.address] ?? "—"} BNB</span>
              </div>
              <div className="balance-row">
                <button onClick={() => getTokenBalance(w.address, USDT_ADDRESS, setUsdtBalances)} className="btn ghost">USDT Balance</button>
                <span>{usdtBalances[w.address] ?? "—"} USDT</span>
              </div>
              <div className="balance-row">
                <button onClick={() => getTokenBalance(w.address, USDC_ADDRESS, setUsdcBalances)} className="btn ghost">USDC Balance</button>
                <span>{usdcBalances[w.address] ?? "—"} USDC</span>
              </div>
              <hr />
              
              <h4>Transfer</h4>
              <div className="input-wrapper full">
                <input placeholder="Receiver Address" value={receiverAddress} onChange={(e) => setReceiverAddress(e.target.value)} className="input full"/>
                {receiverAddress.length > 0 && (<button onClick={() => setReceiverAddress("")} className="btn-clear">×</button>)}
              </div>
              <div className="input-wrapper half">
                <input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="input half"/>
                {amount.length > 0 && (<button onClick={() => setAmount("")} className="btn-clear">×</button>)}
              </div>
              <div className="action-btns">
                <select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)} className="select-token">
                  <option value="BNB">BNB</option>
                  <option value="USDT">USDT</option>
                  <option value="USDC">USDC</option>
                </select>
                <button onClick={() => handleSend(w.privateKey)} disabled={isSending} className="btn accent send-btn">
                  {isSending ? "Sending…" : `Send ${selectedToken}`}
                </button>
              </div>

              <hr />
              <div>
                <h4 style={{ marginBottom: '1rem' }}>Verify Transaction</h4>
                <div className="input-wrapper full">
                  <input type="text" placeholder="Enter Transaction Hash (e.g., 0x...)" value={txHash} onChange={(e) => setTxHash(e.target.value)} className="input full"/>
                  {txHash.length > 0 && (<button onClick={() => setTxHash("")} className="btn-clear">×</button>)}
                </div>
                <div className="input-wrapper full">
                  <input type="text" placeholder="Enter Expected Sender (Admin) Address" value={adminWalletAddress} onChange={(e) => setAdminWalletAddress(e.target.value)} className="input full"/>
                  {adminWalletAddress.length > 0 && (<button onClick={() => setAdminWalletAddress("")} className="btn-clear">×</button>)}
                </div>
                <button onClick={handleVerification} className="btn primary" disabled={isVerifying}>
                  {isVerifying ? "Verifying…" : "Verify Transaction"}
                </button>

                {verificationResult && (
                  <div className={`verification-result ${verificationResult.isValid ? 'valid' : 'invalid'}`}>
                    <p>{verificationResult.message}</p>
                    {verificationResult.details && (
                      <div className="tx-details">
                        <p><strong>Actual Sender:</strong> {verificationResult.details.from}</p>
                        <p><strong>Receiver:</strong> {verificationResult.details.to}</p>
                        <p><strong>Amount:</strong> {verificationResult.details.amount} {verificationResult.details.tokenSymbol}</p>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="history-section">
                  <div className="history-header">
                    <h4>Transaction History</h4>
                    <button onClick={fetchTransactionHistory} className="btn ghost small" disabled={isHistoryLoading}>
                      {isHistoryLoading ? 'Refreshing...' : 'Refresh History'}
                    </button>
                  </div>

                  <div className="history-list">
                    {isHistoryLoading ? (<p className="no-history">Loading history...</p>) : (
                      transactionHistory.filter(tx => tx.from.toLowerCase() === w.address.toLowerCase()).length > 0 ? (
                        transactionHistory
                          .filter(tx => tx.from.toLowerCase() === w.address.toLowerCase())
                          .map(tx => (
                            <div key={tx.txHash} className={`history-item status-${tx.status}`}>
                              <div className="history-item-row">
                                <span>
                                  {tx.status === 'success' && '✅ '}
                                  {tx.status === 'pending' && '⏳ '}
                                  {tx.status === 'failed' && '❌ '}
                                  Status:
                                </span>
                                <span className={`status-text status-${tx.status}`}>{tx.status}</span>
                              </div>
                              <div className="history-item-row">
                                <span>To:</span>
                                <span className="history-address">{tx.to.slice(0, 6)}...{tx.to.slice(-4)}</span>
                              </div>
                              <div className="history-item-row">
                                <span>Amount:</span>
                                <span className="history-amount">{tx.amount} {tx.tokenSymbol}</span>
                              </div>
                              <a href={`https://testnet.bscscan.com/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" className="history-link">
                                View on BscScan
                              </a>
                            </div>
                          )) 
                      ) : (
                        <p className="no-history">No transactions sent from this wallet yet.</p>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{css}</style>
    </div>
  );
}

/* ---------------  CSS (NO CHANGES)  --------------- */
const css = `
:root {
  --bg: #0f0f13;
  --surface: rgba(255,255,255,.05);
  --border: rgba(255,255,255,.08);
  --accent: #00f5a0;
  --primary: #1e90ff;
  --text: #f1f1f1;
  --radius: 16px;
  --font: "Inter", system-ui, sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: var(--font); }

.select-token {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: .85rem 3rem .85rem 1.2rem;
  color: var(--text);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23f1f1f1%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.4-5.4-13z%22/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1.2rem top 50%;
  background-size: .65rem auto;
  flex-shrink: 0;
}

.select-token:hover {
  border-color: var(--accent);
}

.action-btns {
  display: flex;
  gap: .75rem;
  align-items: stretch; /* Makes select and button the same height */
}

/* Make the send button grow to fill the remaining space */
.send-btn {
  flex-grow: 1; 
}

.app { min-height: 100vh; padding: 2rem; }
.title { text-align: center; margin-bottom: 2rem; font-size: 2rem; }

/* --- Simplified QR Code Styles --- */
.address-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.btn.small {
  padding: .4rem .8rem;
  font-size: 0.8rem;
  border-radius: 12px;
  flex-shrink: 0;
}

.qr-code-display {
  margin-top: 1rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  animation: fadeIn .5s ease;
}

.qr-code-image {
  background: white;
  border: 1px solid var(--border);
  padding: 10px; /* Gives a nice white margin around the code */
  border-radius: var(--radius);
  width: 220px;
  height: 220px;
}

.qr-address-label {
  font-size: 0.9rem;
  color: #ccc;
  text-align: center;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Toast CSS */
.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent);
  color: #000;
  padding: 14px 24px;
  border-radius: var(--radius);
  z-index: 1000;
  animation: slideDown .4s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 450px;
  gap: 1.5rem;
}

@keyframes slideDown {
  from { transform: translate(-50%, -100%); opacity: 0; }
  to   { transform: translate(-50%, 0);   opacity: 1; }
}

.toast a { 
  color: #000; 
  text-decoration: underline; 
  font-weight: 700;
  margin-left: 0.5rem;
}

.toast-content {
  font-weight: 600;
  white-space: nowrap;
}

.toast-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toast-btn {
  background: rgba(0,0,0,0.1);
  border: 1px solid rgba(0,0,0,0.2);
  color: #000;
  padding: 6px 16px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 700;
  transition: all .2s;
}

.toast-btn:hover {
  background: rgba(0,0,0,0.2);
}

.toast-btn:disabled {
  background: rgba(0,0,0,0.15);
  cursor: default;
  color: rgba(0,0,0,0.7);
}

/* Controls */
.controls {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.input-wrapper.full { width: 100%; margin-bottom: .5rem; }
.input-wrapper.half {
width: 50%; 
margin-bottom: 0.75rem;}

.input {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: .85rem 1.2rem;
  color: var(--text);
  font-size: 1rem;
  width: 100%;
  padding-right: 6rem;
}
.input.full, .input.half { width: 100%; } 

.btn {
  cursor: pointer;
  border: none;
  border-radius: var(--radius);
  padding: .85rem 1.4rem;
  font-size: 1rem;
  font-weight: 600;
  transition: .3s;
}

.btn-clear {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #888;
  font-size: 1.5rem;
  font-weight: 400;
  cursor: pointer;
  padding: 0 .5rem;
  line-height: 1;
}

.btn-toggle-visibility {
  position: absolute;
  right: 45px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0 .5rem;
}

.btn.primary   { background: var(--primary); color: #fff; }
.btn.secondary { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
.btn.accent    { background: var(--accent); color: #000; }
.btn.ghost     { background: transparent; color: var(--text); border: 1px solid var(--border); }
.btn:hover     { filter: brightness(1.15); }

/* Verification UI */
.verification-result {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: calc(var(--radius) / 2);
  font-weight: 600;
  border: 1px solid transparent;
  word-wrap: break-word;
}

.verification-result.valid {
  background: rgba(0, 245, 160, 0.1);
  color: var(--accent);
  border-color: var(--accent);
}

.verification-result.invalid {
  background: rgba(255, 80, 80, 0.1);
  color: #ff5050;
  border-color: #ff5050;
}

.tx-details {
  margin-top: 1rem;
  font-weight: 400;
  color: var(--text);
  line-height: 1.6;
  font-size: 0.9rem;
}

/* Wallet Grid */
.wallet-grid {
  display: grid;
  gap: 2rem;
  max-width: 720px;
  margin: 0 auto;
}
.wallet-grid h3 { text-align: center; margin-bottom: 1rem; }

.wallet-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  backdrop-filter: blur(12px);
}
.wallet-card p { margin-bottom: .5rem; overflow-wrap: break-word; }
.wallet-card hr { border: none; border-top: 1px solid var(--border); margin: 1.2rem 0; }

.balance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: .8rem;
}

.action-btns {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
}
  /* History Section */
.history-section {
  margin-top: 1.5rem;
}
  .history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.history-section h4 {
  margin-bottom: 0rem;
}
.history-list {
  margin-top: 1rem;
  max-height: 250px; /* Limit height and make it scrollable */
  overflow-y: auto;
  padding-right: 10px; /* Space for the scrollbar */
}
.history-item {
  background: rgba(0,0,0,0.2);
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: .75rem;
  border: 1px solid var(--border);
}
.history-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}
.history-item-row span:first-child {
  color: #aaa;
}
.history-amount {
  font-weight: 700;
}
.history-address {
  font-family: monospace;
}
.history-link {
  display: inline-block;
  margin-top: .5rem;
  font-size: .9rem;
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
}
.history-link:hover {
  text-decoration: underline;
}
.no-history {
  color: #888;
  text-align: center;
  padding: 1.5rem 0;
}

/* Status text styling */
.status-text {
  font-weight: 700;
  text-transform: capitalize;
}
.status-text.status-success { color: var(--accent); }
.status-text.status-pending { color: #f39c12; }
.status-text.status-failed { color: #e74c3c; }

.history-item.status-pending { border-left: 4px solid #f39c12; }
.history-item.status-success { border-left: 4px solid var(--accent); }
.history-item.status-failed { border-left: 4px solid #e74c3c; }
`;