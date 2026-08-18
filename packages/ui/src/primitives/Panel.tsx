import type { HTMLAttributes, KeyboardEvent } from "react";
import { cx } from "../utils/cx";

type PanelTone = "base" | "subtle" | "elevated" | "stronger";

export type PanelProps = HTMLAttributes<HTMLDivElement> & {
  tone?: PanelTone;
  selected?: boolean;
  interactive?: boolean;
  onPress?: () => void;
};

export function Panel({
  className,
  tone = "base",
  selected = false,
  interactive = false,
  onPress,
  onKeyDown,
  onClick,
  tabIndex,
  ...props
}: PanelProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !interactive || !onPress) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPress();
    }
  };

  return (
    <div
      data-interactive={interactive ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
      tabIndex={interactive ? tabIndex ?? 0 : tabIndex}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && interactive && onPress) {
          onPress();
        }
      }}
      onKeyDown={handleKeyDown}
      className={cx("gh-panel", tone !== "base" && `gh-panel--${tone}`, className)}
      {...props}
    />
  );
}
