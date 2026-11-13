import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { Project, Scan } from '../types';
export default function Projects() {
  const nav = useNavigate(); const [list, setList] = useState<Project[] | null>(null); const [q, setQ] = useState(''); const [type, setType] = useState(''); const [err, setErr] = useState('');
  const load = () => api<Project[]>('/api/projects').then(setList).catch((e) => setErr(e.message)); useEffect(() => { load(); }, []);
  async function rescan(id: string) { try { const s = await api<Scan>('/api/scans', { method: 'POST', body: { project_id: id } }); nav(`/app/scans/${s.id}`); } catch (e: any) { setErr(e.message); } }
  async function rename(p: Project) { const name = prompt('New project name', p.name); if (name?.trim()) { await api(`/api/projects/${p.id}`, { method: 'PATCH', body: { name } }).catch((e) => setErr(e.message)); load(); } }
  async function del(p: Project) { if (confirm(`Delete "${p.name}" and all its reports? This cannot be undone.`)) { await api(`/api/projects/${p.id}`, { method: 'DELETE' }).catch((e) => setErr(e.message)); load(); } }
  const shown = (list || []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) && (!type || p.analysis_type === type));
  return (<div><h1 className="text-2xl font-semibold">My Projects</h1>
    <div className="mt-4 flex gap-2"><input className="input" placeholder="Search projects" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
      <select className="input w-auto" aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="website">Website</option><option value="github">GitHub</option><option value="full">Full</option></select></div>
    {err && <p role="alert" className="mt-3 text-sm text-bad">{err}</p>}
    {list && !shown.length && <p className="mt-8 text-sm text-mute">No projects match. Start one from New Analysis.</p>}
    <div className="mt-4 space-y-2">{shown.map((p) => (<div key={p.id} className="card flex flex-wrap items-center justify-between gap-2 p-4"><div><div className="font-medium">{p.name}</div><div className="text-xs text-mute">{p.analysis_type} · {new Date(p.created_at).toLocaleDateString()}</div></div>
      <div className="flex gap-2 text-sm">{p.scans?.[0] && <button className="btn-ghost" onClick={() => nav(`/app/scans/${p.scans![0].id}`)}>Open report</button>}<button className="btn-ghost" onClick={() => rescan(p.id)}>Reanalyze</button><button className="btn-ghost" onClick={() => rename(p)}>Rename</button><button className="btn-ghost text-bad" onClick={() => del(p)}>Delete</button></div></div>))}</div></div>);
}
