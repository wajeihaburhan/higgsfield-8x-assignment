import type { Metadata } from "next";
import { ShowcaseScreen } from "@/components/studio/ShowcaseScreen";

export const metadata: Metadata = { title: "Showcase · Takes" };

export default function ShowcasePage() {
  return <ShowcaseScreen />;
}
