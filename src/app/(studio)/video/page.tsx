import type { Metadata } from "next";
import { StudioScreen } from "@/components/studio/StudioScreen";
import { VideoComposer } from "@/components/studio/VideoComposer";

export const metadata: Metadata = { title: "Video Studio · Takes" };

export default function VideoStudioPage() {
  return <StudioScreen mode="video" composer={<VideoComposer />} />;
}
