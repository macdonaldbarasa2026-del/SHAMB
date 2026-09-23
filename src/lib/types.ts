export const TABS = ["home", "files", "plans", "settings"] as const;
export type Tab = (typeof TABS)[number];

export const ASPECT_RATIOS = [
  "auto",
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const RESOLUTIONS = ["1k", "2k"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export const STYLES = ["photo", "cinematic", "raw"] as const;
export type PhotoStyle = (typeof STYLES)[number];

export const PLANS = ["spark", "studio", "atelier"] as const;
export type PlanId = (typeof PLANS)[number];

export const MEDIA_KINDS = ["photo", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const VIDEO_DURATIONS = [6, 10] as const;
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

export type Photo = {
  id: string;
  prompt: string;
  src: string;
  createdAt: number;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  origin: "user" | "studio";
  kind: MediaKind;
};

export type StudioSettings = {
  aspectRatio: AspectRatio;
  resolution: Resolution;
  style: PhotoStyle;
  reduceMotion: boolean;
  plan: PlanId;
  videoDuration: VideoDuration;
};

export type Attachment = {
  name: string;
  dataUrl: string;
};
