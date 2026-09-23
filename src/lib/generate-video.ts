import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  ASPECT_RATIOS,
  RESOLUTIONS,
  STYLES,
  VIDEO_DURATIONS,
  type AspectRatio,
  type PhotoStyle,
  type Resolution,
  type VideoDuration,
} from "./types";

export type VideoInput = {
  prompt: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  style: PhotoStyle;
  duration: VideoDuration;
  imageDataUrl?: string;
};

export type StartVideoResult =
  | { ok: true; requestId: string; url?: string }
  | { ok: false; error: string };

export type PollVideoResult =
  | { ok: true; status: string; progress: number; url: string | null }
  | { ok: false; error: string };

const VIDEO_MODEL = "grok-imagine-video-1.5";
const VIDEO_FALLBACK = "grok-imagine-video";
const MAX_IMAGE_CHARS = 2_000_000;

function isAspect(value: unknown): value is AspectRatio {
  return typeof value === "string" && (ASPECT_RATIOS as readonly string[]).includes(value);
}

function isResolution(value: unknown): value is Resolution {
  return typeof value === "string" && (RESOLUTIONS as readonly string[]).includes(value);
}

function isStyle(value: unknown): value is PhotoStyle {
  return typeof value === "string" && (STYLES as readonly string[]).includes(value);
}

function isDuration(value: unknown): value is VideoDuration {
  return typeof value === "number" && (VIDEO_DURATIONS as readonly number[]).includes(value);
}

function enhanceVideoPrompt(prompt: string, style: PhotoStyle): string {
  const trimmed = prompt.trim();
  if (style === "raw") return trimmed;
  if (style === "cinematic") {
    return `${trimmed}. Cinematic camera, smooth motion, natural lighting, photoreal, no text, no watermark.`;
  }
  return `${trimmed}. Photorealistic motion, natural light, subtle camera move, no text, no watermark.`;
}

function mapVideoAspect(aspect: AspectRatio): string {
  return aspect === "auto" ? "16:9" : aspect;
}

function mapVideoResolution(resolution: Resolution): "480p" | "720p" {
  return resolution === "2k" ? "720p" : "480p";
}

function validateVideo(input: VideoInput): VideoInput {
  if (!input || typeof input !== "object") {
    throw new Error("Describe the clip first.");
  }
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (prompt.length < 3) throw new Error("Give the clip a little more detail.");
  if (prompt.length > 2500) throw new Error("Keep the prompt under 2500 characters.");
  if (!isAspect(input.aspectRatio)) throw new Error("Unknown aspect ratio.");
  if (!isResolution(input.resolution)) throw new Error("Unknown resolution.");
  if (!isStyle(input.style)) throw new Error("Unknown style.");
  if (!isDuration(input.duration)) throw new Error("Unknown duration.");
  const imageDataUrl =
    typeof input.imageDataUrl === "string" && input.imageDataUrl.trim()
      ? input.imageDataUrl.trim()
      : undefined;
  if (imageDataUrl) {
    if (!imageDataUrl.startsWith("data:image/")) {
      throw new Error("Attach a photograph first.");
    }
    if (imageDataUrl.length > MAX_IMAGE_CHARS) {
      throw new Error("That picture is too large. Try a smaller one.");
    }
  }
  return {
    prompt,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    style: input.style,
    duration: input.duration,
    imageDataUrl,
  };
}

function parseRequestId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.request_id === "string" && record.request_id) return record.request_id;
  if (typeof record.id === "string" && record.id) return record.id;
  return null;
}

function parseVideoUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.url === "string" && record.url.startsWith("http")) return record.url;
  const video = record.video;
  if (video && typeof video === "object") {
    const inner = video as Record<string, unknown>;
    if (typeof inner.url === "string" && inner.url.startsWith("http")) return inner.url;
  }
  return null;
}

async function startRequest(
  apiKey: string,
  model: string,
  input: VideoInput,
): Promise<{ ok: true; requestId?: string; url?: string } | { ok: false; status: number; detail: string }> {
  const body: Record<string, unknown> = {
    model,
    prompt: enhanceVideoPrompt(input.prompt, input.style),
    duration: input.duration,
    aspect_ratio: mapVideoAspect(input.aspectRatio),
    resolution: mapVideoResolution(input.resolution),
  };
  if (input.imageDataUrl) {
    body.image = { url: input.imageDataUrl };
  }

  const res = await fetch("https://api.x.ai/v1/videos/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, detail: raw.slice(0, 280) };
  }
  let json: unknown = null;
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, status: res.status, detail: "The studio returned an unreadable clip." };
  }
  const url = parseVideoUrl(json);
  if (url) return { ok: true, url };
  const requestId = parseRequestId(json);
  if (requestId) return { ok: true, requestId };
  return { ok: false, status: res.status, detail: "No clip was returned." };
}

export const startVideo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: VideoInput): VideoInput => validateVideo(input))
  .handler(async ({ data }): Promise<StartVideoResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Generation is unavailable in this environment." };
    }

    const primary = await startRequest(apiKey, VIDEO_MODEL, data);
    if (primary.ok) {
      return { ok: true, requestId: primary.requestId ?? "", url: primary.url };
    }

    const fallback = await startRequest(apiKey, VIDEO_FALLBACK, data);
    if (fallback.ok) {
      return { ok: true, requestId: fallback.requestId ?? "", url: fallback.url };
    }

    if (primary.status === 400 || fallback.status === 400) {
      return { ok: false, error: "That prompt could not be filmed. Try a different scene." };
    }
    if (primary.status === 429 || fallback.status === 429) {
      return { ok: false, error: "The studio is busy. Wait a moment and try again." };
    }
    return { ok: false, error: "The clip could not be filmed. Try again." };
  });

export const pollVideo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((requestId: string) => {
    const next = typeof requestId === "string" ? requestId.trim() : "";
    if (!next) throw new Error("Missing clip.");
    return next;
  })
  .handler(async ({ data: requestId }): Promise<PollVideoResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Generation is unavailable in this environment." };
    }

    const res = await fetch(`https://api.x.ai/v1/videos/${encodeURIComponent(requestId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const raw = await res.text();
    if (!res.ok) {
      if (res.status === 429) {
        return { ok: true, status: "processing", progress: 0, url: null };
      }
      return { ok: false, error: "The clip could not be filmed. Try again." };
    }
    let json: unknown = null;
    try {
      json = JSON.parse(raw) as unknown;
    } catch {
      return { ok: false, error: "The studio returned an unreadable clip." };
    }
    const record = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
    const status = typeof record.status === "string" ? record.status : "processing";
    const progress = typeof record.progress === "number" ? record.progress : status === "done" ? 100 : 0;
    const url = parseVideoUrl(json);
    return { ok: true, status, progress, url };
  });
