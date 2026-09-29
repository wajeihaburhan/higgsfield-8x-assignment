import type { Metadata } from "next";
import { ImageComposer } from "@/components/studio/ImageComposer";
import { StudioScreen } from "@/components/studio/StudioScreen";

export const metadata: Metadata = { title: "Image Studio · Takes" };

export default function ImageStudioPage() {
  return <StudioScreen mode="image" composer={<ImageComposer />} />;
}
