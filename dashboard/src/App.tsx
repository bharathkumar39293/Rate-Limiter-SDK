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
  const [apiKey, setApiKey] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!apiKey) { setData(null); setError('Enter an API key to view statistics'); return; }
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL}/api/stats`, { headers: { 'x-api-key': apiKey } });
      if (response.status === 401) { setData(null); setError('Invalid or revoked API key'); return; }
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
  }, [apiKey]);

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

      <label>API key <input type="password" autoComplete="off" value={apiKey} onChange={event => { setData(null); setApiKey(event.target.value); }} /></label>
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
