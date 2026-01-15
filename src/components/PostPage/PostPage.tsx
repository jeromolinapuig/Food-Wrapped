import type { Session } from '@supabase/supabase-js';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import { AppShell } from '../common/AppShell';
import { BackButton } from '../common/BackButton';
import { PageHeader } from '../common/PageHeader';
import '../../styles/layout.css';
import '../../styles/shared.css';

type PostPageProps = {
  session: Session | null;
  entryId: string;
  onBack: () => void;
};

export function PostPage({ session, entryId, onBack }: Readonly<PostPageProps>) {
  const currentUserId = session?.user.id ?? null;
  return (
    <AppShell>
        <PageHeader
          title="Post"
          subtitle="Detalle de la entrada."
          leading={<BackButton onClick={onBack} ariaLabel="Volver" />}
        />

        <main className="bw-main">
          <FeedTabs
            currentUserId={currentUserId}
            isReadOnly={!currentUserId}
            entryIdsFilter={[entryId]}
            hideHeader
          />
        </main>
    </AppShell>
  );
}
