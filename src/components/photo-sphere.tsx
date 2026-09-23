import { CARD_TINTS } from "@/lib/studio-photos";
import type { Photo } from "@/lib/types";

type PhotoSphereProps = {
  photos: Photo[];
  freshId?: string | null;
  onSelect: (photo: Photo) => void;
};

export function PhotoSphere({ photos, freshId, onSelect }: PhotoSphereProps) {
  const quantity = Math.max(photos.length, 1);

  return (
    <div className="sphere-wrapper" aria-label="Rotating photographs">
      <div className="inner" style={{ ["--quantity" as string]: quantity }}>
        {photos.map((photo, index) => (
          <button
            type="button"
            className={photo.id === freshId ? "card is-fresh" : "card"}
            key={photo.id}
            style={{
              ["--index" as string]: index,
              ["--color-card" as string]: CARD_TINTS[index % CARD_TINTS.length],
            }}
            onClick={() => onSelect(photo)}
            aria-label={photo.prompt}
          >
            <div className="img">
              {photo.kind === "video" ? (
                <video
                  src={photo.src}
                  muted
                  playsInline
                  preload="metadata"
                  draggable={false}
                />
              ) : (
                <img
                  src={photo.src}
                  alt={photo.prompt}
                  draggable={false}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
