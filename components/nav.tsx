'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/priority', label: 'Priority' },
  { href: '/tasks', label: 'All Tasks' },
  { href: '/projects', label: 'Projects' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 flex items-center h-14 gap-1">
        <span className="font-bold text-lg mr-6">TODO</span>
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'px-3 py-2 text-sm rounded-md transition-colors',
              pathname === item.href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
