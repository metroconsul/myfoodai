import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[72px] w-full rounded-[8px] border-2 border-foreground bg-card px-3 py-2 text-base shadow-[2px_2px_0_var(--ink)] placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-[var(--acid)] focus-visible:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
