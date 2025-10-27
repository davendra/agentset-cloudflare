export default function RootPage() {
  // This component should never actually render because middleware
  // redirects unauthenticated users to /login
  // and authenticated users' requests are rewritten to /app.agentset.ai/
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
