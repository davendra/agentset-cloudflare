"use client";

import { useNamespace } from "@/hooks/use-namespace";
import { useTRPC } from "@/trpc/react";
import { useState } from "react";

import { Button } from "@agentset/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@agentset/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@agentset/ui/select";
import { Skeleton } from "@agentset/ui/skeleton";

type TimeRange = "7d" | "30d" | "90d" | "all";

const getDateRange = (range: TimeRange) => {
  const now = new Date();
  const ranges: Record<TimeRange, { startDate?: Date; endDate?: Date }> = {
    "7d": {
      startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      endDate: now,
    },
    "30d": {
      startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endDate: now,
    },
    "90d": {
      startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      endDate: now,
    },
    all: {},
  };
  return ranges[range];
};

export default function CloudflareMetricsPage() {
  const namespace = useNamespace();
  const trpc = useTRPC();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  const dateRange = getDateRange(timeRange);

  // Fetch metrics summary
  const { data: summary, isLoading: summaryLoading } =
    trpc.cloudflare.getMetricsSummary.useQuery(
      {
        namespaceId: namespace.id,
        ...dateRange,
      },
      { enabled: !namespace.isLoading },
    );

  // Fetch detailed metrics
  const { data: metrics, isLoading: metricsLoading } =
    trpc.cloudflare.getMetrics.useQuery(
      {
        namespaceId: namespace.id,
        ...dateRange,
        limit: 100,
      },
      { enabled: !namespace.isLoading },
    );

  const isLoading = namespace.isLoading || summaryLoading || metricsLoading;

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return "0";
    return new Intl.NumberFormat().format(num);
  };

  const formatCurrency = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const formatPercent = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return "0%";
    return `${(num * 100).toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const hasData =
    summary && (summary.totalQueries > 0 || metrics && metrics.length > 0);

  return (
    <div className="flex max-w-7xl flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">Cloudflare Metrics Dashboard</h2>
          <p className="text-muted-foreground text-sm">
            Monitor performance, costs, and usage for Cloudflare AI Search
          </p>
        </div>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground text-sm mb-4">
              No metrics data available for the selected time range.
            </p>
            <p className="text-muted-foreground text-xs">
              Metrics will appear once you start using Cloudflare AI Search.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(summary?.totalQueries)}
                </div>
                <p className="text-muted-foreground text-xs mt-1">
                  Queries processed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Latency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary?.avgLatency ? `${summary.avgLatency.toFixed(0)}ms` : "N/A"}
                </div>
                <p className="text-muted-foreground text-xs mt-1">
                  Average response time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Cache Hit Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPercent(summary?.cacheHitRate)}
                </div>
                <p className="text-muted-foreground text-xs mt-1">
                  {formatNumber(summary?.totalCacheHits)} hits / {formatNumber((summary?.totalCacheHits ?? 0) + (summary?.totalCacheMisses ?? 0))} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary?.totalCost)}
                </div>
                <p className="text-muted-foreground text-xs mt-1">
                  {formatNumber(summary?.totalTokens)} tokens used
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Metrics */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
                <CardDescription>Query and cache metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Cache Hits</span>
                  <span className="font-medium">
                    {formatNumber(summary?.totalCacheHits)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Cache Misses</span>
                  <span className="font-medium">
                    {formatNumber(summary?.totalCacheMisses)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Error Count</span>
                  <span className="font-medium text-destructive">
                    {formatNumber(summary?.totalErrors)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Average Latency</span>
                  <span className="font-medium">
                    {summary?.avgLatency ? `${summary.avgLatency.toFixed(0)}ms` : "N/A"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
                <CardDescription>Token usage and costs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total Cost</span>
                  <span className="font-medium">
                    {formatCurrency(summary?.totalCost)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total Tokens</span>
                  <span className="font-medium">
                    {formatNumber(summary?.totalTokens)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Queries</span>
                  <span className="font-medium">
                    {formatNumber(summary?.totalQueries)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Cost per Query</span>
                  <span className="font-medium">
                    {summary?.totalCost && summary?.totalQueries
                      ? formatCurrency(summary.totalCost / summary.totalQueries)
                      : "$0.00"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Metrics Table */}
          {metrics && metrics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Last {metrics.length} metric entries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Timestamp</th>
                        <th className="text-right p-2">Queries</th>
                        <th className="text-right p-2">Latency (ms)</th>
                        <th className="text-right p-2">Cache Hits</th>
                        <th className="text-right p-2">Errors</th>
                        <th className="text-right p-2">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.slice(0, 10).map((metric, idx) => (
                        <tr key={metric.id ?? idx} className="border-b">
                          <td className="p-2">
                            {new Date(metric.timestamp).toLocaleString()}
                          </td>
                          <td className="text-right p-2">{metric.queryCount}</td>
                          <td className="text-right p-2">
                            {metric.avgLatencyMs ? metric.avgLatencyMs.toFixed(0) : "-"}
                          </td>
                          <td className="text-right p-2">{metric.cacheHits}</td>
                          <td className="text-right p-2">{metric.errorCount}</td>
                          <td className="text-right p-2">
                            {formatCurrency(metric.totalCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
