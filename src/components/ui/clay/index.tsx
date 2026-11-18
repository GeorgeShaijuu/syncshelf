"use client";

import * as React from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ==========================================
// 1. CLAY BUTTON
// ==========================================
export interface ClayButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "peach" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const ClayButton = React.forwardRef<HTMLButtonElement, ClayButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "h-7 px-3 text-[11px] gap-1.5 font-semibold",
      md: "h-8 px-4 text-xs gap-2 font-semibold",
      lg: "h-10 px-5 text-sm gap-2.5 font-bold",
    };

    const variantClasses = {
      primary: "clay-btn-primary",
      secondary: "clay-btn-secondary",
      peach: "clay-btn-peach",
      destructive:
        "bg-gradient-to-b from-[#F26E5C] to-[#EE624E] text-white border border-[#D94F3C] shadow-[0_4px_12px_rgba(238,98,78,0.3),inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-2px_3px_rgba(0,0,0,0.15)] hover:from-[#F57968] hover:to-[#EB5540] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-xs",
      ghost:
        "bg-transparent text-[#24211F] hover:bg-[#F5EFE5] active:scale-95 border border-transparent shadow-none",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-full select-none cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F58B35]/40 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {children}
      </button>
    );
  }
);
ClayButton.displayName = "ClayButton";

// ==========================================
// 2. CLAY ICON BUTTON
// ==========================================
export interface ClayIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  activeVariant?: "peach" | "orange" | "dark";
  size?: "sm" | "md" | "lg";
}

export const ClayIconButton = React.forwardRef<
  HTMLButtonElement,
  ClayIconButtonProps
