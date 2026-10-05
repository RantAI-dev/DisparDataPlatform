import { redirect } from "next/navigation";
import { DATA_SECTIONS } from "@/lib/data-sections";

export default function HotelPage() {
  redirect(DATA_SECTIONS.hotel.href);
}
