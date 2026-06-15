import { env } from "./env.ts";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction, 
  createTransferInstruction 
} from "@solana/spl-token";
import bs58 from "bs58";

/**
 * Verifies that a given Solana transaction signature represents a successful
 * transfer of a specific amount of USDC from sender to recipient on the correct network.
 */
export async function verifyUsdcTransfer(
  txSig: string,
  expectedSender: string,
  expectedRecipient: string,
  expectedAmountUsdc: number,
  network?: string
): Promise<boolean> {
  const targetNetwork = network || env.network;
  const isMainnet = targetNetwork === "mainnet" || targetNetwork === "mainnet-beta";
  
  // Use configured SOLANA_RPC_URL or default public endpoints
  const rpcUrl = process.env.SOLANA_RPC_URL || 
    (isMainnet ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");
      
  const usdcMint = isMainnet ? env.usdcMint : env.usdcMintDevnet;

  try {
    let retries = 6;
    let result = null;

  while (retries >= 0) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [
            txSig,
            {
              encoding: "jsonParsed",
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0
            }
          ]
        })
      });
      
      const json = (await response.json()) as any;
      if (json.result) {
        result = json.result;
        break;
      }
      
      if (json.error) {
        console.warn(`[solana-verify] RPC returned error (attempt ${6 - retries + 1}):`, json.error);
      } else {
        console.warn(`[solana-verify] Transaction not indexed yet (attempt ${6 - retries + 1}):`, txSig);
      }
    } catch (err) {
      console.warn(`[solana-verify] Fetch error (attempt ${6 - retries + 1}):`, err);
    }
    
    if (retries === 0) break;
    retries--;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  if (!result) {
    console.error("[solana-verify] RPC failed to retrieve transaction after retries:", txSig);
    return false;
  }
    
    // Ensure transaction was successful
    if (result.meta && result.meta.err) {
      console.error("[solana-verify] Transaction failed on-chain:", txSig, result.meta.err);
      return false;
    }
    
    // Extract token balances changes to compute net transfer amount
    const tokenBalances = result.meta?.postTokenBalances || [];
    const preBalances = result.meta?.preTokenBalances || [];
    
    const expectedAmountMicro = Math.round(expectedAmountUsdc * 1_000_000);
    
    // Compute net change in recipient's wallet balance
    let recipientBalanceDiff = 0;
    for (const post of tokenBalances) {
      if (post.owner === expectedRecipient && post.mint === usdcMint) {
        const pre = preBalances.find((p: any) => p.accountIndex === post.accountIndex);
        const preAmount = pre ? Number(pre.uiTokenAmount.amount) : 0;
        const postAmount = Number(post.uiTokenAmount.amount);
        recipientBalanceDiff += (postAmount - preAmount);
      }
    }
    
    // Compute net change in sender's wallet balance
    let senderBalanceDiff = 0;
    for (const pre of preBalances) {
      if (pre.owner === expectedSender && pre.mint === usdcMint) {
        const post = tokenBalances.find((p: any) => p.accountIndex === pre.accountIndex);
        const postAmount = post ? Number(post.uiTokenAmount.amount) : 0;
        const preAmount = Number(pre.uiTokenAmount.amount);
        senderBalanceDiff += (preAmount - postAmount);
      }
    }
    
    // Allow a small buffer (e.g. 10 micro-units) for roundings
    const margin = 10;
    if (Math.abs(recipientBalanceDiff - expectedAmountMicro) <= margin) {
      return true;
    }
    
    console.error(
      `[solana-verify] USDC transfer verification failed for sig: ${txSig}. ` +
      `Expected recipient: ${expectedRecipient}, expected amount micro: ${expectedAmountMicro}. ` +
      `Actual recipient change micro: ${recipientBalanceDiff}, sender change micro: ${senderBalanceDiff}`
    );
    return false;
  } catch (err) {
    console.error("[solana-verify] Error verifying transaction:", err);
    return false;
  }
}

