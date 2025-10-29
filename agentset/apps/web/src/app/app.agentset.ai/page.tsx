"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

/**
 * App Root Page - Post-Login Redirect Handler
 *
 * This page handles routing after login since middleware can't use Prisma
 * to query organizations (edge runtime limitation).
 *
 * Flow:
 * 1. User logs in
 * 2. Middleware rewrites "/" to "/app.agentset.ai/" (this page)
 * 3. This component fetches user's organizations client-side
 * 4. Redirects to first org/namespace or create-organization page
 */
export default function AppRootPage() {
  const router = useRouter();
  const trpc = useTRPC();

  // Fetch user's organizations
  const { data: organizations, isLoading, error } = useQuery(
    trpc.organization.all.queryOptions({
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      staleTime: 0, // Always fetch fresh on mount
    })
  );

  useEffect(() => {
    // Wait for data to load
    if (isLoading) return;

    // Handle errors
    if (error) {
      console.error("[AppRootPage] Error fetching organizations:", error);
      router.push("/create-organization");
      return;
    }

    // If no organizations exist, redirect to create page
    if (!organizations || organizations.length === 0) {
      console.log("[AppRootPage] No organizations found, redirecting to create");
      router.push("/create-organization");
      return;
    }

    // Get first organization
    const firstOrg = organizations[0];

    // Try to fetch first namespace for this org
    const fetchNamespaces = async () => {
      try {
        const namespaces = await trpc.namespace.getOrgNamespaces.query({
          slug: firstOrg.slug,
        });

        if (namespaces && namespaces.length > 0) {
          // Redirect to first org and first namespace
          const firstNamespace = namespaces[0];
          const targetUrl = `/${firstOrg.slug}/${firstNamespace.slug}`;
          console.log("[AppRootPage] Redirecting to:", targetUrl);
          router.push(targetUrl);
        } else {
          // No namespaces, redirect to org page (where they can create one)
          const targetUrl = `/${firstOrg.slug}`;
          console.log("[AppRootPage] No namespaces, redirecting to:", targetUrl);
          router.push(targetUrl);
        }
      } catch (err) {
        console.error("[AppRootPage] Error fetching namespaces:", err);
        // Fallback to org page
        router.push(`/${firstOrg.slug}`);
      }
    };

    fetchNamespaces();
  }, [organizations, isLoading, error, router, trpc]);

  // Show loading state while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <p className="text-sm text-gray-600">Loading your workspace...</p>
      </div>
    </div>
  );
}
