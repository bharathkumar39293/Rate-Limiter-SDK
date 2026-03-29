import { useEffect, useState } from 'react'
import { Stats } from './components/Stats'
import { Clients } from './components/Clients'
import './index.css'

interface DashboardData {
  totals: {
    total_requests: string;
    blocked_requests: string;
  };
  recent: any[];
  topUsers: any[];
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError('Could not connect to the API Server. Is it running?');
    }
  };

  useEffect(() => {
    fetchStats();
    // Poll every 3 seconds for live updates
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-container">
      <header className="header">
        <h1>Rate Limiter Dashboard</h1>
        <div className="status">
          {error ? (
            <span style={{ color: 'var(--danger)' }}>Disconnected</span>
          ) : (
            <>
              <div className="status-dot"></div>
              <span>Live System</span>
            </>
          )}
        </div>
      </header>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '2rem' }}>
          {error}
        </div>
      )}

      {data && (
        <>
          <Stats 
            total={data.totals.total_requests || '0'} 
            blocked={data.totals.blocked_requests || '0'} 
            allowed={String(Number(data.totals.total_requests || 0) - Number(data.totals.blocked_requests || 0))} 
          />
          <Clients data={data.topUsers} />
        </>
      )}
    </div>
  )
}

export default App
