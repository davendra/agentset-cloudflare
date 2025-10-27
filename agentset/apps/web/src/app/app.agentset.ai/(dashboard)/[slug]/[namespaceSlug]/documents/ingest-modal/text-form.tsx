import { useNamespace } from "@/hooks/use-namespace";
import { logEvent } from "@/lib/analytics";
import { useTRPC } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";

import { Button } from "@agentset/ui/button";
import { DialogFooter } from "@agentset/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@agentset/ui/form";
import { Input } from "@agentset/ui/input";
import { Textarea } from "@agentset/ui/textarea";
import { configSchema } from "@agentset/validation";

import IngestConfig from "./config";

const schema = z
  .object({
    name: z.string().optional(),
    text: z.string().min(10, "Text must be at least 10 characters"),
  })
  .extend(configSchema.shape);

export default function TextForm({ onSuccess }: { onSuccess: () => void }) {
  const namespace = useNamespace();
  const trpc = useTRPC();

  const form = useForm({
    resolver: zodResolver(schema),
  });

  const { mutateAsync, isPending } = useMutation(
    trpc.ingestJob.ingest.mutationOptions({
      onSuccess: (doc) => {
        logEvent("document_ingested", {
          type: "text",
          namespaceId: namespace.id,
          chunkSize: doc.config?.chunkSize,
          maxChunkSize: doc.config?.maxChunkSize,
          chunkOverlap: doc.config?.chunkOverlap,
          strategy: doc.config?.strategy,
          chunkingStrategy: doc.config?.chunkingStrategy,
          hasMetadata: !!doc.config?.metadata,
        });
        onSuccess();
      },
    }),
  );

  const handleTextSubmit = async (data: z.infer<typeof schema>) => {
    await mutateAsync({
      namespaceId: namespace.id,
      name: data.name,
      payload: {
        type: "TEXT",
        fileName: data.name,
        text: data.text,
      },
      config:
        data.chunkSize ||
        data.maxChunkSize ||
        data.chunkOverlap ||
        data.metadata
          ? {
              chunkSize: data.chunkSize,
              maxChunkSize: data.maxChunkSize,
              chunkOverlap: data.chunkOverlap,
              metadata: data.metadata,
            }
          : undefined,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleTextSubmit)}>
        <div className="flex flex-col gap-6 py-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="example.txt" {...field} />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Text</FormLabel>
                <FormControl>
                  <Textarea
                    id="text"
                    placeholder="Enter your text here"
                    className="max-h-[400px] min-h-[200px]"
                    {...field}
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <IngestConfig form={form} />
        </div>

        <DialogFooter>
          <Button type="submit" isLoading={isPending}>
            Ingest Text
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
