import React from 'react';

interface ClientStats {
  user_id: string;
  hit_count: string;
  blocked_count: string;
}

interface ClientsProps {
  data: ClientStats[];
}

export const Clients: React.FC<ClientsProps> = ({ data }) => {
  return (
    <div className="table-container">
      <h2>Top Heaviest Users</h2>
      <table>
        <thead>
          <tr>
            <th>User ID</th>
            <th>Total Hits</th>
            <th>Blocked Hits</th>
            <th>Health Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((user) => {
            const hitRatio = Number(user.blocked_count) / Number(user.hit_count);
            const isAbusive = hitRatio > 0.5;

            return (
              <tr key={user.user_id}>
                <td style={{ fontFamily: 'monospace' }}>{user.user_id}</td>
                <td>{user.hit_count}</td>
                <td>{user.blocked_count}</td>
                <td>
                  <span className={`badge ${isAbusive ? 'blocked' : 'allowed'}`}>
                    {isAbusive ? 'Abusive' : 'Healthy'}
                  </span>
                </td>
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                No user data available yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
