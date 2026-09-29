/** Captures the frame currently shown by a (same-origin) video element as a JPEG data URL. */
export function captureFrame(video: HTMLVideoElement, maxSide = 1024): string {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export interface ExtractedFrame {
  time: number;
  src: string;
}

/** Seeks an off-screen copy of the clip to evenly spaced times and grabs a frame at each. */
export async function extractFrames(src: string, count = 5, maxSide = 480): Promise<ExtractedFrame[]> {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.src = src;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Could not load clip"));
  });
  const frames: ExtractedFrame[] = [];
  const end = Math.max(0, video.duration - 0.05);
  for (let i = 0; i < count; i++) {
    const time = (end * i) / (count - 1);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = time;
    });
    frames.push({ time, src: captureFrame(video, maxSide) });
  }
  video.removeAttribute("src");
  video.load();
  return frames;
}

export const formatTime = (t: number) => `0:${t.toFixed(1).padStart(4, "0")}`;
