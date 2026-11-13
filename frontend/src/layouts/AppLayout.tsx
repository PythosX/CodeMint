import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderGit2, Plus, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import Logo from '../components/Logo';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
const nav = [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/app/projects', label: 'My Projects', icon: FolderGit2 }, { to: '/app/new', label: 'New Analysis', icon: Plus }];
export default function AppLayout() {
  const [open, setOpen] = useState(false); const nav2 = useNavigate(); const { session } = useAuth();
  const links = (<>{nav.map((n) => (<NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-elev text-ink' : 'text-mute hover:text-ink'}`}><n.icon size={16} />{n.label}</NavLink>))}</>);
  return (<div className="min-h-screen md:flex">
    <aside className={`${open ? 'flex' : 'hidden'} md:flex fixed md:sticky top-0 z-20 h-screen w-60 flex-col border-r border-line bg-bg2 p-4`}>
      <div className="mb-6 px-1"><Logo /></div><nav className="flex flex-1 flex-col gap-1">{links}</nav>
      <div className="border-t border-line pt-3 text-xs text-mute"><div className="truncate mb-2">{session?.user.email}</div>
        <button className="flex items-center gap-2 hover:text-ink" onClick={async () => { await supabase.auth.signOut(); nav2('/'); }}><LogOut size={14} />Log out</button></div>
    </aside>
    <div className="flex-1 min-w-0"><header className="flex items-center gap-3 border-b border-line p-3 md:hidden"><button aria-label="Open menu" onClick={() => setOpen(!open)}><Menu /></button><Logo size={20} /></header>
      <main className="mx-auto max-w-5xl p-4 md:p-8"><Outlet /></main></div></div>);
}
