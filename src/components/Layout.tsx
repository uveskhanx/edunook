/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link, useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { 
  Home, Compass, PlusCircle, 
  ClipboardList, User, MessageCircle, LogOut, 
  Sparkles, Bell, X, Filter, Settings, ChevronLeft,
  Search as SearchIcon
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { DbService } from '@/lib/db-service';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { VerificationTick } from './VerificationTick';
import { isPremium } from '@/lib/subscription-utils';

// We'll generate navItems dynamically inside Layout to include uid

export function Layout({ children, hideNavigation, hideMobileNav, hideHeader, showSettings }: { children: React.ReactNode; hideNavigation?: boolean; hideMobileNav?: boolean; hideHeader?: boolean; showSettings?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as { q?: string };
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

  const [searchValue, setSearchValue] = useState(searchParams.q || '');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allSearchItems, setAllSearchItems] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [unseenCount, setUnseenCount] = useState(0);

  useEffect(() => {
    setSearchValue(searchParams.q || '');
  }, [searchParams.q]);

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
  }, [user]);

  const handleSearch = (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    const val = typeof e === 'string' ? e : searchValue;
    setSearchValue(val);
    setShowSuggestions(false);
    navigate({ 
      to: '/home', 
      search: { ...searchParams, q: val || undefined } as any,
    });
  };

  const clearSearch = () => {
    setSearchValue('');
    navigate({ 
      to: '/home', 
      search: { ...searchParams, q: undefined } as any,
    });
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground font-sans overflow-x-clip">
      {/* Desktop Sidebar (Left) */}
      {!hideNavigation && (
        <aside className="hidden md:flex flex-col w-[280px] h-screen sticky top-0 left-0 bg-background border-r border-border z-50">
        <div className="p-8">
          <Link to="/" className="flex items-center gap-4 group">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden shadow-2xl shadow-primary/10 border border-white/5 shrink-0">
              <img src="/logo.png" className="w-full h-full object-cover" alt="Logo" />
            </div>
            <span className="text-2xl font-black text-foreground tracking-tighter group-hover:text-primary transition-colors">EduNook</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar py-2">
          {navItems.map((item) => {
            const isHome = item.to === '/home' && (location.pathname === '/' || location.pathname === '/home');
            const isActive = isHome || (location.pathname === item.to && item.to !== '/home');
            
            return (
              <Link
                key={item.label}
                to={item.to as any}
                className={`relative flex items-center gap-4 px-5 py-3.5 rounded-2xl text-[14px] font-bold transition-all group overflow-hidden ${
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/5'
                }`}
              >
                {isActive && (
                  <motion.div layoutId="sidebar-active" className="absolute inset-0 bg-primary/10 rounded-2xl" />
                )}
                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'opacity-70 group-hover:opacity-100'}`} />
                <span>{item.label}</span>
                {item.label === 'Notifications' && unseenCount > 0 && (
                  <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center px-1.5 bg-destructive text-white text-[10px] font-black rounded-full shadow-lg shadow-destructive/20">
                    {unseenCount > 99 ? '99+' : unseenCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-border bg-background/80 backdrop-blur-md">
          {loading ? (
             // Sidebar Loading Skeleton
             <div className="flex items-center gap-3 p-3 rounded-3xl border border-border bg-card/50 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-white/5" />
                <div className="flex-1 space-y-2">
                   <div className="h-3 w-24 bg-white/5 rounded" />
                   <div className="h-2 w-16 bg-white/5 rounded opacity-50" />
                </div>
             </div>
          ) : user ? (
            <div className="space-y-3">
               <Link 
                  to={`/${dbUser?.username}` as any}
                  className={`block p-3 rounded-3xl border transition-all group/profile-box ${
                    location.pathname === `/${dbUser?.username}`
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-card border-border hover:border-primary/30 hover:bg-muted/50'
                  }`}
               >
                 <div className="flex items-center gap-3">
                   <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden border border-border group-hover/profile-box:border-primary/50 transition-colors">
                        <img 
                          src={dbUser?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${dbUser?.uid}`} 
                          className="w-full h-full object-cover group-hover/profile-box:scale-105 transition-transform" 
                          alt="Avatar" 
                        />
                      </div>
                      {dbUser?.subscription?.planId === 'edge' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center border-2 border-card shadow-lg">
                          <Sparkles className="w-2 h-2 text-white fill-white" />
                        </div>
                      )}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-[13px] font-black truncate text-foreground group-hover/profile-box:text-primary transition-colors">
                          {dbUser?.fullName || user.email?.split('@')[0]}
                        </p>
                        <VerificationTick planId={dbUser?.subscription?.planId} size={14} />
                      </div>
                      <div className="flex items-center gap-1.5 overflow-hidden">
                         <p className="text-[9px] text-muted-foreground truncate uppercase tracking-[0.15em] font-black opacity-50">@{dbUser?.username || 'student'}</p>
                         {isPremium(dbUser?.subscription?.planId) && (
                           <span className="text-[7px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20 ml-auto whitespace-nowrap animate-pulse">SAVINGS ACTIVE</span>
                         )}
                         {!isPremium(dbUser?.subscription?.planId) && (
                           <span className="text-[8px] font-black text-primary opacity-0 group-hover/profile-box:opacity-100 transition-opacity uppercase ml-auto whitespace-nowrap">View Profile</span>
                         )}
                      </div>
                   </div>
                 </div>
               </Link>

                <button 
                  onClick={signOut} 
                  aria-label="Sign out"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black text-muted-foreground hover:text-destructive bg-muted/30 hover:bg-destructive/10 transition-all border border-transparent hover:border-destructive/20"
                >
                 <LogOut className="w-3.5 h-3.5" />
                 <span>LOGOUT</span>
               </button>
            </div>
          ) : (
            <Link to="/login" className="flex items-center justify-center w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20">
                SIGN IN
            </Link>
          )}
        </div>
      </aside>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Global Header */}
        {!hideNavigation && !hideHeader && (
          <header className="sticky top-0 z-50 h-[60px] md:h-[72px] bg-background/95 backdrop-blur-xl border-b border-border px-4 md:px-10 flex items-center justify-between gap-4 md:gap-6">
          {/* Mobile Logo */}
          <Link to="/" className="md:hidden flex items-center gap-3 flex-shrink-0" aria-label="EduNook Home">
            <img src="/logo.png" className="w-10 h-10 object-contain" alt="Logo" />
            <span className="text-xl font-black text-foreground tracking-tighter">EduNook</span>
          </Link>

          {/* Search Bar - Desktop and Mobile Overlay */}
          {(location.pathname === '/home' || location.pathname === '/') ? (
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
                     <AnimatePresence>
                       {searchValue && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            type="button"
                            onClick={clearSearch}
                            className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </motion.button>
                       )}
                     </AnimatePresence>
                   </div>
                 </div>
               </form>
   
               {/* Suggestions Dropdown */}
               <AnimatePresence>
                  {showSuggestions && suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
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
                    </motion.div>
                  )}
               </AnimatePresence>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {/* Header Action Icons */}
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {/* Mobile Search Trigger */}
            {(location.pathname === '/home' || location.pathname === '/') && (
              <button 
                onClick={() => setIsMobileSearchOpen(true)}
                aria-label="Open search"
                className="md:hidden p-2.5 bg-muted/20 border border-white/5 rounded-xl text-muted-foreground hover:text-primary transition-all"
              >
                <SearchIcon className="w-5 h-5" />
              </button>
            )}

            <Link 
              to={user ? '/chat' : '/login' as any}
              aria-label="Messages"
              className="md:hidden p-2.5 bg-muted/20 border border-white/5 rounded-xl text-muted-foreground hover:text-primary transition-all"
            >
              <MessageCircle className="w-5 h-5" />
            </Link>
            
            {/* Notification Bell - Mobile Only */}
            <Link
              to={user ? '/notifications' as any : '/login'}
              aria-label="Notifications"
              className="md:hidden relative p-2 bg-card border border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all cursor-pointer group"
            >
               <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
               {unseenCount > 0 && (
                 <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-destructive text-white text-[9px] font-black rounded-full shadow-lg shadow-destructive/30 animate-pulse">
                   {unseenCount > 99 ? '99+' : unseenCount}
                 </span>
               )}
            </Link>
 
            {/* Settings - Mobile Only since it's in Desktop Sidebar */}
            {showSettings && (
              <Link
                to={'/settings' as any}
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
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Nav */}
        {!hideNavigation && !hideMobileNav && (
          <nav className="md:hidden fixed bottom-6 left-6 right-6 z-50">
            <div className="flex items-center justify-around h-[72px] px-2 bg-card/90 backdrop-blur-2xl border border-border rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
              {navItems.map((item) => {
                const isHome = item.to === '/home' && (location.pathname === '/' || location.pathname === '/home');
                const isActive = isHome || (location.pathname === item.to && item.to !== '/home');
                
                // Only show Home, Search, Create, Tests on mobile bottom nav
                if (['Settings', 'Chat', 'Notifications'].includes(item.label)) {
                   return null;
                }
                
                return (
                  <Link
                    key={item.label}
                    to={item.to as any}
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
                  to={`/${dbUser.username}` as any}
                  className={`flex items-center justify-center w-12 h-12 rounded-full transition-all relative ${
                    location.pathname === `/${dbUser.username}` 
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
