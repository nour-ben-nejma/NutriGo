"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, MessageSquare, Scale, Utensils, LogOut } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAuthPage = pathname === '/login' || pathname === '/onboarding';

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      
      if (!u) {
        setLoading(false);
        if (!isAuthPage) {
          router.push('/login');
        }
      } else {
        try {
          const res = await fetch(`http://localhost:8000/api/profile/${u.uid}`);
          if (res.ok) {
            const data = await res.json();
            if (!data.exists) {
              if (pathname !== '/onboarding') {
                router.push('/onboarding');
              }
            } else {
              if (pathname === '/login' || pathname === '/onboarding') {
                router.push('/');
              }
            }
          }
        } catch (e) {
          console.error("Erreur vérification profil", e);
        } finally {
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, [pathname, isAuthPage, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const links = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/repas', label: 'Repas', icon: Utensils },
    { href: '/imc', label: 'Calcul IMC', icon: Scale },
    { href: '/chat', label: 'Chat Coach', icon: MessageSquare },
  ];

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>Chargement...</span>
      </div>
    );
  }

  // Pages auth : pas de sidebar
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Non connecté : on attend la redirection
  if (!user) {
    return null;
  }

  return (
    <div className="app-container" style={{ padding: '0', gap: '0' }}>
      <nav className="sidebar glass-panel">
        <div className="sidebar-logo">
          <span className="logo-text">NutriGo</span>
        </div>

        <div className="sidebar-links" style={{ flex: 1 }}>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link href={link.href} key={link.href} className={`nav-link ${isActive ? 'active' : ''}`}>
                <Icon size={24} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>

        <div style={{ padding: '2rem' }}>
          <button
            onClick={handleLogout}
            className="nav-link"
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}
          >
            <LogOut size={24} />
            <span>Déconnexion</span>
          </button>
        </div>
      </nav>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
