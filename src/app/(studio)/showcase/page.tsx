import type { Metadata } from "next";
import { ShowcaseScreen } from "@/components/studio/ShowcaseScreen";

export const metadata: Metadata = { title: "Showcase · VEYRA" };

export default function ShowcasePage() {
  return <ShowcaseScreen />;
}
