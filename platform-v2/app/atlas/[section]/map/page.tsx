import { notFound, redirect } from "next/navigation";

export default async function AtlasSectionMapPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!["restaurants", "souvenir", "golf"].includes(section)) notFound();
  redirect("/spatial");
}
