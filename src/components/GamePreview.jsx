export function GamePreview({ type }) {
  return (
    <div className={`game-preview game-preview--${type}`} aria-hidden="true">
      <span className="preview-star preview-star--one" />
      <span className="preview-star preview-star--two" />
      <span className="preview-star preview-star--three" />
      <span className="preview-ship" />
      <span className="preview-rock preview-rock--one" />
      <span className="preview-rock preview-rock--two" />
      <span className="preview-orbit" />
      <span className="preview-sticker preview-sticker--one" />
      <span className="preview-sticker preview-sticker--two" />
      <span className="preview-immune-cell preview-immune-cell--one" />
      <span className="preview-immune-cell preview-immune-cell--two" />
      <span className="preview-bacterium preview-bacterium--one" />
      <span className="preview-bacterium preview-bacterium--two" />
      <span className="preview-cannon preview-cannon--one" />
      <span className="preview-cannon preview-cannon--two" />
      <span className="preview-mountain" />
      <span className="preview-shell" />
    </div>
  );
}
