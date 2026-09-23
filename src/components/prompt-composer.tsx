import { useRef } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { fileToDataUrl } from "@/lib/resize-image";
import type { Attachment, MediaKind } from "@/lib/types";

type PromptComposerProps = {
  prompt: string;
  onPrompt: (value: string) => void;
  mode: MediaKind;
  onMode: (mode: MediaKind) => void;
  attachment: Attachment | null;
  onAttachment: (attachment: Attachment | null) => void;
  busy: boolean;
  onSubmit: () => void;
  onError: (message: string) => void;
};

function placeholderFor(mode: MediaKind, hasAttachment: boolean): string {
  if (mode === "video") {
    return hasAttachment
      ? "Describe how this picture should move…"
      : "Describe the clip…";
  }
  return hasAttachment
    ? "Describe how to edit this picture…"
    : "Describe the photograph…";
}

export function PromptComposer({
  prompt,
  onPrompt,
  mode,
  onMode,
  attachment,
  onAttachment,
  busy,
  onSubmit,
  onError,
}: PromptComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      onAttachment({ name: file.name, dataUrl });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not read that picture.");
    }
  }

  return (
    <div className="composer">
      <label className="sr-only" htmlFor="prompt">
        {mode === "video" ? "Clip prompt" : "Photograph prompt"}
      </label>
      <textarea
        id="prompt"
        name="prompt"
        rows={3}
        maxLength={2500}
        placeholder={placeholderFor(mode, Boolean(attachment))}
        value={prompt}
        onChange={(event) => onPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        disabled={busy}
      />

      {attachment ? (
        <div className="attach-chip">
          <img src={attachment.dataUrl} alt="" />
          <span>{attachment.name}</span>
          <button
            type="button"
            className="attach-remove"
            aria-label="Remove picture"
            disabled={busy}
            onClick={() => onAttachment(null)}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      ) : null}

      <div className="composer-bar">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onPick(file);
          }}
        />
        <button
          type="button"
          className={cn("plus-btn", attachment && "is-on")}
          aria-label="Upload a picture"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Plus size={20} strokeWidth={2} />
        </button>
        <div className="mode-toggle" role="group" aria-label="Photo or video">
          <button
            type="button"
            className={cn(mode === "photo" && "is-on")}
            aria-pressed={mode === "photo"}
            disabled={busy}
            onClick={() => onMode("photo")}
          >
            Photo
          </button>
          <button
            type="button"
            className={cn(mode === "video" && "is-on")}
            aria-pressed={mode === "video"}
            disabled={busy}
            onClick={() => onMode("video")}
          >
            Video
          </button>
        </div>
      </div>
    </div>
  );
}
