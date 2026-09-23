import { useEffect } from "react";
import type { Photo } from "@/lib/types";

type LightboxProps = {
  photo: Photo;
  onClose: () => void;
  onDelete?: (id: string) => void;
};

export function Lightbox({ photo, onClose, onDelete }: LightboxProps) {
  const isVideo = photo.kind === "video";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filename = `lumina-${photo.id}${isVideo ? ".mp4" : ".jpg"}`;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={photo.prompt} onClick={onClose}>
      {isVideo ? (
        <video
          src={photo.src}
          controls
          autoPlay
          playsInline
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <img src={photo.src} alt={photo.prompt} onClick={(event) => event.stopPropagation()} />
      )}
      <p>{photo.prompt}</p>
      <div className="lightbox-actions" onClick={(event) => event.stopPropagation()}>
        <a className="ghost-btn" href={photo.src} download={filename} target="_blank" rel="noreferrer">
          Download
        </a>
        {photo.origin === "user" && onDelete ? (
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              onDelete(photo.id);
              onClose();
            }}
          >
            Remove
          </button>
        ) : null}
        <button type="button" className="ghost-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
