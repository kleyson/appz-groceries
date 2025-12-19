import { forwardRef, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, checked, ...props }, ref) => {
    return (
      <label className="inline-flex items-center gap-3 cursor-pointer touch-target">
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            className="sr-only peer"
            {...props}
          />
          <div
            className={cn(
              "w-6 h-6 rounded-lg border-2 transition-all duration-150",
              "flex items-center justify-center",
              "border-slate-300 dark:border-slate-600",
              "peer-checked:border-primary-500 peer-checked:bg-primary-500",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2",
              className,
            )}
          >
            <Check
              className={cn(
                "w-4 h-4 text-white transition-all duration-150",
                checked ? "opacity-100 scale-100" : "opacity-0 scale-75",
              )}
            />
          </div>
        </div>
        {label && (
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {label}
          </span>
        )}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
