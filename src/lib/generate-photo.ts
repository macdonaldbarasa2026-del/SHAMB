import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  ASPECT_RATIOS,
  RESOLUTIONS,
  STYLES,
  type AspectRatio,
  type PhotoStyle,
  type Resolution,
} from "./types";

export type GenerateInput = {
  prompt: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  style: PhotoStyle;
};

export type EditInput = GenerateInput & {
  imageDataUrl: string;
};

export type GenerateResult =
  | { ok: true; url: string; prompt: string }
  | { ok: false; error: string };

const QUALITY_MODEL = "grok-imagine-image-quality";
const FALLBACK_MODEL = "grok-imagine-image-2.0";
const MAX_IMAGE_CHARS = 2_000_000;

export function enhancePrompt(prompt: string, style: PhotoStyle): string {
  const trimmed = prompt.trim();
  if (style === "raw") return trimmed;
  if (style === "cinematic") {
    return `${trimmed}. Cinematic still photograph, anamorphic bokeh, volumetric light, filmic color, ultra-detailed 2K capture with 4K micro-contrast, no text, no watermark.`;
  }
  return `${trimmed}. Photorealistic photograph, optical sharpness, natural materials and light, large-format camera, ultra-detailed 2K capture with 4K photographic grain and micro-contrast, no text, no watermark.`;
}

function isAspect(value: unknown): value is AspectRatio {
  return typeof value === "string" && (ASPECT_RATIOS as readonly string[]).includes(value);
}

function isResolution(value: unknown): value is Resolution {
  return typeof value === "string" && (RESOLUTIONS as readonly string[]).includes(value);
}

function isStyle(value: unknown): value is PhotoStyle {
  return typeof value === "string" && (STYLES as readonly string[]).includes(value);
}

export function parseImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.url === "string" && record.url.startsWith("http")) return record.url;
  const data = record.data;
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    const first = data[0] as Record<string, unknown>;
    if (typeof first.url === "string" && first.url.startsWith("http")) return first.url;
    if (typeof first.b64_json === "string") {
      return `data:image/png;base64,${first.b64_json}`;
    }
  }
  return null;
}

function validateGenerate(input: GenerateInput): GenerateInput {
  if (!input || typeof input !== "object") {
    throw new Error("Describe the photograph first.");
  }
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (prompt.length < 3) throw new Error("Give the photograph a little more detail.");
  if (prompt.length > 2500) throw new Error("Keep the prompt under 2500 characters.");
  if (!isAspect(input.aspectRatio)) throw new Error("Unknown aspect ratio.");
  if (!isResolution(input.resolution)) throw new Error("Unknown resolution.");
  if (!isStyle(input.style)) throw new Error("Unknown style.");
  return {
    prompt,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    style: input.style,
  };
}

async function requestImage(
  apiKey: string,
  model: string,
  input: GenerateInput,
): Promise<{ ok: true; url: string } | { ok: false; status: number; detail: string }> {
  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: enhancePrompt(input.prompt, input.style),
      n: 1,
      resolution: input.resolution,
      aspect_ratio: input.aspectRatio,
      response_format: "url",
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, detail: raw.slice(0, 280) };
  }
  let json: unknown = null;
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, status: res.status, detail: "The studio returned an unreadable frame." };
  }
  const url = parseImageUrl(json);
  if (!url) {
    return { ok: false, status: res.status, detail: "No photograph was returned." };
  }
  return { ok: true, url };
}

async function requestEdit(
  apiKey: string,
  model: string,
  input: EditInput,
  includeFrame: boolean,
): Promise<{ ok: true; url: string } | { ok: false; status: number; detail: string }> {
  const body: Record<string, unknown> = {
    model,
    prompt: enhancePrompt(input.prompt, input.style),
    image: {
      url: input.imageDataUrl,
      type: "image_url",
    },
    n: 1,
    response_format: "url",
  };
  if (includeFrame) {
    body.resolution = input.resolution;
    body.aspect_ratio = input.aspectRatio;
  }
  const res = await fetch("https://api.x.ai/v1/images/edits", {
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
    return { ok: false, status: res.status, detail: "The studio returned an unreadable frame." };
  }
  const url = parseImageUrl(json);
  if (!url) {
    return { ok: false, status: res.status, detail: "No photograph was returned." };
  }
  return { ok: true, url };
}

function failFromStatus(primary: number, fallback: number): GenerateResult {
  if (primary === 400 || fallback === 400) {
    return { ok: false, error: "That prompt could not be photographed. Try a different scene." };
  }
  if (primary === 429 || fallback === 429) {
    return { ok: false, error: "The studio is busy. Wait a moment and try again." };
  }
  return { ok: false, error: "The photograph could not be developed. Try again." };
}

export const generatePhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: GenerateInput): GenerateInput => validateGenerate(input))
  .handler(async ({ data }): Promise<GenerateResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Generation is unavailable in this environment." };
    }

    const primary = await requestImage(apiKey, QUALITY_MODEL, data);
    if (primary.ok) {
      return { ok: true, url: primary.url, prompt: data.prompt };
    }

    const fallback = await requestImage(apiKey, FALLBACK_MODEL, data);
    if (fallback.ok) {
      return { ok: true, url: fallback.url, prompt: data.prompt };
    }

    return failFromStatus(primary.status, fallback.status);
  });

export const editPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: EditInput): EditInput => {
    const base = validateGenerate(input);
    const imageDataUrl = typeof input.imageDataUrl === "string" ? input.imageDataUrl.trim() : "";
    if (!imageDataUrl.startsWith("data:image/")) {
      throw new Error("Attach a photograph first.");
    }
    if (imageDataUrl.length > MAX_IMAGE_CHARS) {
      throw new Error("That picture is too large. Try a smaller one.");
    }
    return { ...base, imageDataUrl };
  })
  .handler(async ({ data }): Promise<GenerateResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Generation is unavailable in this environment." };
    }

    const primary = await requestEdit(apiKey, QUALITY_MODEL, data, true);
    if (primary.ok) return { ok: true, url: primary.url, prompt: data.prompt };

    const fallback = await requestEdit(apiKey, FALLBACK_MODEL, data, primary.status === 400 ? false : true);
    if (fallback.ok) return { ok: true, url: fallback.url, prompt: data.prompt };

    return failFromStatus(primary.status, fallback.status);
  });
