import { Link, useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { 
  Home, Search as SearchIcon, PlusCircle, 
  ClipboardList, User, MessageCircle, LogOut, 
  Sparkles, Bell, X, Filter
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { DbService } from '@/lib/db-service';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

// We'll generate navItems dynamically inside Layout to include uid

export function Layout({ children, hideNavigation }: { children: React.ReactNode; hideNavigation?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as { q?: string };
  const { user, dbUser, signOut } = useAuth();
  
  const navItems = [
    { to: '/home', icon: Home, label: 'Home' },
    { to: '/search', icon: SearchIcon, label: 'Search' },
    { to: '/create', icon: PlusCircle, label: 'Create' },
    { to: '/tests', icon: ClipboardList, label: 'Tests' },
    { to: '/profile', icon: User, label: 'Profile' },
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

  // Load indexing data for suggestions
  useEffect(() => {
    async function loadIndex() {
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
    }
    loadIndex();
  }, []);

  // Filter suggestions
  useEffect(() => {
    if (!searchValue.trim() || !showSuggestions) {
      setSuggestions([]);
      return;
    }
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
    <div className="flex min-h-screen w-full bg-[#050505] text-foreground font-sans">
      {/* Desktop Sidebar (Left) */}
      {!hideNavigation && (
        <aside className="hidden md:flex flex-col w-[280px] h-screen sticky top-0 left-0 bg-[#050505] border-r border-white/5 z-50">
        <div className="p-8">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-white uppercase">EduNook</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || (item.to === '/home' && location.pathname === '/');
            return (
              <Link
                key={item.label}
                to={item.to as any}
                className={`relative flex items-center gap-4 px-5 py-4 rounded-2xl text-[14px] font-bold transition-all group overflow-hidden ${
                  isActive ? 'text-white' : 'text-muted-foreground hover:text-white hover:bg-white/5'
                }`}
              >
                {isActive && (
                  <motion.div layoutId="sidebar-active" className="absolute inset-0 bg-primary/10 rounded-2xl" />
                )}
                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'opacity-70 group-hover:opacity-100'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6">
          {user ? (
            <div className="p-4 rounded-3xl bg-white/[0.03] border border-white/5 space-y-4">
               <div className="flex items-center gap-3">
                 {dbUser?.avatarUrl ? (
                   <img src={dbUser.avatarUrl} className="w-10 h-10 rounded-xl object-cover border border-white/10" alt="Avatar" />
                 ) : (
                   <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold">
                      {dbUser?.fullName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                   </div>
                 )}
                 <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-white">{dbUser?.fullName || user.email?.split('@')[0]}</p>
                    <p className="text-[10px] text-muted-foreground truncate uppercase tracking-[0.2em] font-black opacity-50">@{dbUser?.username || 'student'}</p>
                 </div>
               </div>
               <button onClick={signOut} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[11px] font-black text-white bg-white/5 hover:bg-destructive/10 hover:text-destructive transition-all">
                <LogOut className="w-4 h-4" />
                <span>SIGN OUT</span>
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
        {!hideNavigation && (
          <header className="sticky top-0 z-50 h-[72px] bg-[#050505]/95 backdrop-blur-xl border-b border-white/5 px-6 md:px-10 flex items-center justify-between gap-6">
          {/* Mobile Logo */}
          <Link to="/" className="md:hidden flex-shrink-0">
            <Sparkles className="w-7 h-7 text-primary" />
          </Link>

          {/* Persistent Search Bar with Collapsible Mobile View */}
          <div ref={containerRef} className={`flex-1 max-w-[600px] group relative ${isMobileSearchOpen ? 'fixed inset-x-0 top-0 h-[72px] bg-[#050505] z-[70] px-6 flex items-center md:relative md:inset-auto md:h-auto md:bg-transparent md:px-0' : 'contents md:block'}`}>
             <form onSubmit={handleSearch} className={`relative z-10 w-full ${!isMobileSearchOpen && 'hidden md:block'}`}>
               <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                  <SearchIcon className="w-5 h-5" />
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
                  placeholder="Search courses..."
                  className="w-full pl-12 pr-12 py-3 bg-[#121212] border border-white/10 rounded-full text-[14px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-[#1a1a1a] transition-all placeholder:text-muted-foreground/20"
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
                       className="p-1 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                     >
                       <X className="w-4 h-4" />
                     </motion.button>
                   )}
                 </AnimatePresence>
                 
                 {isMobileSearchOpen && (
                   <button 
                     type="button"
                     onClick={() => setIsMobileSearchOpen(false)}
                     className="md:hidden p-1 text-muted-foreground hover:text-white"
                   >
                     <X className="w-5 h-5" />
                   </button>
                 )}
               </div>
             </form>

             {/* Mobile Search Trigger */}
             {!isMobileSearchOpen && (
               <button 
                 onClick={() => setIsMobileSearchOpen(true)}
                 className="md:hidden p-2 text-muted-foreground hover:text-white bg-[#121212] border border-white/10 rounded-xl"
               >
                 <SearchIcon className="w-5 h-5" />
               </button>
             )}

             {/* Suggestions Dropdown */}
             <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-[#121212] border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] overflow-hidden z-[60]"
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

          {/* Header Action Icons */}
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <Link 
              to={user ? '/chat' : '/login' as any} 
              className="p-2 md:p-3 bg-[#121212] border border-white/10 rounded-xl md:rounded-2xl text-muted-foreground hover:text-white hover:border-primary/50 transition-all group"
            >
              <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </Link>
            
            {/* Notification Bell with Badge */}
            <Link
              to={user ? '/notifications' as any : '/login'}
              className="relative p-2 md:p-3 bg-[#121212] border border-white/10 rounded-xl md:rounded-2xl text-muted-foreground hover:text-white hover:border-accent/50 transition-all cursor-pointer group"
            >
               <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
               {unseenCount > 0 && (
                 <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-destructive text-white text-[9px] font-black rounded-full shadow-lg shadow-destructive/30 animate-pulse">
                   {unseenCount > 99 ? '99+' : unseenCount}
                 </span>
               )}
            </Link>
          </div>
        </header>
        )}

        {/* Page Content */}
        <main className="flex-1 pb-24 md:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Nav */}
        {!hideNavigation && (
          <nav className="md:hidden fixed bottom-6 left-6 right-6 z-50">
            <div className="flex items-center justify-around h-[72px] px-2 bg-[#121212]/90 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to || (item.to === '/home' && location.pathname === '/');
                return (
                  <Link
                    key={item.label}
                    to={item.to as any}
                    className={`flex items-center justify-center w-14 h-14 rounded-full transition-all relative ${
                      isActive ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground'
                    }`}
                  >
                    <item.icon className="w-6 h-6" />
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
