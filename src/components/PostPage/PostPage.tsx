import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { FeedTabs } from '../FeedTabs/FeedTabs';
import { AppShell } from '../common/AppShell';
import { BackButton } from '../common/BackButton';
import { PageHeader } from '../common/PageHeader';
import '../../styles/layout.css';
import '../../styles/shared.css';
import { useTranslation } from 'react-i18next';

type PostPageProps = {
  session: Session | null;
  entryId: string;
  onBack: () => void;
};

export function PostPage({ session, entryId, onBack }: Readonly<PostPageProps>) {
  const { t } = useTranslation();
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
          title={t('feedPage.postTitle', { defaultValue: 'Post' })}
          subtitle={t('feedPage.postSubtitle', { defaultValue: 'Post details.' })}
          leading={<BackButton onClick={onBack} ariaLabel={t('common.back', { defaultValue: 'Back' })} />}
        />

        <main className="bw-main bw-post-main">
          <FeedTabs
            currentUserId={currentUserId}
            isReadOnly={!currentUserId}
            entryIdsFilter={[entryId]}
            hideHeader
            monthFilter="all"
            commentMode="full"
          />
        </main>
    </AppShell>
  );
}
