'use client';

import { useState, useEffect } from 'react';

export default function DbAdminPage() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [rows, setRows] = useState([]);
  const [sql, setSql] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/db-admin/tables');
      const data = await res.json();
      setTables(data.tables || []);
    } catch (err) {
      setError('Failed to fetch tables');
    }
  };

  const fetchRows = async (tableName) => {
    setLoading(true);
    setSelectedTable(tableName);
    try {
      const res = await fetch(`/api/db-admin/rows?table=${tableName}`);
      const data = await res.json();
      setRows(data.rows || []);
      setResult(null);
    } catch (err) {
      setError(`Failed to fetch rows for ${tableName}`);
    } finally {
      setLoading(false);
    }
  };

  const runSql = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/db-admin/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data.result);
        if (selectedTable) fetchRows(selectedTable);
      }
    } catch (err) {
      setError('Query execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            Smart Conference DB Manager
          </h1>
          <p className="text-slate-400">Manage your MariaDB instance</p>
        </div>
        <button 
          onClick={fetchTables}
          className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors text-sm"
        >
          Refresh Tables
        </button>
      </header>

      <div className="grid grid-cols-12 gap-8">
        {/* Sidebar: Tables */}
        <aside className="col-span-3 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-[calc(100vh-12rem)] overflow-y-auto">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Tables</h2>
          <ul className="space-y-2">
            {tables.map((table) => (
              <li key={table}>
                <button
                  onClick={() => fetchRows(table)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                    selectedTable === table 
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                      : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  {table}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main Content */}
        <main className="col-span-9 space-y-8">
          {/* SQL Editor */}
          <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">SQL Query Editor</h2>
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-all mb-4 h-32"
              placeholder="SELECT * FROM conferences LIMIT 10;"
            />
            <div className="flex justify-between items-center">
              <button
                onClick={runSql}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
              >
                {loading ? 'Executing...' : 'Run Query'}
              </button>
              {error && <p className="text-rose-500 text-sm">{error}</p>}
            </div>
          </section>

          {/* Data Table */}
          <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 overflow-x-auto max-h-[calc(100vh-35rem)]">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
              {selectedTable ? `Browsing: ${selectedTable}` : 'Query Results'}
            </h2>
            
            {result || rows.length > 0 ? (
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800">
                    {Object.keys((result?.[0] || rows[0]) || {}).map((key) => (
                      <th key={key} className="px-4 py-3 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(result || rows).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-4 py-3 text-slate-300 max-w-xs truncate">
                          {val === null ? <span className="text-slate-600 italic">null</span> : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-slate-600">
                {loading ? 'Loading data...' : 'Select a table or run a query to see results'}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
