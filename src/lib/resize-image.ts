const MAX_CHARS = 1_800_000;

export async function fileToDataUrl(file: File, maxEdge = 1280): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a photograph.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("That picture is too large. Try a smaller one.");
  }

  const bitmap = await createImageBitmap(file).catch(async () => {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadHtmlImage(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not read that picture.");
      ctx.drawImage(img, 0, 0);
      return await createImageBitmap(canvas);
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not read that picture.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.82, 0.68, 0.52]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_CHARS) return dataUrl;
  }
  throw new Error("That picture is too large. Try a smaller one.");
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that picture."));
    img.src = src;
  });
}

export function isUnauthorized(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { status?: unknown; message?: unknown };
  if (record.status === 401) return true;
  return typeof record.message === "string" && record.message === "Unauthorized";
}
