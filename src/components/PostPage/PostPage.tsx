import { useEffect } from 'react';
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
  useEffect(() => {
    const main = document.querySelector('.bw-main');
    if (main) {
      main.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [entryId]);
  return (
    <AppShell>
        <PageHeader
          title="Post"
          subtitle="Detalle de la entrada."
          leading={<BackButton onClick={onBack} ariaLabel="Volver" />}
        />

        <main className="bw-main bw-post-main">
          <FeedTabs
            currentUserId={currentUserId}
            isReadOnly={!currentUserId}
            entryIdsFilter={[entryId]}
            hideHeader
            commentMode="full"
          />
        </main>
    </AppShell>
  );
}
