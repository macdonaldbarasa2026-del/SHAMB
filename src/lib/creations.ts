import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  ASPECT_RATIOS,
  MEDIA_KINDS,
  RESOLUTIONS,
  type AspectRatio,
  type MediaKind,
  type Photo,
  type Resolution,
} from "./types";

type CreationRow = {
  id: string;
  kind: string;
  prompt: string;
  src: string;
  aspect_ratio: string;
  resolution: string;
  created_at: number | string;
};

export type SaveCreationInput = {
  id: string;
  kind: MediaKind;
  prompt: string;
  src: string;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  createdAt: number;
};

function asKind(value: string): MediaKind {
  return value === "video" ? "video" : "photo";
}

function asAspect(value: string): AspectRatio {
  return (ASPECT_RATIOS as readonly string[]).includes(value) ? (value as AspectRatio) : "auto";
}

function asResolution(value: string): Resolution {
  return (RESOLUTIONS as readonly string[]).includes(value) ? (value as Resolution) : "2k";
}

function toPhoto(row: CreationRow): Photo {
  return {
    id: row.id,
    kind: asKind(row.kind),
    prompt: row.prompt,
    src: row.src,
    createdAt: Number(row.created_at) || Date.now(),
    aspectRatio: asAspect(row.aspect_ratio),
    resolution: asResolution(row.resolution),
    origin: "user",
  };
}

export const listCreations = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Photo[]> => {
    const sql = await getSql();
    const rows = await sql<CreationRow>`
      select id, kind, prompt, src, aspect_ratio, resolution, created_at
      from creations
      where user_id = ${context.userId}
      order by created_at desc
      limit 48
    `;
    return rows.map(toPhoto);
  });

export const saveCreation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: SaveCreationInput): SaveCreationInput => {
    if (!input || typeof input !== "object") throw new Error("Missing frame.");
    const id = typeof input.id === "string" ? input.id.trim() : "";
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    const src = typeof input.src === "string" ? input.src.trim() : "";
    if (!id || !prompt || !src) throw new Error("Missing frame.");
    if (!src.startsWith("http")) throw new Error("Only developed frames can be saved.");
    if (!(MEDIA_KINDS as readonly string[]).includes(input.kind)) throw new Error("Unknown kind.");
    if (!(ASPECT_RATIOS as readonly string[]).includes(input.aspectRatio)) throw new Error("Unknown aspect.");
    if (!(RESOLUTIONS as readonly string[]).includes(input.resolution)) throw new Error("Unknown resolution.");
    const createdAt = Number(input.createdAt);
    return {
      id,
      kind: input.kind,
      prompt,
      src,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into creations (id, user_id, kind, prompt, src, aspect_ratio, resolution, created_at)
      values (
        ${data.id},
        ${context.userId},
        ${data.kind},
        ${data.prompt},
        ${data.src},
        ${data.aspectRatio},
        ${data.resolution},
        ${data.createdAt}
      )
      on conflict (id) do nothing
    `;
  });

export const deleteCreation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => {
    const next = typeof id === "string" ? id.trim() : "";
    if (!next) throw new Error("Missing frame.");
    return next;
  })
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`delete from creations where id = ${id} and user_id = ${context.userId}`;
  });

export const clearCreations = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`delete from creations where user_id = ${context.userId}`;
  });
