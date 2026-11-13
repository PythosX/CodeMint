import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase, configured } from '../services/supabase';
export default function Auth({ mode }: { mode: 'login' | 'register' }) {
  const nav = useNavigate(); const reg = mode === 'register';
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '', terms: false }); const [show, setShow] = useState(false);
  const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k: string, v: string | boolean) => setF({ ...f, [k]: v });
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    if (!configured) return setErr('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.');
    if (reg && f.password !== f.confirm) return setErr('Passwords do not match.');
    if (reg && f.password.length < 8) return setErr('Use at least 8 characters.');
    if (reg && !f.terms) return setErr('Accept the terms to create an account.');
    setBusy(true);
    if (reg) {
      const { data, error } = await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.name }, emailRedirectTo: `${location.origin}/app` } });
      setBusy(false);
      if (error) return setErr(error.message);
      if (data.user && data.user.identities?.length === 0) return setErr('An account with this email already exists. Sign in instead.');
      setMsg('Check your inbox to verify your email, then sign in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password }); setBusy(false);
      if (error) return setErr(error.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : error.message);
      nav('/app');
    }
  }
  async function google() { setErr(''); if (!configured) return setErr('Supabase is not configured.'); const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/app` } }); if (error) setErr(error.message); }
  async function forgot() { if (!f.email) return setErr('Enter your email first, then select Forgot password.'); const { error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: `${location.origin}/login` }); error ? setErr(error.message) : setMsg('Password reset email sent.'); }
  return (<div className="grid min-h-screen place-items-center p-4"><div className="card w-full max-w-sm p-6">
    <Link to="/"><Logo /></Link><h1 className="mt-5 text-2xl font-semibold">{reg ? 'Create your account' : 'Sign in'}</h1>
    <button className="btn-ghost mt-5 w-full" onClick={google}>Continue with Google</button><div className="my-4 text-center text-xs text-mute">or use email</div>
    <form onSubmit={submit} className="space-y-3">
      {reg && <div><label htmlFor="n" className="mb-1 block text-sm">Full name</label><input id="n" className="input" required value={f.name} onChange={(e) => set('name', e.target.value)} /></div>}
      <div><label htmlFor="e" className="mb-1 block text-sm">Email</label><input id="e" type="email" className="input" required value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
      <div><label htmlFor="p" className="mb-1 block text-sm">Password</label><div className="relative"><input id="p" type={show ? 'text' : 'password'} className="input pr-14" required value={f.password} onChange={(e) => set('password', e.target.value)} /><button type="button" className="absolute right-3 top-2.5 text-xs text-mute" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div></div>
      {reg && <div><label htmlFor="c" className="mb-1 block text-sm">Confirm password</label><input id="c" type="password" className="input" required value={f.confirm} onChange={(e) => set('confirm', e.target.value)} /></div>}
      {reg && <label className="flex gap-2 text-xs text-mute"><input type="checkbox" checked={f.terms} onChange={(e) => set('terms', e.target.checked)} />I accept the Terms of Service and Privacy Policy.</label>}
      {!reg && <button type="button" className="text-xs text-cyan" onClick={forgot}>Forgot password?</button>}
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}{msg && <p role="status" className="text-sm text-ok">{msg}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Please wait…' : reg ? 'Create account' : 'Sign in'}</button></form>
    <p className="mt-4 text-sm text-mute">{reg ? 'Have an account?' : 'New to CodeMint?'} <Link className="text-cyan" to={reg ? '/login' : '/register'}>{reg ? 'Sign in' : 'Create account'}</Link></p></div></div>);
}
