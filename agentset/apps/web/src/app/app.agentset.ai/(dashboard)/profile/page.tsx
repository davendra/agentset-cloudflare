import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { ChevronLeftIcon } from "lucide-react";

import ActiveSessions from "./active-sessions";
import EditUser from "./edit-user";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const allSessions = await auth.api.listSessions({
    headers: await headers(),
  });

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-10 flex items-center gap-2">
          <ChevronLeftIcon className="h-4 w-4" />
          <span className="text-sm font-medium">Back to dashboard</span>
        </Link>

        <EditUser />
        <ActiveSessions activeSessions={allSessions} />
      </div>
    </div>
  );
}
