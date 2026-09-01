import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AuthPage from '@/components/AuthPage';
import Dashboard from '@/components/Dashboard';
import InspectionWorkflow from '@/components/InspectionWorkflow';
import InspectionDetail from '@/components/InspectionDetail';

type View = 'dashboard' | 'new-inspection' | 'inspection-detail';

function AppContent() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200 mb-4">
            <ShieldCheck className="w-9 h-9 text-white" strokeWidth={2.2} />
          </div>
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading PackCheck India...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (view === 'new-inspection') {
    return (
      <InspectionWorkflow
        onComplete={() => setView('dashboard')}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'inspection-detail' && selectedInspectionId) {
    return (
      <InspectionDetail
        inspectionId={selectedInspectionId}
        onBack={() => setView('dashboard')}
      />
    );
  }

  return (
    <Dashboard
      onNewInspection={() => setView('new-inspection')}
      onOpenInspection={(id) => {
        setSelectedInspectionId(id);
        setView('inspection-detail');
      }}
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
