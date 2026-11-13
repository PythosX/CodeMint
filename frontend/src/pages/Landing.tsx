import { Link } from 'react-router-dom';
import { Globe, GitBranch, ShieldCheck, Gauge, SearchCheck, Map } from 'lucide-react';
import Logo from '../components/Logo';
const features = [
  { i: Globe, t: 'Website Intelligence', d: 'Structure, SEO, accessibility and technology signals read from your live site.' },
  { i: GitBranch, t: 'GitHub Codebase Intelligence', d: 'Project layout, dependencies, tests and code-quality signals from public repositories.' },
  { i: ShieldCheck, t: 'Security Insights', d: 'Non-invasive header and configuration checks. Gaps are labeled as hardening gaps, never as proven exploits.' },
  { i: Gauge, t: 'Performance Analysis', d: 'Real Lighthouse metrics via Google PageSpeed Insights, shown only when the API returns them.' },
  { i: SearchCheck, t: 'Missing Feature Detection', d: 'TODOs and gaps cross-checked against surrounding evidence, with a confidence level on every finding.' },
  { i: Map, t: 'AI Improvement Roadmap', d: 'Findings turned into prioritized tasks you can mark done and copy as coding prompts.' }];
export default function Landing() {
  return (<div>
    <header className="mx-auto flex max-w-6xl items-center justify-between p-4"><Logo />
      <nav className="hidden gap-6 text-sm text-mute md:flex"><a href="#features" className="hover:text-ink">Features</a><a href="#how" className="hover:text-ink">How it works</a><a href="#faq" className="hover:text-ink">FAQ</a></nav>
      <div className="flex gap-2"><Link to="/login" className="btn-ghost">Sign in</Link><Link to="/register" className="btn-primary">Get started</Link></div></header>
    <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
      <div><h1 className="text-4xl font-bold leading-tight md:text-6xl">Your Application. Fully Understood.</h1>
        <p className="mt-5 max-w-md text-mute">Analyze your website and codebase with AI-powered technical intelligence. Discover what's working, what's missing and what to improve next.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link to="/register" className="btn-primary">Analyze Your Project</Link><a href="#features" className="btn-ghost">Explore Features</a></div></div>
      <div className="card p-4 font-mono text-xs" aria-label="Example report finding">
        <div className="mb-3 flex items-center justify-between"><span className="text-mute">Example finding</span><span className="rounded bg-warn/15 px-2 py-0.5 text-warn">medium · high confidence</span></div>
        <div className="font-sans text-base font-medium">Missing Content-Security-Policy header</div>
        <div className="mt-3 rounded bg-bg2 p-3 text-mute">Evidence: Response headers for https://example.com did not include content-security-policy.</div>
        <div className="mt-3 text-cyan">Fix: Set the header at your host or CDN.</div></div></section>
    <section id="features" className="mx-auto max-w-6xl px-4 py-12"><h2 className="text-3xl font-semibold">What CodeMint inspects</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">{features.map((f) => (<div key={f.t} className="card p-5"><f.i className="text-cyan" size={20} /><h3 className="mt-3 font-medium">{f.t}</h3><p className="mt-1 text-sm text-mute">{f.d}</p></div>))}</div></section>
    <section id="how" className="mx-auto max-w-6xl px-4 py-12"><h2 className="text-3xl font-semibold">How it works</h2>
      <ol className="mt-8 grid gap-4 md:grid-cols-4">{['Submit your website or GitHub repository.', 'CodeMint inspects the available information.', 'Findings are organized with evidence and confidence.', 'Receive your technical report and roadmap.'].map((s, i) => (<li key={i} className="card p-5 text-sm"><span className="font-mono text-cyan">Step {i + 1}</span><p className="mt-2">{s}</p></li>))}</ol></section>
    <section id="faq" className="mx-auto max-w-3xl px-4 py-12"><h2 className="text-3xl font-semibold">FAQ</h2>
      {[['Does CodeMint run my code?', 'No. Repository files are read as text through the GitHub API and never executed.'], ['Can it prove my site is vulnerable?', 'No. It runs safe, non-invasive checks and reports configuration gaps with evidence and a confidence level.'], ['Private repositories?', 'Not in V1. Private access via GitHub OAuth is planned.']].map(([q, a]) => (<details key={q} className="card mt-3 p-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-sm text-mute">{a}</p></details>))}</section>
    <footer className="border-t border-line p-6 text-center text-sm text-mute">© CodeMint. Understand your code. Improve your product. Ship with confidence.</footer></div>);
}
