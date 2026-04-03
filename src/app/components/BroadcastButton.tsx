import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type BroadcastState = "idle" | "preview" | "live";

export interface BroadcastButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BroadcastState;
  /**
   * Used to override default industrial styles, but preserves active travel physics
   */
  containerClassName?: string;
}

export function BroadcastButton({
  variant = "idle",
  children,
  className,
  containerClassName,
  ...props
}: BroadcastButtonProps) {
  // Define standard industrial tally boundaries entirely in CSS for 0ms latency.
  const variantStyles = {
    idle:
      "bg-slate-900 border-slate-700 text-slate-400 shadow-[inset_1px_1px_rgba(255,255,255,0.05),_2px_2px_0px_#020617] active:shadow-[inset_2px_2px_#020617] active:bg-slate-950",
    preview:
      "bg-slate-900 border-[#00ff00] text-[#00ff00] shadow-[inset_1px_1px_rgba(255,255,255,0.1),_2px_2px_0px_#004400,_0_0_8px_rgba(0,255,0,0.3)] active:shadow-[inset_2px_2px_#004400] active:bg-slate-800",
    live: "bg-[#ff0000] border-[#ff4444] text-white shadow-[inset_1px_1px_rgba(255,255,255,0.3),_2px_2px_0px_#440000,_0_0_12px_rgba(255,0,0,0.5)] active:shadow-[inset_2px_2px_#440000] active:bg-[#cc0000]",
  };

  return (
    <button
      type="button"
      className={cn(
        // Core interaction & box model
        "relative flex items-center justify-center box-border",
        // Industrial Aesthetics: cursor-default overrides web pointer
        "cursor-default select-none outline-none",
        // Layout and shape
        "border-[1.5px] rounded-sm px-6 py-3",
        // Typography matching broadcast switchers (legible, bold)
        "font-mono text-sm uppercase font-extrabold tracking-widest leading-none",
        // Physics: Instant feedback 0ms latency on hover and active
        "transition-none",
        "active:translate-x-[2px] active:translate-y-[2px]",
        // Variant styling routing
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
