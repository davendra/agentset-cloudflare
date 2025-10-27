"use client";

import { useNamespace } from "@/hooks/use-namespace";
import { useTRPC } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";

import { Button } from "@agentset/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@agentset/ui/form";
import { Input } from "@agentset/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentset/ui/select";
import { Skeleton } from "@agentset/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@agentset/ui/tabs";

const formSchema = z.object({
  endpoint: z.url().optional().or(z.literal("")),
  apiKey: z.string().optional(),
  cfModelRoute: z
    .enum(["final-answer", "fast-lane", "cheap"])
    .nullable()
    .optional(),
  cfSafetyLevel: z.enum(["off", "standard", "strict"]).nullable().optional(),
  cfCacheMode: z.enum(["public", "private"]).nullable().optional(),
  cfBudgetLimit: z.number().positive().nullable().optional(),
});

export default function CloudflareSettingsPage() {
  const namespace = useNamespace();
  const trpc = useTRPC();
  const [testingConnection, setTestingConnection] = useState(false);

  // Fetch current Cloudflare settings
  const { data: settings, isLoading: settingsLoading } =
    trpc.cloudflare.getSettings.useQuery(
      { namespaceId: namespace.id },
      { enabled: !namespace.isLoading },
    );

  const form = useForm({
    resolver: zodResolver(formSchema),
    values: {
      endpoint:
        ((settings?.cfSettings as Record<string, unknown> | null)
          ?.endpoint as string) ?? "",
      apiKey:
        ((settings?.cfSettings as Record<string, unknown> | null)
          ?.apiKey as string) ?? "",
      cfModelRoute: settings?.cfModelRoute ?? null,
      cfSafetyLevel: settings?.cfSafetyLevel ?? null,
      cfCacheMode: settings?.cfCacheMode ?? null,
      cfBudgetLimit: settings?.cfBudgetLimit ?? null,
    },
  });

  const { mutate: updateSettings, isPending } = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const cfSettings: Record<string, unknown> = {};
      if (data.endpoint) cfSettings.endpoint = data.endpoint;
      if (data.apiKey) cfSettings.apiKey = data.apiKey;

      return trpc.cloudflare.updateSettings.mutate({
        namespaceId: namespace.id,
        cfModelRoute: data.cfModelRoute,
        cfSafetyLevel: data.cfSafetyLevel,
        cfCacheMode: data.cfCacheMode,
        cfBudgetLimit: data.cfBudgetLimit,
        cfSettings: Object.keys(cfSettings).length > 0 ? cfSettings : null,
      });
    },
    onSuccess: () => {
      toast.success("Cloudflare settings updated successfully");
      void trpc.cloudflare.getSettings.invalidate({ namespaceId: namespace.id });
      void trpc.namespace.getNamespaceBySlug.invalidate({
        slug: namespace.slug,
        orgSlug: namespace.organization.slug,
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update Cloudflare settings",
      );
    },
  });

  const { mutate: testConnection } = useMutation({
    mutationFn: async () => {
      const endpoint = form.getValues("endpoint");
      const apiKey = form.getValues("apiKey");

      if (!endpoint) {
        throw new Error("Endpoint is required to test connection");
      }

      return trpc.cloudflare.testConnection.mutate({
        namespaceId: namespace.id,
        endpoint,
        apiKey,
      });
    },
    onMutate: () => {
      setTestingConnection(true);
    },
    onSuccess: (data) => {
      toast.success(`Connection successful! Latency: ${data.latency}ms`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to connect to Cloudflare Worker",
      );
    },
    onSettled: () => {
      setTestingConnection(false);
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    updateSettings(data);
  };

  if (namespace.isLoading || settingsLoading) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const isDirty = form.formState.isDirty;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Cloudflare AI Search Settings</h2>
        <p className="text-muted-foreground text-sm">
          Configure Cloudflare AI Search integration for this namespace.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="models">Models</TabsTrigger>
              <TabsTrigger value="safety">Safety</TabsTrigger>
              <TabsTrigger value="caching">Caching</TabsTrigger>
              <TabsTrigger value="budget">Budget</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <FormField
                control={form.control}
                name="endpoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Worker Endpoint</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://agentset-ai-search.<sub>.workers.dev"
                      />
                    </FormControl>
                    <FormDescription>
                      The URL of your Cloudflare Worker that handles AI Search
                      requests. Leave empty to use the default endpoint.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Optional Worker API key"
                      />
                    </FormControl>
                    <FormDescription>
                      Optional API key for authenticating with the Worker. Leave
                      empty to use the default key.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => testConnection()}
                isLoading={testingConnection}
                disabled={!form.getValues("endpoint")}
              >
                Test Connection
              </Button>
            </TabsContent>

            {/* Models Tab */}
            <TabsContent value="models" className="space-y-4 mt-4">
              <FormField
                control={form.control}
                name="cfModelRoute"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model Route</FormLabel>
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select model route" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="final-answer">
                          Final Answer (Quality)
                        </SelectItem>
                        <SelectItem value="fast-lane">
                          Fast Lane (Low Latency)
                        </SelectItem>
                        <SelectItem value="cheap">Cheap (Budget)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the AI Gateway model route for balancing quality,
                      latency, and cost.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-muted rounded-lg border p-4 space-y-2">
                <h3 className="font-medium text-sm">Model Route Details</h3>
                <ul className="text-muted-foreground text-xs space-y-1">
                  <li>
                    <strong>Final Answer:</strong> Best quality, higher latency
                    and cost
                  </li>
                  <li>
                    <strong>Fast Lane:</strong> Balanced quality and low
                    latency
                  </li>
                  <li>
                    <strong>Cheap:</strong> Budget-optimized, acceptable
                    quality
                  </li>
                </ul>
              </div>
            </TabsContent>

            {/* Safety Tab */}
            <TabsContent value="safety" className="space-y-4 mt-4">
              <FormField
                control={form.control}
                name="cfSafetyLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Safety Level</FormLabel>
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select safety level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="off">Off</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="strict">Strict</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Configure Cloudflare Guardrails safety level for content
                      filtering.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-muted rounded-lg border p-4 space-y-2">
                <h3 className="font-medium text-sm">Safety Level Details</h3>
                <ul className="text-muted-foreground text-xs space-y-1">
                  <li>
                    <strong>Off:</strong> No content filtering
                  </li>
                  <li>
                    <strong>Standard:</strong> Basic content filtering for
                    harmful content
                  </li>
                  <li>
                    <strong>Strict:</strong> Aggressive filtering for sensitive
                    applications
                  </li>
                </ul>
              </div>
            </TabsContent>

            {/* Caching Tab */}
            <TabsContent value="caching" className="space-y-4 mt-4">
              <FormField
                control={form.control}
                name="cfCacheMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cache Mode</FormLabel>
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select cache mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Control caching behavior for identical queries.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-muted rounded-lg border p-4 space-y-2">
                <h3 className="font-medium text-sm">Cache Mode Details</h3>
                <ul className="text-muted-foreground text-xs space-y-1">
                  <li>
                    <strong>Public:</strong> Enable global caching for identical
                    prompts (faster, cheaper)
                  </li>
                  <li>
                    <strong>Private:</strong> Disable caching (more secure,
                    slower, higher cost)
                  </li>
                </ul>
              </div>
            </TabsContent>

            {/* Budget Tab */}
            <TabsContent value="budget" className="space-y-4 mt-4">
              <FormField
                control={form.control}
                name="cfBudgetLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget Limit (USD)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="100.00"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value ? parseFloat(value) : null);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional monthly budget limit for this namespace. Queries
                      will be blocked when the limit is reached.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-muted rounded-lg border p-4 space-y-2">
                <h3 className="font-medium text-sm">Budget Management</h3>
                <p className="text-muted-foreground text-xs">
                  Setting a budget limit helps prevent unexpected costs. You can
                  monitor usage in the metrics dashboard.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={!isDirty} isLoading={isPending}>
              Save Settings
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              disabled={!isDirty}
            >
              Reset
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