export async function verifyUsdcSplitTransfer(
  txSig: string,
  expectedSender: string,
  expectedRecipient1: string,
  expectedAmount1Usdc: number,
  expectedRecipient2: string,
  expectedAmount2Usdc: number,
  network?: string
): Promise<boolean> {
  const targetNetwork = network || env.network;
  const isMainnet = targetNetwork === "mainnet" || targetNetwork === "mainnet-beta";
  const rpcUrl = process.env.SOLANA_RPC_URL || 
    (isMainnet ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");
  const usdcMint = isMainnet ? env.usdcMint : env.usdcMintDevnet;

  try {
    let retries = 6;
    let result = null;

  while (retries >= 0) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [
            txSig,
            {
              encoding: "jsonParsed",
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0
            }
          ]
        })
      });
      
      const json = (await response.json()) as any;
      if (json.result) {
        result = json.result;
        break;
      }
      
      if (json.error) {
        console.warn(`[solana-verify] RPC returned error (attempt ${6 - retries + 1}):`, json.error);
      } else {
        console.warn(`[solana-verify] Transaction not indexed yet (attempt ${6 - retries + 1}):`, txSig);
      }
    } catch (err) {
      console.warn(`[solana-verify] Fetch error (attempt ${6 - retries + 1}):`, err);
    }
    
    if (retries === 0) break;
    retries--;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  if (!result) {
    console.error("[solana-verify] RPC failed to retrieve split transaction after retries:", txSig);
    return false;
  }
    
    // Ensure transaction was successful
    if (result.meta && result.meta.err) {
      console.error("[solana-verify] Transaction failed on-chain:", txSig, result.meta.err);
      return false;
    }
    
    const tokenBalances = result.meta?.postTokenBalances || [];
    const preBalances = result.meta?.preTokenBalances || [];
    
    const expectedAmount1Micro = Math.round(expectedAmount1Usdc * 1_000_000);
    const expectedAmount2Micro = Math.round(expectedAmount2Usdc * 1_000_000);
    
    // Compute net change in recipient 1's wallet balance
    let recipient1BalanceDiff = 0;
    for (const post of tokenBalances) {
      if (post.owner === expectedRecipient1 && post.mint === usdcMint) {
        const pre = preBalances.find((p: any) => p.accountIndex === post.accountIndex);
        const preAmount = pre ? Number(pre.uiTokenAmount.amount) : 0;
        const postAmount = Number(post.uiTokenAmount.amount);
        recipient1BalanceDiff += (postAmount - preAmount);
      }
    }

    // Compute net change in recipient 2's wallet balance
    let recipient2BalanceDiff = 0;
    for (const post of tokenBalances) {
      if (post.owner === expectedRecipient2 && post.mint === usdcMint) {
        const pre = preBalances.find((p: any) => p.accountIndex === post.accountIndex);
        const preAmount = pre ? Number(pre.uiTokenAmount.amount) : 0;
        const postAmount = Number(post.uiTokenAmount.amount);
        recipient2BalanceDiff += (postAmount - preAmount);
      }
    }
    
    const margin = 10;
    const ok1 = Math.abs(recipient1BalanceDiff - expectedAmount1Micro) <= margin;
    const ok2 = Math.abs(recipient2BalanceDiff - expectedAmount2Micro) <= margin;
    
    if (ok1 && ok2) {
      return true;
    }
    
    console.error(
      `[solana-verify] USDC split transfer verification failed for sig: ${txSig}. ` +
      `Recipient 1 (${expectedRecipient1}): expected ${expectedAmount1Micro}, got ${recipient1BalanceDiff}. ` +
      `Recipient 2 (${expectedRecipient2}): expected ${expectedAmount2Micro}, got ${recipient2BalanceDiff}.`
    );
    return false;
  } catch (err) {
    console.error("[solana-verify] Error verifying split transaction:", err);
    return false;
  }
}

export async function sendUsdcFromService(
  recipientWallet: string,
  amountUsdc: number,
  network?: string
): Promise<string> {
  const targetNetwork = network || env.network;
  const isMainnet = targetNetwork === "mainnet" || targetNetwork === "mainnet-beta";
  const rpcUrl = process.env.SOLANA_RPC_URL || 
    (isMainnet ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");
  
  const connection = new Connection(rpcUrl, "confirmed");
  
  const privateKeyStr = process.env.OBSCURA_SERVICE_PRIVATE_KEY;
  if (!privateKeyStr) {
    throw new Error("OBSCURA_SERVICE_PRIVATE_KEY is not configured on the backend!");
  }
  
  let serviceKeypair: Keypair;
  try {
    if (privateKeyStr.trim().startsWith("[")) {
      const arr = JSON.parse(privateKeyStr);
      serviceKeypair = Keypair.fromSecretKey(Uint8Array.from(arr));
    } else {
      serviceKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyStr.trim()));
    }
  } catch (err) {
    throw new Error("Failed to parse OBSCURA_SERVICE_PRIVATE_KEY: " + (err instanceof Error ? err.message : String(err)));
  }

  const usdcMint = new PublicKey(isMainnet ? env.usdcMint : env.usdcMintDevnet);
  const recipient = new PublicKey(recipientWallet);
  
  // Find sender (service wallet) ATA
  const senderTokenAccounts = await connection.getTokenAccountsByOwner(serviceKeypair.publicKey, { mint: usdcMint });
  let senderAta: PublicKey;
  if (senderTokenAccounts.value.length > 0) {
    senderAta = senderTokenAccounts.value[0].pubkey;
  } else {
    senderAta = getAssociatedTokenAddressSync(usdcMint, serviceKeypair.publicKey);
  }

  // Find recipient ATA
  const recipientTokenAccounts = await connection.getTokenAccountsByOwner(recipient, { mint: usdcMint });
  let recipientAta: PublicKey;
  if (recipientTokenAccounts.value.length > 0) {
    recipientAta = recipientTokenAccounts.value[0].pubkey;
  } else {
    recipientAta = getAssociatedTokenAddressSync(usdcMint, recipient);
  }

  const transaction = new Transaction();
  
  // Check if recipient ATA exists, if not create it
  const accountInfo = await connection.getAccountInfo(recipientAta);
  if (!accountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        serviceKeypair.publicKey,
        recipientAta,
        recipient,
        usdcMint
      )
    );
  }

  const amountMicro = Math.round(amountUsdc * 1_000_000);
  transaction.add(
    createTransferInstruction(
      senderAta,
      recipientAta,
      serviceKeypair.publicKey,
      amountMicro
    )
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = serviceKeypair.publicKey;

  transaction.sign(serviceKeypair);
  
  const txSig = await connection.sendRawTransaction(transaction.serialize());
  
  // Confirm transaction
  await connection.confirmTransaction(txSig, "confirmed");
  
  return txSig;
}

