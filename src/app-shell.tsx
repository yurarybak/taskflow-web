import { useQuery } from "@tanstack/react-query";
import { Bell, Boxes, ChevronDown, LogOut, Menu, Settings, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Avatar, Button } from "./components/ui";
import { useAuth } from "./features/auth/auth-provider";
import { api } from "./lib/api";
import { keys } from "./lib/query-keys";
import { initials } from "./lib/utils";

export function AppShell() {
  const [open, setOpen] = useState(false); const { user, logout } = useAuth(); const { data } = useQuery({ queryKey: keys.workspaces, queryFn: api.workspaces });
  const avatarUrl = user ? api.avatarUrl(user.id) : undefined;
  return <div className="app-shell"><aside className={open ? "sidebar open" : "sidebar"}><header><Link className="brand" to="/"><span>TF</span><strong>TaskFlow</strong></Link><Button variant="ghost" className="mobile-only" onClick={() => setOpen(false)}><X size={18} /></Button></header><nav><small>Workspace</small><NavLink to="/" end><Boxes size={16} /> All workspaces</NavLink>{data?.data?.slice(0, 5).map((workspace) => <NavLink to={`/workspaces/${workspace.id}`} key={workspace.id}><span className="nav-dot">{workspace.name[0]}</span>{workspace.name}</NavLink>)}</nav><div className="sidebar-future"><Bell size={15} /><div><strong>Notifications</strong><small>Coming soon</small></div></div><footer><Link to="/profile"><Avatar label={initials(user ?? undefined)} src={avatarUrl} /><span><strong>{user?.firstName || user?.email}</strong><small>Account settings</small></span><ChevronDown size={14} /></Link><Button variant="ghost" onClick={() => logout()}><LogOut size={15} /> Sign out</Button></footer></aside><main className="main"><div className="mobile-topbar"><Button variant="ghost" onClick={() => setOpen(true)}><Menu size={19} /></Button><strong>TaskFlow</strong><Link to="/profile"><Settings size={17} /></Link></div><div className="content"><Outlet /></div></main></div>;
}
