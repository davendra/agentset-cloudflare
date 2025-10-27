"use client";

import { useNamespace } from "@/hooks/use-namespace";
import { useTRPC } from "@/trpc/react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@agentset/ui/button";
import { Label } from "@agentset/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentset/ui/select";
import { Skeleton } from "@agentset/ui/skeleton";

export default function NamespaceSettingsPage() {
  const namespace = useNamespace();
  const trpc = useTRPC();

  const { mutate: updateSettings, isPending } = useMutation({
    mutationFn: async (ragProvider: string | null) => {
      return trpc.cloudflare.updateSettings.mutate({
        namespaceId: namespace.id,
        ragProvider,
      });
    },
    onSuccess: () => {
      toast.success("RAG provider updated successfully");
      // Invalidate namespace query to refetch updated data
      void trpc.namespace.getNamespaceBySlug.invalidate({
        slug: namespace.slug,
        orgSlug: namespace.organization.slug,
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update RAG provider",
      );
    },
  });

  const handleProviderChange = (value: string) => {
    const provider = value === "default" ? null : value;
    updateSettings(provider);
  };

  const currentProvider = namespace.ragProvider ?? "default";
  const isCloudflareEnabled = currentProvider === "cloudflare";

  if (namespace.isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-96" />
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {/* RAG Provider Section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">RAG Provider</h2>
          <p className="text-muted-foreground text-sm">
            Choose between local vector store or Cloudflare AI Search for
            retrieval-augmented generation.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="rag-provider">Provider</Label>
          <Select
            value={currentProvider}
            onValueChange={handleProviderChange}
            disabled={isPending}
          >
            <SelectTrigger id="rag-provider" className="w-[300px]">
              <SelectValue placeholder="Select RAG provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Local Vector Store</SelectItem>
              <SelectItem value="cloudflare">Cloudflare AI Search</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {isCloudflareEnabled
              ? "Using Cloudflare AI Search with edge retrieval and model routing"
              : "Using local vector store with your configured embedding model"}
          </p>
        </div>

        {isCloudflareEnabled && (
          <div className="bg-muted rounded-lg border p-4">
            <p className="text-sm mb-2">
              Cloudflare integration is enabled for this namespace.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href={`${namespace.baseUrl}/settings/cloudflare`}>
                Configure Cloudflare Settings
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
