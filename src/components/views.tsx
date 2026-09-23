import {
  ASPECT_RATIOS,
  RESOLUTIONS,
  VIDEO_DURATIONS,
  type Photo,
  type PlanId,
  type PhotoStyle,
  type StudioSettings,
} from "@/lib/types";
import { cn } from "@/lib/cn";

type FilesViewProps = {
  photos: Photo[];
  studio: Photo[];
  onOpen: (photo: Photo) => void;
  onHome: () => void;
};

export function FilesView({ photos, studio, onOpen, onHome }: FilesViewProps) {
  return (
    <section className="panel">
      <h2>Files</h2>
      <p className="lede">Your developed frames and clips live here, saved to your account.</p>
      {photos.length === 0 ? (
        <div className="empty">
          Nothing yet. Write a prompt on Home and press Start — or attach a picture with Plus.
          <div>
            <button type="button" className="ghost-btn" onClick={onHome}>
              Go to Home
            </button>
          </div>
        </div>
      ) : (
        <Grid photos={photos} onOpen={onOpen} />
      )}
      <h2 className="stack-gap-lg">Studio collection</h2>
      <p className="lede">Reference plates spinning on the home ring.</p>
      <Grid photos={studio} onOpen={onOpen} />
    </section>
  );
}

function Grid({ photos, onOpen }: { photos: Photo[]; onOpen: (photo: Photo) => void }) {
  return (
    <div className="photo-grid">
      {photos.map((photo) => (
        <figure className="photo-tile" key={photo.id}>
          <button type="button" onClick={() => onOpen(photo)} aria-label={photo.prompt}>
            {photo.kind === "video" ? (
              <video src={photo.src} muted playsInline preload="metadata" />
            ) : (
              <img src={photo.src} alt={photo.prompt} />
            )}
            {photo.kind === "video" ? <span className="media-badge">Video</span> : null}
          </button>
          <figcaption>{photo.prompt}</figcaption>
        </figure>
      ))}
    </div>
  );
}

const PLAN_COPY: { id: PlanId; title: string; body: string }[] = [
  {
    id: "spark",
    title: "Spark",
    body: "Twelve frames a month. 1K capture. An account unlocks the cloud studio.",
  },
  {
    id: "studio",
    title: "Studio",
    body: "Photographs and prompt edits of your own pictures. 2K capture with 4K-grade detail.",
  },
  {
    id: "atelier",
    title: "Atelier",
    body: "Open studio. Video clips, priority queue, cinematic grade, every ratio.",
  },
];

type PlansViewProps = {
  plan: PlanId;
  onSelect: (plan: PlanId) => void;
};

export function PlansView({ plan, onSelect }: PlansViewProps) {
  return (
    <section className="panel">
      <h2>Plans</h2>
      <p className="lede">
        Sign in to use the cloud. This preview keeps every desk unlocked so you can keep shooting.
      </p>
      <div className="plan-list">
        {PLAN_COPY.map((item) => (
          <button
            type="button"
            key={item.id}
            className={cn("plan-card", plan === item.id && "is-on")}
            onClick={() => onSelect(item.id)}
          >
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

const STYLE_COPY: { id: PhotoStyle; label: string }[] = [
  { id: "photo", label: "Photograph" },
  { id: "cinematic", label: "Cinematic" },
  { id: "raw", label: "Unfiltered" },
];

type SettingsViewProps = {
  settings: StudioSettings;
  libraryCount: number;
  onPatch: (patch: Partial<StudioSettings>) => void;
  onClear: () => void;
};

export function SettingsView({ settings, libraryCount, onPatch, onClear }: SettingsViewProps) {
  return (
    <section className="panel">
      <h2>Settings</h2>
      <p className="lede">Frame, grade, and motion. Changes apply to the next Start.</p>

      <article className="setting-card">
        <h3>Aspect</h3>
        <p>How the next photograph or clip is cropped.</p>
        <div className="choice-row">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              type="button"
              key={ratio}
              className={cn("choice", settings.aspectRatio === ratio && "is-on")}
              onClick={() => onPatch({ aspectRatio: ratio })}
            >
              {ratio}
            </button>
          ))}
        </div>
      </article>

      <article className="setting-card stack-gap">
        <h3>Resolution</h3>
        <p>2K is the highest still. Video maps 2K to 720p.</p>
        <div className="choice-row">
          {RESOLUTIONS.map((resolution) => (
            <button
              type="button"
              key={resolution}
              className={cn("choice", settings.resolution === resolution && "is-on")}
              onClick={() => onPatch({ resolution })}
            >
              {resolution === "2k" ? "2K · max" : "1K · draft"}
            </button>
          ))}
        </div>
      </article>

      <article className="setting-card stack-gap">
        <h3>Clip length</h3>
        <p>Shorter clips develop faster. Used when Video is selected.</p>
        <div className="choice-row">
          {VIDEO_DURATIONS.map((duration) => (
            <button
              type="button"
              key={duration}
              className={cn("choice", (settings.videoDuration ?? 6) === duration && "is-on")}
              onClick={() => onPatch({ videoDuration: duration })}
            >
              {duration}s
            </button>
          ))}
        </div>
      </article>

      <article className="setting-card stack-gap">
        <h3>Grade</h3>
        <p>Photograph and cinematic wrap your prompt. Unfiltered sends it as written.</p>
        <div className="choice-row">
          {STYLE_COPY.map((style) => (
            <button
              type="button"
              key={style.id}
              className={cn("choice", settings.style === style.id && "is-on")}
              onClick={() => onPatch({ style: style.id })}
            >
              {style.label}
            </button>
          ))}
        </div>
      </article>

      <article className={cn("setting-card stack-gap", settings.reduceMotion && "is-on")}>
        <h3>Reduce motion</h3>
        <p>Pause the starfield, sphere, and Start iridescence.</p>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => onPatch({ reduceMotion: !settings.reduceMotion })}
        >
          {settings.reduceMotion ? "Motion off" : "Motion on"}
        </button>
      </article>

      <article className="setting-card stack-gap">
        <h3>Library</h3>
        <p className="muted">
          {libraryCount} piece{libraryCount === 1 ? "" : "s"} in your cloud studio.
        </p>
        <button
          type="button"
          className="ghost-btn"
          onClick={onClear}
          disabled={libraryCount === 0}
        >
          Clear my library
        </button>
      </article>
    </section>
  );
}
