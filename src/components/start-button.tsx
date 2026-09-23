const LAYERS = [
  { delay: "0s", duration: "25s" },
  { delay: "0.15s", duration: "15.9s" },
  { delay: "0.53s", duration: "26.4s" },
  { delay: "0.45s", duration: "17.8s" },
  { delay: "1.6s", duration: "19.2s" },
  { delay: "1.6s", duration: "29.2s" },
  { delay: "1.6s", duration: "20.2s" },
] as const;

type StartButtonProps = {
  disabled?: boolean;
  label?: string;
  onClick?: () => void;
};

export function StartButton({ disabled, label = "Start", onClick }: StartButtonProps) {
  return (
    <div className={disabled ? "btn-wrapper is-disabled" : "btn-wrapper"}>
      <div className="light" />
      {LAYERS.map((layer, index) => (
        <div
          className="gradient-layer"
          key={index}
          style={{ animationDelay: layer.delay, animationDuration: layer.duration }}
        />
      ))}
      <button
        className="gradient-btn"
        type="submit"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        {label}
      </button>
      <div className="text-overlay">{label}</div>
    </div>
  );
}
