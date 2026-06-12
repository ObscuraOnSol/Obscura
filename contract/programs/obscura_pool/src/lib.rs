//! Obscura dark-pool program (placeholder / interface-level).
//!
//! Scope: this program implements the ORDER-PRIVACY mechanic — commit-reveal
//! order entrypoints and the batch-settlement trigger. The FUND-PRIVACY money
//! core (escrow lock/release/refund, the association-set clean-provenance
//! verifier, and the Groth16 settlement verifier) is documented at the
//! interface level only and is intentionally OUT OF SCOPE here. See
//! `contract/README.md` and the Obscura Backend doc, section 9.
//!
//! The association-set dissociation proof on every external exit is
//! load-bearing and non-removable in the production design — it is referenced
//! here but its internals are not implemented in this scaffold.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod obscura_pool {
    use super::*;

    /// Initialise the pool with an authority and a batch interval (seconds).
    pub fn initialize_pool(ctx: Context<InitializePool>, batch_interval: u32) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.batch_interval = batch_interval;
        pool.batch_counter = 0;
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    /// Commit phase: submit only a hash. No size/price/timing is exposed on-chain.
    pub fn commit_order(ctx: Context<CommitOrder>, commit_hash: [u8; 32]) -> Result<()> {
        let order = &mut ctx.accounts.order;
        order.owner = ctx.accounts.owner.key();
        order.commit_hash = commit_hash;
        order.revealed = false;
        order.batch_id = ctx.accounts.pool.batch_counter;
        order.bump = ctx.bumps.order;
        emit!(OrderCommitted {
            owner: order.owner,
            batch_id: order.batch_id,
        });
        Ok(())
    }

    /// Reveal phase: disclose price, qty, and secret. Must hash to the commit.
    pub fn reveal_order(
        ctx: Context<RevealOrder>,
        price: u64,
        qty: u64,
        secret: [u8; 32],
    ) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(!order.revealed, ObscuraError::AlreadyRevealed);

        // commit_hash == keccak256(price || qty || secret)
        let mut data = Vec::with_capacity(8 + 8 + 32);
        data.extend_from_slice(&price.to_le_bytes());
        data.extend_from_slice(&qty.to_le_bytes());
        data.extend_from_slice(&secret);
        let computed = keccak::hash(&data).to_bytes();
        require!(computed == order.commit_hash, ObscuraError::CommitMismatch);

        order.revealed = true;
        order.price = price;
        order.qty = qty;
        emit!(OrderRevealed {
            owner: order.owner,
            batch_id: order.batch_id,
        });
        Ok(())
    }

    /// Authority triggers the next batch auction. Matching + USDC settlement
    /// from escrow happens in the money-core (out of scope); this only advances
    /// the batch counter and emits the trigger event the workers listen for.
    pub fn trigger_batch(ctx: Context<TriggerBatch>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let triggered = pool.batch_counter;
        pool.batch_counter = pool.batch_counter.checked_add(1).unwrap();
        emit!(BatchTriggered { batch_id: triggered });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Pool::SIZE,
        seeds = [b"pool"],
        bump
    )]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(commit_hash: [u8; 32])]
pub struct CommitOrder<'info> {
    #[account(seeds = [b"pool"], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(
        init,
        payer = owner,
        space = 8 + Order::SIZE,
        seeds = [b"order", owner.key().as_ref(), commit_hash.as_ref()],
        bump
    )]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevealOrder<'info> {
    #[account(
        mut,
        seeds = [b"order", owner.key().as_ref(), order.commit_hash.as_ref()],
        bump = order.bump,
        has_one = owner
    )]
    pub order: Account<'info, Order>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct TriggerBatch<'info> {
    #[account(mut, seeds = [b"pool"], bump = pool.bump, has_one = authority)]
    pub pool: Account<'info, Pool>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Pool {
    pub authority: Pubkey,
    pub batch_interval: u32,
    pub batch_counter: u64,
    pub bump: u8,
}
impl Pool {
    pub const SIZE: usize = 32 + 4 + 8 + 1;
}

#[account]
pub struct Order {
    pub owner: Pubkey,
    pub commit_hash: [u8; 32],
    pub revealed: bool,
    pub price: u64,
    pub qty: u64,
    pub batch_id: u64,
    pub bump: u8,
}
impl Order {
    pub const SIZE: usize = 32 + 32 + 1 + 8 + 8 + 8 + 1;
}

#[event]
pub struct OrderCommitted {
    pub owner: Pubkey,
    pub batch_id: u64,
}

#[event]
pub struct OrderRevealed {
    pub owner: Pubkey,
    pub batch_id: u64,
}

#[event]
pub struct BatchTriggered {
    pub batch_id: u64,
}

#[error_code]
pub enum ObscuraError {
    #[msg("order has already been revealed")]
    AlreadyRevealed,
    #[msg("reveal does not match the committed hash")]
    CommitMismatch,
}
