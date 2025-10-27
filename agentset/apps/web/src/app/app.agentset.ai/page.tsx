import { redirect } from "next/navigation";

export default function AppRootPage() {
  // In production, this would query the user's organizations
  // For dev mode, redirect to a placeholder or show organization selector
  // For now, just show a message that org setup is needed
  redirect("/create-organization");
}
