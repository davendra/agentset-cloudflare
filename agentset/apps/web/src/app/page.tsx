// Force dynamic rendering so middleware can handle redirects
export const dynamic = 'force-dynamic';

// Client-side redirect as fallback
import { redirect } from 'next/navigation';

export default function RootPage() {
  // This component should never actually render because middleware
  // redirects unauthenticated users to /login
  // and authenticated users' requests are rewritten to /app.agentset.ai/
  //
  // If we reach here, redirect client-side as fallback
  redirect('/login');
}
