import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../services/api';
import Logo from '../components/Logo';
import type { Finding, Results, Scan as ScanT, Severity } from '../types';
const sev: Record<Severity, string> = { critical: 'text-bad', high: 'text-bad', medium: 'text-warn', low: 'text-cyan', info: 'text-mute' };
const ACTIVE = ['queued', 'running'];
export default function ScanPage() {
  const { id } = useParams(); const [scan, setScan] = useState<ScanT | null>(null); const [res, setRes] = useState<Results | null>(null); const [err, setErr] = useState(''); const [secs, setSecs] = useState(0); const t0 = useRef(Date.now());
  useEffect(() => { let stop = false;
    const tick = async () => { try { const s = await api<ScanT>(`/api/scans/${id}`); if (stop) return; setScan(s); if (!ACTIVE.includes(s.status)) { setRes(await api<Results>(`/api/scans/${id}/results`)); return; } setTimeout(tick, 2000); } catch (e: any) { setErr(e.message); } };
    tick(); const c = setInterval(() => setSecs(Math.floor((Date.now() - t0.current) / 1000)), 1000); return () => { stop = true; clearInterval(c); }; }, [id]);
  if (err) return <div role="alert" className="card p-5 text-sm text-bad">{err}</div>;
  if (!scan) return <div className="h-40 animate-pulse rounded-lg bg-card" />;
  if (ACTIVE.includes(scan.status)) return (<div className="mx-auto mt-16 max-w-md text-center"><motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 2 }} className="flex justify-center"><Logo size={36} /></motion.div>
    <p className="mt-6 font-mono text-sm text-cyan">{scan.current_stage || 'Queued'}</p>
    <div className="mt-4 h-2 overflow-hidden rounded bg-elev" role="progressbar" aria-valuenow={scan.progress} aria-valuemin={0} aria-valuemax={100}><motion.div className="h-full bg-accent" animate={{ width: `${scan.progress}%` }} transition={{ ease: 'easeOut' }} /></div>
    <p className="mt-2 text-xs text-mute">{scan.progress}% · {secs}s elapsed · status: {scan.status}</p>
    <button className="btn-ghost mt-6" onClick={() => api(`/api/scans/${id}/cancel`, { method: 'POST' })}>Cancel</button></div>);
  if (!res) return <div className="h-40 animate-pulse rounded-lg bg-card" />;
  return <Report r={res} />;
}
function Report({ r }: { r: Results }) {
  const [findings, setFindings] = useState<Finding[]>(r.findings); const [copied, setCopied] = useState('');
  const failed = r.scan.status === 'failed'; const errors = r.report?.report_data.errors || (r.scan.error_message ? [r.scan.error_message] : []);
  async function setStatus(f: Finding, status: string) { setFindings(findings.map((x) => (x.id === f.id ? { ...x, status } : x))); await api(`/api/findings/${f.id}`, { method: 'PATCH', body: { status } }).catch(() => setFindings(findings)); }
  const prompt = (f: Finding) => `Fix this issue in my project without changing unrelated functionality or the existing UI.\n\nIssue: ${f.title}\nEvidence: ${f.evidence}\n${f.affected_resource ? `Where: ${f.affected_resource}\n` : ''}Suggested direction: ${f.suggested_fix}\n\nAfter the change, verify: the app builds, the affected behavior is corrected, and nothing else regressed.`;
  const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  return (<div><h1 className="text-2xl font-semibold">{r.project.name}</h1><p className="text-xs text-mute">{r.project.website_url} {r.project.github_repository_url} · {r.scan.status}</p>
    {errors.length > 0 && <div role="alert" className="card mt-4 border-warn p-4 text-sm"><strong>{failed ? 'Analysis failed' : 'Partially completed'}</strong>{errors.map((e) => <p key={e} className="mt-1 text-mute">{e}</p>)}</div>}
    {r.report && <><p className="mt-4 text-sm">{r.report.summary}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">{Object.entries(r.report.scores).map(([k, v]) => (<div key={k} className="card p-3"><div className="text-xs capitalize text-mute">{k.replace('_', ' ')}</div><div className="text-xl font-semibold">{v ?? 'Not measured'}</div></div>))}</div>
      <p className="mt-2 text-xs text-mute">Scores start at 100 and lose points per finding by severity, only for checks that actually ran. "Not measured" means that check did not run or its data was unavailable.</p></>}
    <h2 className="mt-8 text-lg font-semibold">Findings ({findings.length})</h2>
    {!findings.length && !failed && <p className="mt-2 text-sm text-mute">No findings from the checks that ran.</p>}
    <div className="mt-3 space-y-3">{[...findings].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)).map((f) => (<motion.div key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-4">
      <div className="flex flex-wrap items-center gap-2"><span className={`font-mono text-xs ${sev[f.severity]}`}>{f.severity}</span><span className="font-mono text-xs text-mute">{f.confidence} confidence</span><span className="font-mono text-xs text-mute">{f.category}</span></div>
      <h3 className="mt-1 font-medium">{f.title}</h3><p className="mt-1 text-sm text-mute">{f.description}</p>
      <p className="mt-2 rounded bg-bg2 p-2 font-mono text-xs break-words">Evidence: {f.evidence}</p>{f.affected_resource && <p className="mt-1 text-xs text-mute">Affected: {f.affected_resource}</p>}
      <p className="mt-2 text-sm text-cyan">Fix: {f.suggested_fix}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs"><select aria-label="Status" className="input w-auto py-1" value={f.status} onChange={(e) => setStatus(f, e.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="saved">Saved for later</option><option value="resolved">Resolved</option></select>
        <button className="btn-ghost py-1" onClick={() => { navigator.clipboard.writeText(prompt(f)); setCopied(f.id); }}>{copied === f.id ? 'Copied' : 'Copy fix prompt'}</button></div></motion.div>))}</div></div>);
}
