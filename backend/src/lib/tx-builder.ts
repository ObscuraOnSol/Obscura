import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { env } from "./env.ts";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8kn");
const RENT_SYSVAR_ID = new PublicKey("SysvarRent111111111111111111111111111111111");

function getUsdcMint(): PublicKey {
  const isMainnet = env.network === "mainnet" || env.network === "mainnet-beta";
  return new PublicKey(isMainnet ? env.usdcMint : env.usdcMintDevnet);
}

function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

function createAssociatedTokenAccountInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: RENT_SYSVAR_ID, isSigner: false, isWritable: false }
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0)
  });
}

function createTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: number
): TransactionInstruction {
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0); // Transfer instruction index is 3
  
  // Write uint64 amount (little endian)
  const low = amount % 0x100000000;
  const high = Math.floor(amount / 0x100000000);
  data.writeUInt32LE(low, 1);
  data.writeUInt32LE(high, 5);
  
  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false }
    ],
    programId: TOKEN_PROGRAM_ID,
    data
  });
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
  
  const senderAta = getAssociatedTokenAddress(mint, payer);
  const recipient1Ata = getAssociatedTokenAddress(mint, recipient1);
  const recipient2Ata = getAssociatedTokenAddress(mint, recipient2);
  
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
