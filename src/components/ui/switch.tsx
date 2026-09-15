"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Radix switch that also submits with plain forms: when `name` is given, a hidden input mirrors
 * the state as "on"/"off" so server actions can read it without JavaScript state plumbing.
 */
const Switch = React.forwardRef<React.ComponentRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(({ className, name, defaultChecked, checked, onCheckedChange, ...props }, ref) => {
  const [internal, setInternal] = React.useState(Boolean(defaultChecked));
  const value = checked ?? internal;
  return (
    <>
      <SwitchPrimitive.Root
        ref={ref}
        checked={value}
        onCheckedChange={(v) => {
          setInternal(v);
          onCheckedChange?.(v);
        }}
        className={cn(
          "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-brand data-[state=unchecked]:bg-input",
          className,
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
      </SwitchPrimitive.Root>
      {name && <input type="hidden" name={name} value={value ? "on" : "off"} />}
    </>
  );
});
Switch.displayName = "Switch";

export { Switch };
