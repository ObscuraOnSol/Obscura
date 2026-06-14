import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction, 
  createTransferInstruction 
} from "@solana/spl-token";
import { env } from "./env.ts";

function getUsdcMint(): PublicKey {
  const isMainnet = env.network === "mainnet" || env.network === "mainnet-beta";
  return new PublicKey(isMainnet ? env.usdcMint : env.usdcMintDevnet);
}

export async function buildSplitTransferTx(
  payerWallet: string,
  recipient1Address: string,
  amount1Usdc: number,
  recipient2Address: string,
  amount2Usdc: number
): Promise<string> {
  const isMainnet = env.network === "mainnet" || env.network === "mainnet-beta";
  const rpcUrl = process.env.SOLANA_RPC_URL || 
    (isMainnet ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");
  
  const connection = new Connection(rpcUrl, "confirmed");
  const payer = new PublicKey(payerWallet);
  const mint = getUsdcMint();
  
  const recipient1 = new PublicKey(recipient1Address);
  const recipient2 = new PublicKey(recipient2Address);
  
  // Find sender token account dynamically (handle non-standard/legacy token accounts)
  const tokenAccounts = await connection.getTokenAccountsByOwner(payer, { mint });
  let senderAta: PublicKey;
  if (tokenAccounts.value.length > 0) {
    senderAta = tokenAccounts.value[0].pubkey;
  } else {
    senderAta = getAssociatedTokenAddressSync(mint, payer);
  }

  const recipient1Ata = getAssociatedTokenAddressSync(mint, recipient1);
  const recipient2Ata = getAssociatedTokenAddressSync(mint, recipient2);
  
  const transaction = new Transaction();
  
  // Check if recipient1 ATA exists
  const accountInfo1 = await connection.getAccountInfo(recipient1Ata);
  if (!accountInfo1) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer,
        recipient1Ata,
        recipient1,
        mint
      )
    );
  }

  // Check if recipient2 ATA exists
  const accountInfo2 = await connection.getAccountInfo(recipient2Ata);
  if (!accountInfo2) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer,
        recipient2Ata,
        recipient2,
        mint
      )
    );
  }
  
  const amount1Micro = Math.round(amount1Usdc * 1_000_000);
  const amount2Micro = Math.round(amount2Usdc * 1_000_000);
  
  transaction.add(
    createTransferInstruction(
      senderAta,
      recipient1Ata,
      payer,
      amount1Micro
    )
  );

  transaction.add(
    createTransferInstruction(
      senderAta,
      recipient2Ata,
      payer,
      amount2Micro
    )
  );
  
  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = payer;
  
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false
  });
  
  return serialized.toString("base64");
}

export async function buildSingleTransferTx(
  payerWallet: string,
  recipientAddress: string,
  amountUsdc: number
): Promise<string> {
  const isMainnet = env.network === "mainnet" || env.network === "mainnet-beta";
  const rpcUrl = process.env.SOLANA_RPC_URL || 
    (isMainnet ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");
  
  const connection = new Connection(rpcUrl, "confirmed");
  const payer = new PublicKey(payerWallet);
  const mint = getUsdcMint();
  const recipient = new PublicKey(recipientAddress);
  
  // Find sender token account dynamically
  const tokenAccounts = await connection.getTokenAccountsByOwner(payer, { mint });
  let senderAta: PublicKey;
  if (tokenAccounts.value.length > 0) {
    senderAta = tokenAccounts.value[0].pubkey;
  } else {
    senderAta = getAssociatedTokenAddressSync(mint, payer);
  }

  const recipientAta = getAssociatedTokenAddressSync(mint, recipient);
  
  const transaction = new Transaction();
  
  // Check if recipient ATA exists
  const accountInfo = await connection.getAccountInfo(recipientAta);
  if (!accountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer,
        recipientAta,
        recipient,
        mint
      )
    );
  }
  
  const amountMicro = Math.round(amountUsdc * 1_000_000);
  
  transaction.add(
    createTransferInstruction(
      senderAta,
      recipientAta,
      payer,
      amountMicro
    )
  );
  
  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = payer;
  
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false
  });
  
  return serialized.toString("base64");
}

