type GeneratingLoaderProps = {
  word?: string;
};

export function GeneratingLoader({ word = "Generating" }: GeneratingLoaderProps) {
  const letters = word.split("");
  return (
    <div className="loader-wrapper" aria-label={word} role="status">
      {letters.map((letter, index) => (
        <span className="loader-letter" key={`${letter}-${index}`}>
          {letter}
        </span>
      ))}
      <div className="loader" />
    </div>
  );
}
