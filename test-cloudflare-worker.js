/**
 * Test script for Cloudflare Worker AI Search integration
 * Tests the deployed worker at https://agentset-ai-search.davendra.workers.dev
 */

const WORKER_URL = 'https://agentset-ai-search.davendra.workers.dev';

async function testWorkerSearch() {
  console.log('🧪 Testing Cloudflare Worker AI Search...\n');

  const testQuery = {
    query: "What is Cloudflare?",
    filters: { tenantId: "test" },
    workspaceId: "test-workspace",
    mode: "public",
    safety: "standard",
    modelRoute: "final-answer",
    temperature: 0.7,
    max_tokens: 500
  };

  console.log('📤 Request:');
  console.log(JSON.stringify(testQuery, null, 2));
  console.log('\n---\n');

  try {
    const response = await fetch(`${WORKER_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testQuery)
    });

    console.log(`📥 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📥 Response Headers:`, Object.fromEntries(response.headers.entries()));
    console.log('\n---\n');

    const data = await response.json();
    console.log('📥 Response Body:');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Test PASSED - Worker responded successfully');
      if (data.answer) {
        console.log(`\n💡 Answer: ${data.answer.substring(0, 200)}...`);
      }
      if (data.sources && data.sources.length > 0) {
        console.log(`\n📚 Found ${data.sources.length} sources`);
      }
    } else {
      console.log('\n❌ Test FAILED - Worker returned an error');
    }
  } catch (error) {
    console.error('\n❌ Test FAILED - Error:', error.message);
  }
}

// Run the test
testWorkerSearch();
