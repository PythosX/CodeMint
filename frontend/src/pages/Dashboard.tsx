import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { Project } from '../types';
export default function Dashboard() {
  const { session } = useAuth(); const [stats, setStats] = useState<Record<string, number> | null>(null); const [projects, setProjects] = useState<Project[] | null>(null); const [err, setErr] = useState('');
  const load = () => { setErr(''); Promise.all([api<Record<string, number>>('/api/stats'), api<Project[]>('/api/projects')]).then(([s, p]) => { setStats(s); setProjects(p); }).catch((e) => setErr(e.message)); };
  useEffect(load, []);
  const name = session?.user.user_metadata?.full_name || session?.user.email?.split('@')[0] || '';
  return (<div>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Welcome back, {name}</h1><p className="text-sm text-mute">Here's what's happening with your applications.</p></div><Link to="/app/new" className="btn-primary">+ Analyze New Project</Link></div>
    {err && <div role="alert" className="card mt-6 p-4 text-sm text-bad">{err} <button className="ml-2 underline" onClick={load}>Retry</button></div>}
    {!err && !projects && <div className="mt-6 h-24 animate-pulse rounded-lg bg-card" />}
    {stats && <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">{[['Projects Analyzed', stats.projects], ['Total Reports', stats.reports], ['Open Findings', stats.open_findings], ['Resolved Findings', stats.resolved_findings]].map(([l, v]) => (<div key={l as string} className="card p-4"><div className="text-2xl font-semibold">{v}</div><div className="text-xs text-mute">{l}</div></div>))}</div>}
    {projects && projects.length === 0 && <div className="card mt-8 p-10 text-center"><h2 className="text-xl font-semibold">Your development workspace is ready.</h2><p className="mx-auto mt-2 max-w-sm text-sm text-mute">Add your first website or repository to discover what can be improved.</p><Link to="/app/new" className="btn-primary mt-5">Start Your First Analysis</Link></div>}
    {projects && projects.length > 0 && <div className="mt-8 grid gap-3 md:grid-cols-2">{projects.map((p) => { const s = p.scans?.[0]; return (<div key={p.id} className="card p-4"><div className="font-medium">{p.name}</div><div className="mt-1 truncate text-xs text-mute">{p.website_url || p.github_repository_url?.replace('https://github.com/', '')}</div>
      <div className="mt-3 flex items-center justify-between text-xs"><span className="text-mute">{s ? `${s.status} · ${s.findings?.[0]?.count ?? 0} findings` : 'Not analyzed yet'}</span>
        {s ? <Link className="text-cyan" to={`/app/scans/${s.id}`}>View report</Link> : <Link className="text-cyan" to="/app/new">Analyze</Link>}</div></div>); })}</div>}
  </div>);
}
