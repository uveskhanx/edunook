'use client';

import React from 'react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - IDE resolution glitch
import Link from 'next/link';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - IDE resolution glitch
import Image from 'next/image';
import { LogOut, Sparkles, User } from 'lucide-react';
import { VerificationTick } from './VerificationTick';
import { isPremium } from '@/lib/subscription-utils';

interface SidebarProps {
  navItems: any[];
  pathname: string;
  loading: boolean;
  user: any;
  dbUser: any;
  signOut: () => void;
  getNavBadgeCount: (label: string) => number;
  CountBadge: any;
}

export function Sidebar({ 
  navItems, 
  pathname, 
  loading, 
  user, 
  dbUser, 
  signOut, 
  getNavBadgeCount,
  CountBadge
}: SidebarProps) {
  return (
    <aside className="hidden md:flex flex-col w-[280px] h-screen sticky top-0 left-0 bg-background border-r border-border z-50">
      <div className="p-8">
        <Link href="/" className="flex items-center gap-4 group" aria-label="EduNook Home">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden shadow-2xl shadow-primary/10 border border-white/5 shrink-0 relative">
            <Image 
              src="/logo.png" 
              width={56}
              height={56}
              className="w-full h-full object-cover" 
              alt="EduNook Logo" 
              priority
            />
          </div>
          <span className="text-2xl font-black text-foreground tracking-tighter group-hover:text-primary transition-colors">EduNook</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar py-2">
        {navItems.map((item) => {
          const isHome = item.to === '/home' && (pathname === '/' || pathname === '/home');
          const isActive = isHome || (pathname === item.to && item.to !== '/home');
          
          return (
            <Link
              key={item.label}
              href={item.to}
              className={`relative flex items-center gap-4 px-5 py-3.5 rounded-2xl text-[14px] font-bold transition-all group overflow-hidden ${
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/5'
              }`}
            >
              {isActive && (
                <div className="absolute inset-0 bg-primary/10 rounded-2xl border border-primary/20" />
              )}
              <span className="relative shrink-0">
                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'opacity-70 group-hover:opacity-100'}`} />
                <CountBadge count={getNavBadgeCount(item.label)} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-border bg-background/80 backdrop-blur-md">
        {loading ? (
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
                href={`/${dbUser?.username || 'user'}`}
                className={`block p-3 rounded-3xl border transition-all group/profile-box ${
                  pathname === `/${dbUser?.username}`
                  ? 'bg-primary/10 border-primary/30'
                  : 'bg-card border-border hover:border-primary/30 hover:bg-muted/50'
                }`}
             >
               <div className="flex items-center gap-3">
                 <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-border group-hover/profile-box:border-primary/50 transition-colors relative bg-white/5">
                      {dbUser?.avatarUrl ? (
                        <Image 
                          src={dbUser.avatarUrl} 
                          width={40}
                          height={40}
                          className="w-full h-full object-cover group-hover/profile-box:scale-105 transition-transform" 
                          alt={`${dbUser?.fullName || 'User'}'s avatar`} 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-5 h-5 text-muted-foreground/40" />
                        </div>
                      )}
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
                    </div>
                 </div>
               </div>
             </Link>

              <button 
                onClick={signOut} 
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[10px] font-black text-muted-foreground hover:text-destructive bg-muted/30 hover:bg-destructive/10 transition-all border border-transparent hover:border-destructive/20"
              >
               <LogOut className="w-3.5 h-3.5" />
               <span>LOGOUT</span>
             </button>
          </div>
        ) : (
          <Link href="/login" className="flex items-center justify-center w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20">
              SIGN IN
          </Link>
        )}
      </div>
    </aside>
  );
}