>(
  (
    {
      className,
      active = false,
      activeVariant = "peach",
      size = "md",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "h-7 w-7 rounded-lg",
      md: "h-8 w-8 rounded-xl",
      lg: "h-9 w-9 rounded-xl",
    };

    let activeClass = "";
    if (active) {
      if (activeVariant === "peach") {
        activeClass =
          "bg-gradient-to-b from-[#FFE4D0] to-[#FFDDC5] text-[#F58B35] border border-[#F5C6A3] shadow-[0_2px_8px_rgba(245,139,53,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]";
      } else if (activeVariant === "orange") {
        activeClass =
          "bg-gradient-to-b from-[#F99849] to-[#F58B35] text-white border border-[#E57A24] shadow-[0_3px_10px_rgba(245,139,53,0.35),inset_0_1px_1px_rgba(255,255,255,0.5)]";
      } else {
        activeClass =
          "bg-[#24211F] text-[#FFFEFA] border border-black/30 shadow-[0_3px_10px_rgba(0,0,0,0.25)]";
      }
    } else {
      activeClass =
        "bg-transparent text-[#817A72] hover:text-[#24211F] hover:bg-[#F5EFE5]";
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "clay-icon-btn inline-flex items-center justify-center shrink-0 select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F58B35]/40 disabled:opacity-50 disabled:pointer-events-none",
          sizeClasses[size],
          activeClass,
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
ClayIconButton.displayName = "ClayIconButton";

// ==========================================
// 3. CLAY SURFACE
// ==========================================
export interface ClaySurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "soft" | "cream";
}

export function ClaySurface({
  className,
  variant = "soft",
  children,
  ...props
}: ClaySurfaceProps) {
  return (
    <div
      className={cn(
        variant === "cream" ? "clay-surface-cream" : "clay-surface",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ==========================================
// 4. CLAY CARD
// ==========================================
export interface ClayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function ClayCard({
  className,
  elevated = false,
  children,
  ...props
}: ClayCardProps) {
  return (
    <div
      className={cn(
        "clay-card",
        elevated && "shadow-[0_8px_20px_-2px_rgba(36,33,31,0.06)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ==========================================
// 5. CLAY INPUT
// ==========================================
export interface ClayInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const ClayInput = React.forwardRef<HTMLInputElement, ClayInputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full space-y-1">
        <input
          ref={ref}
          className={cn(
            "clay-inset w-full h-9 px-3.5 text-xs font-medium rounded-xl text-[#24211F] placeholder:text-[#AAA197] transition-all focus:outline-none focus:bg-[#FFFEFA]",
            error && "border-[#EE624E] focus:border-[#EE624E] focus:ring-[#EE624E]/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-[11px] text-[#EE624E]">{error}</p>}
      </div>
    );
  }
);
ClayInput.displayName = "ClayInput";

// ==========================================
// 6. CLAY SEARCH
// ==========================================
export interface ClaySearchProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const ClaySearch = React.forwardRef<HTMLInputElement, ClaySearchProps>(
  ({ className, value, onClear, onChange, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#817A72] stroke-[2]" />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={onChange}
          className={cn(
            "clay-inset w-full h-9 pl-9 pr-8 text-xs font-medium rounded-full text-[#24211F] placeholder:text-[#AAA197] transition-all focus:outline-none focus:bg-[#FFFEFA]",
            className
          )}
          {...props}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#817A72] hover:text-[#24211F] active:scale-90 transition-transform"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }
);
ClaySearch.displayName = "ClaySearch";

// ==========================================
// 7. CLAY TABS (Segmented Control)
// ==========================================
export interface ClayTabsProps<T extends string> {
  options: { label: string; value: T; icon?: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function ClayTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: ClayTabsProps<T>) {
  return (
    <div
      className={cn(
        "clay-inset inline-flex items-center p-1 rounded-full gap-0.5 select-none",
        className
      )}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-7 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer focus:outline-none",
              isSelected
                ? "bg-gradient-to-b from-[#FFE4D0] to-[#FFDDC5] text-[#F58B35] border border-[#F5C6A3] shadow-[0_2px_6px_rgba(245,139,53,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]"
                : "text-[#817A72] hover:text-[#24211F] hover:bg-white/40"
            )}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ==========================================
// 8. CLAY SWITCH (Toggle)
// ==========================================
export interface ClaySwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function ClaySwitch({
  checked,
  onChange,
  disabled = false,
  className,
}: ClaySwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F58B35]/40 disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "bg-[#F58B35] border-[#E57A24] shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]"
          : "clay-inset",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-[0_2px_4px_rgba(36,33,31,0.15),inset_0_1px_1px_rgba(255,255,255,1)] transform ring-0 transition duration-200 ease-in-out mt-[1px] ml-[1px]",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ==========================================
// 9. CLAY BADGE
// ==========================================
export interface ClayBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "text"
    | "code"
    | "link"
    | "image"
    | "audio"
    | "video"
    | "file"
    | "default";
}

export function ClayBadge({
  className,
  variant = "default",
  children,
  ...props
}: ClayBadgeProps) {
  const variantStyles = {
    text: "bg-[#FFE8D6] text-[#A65E26] border border-[#FCD5B5]",
    code: "bg-[#E9DDF6] text-[#6948A4] border border-[#D5C2EC]",
    link: "bg-[#FFF2D4] text-[#9A6D14] border border-[#FDE3A8]",
    image: "bg-[#FFE5E2] text-[#B73D30] border border-[#F9CBC6]",
    audio: "bg-[#FCE8EB] text-[#A43B4E] border border-[#F8C8D0]",
    video: "bg-[#FEE4E2] text-[#B92F24] border border-[#F9C3BE]",
    file: "bg-[#FEF0D4] text-[#986415] border border-[#F9DC9F]",
    default: "bg-[#F5EFE5] text-[#817A72] border border-[#EDE5D9]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold shadow-[0_1px_2px_rgba(36,33,31,0.04),inset_0_1px_1px_rgba(255,255,255,0.7)] select-none",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// ==========================================
// 10. CLAY EMPTY STATE
// ==========================================
export interface ClayEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function ClayEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: ClayEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-3xl border border-dashed border-[#DDD5C7] bg-[#FFFEFA]/50 shadow-[inset_0_2px_6px_rgba(36,33,31,0.02)]",
        className
      )}
    >
      {icon && (
        <div className="h-12 w-12 rounded-2xl bg-[#F5EFE5] border border-[#EDE5D9] flex items-center justify-center text-[#817A72] mb-3 shadow-[0_2px_8px_rgba(36,33,31,0.04),inset_0_1px_1px_rgba(255,255,255,0.9)]">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-bold text-[#24211F]">{title}</h3>
      {description && (
        <p className="text-xs text-[#817A72] mt-1 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
