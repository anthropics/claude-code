"use client";

import React, { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "react-toastify";

import Spinner from "@/components/shared/Spinner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { uploadImage, type UploadKind } from "@/lib/api/uploads";
import {
	ACCEPTED_TYPES,
	cropToWebp,
	validateSourceFile,
} from "@/lib/images/cropToWebp";

interface ImageCropperProps {
	kind: UploadKind;
	/** Called with the uploaded public URL after a successful crop + upload. */
	onUploaded: (publicUrl: string) => void;
	/** Optional className for the trigger button. */
	className?: string;
	/** Trigger button label. Defaults to 「画像をアップロード」. */
	label?: string;
}

const OUTPUT = {
	avatar: { width: 400, height: 400, aspect: 1, cropShape: "round" as const },
	header: { width: 1200, height: 400, aspect: 3, cropShape: "rect" as const },
};

/**
 * Modal-based image cropper (P1-15).
 *
 * - ``react-easy-crop`` for the gesture-capable zoom/pan UI (works on touch).
 * - Avatars use a circular mask 1:1; headers use a 3:1 rectangle.
 * - On confirm: crop → WebP → presigned PUT → PATCH /users/me/.
 * - Errors (client-side validation, S3 403, DRF 429) surface as ``toast.error``.
 */
export default function ImageCropper({
	kind,
	onUploaded,
	className,
	label,
}: ImageCropperProps) {
	const [open, setOpen] = useState(false);
	const [imageSrc, setImageSrc] = useState<string | null>(null);
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedArea, setCroppedArea] = useState<Area | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const onCropComplete = useCallback((_: Area, pixels: Area) => {
		setCroppedArea(pixels);
	}, []);

	const onFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		const validation = validateSourceFile(file);
		if (!validation.ok) {
			toast.error(validation.message);
			event.target.value = "";
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			setImageSrc(reader.result as string);
			setOpen(true);
		};
		reader.onerror = () => toast.error("画像の読み込みに失敗しました");
		reader.readAsDataURL(file);
		event.target.value = "";
	};

	const onConfirm = async () => {
		if (!imageSrc || !croppedArea) return;
		setIsUploading(true);
		try {
			const shape = OUTPUT[kind];
			const blob = await cropToWebp(imageSrc, croppedArea, {
				outputWidth: shape.width,
				outputHeight: shape.height,
				quality: 0.8,
			});
			const url = await uploadImage(kind, blob);
			onUploaded(url);
			toast.success("画像をアップロードしました");
			setOpen(false);
			setImageSrc(null);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "画像アップロードに失敗しました";
			toast.error(message);
		} finally {
			setIsUploading(false);
		}
	};

	const shape = OUTPUT[kind];

	return (
		<>
			<input
				ref={fileInputRef}
				type="file"
				accept={ACCEPTED_TYPES.join(",")}
				onChange={onFileSelected}
				className="sr-only"
				aria-label={
					kind === "avatar" ? "アバター画像を選択" : "ヘッダー画像を選択"
				}
			/>
			<Button
				type="button"
				onClick={() => fileInputRef.current?.click()}
				className={className}
			>
				{label ?? "画像をアップロード"}
			</Button>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-xl">
					<DialogHeader>
						<DialogTitle>
							{kind === "avatar" ? "アバターの調整" : "ヘッダーの調整"}
						</DialogTitle>
					</DialogHeader>
					<div className="relative h-80 w-full overflow-hidden rounded-md bg-black">
						{imageSrc && (
							<Cropper
								image={imageSrc}
								crop={crop}
								zoom={zoom}
								aspect={shape.aspect}
								cropShape={shape.cropShape}
								showGrid={false}
								onCropChange={setCrop}
								onZoomChange={setZoom}
								onCropComplete={onCropComplete}
							/>
						)}
					</div>
					<label className="mt-3 block text-sm">
						<span className="mb-1 block">ズーム</span>
						<input
							type="range"
							min={1}
							max={3}
							step={0.01}
							value={zoom}
							onChange={(e) => setZoom(Number(e.target.value))}
							className="w-full"
						/>
					</label>
					<DialogFooter>
						<Button
							variant="secondary"
							type="button"
							onClick={() => setOpen(false)}
							disabled={isUploading}
						>
							キャンセル
						</Button>
						<Button type="button" onClick={onConfirm} disabled={isUploading}>
							{isUploading ? <Spinner size="sm" /> : "アップロード"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
