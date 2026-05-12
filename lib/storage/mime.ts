export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const PROJECT_FILE_MAX_BYTES = 15 * 1024 * 1024;

export const AVATAR_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const PROJECT_FILE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function extForAvatarMime(mime: string): "jpg" | "png" | "webp" | "gif" {
  if (mime === "image/png") {
    return "png";
  }
  if (mime === "image/webp") {
    return "webp";
  }
  if (mime === "image/gif") {
    return "gif";
  }
  return "jpg";
}

export function sanitizeFileBaseName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif)$/i;

/** Erkennt Bild-Anhänge auch bei leerem Browser-MIME (mobil) oder HEIC. */
export function isLikelyProjectImage(fileType: string, fileName: string): boolean {
  const t = (fileType || "").toLowerCase().trim();
  if (t.startsWith("image/")) return true;
  return IMAGE_EXT.test(fileName.trim());
}

/**
 * MIME für DB + Storage: Browser liefert oft `""` oder `image/jpg`; Storage-Bucket prüft den Typ.
 */
export function inferStoredProjectFileMime(file: File): string {
  const raw = (file.type || "").toLowerCase().trim();
  if (raw === "image/jpg") return "image/jpeg";
  if (raw && PROJECT_FILE_MIME.has(raw)) return raw;
  const lower = file.name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  const byExt: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  if (ext && byExt[ext]) return byExt[ext]!;
  if (raw) return raw;
  return "application/octet-stream";
}
