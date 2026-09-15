"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, X } from "lucide-react";

const MAX_EDGE = 1600;
const TARGET_BYTES = 900_000;

async function blobToJpegFile(blob: Blob, name: string) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the photo");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.86;
  let out: Blob | null = null;
  while (quality >= 0.45) {
    out = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (out && out.size <= TARGET_BYTES) break;
    quality -= 0.12;
  }
  if (!out) throw new Error("Could not save the photo");
  const base = name.replace(/\.[^.]+$/, "") || "id-card";
  return new File([out], `${base}.jpg`, { type: "image/jpeg" });
}

function assignFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
}

export function IdCardCapture({
  name,
  label,
  required = false,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [hint, setHint] = useState("");

  function stopLive() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
  }

  useEffect(() => () => stopLive(), []);

  useEffect(() => {
    if (!live || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play();
  }, [live]);

  async function useFile(file: File | undefined) {
    if (!file || !fileRef.current) return;
    setBusy(true);
    setHint("");
    try {
      const prepared = await blobToJpegFile(file, file.name || name);
      assignFile(fileRef.current, prepared);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(prepared);
      });
    } catch {
      setHint("That photo could not be read. Try another image or the camera again.");
    } finally {
      setBusy(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraFileRef.current) cameraFileRef.current.value = "";
    }
  }

  async function openLiveCamera() {
    setHint("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      cameraFileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setLive(true);
    } catch {
      cameraFileRef.current?.click();
    }
  }

  async function snapLive() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    stopLive();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (blob) await useFile(new File([blob], `${name}-camera.jpg`, { type: "image/jpeg" }));
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <input ref={fileRef} name={name} type="file" accept="image/jpeg" required={required} className="sr-only" />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void useFile(event.target.files?.[0])}
      />
      <input
        ref={cameraFileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => void useFile(event.target.files?.[0])}
      />
      <div className="overflow-hidden rounded-2xl border border-line bg-soft">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`${label} preview`} className="h-40 w-full object-contain bg-black/90" />
        ) : (
          <div className="grid h-32 place-items-center px-3 text-center text-xs text-muted">
            {busy ? "Preparing photo…" : "Choose a gallery photo or take one with the camera."}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-white text-xs font-semibold text-ink hover:bg-soft"
        >
          <ImageIcon className="size-3.5" />
          Gallery
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void openLiveCamera()}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-sidebar text-xs font-semibold text-white hover:bg-black"
        >
          <Camera className="size-3.5" />
          Camera
        </button>
      </div>
      {hint ? <p className="text-xs text-rose-700">{hint}</p> : null}

      {live ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-4 sm:place-items-center">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-black text-white shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-medium">Take {label.toLowerCase()}</p>
              <button type="button" onClick={stopLive} className="grid size-9 place-items-center rounded-full bg-white/10" aria-label="Close camera">
                <X className="size-4" />
              </button>
            </div>
            <video ref={videoRef} playsInline autoPlay muted className="h-72 w-full bg-black object-cover" />
            <div className="p-4">
              <button
                type="button"
                onClick={() => void snapLive()}
                className="h-12 w-full rounded-xl bg-accent text-sm font-semibold text-white"
              >
                Capture photo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
