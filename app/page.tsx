import { requireChatGPTUser } from './chatgpt-auth';
import { Dashboard } from './dashboard';
import { QueryProvider } from '@/components/query-provider';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireChatGPTUser('/');
  return (
    <QueryProvider>
      <Dashboard displayName={user.displayName} />
    </QueryProvider>
  );
}
