"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { Trophy, Medal, Award, Eye, HelpCircle, Loader2 } from "lucide-react";
import { leaderboardApi, type LeaderboardRow } from "@/lib/api";
import { DataError } from "@/components/marketplace/marketplace-live";
import { FadeIn } from "@/components/motion";
import { shortHash } from "@/lib/utils";

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await leaderboardApi.get();
        setLeaderboard(data.leaderboard);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-amber-400 animate-bounce" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />;
    return <span className="font-mono text-xs text-muted-foreground w-5 text-center">{rank}</span>;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40";
    if (rank === 2) return "border-slate-300/20 bg-slate-300/5 hover:border-slate-300/40";
    if (rank === 3) return "border-amber-700/20 bg-amber-700/5 hover:border-amber-700/40";
    return "border-border/40 bg-card/10 hover:border-primary/20";
  };

  return (
    <AppFrame active="/leaderboard" title="Practice Leaderboard">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Paper Trading Standings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Top operators and developers executing simulated compute leases in Practice Mode.
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-xs text-primary max-w-fit font-mono">
            <Eye className="h-3.5 w-3.5" /> Live Sandbox data
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading standings...</p>
            </div>
          </div>
        ) : error ? (
          <DataError message={error} />
        ) : leaderboard && leaderboard.length === 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border bg-card/20 p-10 text-center">
            <div className="max-w-md">
              <HelpCircle className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
              <h3 className="text-sm font-semibold">No participants yet</h3>
              <p className="text-xs text-muted-foreground mt-2">
                Enable Practice Mode in your settings or sidebar, run a mock compute lease order, and watch yourself clear onto the board!
              </p>
            </div>
          </div>
        ) : (
          <FadeIn>
            <div className="space-y-3">
              {/* Leaderboard Table Headers */}
              <div className="grid grid-cols-12 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 font-mono">
                <div className="col-span-1 text-center">Rank</div>
                <div className="col-span-4 sm:col-span-5">Wallet Identity</div>
                <div className="col-span-2 text-right">Leases</div>
                <div className="col-span-2 text-right">Hours Leased</div>
                <div className="col-span-3 sm:col-span-2 text-right">Simulated Spend</div>
              </div>

              {/* Leaderboard Row Entries */}
              <div className="space-y-2">
                {leaderboard?.map((row) => (
                  <div
                    key={row.wallet}
                    className={`grid grid-cols-12 items-center rounded-xl border px-5 py-3.5 transition-all duration-300 ${getRankStyle(row.rank)}`}
                  >
                    {/* Rank */}
                    <div className="col-span-1 flex justify-center">
                      {getRankIcon(row.rank)}
                    </div>
                    
                    {/* Masked Wallet Address */}
                    <div className="col-span-4 sm:col-span-5 min-w-0">
                      <span className="font-mono text-xs font-semibold text-foreground truncate block">
                        {row.wallet.startsWith("paper_") 
                          ? `paper_…${row.wallet.slice(-8)}`
                          : shortHash(row.wallet, 4, 4)
                        }
                      </span>
                      {row.rank <= 3 && (
                        <span className="text-[9px] uppercase tracking-widest text-primary font-bold">
                          {row.rank === 1 ? "Alpha Operator" : row.rank === 2 ? "Beta Builder" : "Gamma Node"}
                        </span>
                      )}
                    </div>

                    {/* Total Leases */}
                    <div className="col-span-2 text-right font-mono text-xs">
                      {row.totalLeases}
                    </div>

                    {/* Total Leased Hours */}
                    <div className="col-span-2 text-right font-mono text-xs font-semibold">
                      {row.totalHours}h
                    </div>

                    {/* Simulated Spend */}
                    <div className="col-span-3 sm:col-span-2 text-right font-mono text-xs font-bold text-emerald-500">
                      ${row.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        )}
      </div>
    </AppFrame>
  );
}
