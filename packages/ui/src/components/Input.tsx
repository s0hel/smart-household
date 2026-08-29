import * as React from "react";
import { cn } from "../cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-lg border border-ink-300 px-3 text-sm placeholder:text-ink-400 focus:border-sapphire-500 focus:outline-none focus:ring-2 focus:ring-sapphire-100",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => {
    return <label ref={ref} className={cn("mb-1 block text-sm font-medium text-ink-700", className)} {...props} />;
  },
);
Label.displayName = "Label";
