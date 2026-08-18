import type { ButtonHTMLAttributes } from "react";
import { cx } from "../utils/cx";

type ButtonVariant = "primary" | "secondary" | "tertiary";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  selected?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  selected = false,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-selected={selected ? "true" : "false"}
      className={cx("gh-button", `gh-button--${variant}`, `gh-button--${size}`, className)}
      {...props}
    />
  );
}
