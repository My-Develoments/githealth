import type { HTMLAttributes } from "react";
import type { StatusTone } from "../tokens";
import { cx } from "../utils/cx";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return <span className={cx("gh-badge", `gh-badge--${tone}`, className)} {...props} />;
}
