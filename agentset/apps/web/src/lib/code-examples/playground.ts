export const curlExample = /* bash */ `
curl --request POST \\
  --url https://api.agentset.ai/v1/namespace/{{namespace}}/search \\
  --header 'Authorization: Bearer <token>' \\
  --header 'Content-Type: application/json' \\
  --data '{
  "query": "<string>",
  "topK": 15,
  "includeMetadata": true
}'
`;

export const tsSdkExample = /* typescript */ `
import { Agentset } from "agentset";

const agentset = new Agentset({
  apiKey: "YOUR_API_KEY",
});

const ns = agentset.namespace("{{namespace}}");

const results = await ns.search({ query: "YOUR QUERY" });
console.log(results);
`;

export const aiSdkExample = /* typescript */ `
import { Agentset } from "agentset";
import { DEFAULT_PROMPT, makeAgentsetTool } from "@agentset/ai-sdk";
import { generateText } from "ai";

const agentset = new Agentset({
  apiKey: "YOUR_API_KEY",
});
const ns = agentset.namespace("{{namespace}}");

const result = await generateText({
  model: gpt4o,
  tools: {
    knowledgeBase: makeAgentsetTool(ns),
  },
  system: DEFAULT_SYSTEM_PROMPT,
  messages: [
    {
      role: 'user',
      content: '<question>',
    },
  ],
  maxSteps: 3,
});
console.log(result);
`;
