"use client";

/** Thin styled button — kept as a shared control for game CTAs. */
export default function TapButton({
  onPress,
  className = "",
  children,
  disabled,
  ariaLabel,
}: {
  onPress: () => void;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onPress}
      className={className}
      style={{ touchAction: "manipulation" }}
    >
      {children}
    </button>
  );
}
