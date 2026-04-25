/**
 * Canvas helpers for P1-15 avatar crop.
 *
 * Given a source image URL (blob: or data:) and the crop region produced by
 * ``react-easy-crop``, draw the cropped region to a canvas of the target
 * output dimensions and return a WebP Blob.
 *
 * Minimum validation (size / dimensions) lives here too so the cropper
 * component and tests share a single source of truth.
 */

export interface CropArea {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface CropToWebpOptions {
	/** Final side length for avatars (square) or width for headers. */
	outputWidth: number;
	/** Final height; equals ``outputWidth`` for avatars, 1/3 for headers. */
	outputHeight: number;
	/** WebP quality, 0 to 1. Defaults to 0.8. */
	quality?: number;
}

/** Maximum allowed source file size (5 MiB) — matches backend. */
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

/** Minimum allowed source image dimension on either axis. */
export const MIN_SOURCE_EDGE = 200;

export const ACCEPTED_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

export type AcceptedType = (typeof ACCEPTED_TYPES)[number];

export function validateSourceFile(
	file: File,
): { ok: true } | { ok: false; message: string } {
	if (!ACCEPTED_TYPES.includes(file.type as AcceptedType)) {
		return { ok: false, message: "JPEG / PNG / WebP のみアップロードできます" };
	}
	if (file.size > MAX_SOURCE_BYTES) {
		return { ok: false, message: "画像サイズは 5MB 以下にしてください" };
	}
	return { ok: true };
}

/** Load a source URL as an ``HTMLImageElement``. Rejects on error. */
export function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
		img.src = src;
	});
}

export function validateSourceDimensions(
	image: HTMLImageElement,
): { ok: true } | { ok: false; message: string } {
	if (
		image.naturalWidth < MIN_SOURCE_EDGE ||
		image.naturalHeight < MIN_SOURCE_EDGE
	) {
		return {
			ok: false,
			message: `画像は ${MIN_SOURCE_EDGE}×${MIN_SOURCE_EDGE}px 以上が必要です`,
		};
	}
	return { ok: true };
}

/**
 * Draw the cropped region to a canvas sized to ``outputWidth × outputHeight``
 * and return a WebP Blob. The browser re-encodes to WebP at the given
 * quality; modern browsers default-support WebP since 2020.
 */
export async function cropToWebp(
	imageSrc: string,
	crop: CropArea,
	{ outputWidth, outputHeight, quality = 0.8 }: CropToWebpOptions,
): Promise<Blob> {
	const image = await loadImage(imageSrc);
	const dims = validateSourceDimensions(image);
	if (!dims.ok) {
		throw new Error(dims.message);
	}
	const canvas = document.createElement("canvas");
	canvas.width = outputWidth;
	canvas.height = outputHeight;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("canvas context unavailable");

	ctx.drawImage(
		image,
		crop.x,
		crop.y,
		crop.width,
		crop.height,
		0,
		0,
		outputWidth,
		outputHeight,
	);

	return await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					reject(new Error("WebP エンコードに失敗しました"));
					return;
				}
				resolve(blob);
			},
			"image/webp",
			quality,
		);
	});
}
