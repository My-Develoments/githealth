import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";

type TextSize = "sm" | "md" | "lg";
type TextTone = "primary" | "muted" | "secondary" | "inverse";
type HeadingSize = "display" | "xl" | "lg" | "md" | "sm";

type TextElement = "p" | "span" | "div" | "label";
type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export type TextProps = HTMLAttributes<HTMLElement> & {
  as?: TextElement;
  size?: TextSize;
  tone?: TextTone;
};

export function Text({
  as = "p",
  size = "md",
  tone = "primary",
  className,
  ...props
}: TextProps) {
  const Component = as;
  return <Component className={cx("gh-text", `gh-text--${size}`, `gh-text--${tone}`, className)} {...props} />;
}

export type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: HeadingElement;
  size?: HeadingSize;
};

export function Heading({ as = "h2", size = "xl", className, ...props }: HeadingProps) {
  const Component = as;
  return <Component className={cx("gh-heading", `gh-heading--${size}`, className)} {...props} />;
}
