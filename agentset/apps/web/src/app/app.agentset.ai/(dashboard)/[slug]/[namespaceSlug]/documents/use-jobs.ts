import { useState } from "react";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { useNamespace } from "@/hooks/use-namespace";
import { useTRPC } from "@/trpc/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { IngestJobStatus } from "@agentset/db";
import { capitalize } from "@agentset/utils";

const statusLabels = Object.values(IngestJobStatus).map((status) => ({
  label: capitalize(status.split("_").join(" ")) as string,
  value: status,
}));

export function useJobs() {
  const namespace = useNamespace();
  const trpc = useTRPC();
  const [statuses, _setStatuses] = useState<IngestJobStatus[]>([]);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const {
    cursor,
    cursorDirection,
    handleNext,
    handlePrevious,
    hasPrevious,
    reset,
  } = useCursorPagination();

  const { isLoading, data, refetch, isFetching } = useQuery(
    trpc.ingestJob.all.queryOptions(
      {
        namespaceId: namespace.id,
        statuses: statuses.length > 0 ? statuses.join(",") : undefined,
        cursor,
        cursorDirection,
      },
      { refetchInterval: 15_000, placeholderData: keepPreviousData }, // Refetch every 15 seconds
    ),
  );

  const setStatuses = (statuses: IngestJobStatus[]) => {
    _setStatuses(statuses);
    reset();
  };

  return {
    isLoading,
    isFetching,
    data,
    refetch,
    cursor,
    cursorDirection,
    handleNext,
    handlePrevious,
    hasPrevious,
    statuses,
    setStatuses,
    statusLabels,
    expandedJobId,
    setExpandedJobId,
  };
}
