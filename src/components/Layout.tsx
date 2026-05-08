'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { 
  Home, Compass, PlusCircle, 
  ClipboardList, User, MessageCircle, LogOut, 
  Sparkles, Bell, X, Filter, Settings, ChevronLeft,
  Search as SearchIcon, BarChart3
} from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { DbService } from '@/lib/db-service';
import { useState, useRef, useEffect } from 'react';
import { VerificationTick } from './VerificationTick';
import { isPremium } from '@/lib/subscription-utils';

import dynamic from 'next/dynamic';

const Sidebar = dynamic(() => import('./Sidebar').then(m => m.Sidebar), {
  ssr: true,
  loading: () => <aside className="hidden md:flex w-[280px] bg-background border-r border-border animate-pulse" />
});

export function Layout({ children, hideNavigation, hideMobileNav, hideHeader, showSettings }: { children: React.ReactNode; hideNavigation?: boolean; hideMobileNav?: boolean; hideHeader?: boolean; showSettings?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, dbUser, loading, signOut } = useAuth();
  
  const navItems = [
    { to: '/home', icon: Home, label: 'Home' },
    { to: '/search', icon: Compass, label: 'Explore' },
    { to: '/create', icon: PlusCircle, label: 'Create' },
    { to: '/chat', icon: MessageCircle, label: 'Chat' },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
    { to: '/tests', icon: ClipboardList, label: 'Tests' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ] as const;

  const [searchValue, setSearchValue] = useState(searchParams?.get('q') || '');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allSearchItems, setAllSearchItems] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [unseenCount, setUnseenCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    setSearchValue(searchParams?.get('q') || '');
  }, [searchParams]);

  // Load indexing data for suggestions lazily
  const loadSuggestionsIndex = async () => {
    if (allSearchItems.length > 0) return;
    try {
      const courses = await DbService.getCourses({ isPublished: true });
      const items = new Set<string>();
      courses.forEach((c: any) => {
        items.add(c.title);
      });
      setAllSearchItems(Array.from(items));
    } catch (err) {
      console.error('Index load failed', err);
    }
  };

  // Filter suggestions
  useEffect(() => {
    if (!searchValue.trim() || !showSuggestions) {
      setSuggestions([]);
      return;
    }
    loadSuggestionsIndex(); // Lazy load index on interaction
    const q = searchValue.toLowerCase();
    const filtered = allSearchItems
      .filter(item => item.toLowerCase().includes(q))
      .slice(0, 5);
    setSuggestions(filtered);
  }, [searchValue, allSearchItems, showSuggestions]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Real-time unseen notification count
  useEffect(() => {
    if (user) {
      const unsubscribe = DbService.subscribeToUnseenCount(user.id, setUnseenCount);
      return () => unsubscribe();
    }
    setUnseenCount(0);
  }, [user]);

  // Real-time unread chat count
  useEffect(() => {
    if (user) {
      const unsubscribe = DbService.subscribeToUnreadChatCount(user.id, setUnreadChatCount);
      return () => unsubscribe();
    }
    setUnreadChatCount(0);
  }, [user]);

  const formatBadgeCount = (count: number) => count > 99 ? '99+' : String(count);
  const getNavBadgeCount = (label: string) => {
    if (label === 'Notifications') return unseenCount;
    if (label === 'Chat') return unreadChatCount;
    return 0;
  };

  const CountBadge = ({ count, className = '' }: { count: number; className?: string }) => (
    count > 0 ? (
      <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-destructive text-white text-[9px] font-black rounded-full shadow-lg shadow-destructive/30 ring-2 ring-background ${className}`}>
        {formatBadgeCount(count)}
      </span>
    ) : null
  );

  const handleSearch = (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    const val = typeof e === 'string' ? e : searchValue;
    setSearchValue(val);
    setShowSuggestions(false);
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (val) {
      params.set('q', val);
    } else {
      params.delete('q');
    }
    router.push(`/home?${params.toString()}`);
  };

  const clearSearch = () => {
    setSearchValue('');
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.delete('q');
    router.push(`/home?${params.toString()}`);
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground font-sans overflow-x-clip">
      {/* Desktop Sidebar (Left) */}
      {!hideNavigation && (
        <Sidebar 
          navItems={navItems as any}
          pathname={pathname}
          loading={loading}
          user={user}
          dbUser={dbUser}
          signOut={signOut}
          getNavBadgeCount={getNavBadgeCount}
          CountBadge={CountBadge}
        />
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Global Header */}
        {!hideNavigation && !hideHeader && (
          <header className="sticky top-0 z-50 h-[60px] md:h-[72px] bg-background/95 backdrop-blur-xl border-b border-border px-4 md:px-10 flex items-center justify-between gap-4 md:gap-6">
          {/* Mobile Logo */}
          <Link href="/" className="md:hidden flex items-center gap-3 flex-shrink-0" aria-label="EduNook Home">
            <Image 
              src="/logo.png" 
              width={40} 
              height={40} 
              className="w-10 h-10 object-contain" 
              alt="EduNook Logo" 
              priority
            />
            <span className="text-xl font-black text-foreground tracking-tighter">EduNook</span>
          </Link>

          {/* Search Bar - Desktop and Mobile Overlay */}
          {(pathname === '/home' || pathname === '/') ? (
            <div ref={containerRef} className="flex-1 flex justify-end md:justify-center">
               <form onSubmit={handleSearch} className={`
                 ${isMobileSearchOpen 
                   ? 'fixed inset-x-0 top-0 h-[60px] md:h-[72px] bg-background/98 backdrop-blur-2xl z-[70] px-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300' 
                   : 'hidden md:block w-full max-w-[600px] relative'
                 }
               `}>
                 {isMobileSearchOpen && (
                   <button 
                     type="button"
                     onClick={() => setIsMobileSearchOpen(false)}
                     className="p-2 text-muted-foreground hover:text-foreground bg-muted/20 rounded-xl"
                   >
                     <ChevronLeft className="w-5 h-5" />
                   </button>
                 )}

                 <div className="relative flex-1 group">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                      <SearchIcon className="w-4 h-4 md:w-5 h-5" />
                   </div>
                   <input
                      ref={searchRef}
                      type="text"
                      value={searchValue}
                      onFocus={() => setShowSuggestions(true)}
                      onChange={(e) => {
                        setSearchValue(e.target.value);
                        setShowSuggestions(true);
                      }}
                      placeholder="Search for courses..."
                      className="w-full pl-11 md:pl-12 pr-12 py-2.5 md:py-3 bg-muted/20 border border-white/5 rounded-2xl md:rounded-full text-[14px] text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/40"
                   />
                   
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                     {searchValue && (
                           <button
                             type="button"
                             onClick={clearSearch}
                             className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                           >
                             <X className="w-4 h-4" />
                           </button>
                        )}
                   </div>
                 </div>
               </form>
   
               {/* Suggestions Dropdown */}
               {showSuggestions && suggestions.length > 0 && (
                     <div
                       className={`absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-[80] ${isMobileSearchOpen ? 'mx-4' : 'max-w-[600px] mx-auto'}`}
                     >
                       {suggestions.map((item, idx) => (
                         <button
                           key={idx}
                           onClick={() => {
                             handleSearch(item);
                             setIsMobileSearchOpen(false);
                           }}
                           className="w-full text-left px-5 py-3.5 hover:bg-white/5 text-[14px] font-medium text-muted-foreground hover:text-white transition-colors flex items-center gap-3"
                         >
                           <SearchIcon className="w-4 h-4 opacity-30" />
                           {item}
                         </button>
                       ))}
                     </div>
                   )}
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {/* Header Action Icons */}
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {/* Mobile Search Trigger */}
            {(pathname === '/home' || pathname === '/') && (
              <button 
                onClick={() => setIsMobileSearchOpen(true)}
                aria-label="Open search"
                className="md:hidden p-2.5 bg-muted/20 border border-white/5 rounded-xl text-muted-foreground hover:text-primary transition-all"
              >
                <SearchIcon className="w-5 h-5" />
              </button>
            )}

            <Link 
              href={user ? '/chat' : '/login'}
              aria-label="Messages"
              className="md:hidden relative p-2.5 bg-muted/20 border border-white/5 rounded-xl text-muted-foreground hover:text-primary transition-all"
            >
              <MessageCircle className="w-5 h-5" />
              <CountBadge count={unreadChatCount} />
            </Link>
            
            {/* Notification Bell - Mobile Only */}
            <Link
              href={user ? '/notifications' : '/login'}
              aria-label="Notifications"
              className="md:hidden relative p-2 bg-card border border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all cursor-pointer group"
            >
               <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
               <CountBadge count={unseenCount} />
            </Link>
 
            {/* Settings - Mobile Only since it's in Desktop Sidebar */}
            {showSettings && (
              <Link
                href="/settings"
                aria-label="Settings"
                className="md:hidden p-2 bg-card border border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all cursor-pointer group"
              >
                 <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
              </Link>
            )}
          </div>
        </header>
        )}

        {/* Page Content */}
        <main className={`flex-1 flex flex-col ${(!hideNavigation && !hideMobileNav) ? 'pb-[72px] md:pb-0' : ''}`}>
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        {!hideNavigation && !hideMobileNav && (
          <nav className="md:hidden fixed bottom-6 left-6 right-6 z-50">
            <div className="flex items-center justify-around h-[72px] px-2 bg-card/90 backdrop-blur-2xl border border-border rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
              {navItems.map((item) => {
                const isHome = item.to === '/home' && (pathname === '/' || pathname === '/home');
                const isActive = isHome || (pathname === item.to && item.to !== '/home');
                
                // Only show Home, Search, Create, Tests on mobile bottom nav
                if (['Settings', 'Chat', 'Notifications'].includes(item.label)) {
                   return null;
                }
                
                return (
                  <Link
                    key={item.label}
                    href={item.to}
                    aria-label={item.label}
                    className={`flex items-center justify-center w-12 h-12 rounded-full transition-all relative ${
                      isActive ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                  </Link>
                );
              })}

              {/* Mobile Profile Entry */}
              {loading ? (
                <div className="w-12 h-12 rounded-full bg-white/5 animate-pulse flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground/30" />
                </div>
              ) : dbUser ? (
                <Link
                  href={`/${dbUser.username}`}
                  className={`flex items-center justify-center w-12 h-12 rounded-full transition-all relative ${
                    pathname === `/${dbUser.username}` 
                      ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                      : 'text-muted-foreground'
                  }`}
                >
                  <User className="w-5 h-5" />
                </Link>
              ) : null}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
