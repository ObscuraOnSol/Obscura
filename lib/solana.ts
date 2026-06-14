import { Transaction, PublicKey, TransactionInstruction, SystemProgram } from "@solana/web3.js";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8kn");
const RENT_SYSVAR_ID = new PublicKey("SysvarRent111111111111111111111111111111111");

export const getUsdcMint = () => {
  const network = process.env.NEXT_PUBLIC_NETWORK || "devnet";
  if (network === "mainnet" || network === "mainnet-beta") {
    return process.env.NEXT_PUBLIC_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  }
  return process.env.NEXT_PUBLIC_USDC_MINT_DEVNET || "Gh9ZwEmd5Tg4Pq9d9Kh7X4T6PHW3cWUKAdJ1z7X3J42s";
};

export function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
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

export async function performUsdcTransfer(
  connection: any,
  publicKey: PublicKey,
  sendTransaction: any,
  recipientAddress: string,
  amountUsdc: number
): Promise<string> {
  const mintAddress = getUsdcMint();
  const mint = new PublicKey(mintAddress);
  const recipient = new PublicKey(recipientAddress);
  
  const senderAta = getAssociatedTokenAddress(mint, publicKey);
  const recipientAta = getAssociatedTokenAddress(mint, recipient);
  
  const transaction = new Transaction();
  
  // Check if recipient ATA exists
  const accountInfo = await connection.getAccountInfo(recipientAta);
  if (!accountInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        publicKey,
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
      publicKey,
      amountMicro
    )
  );
  
  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = publicKey;
  
  const signature = await sendTransaction(transaction, connection);
  
  // Wait for confirmation
  await connection.confirmTransaction({
    signature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }, "confirmed");
  
  return signature;
}
