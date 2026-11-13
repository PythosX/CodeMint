import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { Project, Scan } from '../types';
export default function NewAnalysis() {
  const nav = useNavigate(); const [f, setF] = useState({ name: '', site: '', repo: '', auth: false }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const mode = f.site && f.repo ? 'Full Application Analysis' : f.site ? 'Website Analysis' : f.repo ? 'GitHub Repository Analysis' : 'Add at least one input';
  async function go(e: FormEvent) {
    e.preventDefault(); setErr('');
    if (!f.site.trim() && !f.repo.trim()) return setErr('Add a website URL, a GitHub repository, or both.');
    if (!f.auth) return setErr('Confirm you are authorized to analyze these assets.');
    setBusy(true);
    try {
      const name = f.name.trim() || (f.site ? new URL(f.site.startsWith('http') ? f.site : 'https://' + f.site).hostname : f.repo.split('/').slice(-2).join('/'));
      const p = await api<Project>('/api/projects', { method: 'POST', body: { name, website_url: f.site.trim(), github_repository_url: f.repo.trim(), authorized: true } });
      const s = await api<Scan>('/api/scans', { method: 'POST', body: { project_id: p.id } }); nav(`/app/scans/${s.id}`);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  return (<div className="mx-auto max-w-xl"><h1 className="text-2xl font-semibold">Let's understand what you've built.</h1>
    <p className="mt-1 text-sm text-mute">Add your website or connect a GitHub repository to begin your first CodeMint analysis.</p>
    <form onSubmit={go} className="card mt-6 space-y-4 p-5">
      <div><label htmlFor="nm" className="mb-1 block text-sm">Project name (optional)</label><input id="nm" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><label htmlFor="ws" className="mb-1 block text-sm">Website URL</label><input id="ws" className="input" placeholder="https://yourwebsite.com" value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} /></div>
      <div><label htmlFor="gh" className="mb-1 block text-sm">GitHub Repository</label><input id="gh" className="input" placeholder="https://github.com/username/repository" value={f.repo} onChange={(e) => setF({ ...f, repo: e.target.value })} /><p className="mt-1 text-xs text-mute">Public repositories only. Private access is a future integration.</p></div>
      <p className="font-mono text-xs text-cyan">Mode: {mode}</p>
      <label className="flex gap-2 text-sm text-mute"><input type="checkbox" checked={f.auth} onChange={(e) => setF({ ...f, auth: e.target.checked })} />I own these assets or have permission to analyze them.</label>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}<button className="btn-primary w-full" disabled={busy}>{busy ? 'Validating…' : 'Start Analysis'}</button></form></div>);
}
