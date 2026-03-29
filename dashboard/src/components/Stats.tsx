import React from 'react';

interface StatsProps {
  total: string;
  blocked: string;
  allowed: string;
}

export const Stats: React.FC<StatsProps> = ({ total, blocked, allowed }) => {
  return (
    <div className="grid">
      <div className="card">
        <h3>Total Requests</h3>
        <div className="value accent">{total}</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>All time traffic</p>
      </div>
      <div className="card">
        <h3>Allowed</h3>
        <div className="value success">{allowed}</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Successfully processed</p>
      </div>
      <div className="card">
        <h3>Blocked (429)</h3>
        <div className="value danger">{blocked}</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Rate limit exceeded</p>
      </div>
    </div>
  );
};
