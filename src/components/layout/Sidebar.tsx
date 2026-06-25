'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ProviderStatus {
  id: string;
  name: string;
  status: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);

  useEffect(() => {
    async function fetchProviders() {
      try {
        const res = await fetch('/api/providers');
        if (res.ok) {
          const data = await res.json();
          setProviders(data);
        }
      } catch (e: any) {
        // Handle transient fetch errors gracefully (e.g. during dev compilation/hot-reloading)
        console.warn('Failed to fetch sidebar providers status (retrying automatically)');
      }
    }
    fetchProviders();
    const interval = setInterval(fetchProviders, 5000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: '📊' },
    { name: 'Rules & Skills', path: '/rules', icon: '⚙️' },
    { name: 'Onboarding Guide', path: '/walkthrough', icon: '📖' }
  ];

  return (
    <div className="sidebar">
      <div>
        <h2 style={{ 
          fontFamily: 'var(--font-display)', 
          fontSize: '1.6rem', 
          background: 'linear-gradient(to right, #8b5cf6, #06b6d4)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px'
        }}>
          NextRouter
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Context Sync Engine
        </p>
      </div>

      <nav className="nav-menu">
        {navItems.map((item) => (
          <Link 
            href={item.path} 
            key={item.path} 
            className={`nav-item ${pathname === item.path ? 'active' : ''}`}
          >
            <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
            Active Providers
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {providers.map((p) => {
              const isActive = p.status === 'active';
              return (
                <div key={p.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-color)'}`,
                  fontSize: '0.85rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isActive ? 'var(--color-success)' : 'var(--text-dark)',
                      boxShadow: isActive ? '0 0 8px var(--color-success)' : 'none'
                    }} />
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                  </div>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: isActive ? 'var(--color-success)' : 'var(--text-muted)',
                    marginLeft: 'auto'
                  }}>
                    {isActive ? 'Active' : 'Offline'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
