import Image from "next/image";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Obscura"
      width={40}
      height={40}
      className={cn("invert rounded-[10px]", className)}
    />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-7 w-7" />
      <span className="text-lg font-semibold tracking-[0.08em]">
        Obscura
      </span>
    </span>
  );
}
