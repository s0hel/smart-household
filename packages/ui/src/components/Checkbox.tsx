import * as React from "react";
import { cn } from "../cn";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "h-5 w-5 shrink-0 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500",
          className,
        )}
        {...props}
      />
    );
  },
);
Checkbox.displayName = "Checkbox";
