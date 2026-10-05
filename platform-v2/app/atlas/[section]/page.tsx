import { notFound, redirect } from "next/navigation";
import { DATA_SECTIONS, type DataSection } from "@/lib/data-sections";

export default async function AtlasSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!Object.prototype.hasOwnProperty.call(DATA_SECTIONS, section)) notFound();
  redirect(DATA_SECTIONS[section as DataSection].href);
}
