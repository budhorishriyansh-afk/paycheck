import { useEffect, useState } from 'react';
import { Plus, FileText, ChevronRight, Loader2, ShieldCheck, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Inspection, ComplianceStatus } from '@/types';

interface DashboardProps {
  onNewInspection: () => void;
  onOpenInspection: (id: string) => void;
}

const statusConfig: Record<ComplianceStatus, { icon: typeof ShieldCheck; color: string; bg: string; label: string }> = {
  passed: { icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Passed' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Failed' },
  review: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Review' },
};

export default function Dashboard({ onNewInspection, onOpenInspection }: DashboardProps) {
  const { user, signOut } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInspections();
  }, []);

  const loadInspections = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setInspections(data as Inspection[]);
    }
    setLoading(false);
  };

  const stats = {
    total: inspections.length,
    passed: inspections.filter((i) => i.compliance_status === 'passed').length,
    failed: inspections.filter((i) => i.compliance_status === 'failed').length,
    review: inspections.filter((i) => i.compliance_status === 'review').length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-200">
              <ShieldCheck className="w-5.5 h-5.5 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">
                PackCheck <span className="text-emerald-600">India</span>
              </h1>
              <p className="text-xs text-slate-400 leading-tight">Compliance Inspector</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-slate-500">{user?.email}</span>
            <button
              onClick={signOut}
              className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <StatCard label="Total Inspections" value={stats.total} icon={FileText} color="text-slate-700" bg="bg-slate-100" />
          <StatCard label="Passed" value={stats.passed} icon={ShieldCheck} color="text-emerald-600" bg="bg-emerald-50" />
          <StatCard label="Needs Review" value={stats.review} icon={AlertTriangle} color="text-amber-500" bg="bg-amber-50" />
          <StatCard label="Failed" value={stats.failed} icon={XCircle} color="text-red-500" bg="bg-red-50" />
        </div>

        {/* New Inspection Button */}
        <button
          onClick={onNewInspection}
          className="w-full mb-6 p-5 rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group flex items-center justify-center gap-3"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-500 group-hover:bg-emerald-600 flex items-center justify-center transition-colors">
            <Plus className="w-5.5 h-5.5 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-700 group-hover:text-emerald-700 transition-colors">
              Start New Inspection
            </p>
            <p className="text-sm text-slate-400 group-hover:text-emerald-600 transition-colors">
              Upload a product label and run compliance check
            </p>
          </div>
        </button>

        {/* Inspections List */}
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Recent Inspections
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : inspections.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No inspections yet. Start your first one above.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {inspections.map((insp) => {
              const cfg = insp.compliance_status ? statusConfig[insp.compliance_status] : null;
              const StatusIcon = cfg?.icon ?? Clock;
              return (
                <button
                  key={insp.id}
                  onClick={() => onOpenInspection(insp.id)}
                  className="w-full bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all p-4 flex items-center gap-4 text-left group"
                >
                  <div className={`w-11 h-11 rounded-xl ${cfg?.bg ?? 'bg-slate-100'} flex items-center justify-center shrink-0`}>
                    <StatusIcon className={`w-5 h-5 ${cfg?.color ?? 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{insp.product_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {insp.brand_name && <span className="text-sm text-slate-400 truncate">{insp.brand_name}</span>}
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-sm text-slate-400">
                        {new Date(insp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  {insp.compliance_score !== null && (
                    <div className="hidden sm:flex flex-col items-end shrink-0">
                      <span className={`text-lg font-bold ${cfg?.color ?? 'text-slate-400'}`}>
                        {insp.compliance_score}%
                      </span>
                      <span className="text-xs text-slate-400">{cfg?.label ?? 'Draft'}</span>
                    </div>
                  )}
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </main>
      <footer className="max-w-6xl mx-auto px-4 sm:px-6 pb-6">
        <p className="text-center text-xs text-slate-300">
          Crafted by Shriyansh Budhori
        </p>
      </footer>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
  color: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-2.5`}>
        <Icon className={`w-4.5 h-4.5 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}
