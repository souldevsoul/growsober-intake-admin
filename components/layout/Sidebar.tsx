'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Zap, Clock, UsersRound, Workflow, LayoutDashboard, BarChart3, Settings } from 'lucide-react';

// Mountain Logo SVG from growsober-web
function MountainLogo({ className = 'w-8 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 18" fill="none" className={className}>
      <path d="M8 18L2 18L6.5 10L9 14L8 18Z" fill="currentColor" />
      <path d="M22 18L8 18L14 6L22 18Z" fill="currentColor" />
    </svg>
  );
}

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/crm', label: 'Leads', icon: Users },
  { href: '/crm/sequences', label: 'Sequences', icon: Zap },
  { href: '/crm/scheduled', label: 'Scheduled', icon: Clock },
  { href: '/crm/cohorts', label: 'Cohorts', icon: UsersRound },
  { href: '/crm/automations', label: 'Automations', icon: Workflow },
  { href: '/crm/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/crm/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen border-r border-white/[0.08] bg-black p-5 flex flex-col">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-8">
        <MountainLogo className="w-8 h-6 text-white" />
        <span className="text-white font-black text-sm tracking-tight uppercase">
          GROW SOBER
        </span>
      </Link>

      {/* Navigation */}
      <nav className="space-y-0.5 flex-1">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                active
                  ? 'text-white border-l-2 border-white bg-white/[0.04]'
                  : 'text-white/40 hover:text-white/70 border-l-2 border-transparent'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
