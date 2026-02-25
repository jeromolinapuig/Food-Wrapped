import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { AppShell } from '../common/AppShell';
import { PageHeader } from '../common/PageHeader';
import '../../styles/layout.css';
import '../../styles/shared.css';

type AdminReportsPageProps = {
  session: Session;
};

type PendingReport = {
  id: string;
  entryId: string;
  reason: string | null;
  reporterId: string;
  createdAt: string | null;
};

export function AdminReportsPage({ session }: Readonly<AdminReportsPageProps>) {
  const navigate = useNavigate();
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    const { data } = await supabase
      .from('entry_reports')
      .select('id, entry_id, reporter_id, reason, created_at, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);

    const mapped = ((data ?? []) as {
      id: string;
      entry_id: string;
      reporter_id: string;
      reason: string | null;
      created_at: string | null;
    }[]).map((row) => ({
      id: row.id,
      entryId: row.entry_id,
      reporterId: row.reporter_id,
      reason: row.reason,
      createdAt: row.created_at,
    }));

    setReports(mapped);
    setReportsLoading(false);
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleReportStatus = async (reportId: string, status: 'resolved' | 'dismissed') => {
    await supabase
      .from('entry_reports')
      .update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: session.user.id,
      })
      .eq('id', reportId);

    await loadReports();
  };

  return (
    <AppShell>
      <PageHeader
        title="Admin · Reportes"
        subtitle="Moderacion por reportes de usuarios"
      />

      <main className="bw-main">
        <section className="bw-card" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: '0 0 8px' }}>Reportes pendientes</h3>
          {reportsLoading && <p className="bw-helper">Cargando reportes...</p>}
          {!reportsLoading && reports.length === 0 && <p className="bw-helper">No hay reportes pendientes.</p>}
          {!reportsLoading && reports.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {reports.map((report) => (
                <div key={report.id} className="bw-card" style={{ padding: 10 }}>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>
                    {report.reason || 'Sin motivo'} · {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'sin fecha'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="bw-btn bw-btn-ghost"
                      onClick={() => navigate(`/posts/${report.entryId}`, { state: { returnTo: '/admin/reports' } })}
                    >
                      Ver post
                    </button>
                    <button
                      type="button"
                      className="bw-btn bw-btn-primary"
                      onClick={() => void handleReportStatus(report.id, 'resolved')}
                    >
                      Resolver
                    </button>
                    <button
                      type="button"
                      className="bw-btn bw-btn-ghost"
                      onClick={() => void handleReportStatus(report.id, 'dismissed')}
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
