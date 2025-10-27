# @agentset-cf/tools

TypeScript client library for integrating AgentSet UI with Cloudflare Worker AI Search and Gateway.

## Installation

```bash
pnpm add @agentset-cf/tools
```

## Quick Start

```typescript
import { createCloudflareSearchTool } from '@agentset-cf/tools';

// Create client instance
const searchTool = createCloudflareSearchTool({
  endpoint: 'https://agentset-ai-search.sub.workers.dev',
  apiKey: process.env.CF_API_KEY, // Optional
  timeout: 30000,
});

// Perform a search
const response = await searchTool.search({
  query: 'What is the AgentSet platform?',
  workspaceId: 'workspace-123',
  modelRoute: 'final-answer',
  safety: 'standard',
});

console.log(response.answer);
console.log(response.sources);
```

## API Reference

### `CloudflareSearchTool`

Main client class for interacting with the Cloudflare Worker.

#### Constructor

```typescript
new CloudflareSearchTool(config: CloudflareSearchToolConfig)
```

**Config Options:**
- `endpoint` (string, required): Worker URL
- `apiKey` (string, optional): Authentication token
- `timeout` (number, optional): Request timeout in ms (default: 30000)
- `maxRetries` (number, optional): Max retry attempts (default: 3)
- `retryDelay` (number, optional): Initial retry delay in ms (default: 1000)

#### Methods

##### `search(options: SearchOptions): Promise<SearchResponse>`

Perform a search query.

**Options:**
- `query` (string, required): Search query text
- `workspaceId` (string, optional): Workspace identifier for tenant isolation
- `filters` (object, optional): Metadata filters for search refinement
- `mode` ('public' | 'private', optional): Cache mode
- `safety` ('off' | 'standard' | 'strict', optional): Content moderation level
- `modelRoute` ('final-answer' | 'fast-lane' | 'cheap', optional): Model selection
  - `final-answer`: Claude 3.5 Sonnet (quality)
  - `fast-lane`: GPT-4o mini (speed)
  - `cheap`: Workers AI Llama 3 (cost)
- `temperature` (number, optional): LLM temperature (0-2)
- `max_tokens` (number, optional): Max response tokens

**Returns:**
```typescript
{
  answer: string;
  sources: Array<{
    idx: number;
    score: number;
    metadata: Record<string, unknown>;
    preview: string;
    url?: string;
  }>;
  metadata?: {
    model?: string;
    tokens?: number;
    cached?: boolean;
    latency?: number;
  };
}
```

##### `health(): Promise<boolean>`

Check Worker health status.

##### `updateConfig(config: Partial<CloudflareSearchToolConfig>): void`

Update client configuration.

##### `getEndpoint(): string`

Get the current endpoint URL.

## Examples

### Basic Search

```typescript
const response = await searchTool.search({
  query: 'How do I configure the API?',
});
```

### Search with Workspace Isolation

```typescript
const response = await searchTool.search({
  query: 'Show me the latest reports',
  workspaceId: 'workspace-abc123',
  filters: {
    tenantId: 'tenant-456',
    documentType: 'report',
  },
});
```

### Fast Response with Caching

```typescript
const response = await searchTool.search({
  query: 'What are the pricing tiers?',
  modelRoute: 'fast-lane', // Use faster model
  mode: 'public', // Enable caching
});
```

### Strict Safety with Custom Parameters

```typescript
const response = await searchTool.search({
  query: 'Explain the security features',
  safety: 'strict',
  temperature: 0.2,
  max_tokens: 800,
});
```

### Health Check

```typescript
const isHealthy = await searchTool.health();
if (!isHealthy) {
  console.error('Worker is not responding');
}
```

### Error Handling

```typescript
import { CloudflareSearchError } from '@agentset-cf/tools';

try {
  const response = await searchTool.search({
    query: 'My query',
  });
} catch (error) {
  if (error instanceof CloudflareSearchError) {
    console.error(`Error: ${error.message}`);
    console.error(`Status: ${error.statusCode}`);
    console.error(`Details:`, error.details);
  }
}
```

## Features

- ✅ Full TypeScript support with comprehensive types
- ✅ Automatic retry with exponential backoff
- ✅ Configurable timeouts and error handling
- ✅ Request/response validation
- ✅ Health check endpoint
- ✅ Support for all Worker parameters
- ✅ Typed error handling
- ✅ Zero dependencies

## License

MIT
