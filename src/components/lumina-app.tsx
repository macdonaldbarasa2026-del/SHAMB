import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AccountChip } from "@/components/account-chip";
import { BottomNav } from "@/components/bottom-nav";
import { GeneratingLoader } from "@/components/generating-loader";
import { Lightbox } from "@/components/lightbox";
import { PhotoSphere } from "@/components/photo-sphere";
import { PromptComposer } from "@/components/prompt-composer";
import { StartButton } from "@/components/start-button";
import { FilesView, PlansView, SettingsView } from "@/components/views";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { clearCreations, deleteCreation, listCreations, saveCreation } from "@/lib/creations";
import { editPhoto, generatePhoto } from "@/lib/generate-photo";
import { pollVideo, startVideo } from "@/lib/generate-video";
import { sphereSlots, useGallery } from "@/lib/gallery-store";
import { isUnauthorized } from "@/lib/resize-image";
import { PHOTO_CHIPS, STUDIO_PHOTOS, VIDEO_CHIPS } from "@/lib/studio-photos";
import type { Attachment, MediaKind, Photo, Tab } from "@/lib/types";

const DRAFT_KEY = "lumina-draft";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function LuminaApp() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const photos = useGallery((s) => s.photos);
  const settings = useGallery((s) => s.settings);
  const addPhoto = useGallery((s) => s.addPhoto);
  const removePhoto = useGallery((s) => s.removePhoto);
  const replaceLibrary = useGallery((s) => s.replaceLibrary);
  const clearLibrary = useGallery((s) => s.clearLibrary);
  const patchSettings = useGallery((s) => s.patchSettings);

  const [tab, setTab] = useState<Tab>("home");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<MediaKind>("photo");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [opened, setOpened] = useState<Photo | null>(null);

  useEffect(() => {
    void useGallery.persist.rehydrate();
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as { prompt?: string; mode?: MediaKind };
      if (typeof draft.prompt === "string") setPrompt(draft.prompt);
      if (draft.mode === "photo" || draft.mode === "video") setMode(draft.mode);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ prompt, mode }));
    } catch {
      /* ignore */
    }
  }, [prompt, mode]);

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    void listCreations()
      .then((rows) => {
        if (cancelled) return;
        replaceLibrary(rows);
      })
      .catch(() => {
        /* signed-out or empty cloud library */
      });
    return () => {
      cancelled = true;
    };
  }, [isPending, user, replaceLibrary]);

  const ring = useMemo(() => sphereSlots(photos, STUDIO_PHOTOS, 10), [photos]);
  const chips = mode === "video" ? VIDEO_CHIPS : PHOTO_CHIPS;

  function requireAccount(): boolean {
    if (isPending) return false;
    if (user) return true;
    toast.error("Log in to use the cloud studio.");
    void navigate({ to: "/login" });
    return false;
  }

  async function persist(photo: Photo) {
    if (!photo.src.startsWith("http")) return;
    try {
      await saveCreation({
        data: {
          id: photo.id,
          kind: photo.kind,
          prompt: photo.prompt,
          src: photo.src,
          aspectRatio: photo.aspectRatio,
          resolution: photo.resolution,
          createdAt: photo.createdAt,
        },
      });
    } catch {
      /* local copy still holds */
    }
  }

  async function filmClip(next: string): Promise<string> {
    const started = await startVideo({
      data: {
        prompt: next,
        aspectRatio: settings.aspectRatio,
        resolution: settings.resolution,
        style: settings.style,
        duration: settings.videoDuration ?? 6,
        imageDataUrl: attachment?.dataUrl,
      },
    });
    if (!started.ok) throw new Error(started.error);
    if (started.url) return started.url;
    if (!started.requestId) throw new Error("The clip could not be filmed. Try again.");

    let delay = 2000;
    for (let i = 0; i < 50; i += 1) {
      await sleep(delay);
      const polled = await pollVideo({ data: started.requestId });
      if (!polled.ok) throw new Error(polled.error);
      if (polled.status === "failed" || polled.status === "expired") {
        throw new Error("The clip could not be filmed. Try a different scene.");
      }
      if ((polled.status === "done" || polled.progress >= 100) && polled.url) {
        return polled.url;
      }
      delay = Math.min(Math.round(delay * 1.12), 4000);
    }
    throw new Error("The clip is still developing. Try again in a moment.");
  }

  async function onGenerate() {
    const next = prompt.trim();
    if (next.length < 3) {
      toast.error(mode === "video" ? "Describe the clip first." : "Describe the photograph first.");
      return;
    }
    if (busy) return;
    if (!requireAccount()) return;
    setBusy(true);
    try {
      let url: string;
      if (mode === "video") {
        url = await filmClip(next);
      } else if (attachment) {
        const result = await editPhoto({
          data: {
            prompt: next,
            aspectRatio: settings.aspectRatio,
            resolution: settings.resolution,
            style: settings.style,
            imageDataUrl: attachment.dataUrl,
          },
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        url = result.url;
      } else {
        const result = await generatePhoto({
          data: {
            prompt: next,
            aspectRatio: settings.aspectRatio,
            resolution: settings.resolution,
            style: settings.style,
          },
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        url = result.url;
      }

      const photo: Photo = {
        id: crypto.randomUUID(),
        prompt: next,
        src: url,
        createdAt: Date.now(),
        aspectRatio: settings.aspectRatio,
        resolution: settings.resolution,
        origin: "user",
        kind: mode,
      };
      addPhoto(photo);
      void persist(photo);
      setFreshId(photo.id);
      setOpened(photo);
      toast.success(mode === "video" ? "Clip developed." : "Photograph developed.");
    } catch (error) {
      if (isUnauthorized(error)) {
        toast.error("Log in to use the cloud studio.");
        void navigate({ to: "/login" });
        return;
      }
      const message =
        error instanceof Error ? error.message : "The studio could not finish that request.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const startLabel = mode === "video" ? "Film" : attachment ? "Edit" : "Start";

  return (
    <div className={settings.reduceMotion ? "page-root reduce-motion" : "page-root"}>
      <div className="stars-bg" aria-hidden="true">
        <div id="stars" />
        <div id="stars2" />
        <div id="stars3" />
      </div>
      <div className="vignette" />
      <div className="top-badge">
        <h1>Lumina</h1>
        <div className="dot-line" />
        <div className="sub">Photo · video · cloud studio</div>
      </div>
      <AccountChip />

      {tab === "home" ? (
        <div className="center-stack">
          <div className="stage">
            <PhotoSphere photos={ring} freshId={freshId} onSelect={setOpened} />
            {busy ? (
              <div className="generating-overlay">
                <GeneratingLoader word={mode === "video" ? "Filming" : "Generating"} />
                {mode === "video" ? (
                  <p className="generating-hint">Clips take about a minute.</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <form
            className="prompt-field"
            onSubmit={(event) => {
              event.preventDefault();
              void onGenerate();
            }}
          >
            <PromptComposer
              prompt={prompt}
              onPrompt={setPrompt}
              mode={mode}
              onMode={setMode}
              attachment={attachment}
              onAttachment={setAttachment}
              busy={busy}
              onSubmit={() => void onGenerate()}
              onError={(message) => toast.error(message)}
            />
            <div className="chip-row">
              {chips.map((chip) => (
                <button
                  type="button"
                  className="chip"
                  key={chip}
                  onClick={() => setPrompt(chip)}
                  disabled={busy}
                >
                  {chip}
                </button>
              ))}
            </div>
            {!isPending && !user ? (
              <p className="guest-hint">Log in to develop photographs, edit uploads, and film clips.</p>
            ) : null}
            <StartButton disabled={busy} label={startLabel} />
          </form>
        </div>
      ) : null}

      {tab === "files" ? (
        <FilesView photos={photos} studio={STUDIO_PHOTOS} onOpen={setOpened} onHome={() => setTab("home")} />
      ) : null}
      {tab === "plans" ? (
        <PlansView plan={settings.plan} onSelect={(plan) => patchSettings({ plan })} />
      ) : null}
      {tab === "settings" ? (
        <SettingsView
          settings={settings}
          libraryCount={photos.length}
          onPatch={patchSettings}
          onClear={() => {
            clearLibrary();
            if (user) void clearCreations().catch(() => undefined);
            toast.success("Library cleared.");
          }}
        />
      ) : null}

      <BottomNav tab={tab} onChange={setTab} />

      {opened ? (
        <Lightbox
          photo={opened}
          onClose={() => setOpened(null)}
          onDelete={(id) => {
            removePhoto(id);
            if (user) void deleteCreation({ data: id }).catch(() => undefined);
            toast.success("Removed.");
          }}
        />
      ) : null}
    </div>
  );
}
