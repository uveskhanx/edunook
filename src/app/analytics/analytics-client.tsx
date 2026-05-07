'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/use-auth';
import { DbService, Course, CourseReview } from '@/lib/db-service';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
  TrendingUp, Users, DollarSign, Eye, ArrowUpRight,
  BarChart3, Activity, BookOpen, Star, UserPlus, IndianRupee,
  Tv, CircleDollarSign, Info, Globe2, Smartphone, Monitor
} from 'lucide-react';
import { motion } from 'framer-motion';

const MONETIZATION_THRESHOLD = 1000;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};


// Custom Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/90 border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-xl">
      <p className="text-white/60 text-[10px] font-bold mb-1.5 uppercase tracking-widest">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs font-bold text-white">
            {entry.name}: {entry.name.includes('Revenue') ? formatCurrency(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

interface AnalyticsData {
  courses: Course[];
  enrollmentsByCourse: Record<string, any[]>;
  payments: any[];
  reviewsByCourse: Record<string, CourseReview[]>;
  followers: string[];
  totalViews: number;
  ageDemographics: { age: string; count: number }[];
  deviceBreakdown: { name: string; value: number }[];
}

export default function AnalyticsClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user) return;
      try {
        const result = await DbService.getCreatorAnalytics(user.id);
        if (mounted) {
          setData(result);
          setLoading(false);
          if (result.courses.length === 0) router.push('/create?error=analytics_no_courses');
        }
      } catch (err) {
        console.error('Analytics load failed:', err);
        if (mounted) setLoading(false);
      }
    };
    if (!authLoading) {
      if (!user) router.push('/login');
      else load();
    }
    return () => { mounted = false; };
  }, [user, authLoading, router]);

  // Computed Metrics
  const metrics = useMemo(() => {
    if (!data) return null;
    const { courses, enrollmentsByCourse, payments, reviewsByCourse, followers } = data;

    // Premium revenue from actual payments
    const premiumRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Ad revenue (Disabled until rate is fixed)
    const adRevenue = 0;

    const totalRevenue = premiumRevenue;
    const totalEnrollments = Object.values(enrollmentsByCourse).reduce((sum, arr) => sum + arr.length, 0);
    const totalViews = courses.reduce((sum, c) => sum + (c.views || 0), 0);

    // Real average rating from reviews
    const allReviews = Object.values(reviewsByCourse).flat();
    const ratedReviews = allReviews.filter((r: any) => r.rating > 0);
    const avgRating = ratedReviews.length > 0
      ? (ratedReviews.reduce((s: number, r: any) => s + r.rating, 0) / ratedReviews.length).toFixed(1)
      : 'N/A';

    return {
      premiumRevenue, adRevenue, totalRevenue,
      totalEnrollments, totalViews, avgRating,
      totalFollowers: followers.length,
      totalReviews: allReviews.length,
      totalCourses: courses.length,
      freeCourses: courses.filter(c => c.price <= 0).length,
      paidCourses: courses.filter(c => c.price > 0).length,
    };
  }, [data]);

  // Enrollment growth timeline (last 30 days) from real enrollment dates
  const enrollmentTimeline = useMemo(() => {
    if (!data) return [];
    const allEnrollments = Object.values(data.enrollmentsByCourse).flat();
    const now = new Date();
    const days: Record<string, number> = {};

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days[key] = 0;
    }

    allEnrollments.forEach((e: any) => {
      if (!e.enrolledAt) return;
      const d = new Date(e.enrolledAt);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (days[key] !== undefined) days[key]++;
    });

    return Object.entries(days).map(([date, enrollments]) => ({ date, enrollments }));
  }, [data]);

  // Rating distribution from real reviews
  const ratingDistribution = useMemo(() => {
    if (!data) return [];
    const allReviews = Object.values(data.reviewsByCourse).flat();
    const dist = [0, 0, 0, 0, 0]; // 1-5 stars
    allReviews.forEach((r: any) => {
      const rating = Math.round(r.rating || 0);
      if (rating >= 1 && rating <= 5) dist[rating - 1]++;
    });
    return [
      { stars: '5★', count: dist[4], color: '#10b981' },
      { stars: '4★', count: dist[3], color: '#22c55e' },
      { stars: '3★', count: dist[2], color: '#f59e0b' },
      { stars: '2★', count: dist[1], color: '#f97316' },
      { stars: '1★', count: dist[0], color: '#ef4444' },
    ];
  }, [data]);

  // Course leaderboard sorted by revenue (primary) then views (secondary)
  const leaderboard = useMemo(() => {
    if (!data) return [];
    return data.courses
      .map(c => {
        const enrollments = data.enrollmentsByCourse[c.id]?.length || 0;
        const reviews = data.reviewsByCourse[c.id]?.length || 0;
        const coursePayments = data.payments.filter(p => p.course_id === c.id);
        const premRev = coursePayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
        const adRev = 0;
        const totalRev = premRev;

        return { ...c, enrollments, reviews, premRev, adRev, totalRev };
      })
      .sort((a, b) => b.totalRev - a.totalRev || (b.views || 0) - (a.views || 0));
  }, [data]);

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
             <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Synchronizing Intelligence</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!data || data.courses.length === 0) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 rounded-[2.5rem] bg-muted/20 flex items-center justify-center border border-border mb-8">
            <BarChart3 className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <h2 className="text-3xl font-black text-foreground tracking-tight mb-2">No Active Courses</h2>
          <p className="text-muted-foreground font-medium max-w-sm mb-10">
            Your analytics dashboard will light up once you publish your first course.
          </p>
          <Link 
            href="/create"
            className="px-8 py-4 bg-primary text-white font-black rounded-3xl hover:scale-[1.03] transition-all active:scale-95 shadow-xl shadow-primary/20"
          >
            Create Your First Course
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background p-4 md:p-8 lg:p-12 pb-32">
        <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-10">

          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl md:text-4xl font-black text-foreground tracking-tighter">Creator Analytics</h1>
            </div>
            <p className="text-muted-foreground font-medium text-sm max-w-xl">
              100% real insights from your courses. Track revenue, enrollments, views, and ratings.
            </p>
          </div>



          {/* Core Metrics Grid */}
          {metrics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
              {[
                { label: 'Total Revenue', value: formatCurrency(metrics.totalRevenue), sub: `Total earnings from your premium content`, icon: DollarSign, gradient: 'from-emerald-500/10 to-transparent', border: 'border-emerald-500/20', accent: 'text-emerald-500', accentBg: 'text-emerald-500/70' },
                { label: 'Total Enrollments', value: formatNumber(metrics.totalEnrollments), sub: `Across ${metrics.totalCourses} courses`, icon: Users, gradient: 'from-blue-500/10 to-transparent', border: 'border-blue-500/20', accent: 'text-blue-500', accentBg: 'text-blue-500/70' },
                { label: 'Total Views', value: formatNumber(metrics.totalViews), sub: `${metrics.freeCourses} free · ${metrics.paidCourses} paid`, icon: Eye, gradient: 'from-violet-500/10 to-transparent', border: 'border-violet-500/20', accent: 'text-violet-500', accentBg: 'text-violet-500/70' },
                { label: 'Avg Rating', value: metrics.avgRating, sub: `${metrics.totalReviews} reviews · ${metrics.totalFollowers} followers`, icon: Star, gradient: 'from-amber-500/10 to-transparent', border: 'border-amber-500/20', accent: 'text-amber-500', accentBg: 'text-amber-500/70' },
              ].map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`bg-gradient-to-br ${m.gradient} border ${m.border} p-4 md:p-6 rounded-2xl md:rounded-[2rem] relative overflow-hidden group`}
                >
                  <div className="absolute top-0 right-0 p-3 md:p-5 opacity-10 group-hover:scale-110 transition-transform">
                    <m.icon className={`w-10 h-10 md:w-14 md:h-14 ${m.accent}`} />
                  </div>
                  <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${m.accentBg} mb-1`}>{m.label}</p>
                  <h3 className="text-xl md:text-3xl lg:text-4xl font-black text-foreground tracking-tighter">{m.value}</h3>
                  <p className="text-[10px] md:text-xs text-muted-foreground font-medium mt-2 line-clamp-1">{m.sub}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">

            {/* Enrollment Growth (spans 2 cols) */}
            <div className="xl:col-span-2 bg-card border border-border p-4 md:p-8 rounded-2xl md:rounded-[2.5rem]">
              <div className="mb-6">
                <h3 className="text-base md:text-lg font-black text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Enrollment Growth
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-1">Real enrollments over the last 30 days</p>
              </div>
              <div className="h-[250px] md:h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={enrollmentTimeline} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gEnroll" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                    <XAxis dataKey="date" stroke="rgba(128,128,128,0.3)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis stroke="rgba(128,128,128,0.3)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="enrollments" name="Enrollments" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#gEnroll)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ratings Distribution */}
            <div className="bg-card border border-border p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] flex flex-col">
              <div className="mb-6">
                <h3 className="text-base md:text-lg font-black text-foreground flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" /> Rating Distribution
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-1">Real reviews from your students</p>
              </div>
              {metrics && metrics.totalReviews > 0 ? (
                <div className="flex-1 min-h-[200px] md:min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ratingDistribution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" horizontal={false} />
                      <XAxis type="number" stroke="rgba(128,128,128,0.3)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="stars" stroke="rgba(128,128,128,0.3)" fontSize={12} tickLine={false} axisLine={false} width={35} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Reviews" radius={[0, 6, 6, 0]} maxBarSize={24}>
                        {ratingDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm font-medium">
                  No reviews yet. Reviews will appear here as students rate your courses.
                </div>
              )}
            </div>
          </div>

          {/* Audience Insights Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Age Demographics */}
            <div className="bg-card border border-border p-6 md:p-8 rounded-2xl md:rounded-[2.5rem]">
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h3 className="text-base md:text-lg font-black text-foreground flex items-center gap-2">
                    <Globe2 className="w-4 h-4 text-primary" /> Audience Age
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium mt-1">Real age groups of your enrolled students</p>
                </div>
                <div className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                  <span className="text-[10px] font-black text-primary uppercase tracking-wider">{metrics?.totalEnrollments} Students</span>
                </div>
              </div>
              {data && data.ageDemographics.length > 0 ? (
                <div className="h-[250px] md:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.ageDemographics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                      <XAxis dataKey="age" stroke="rgba(128,128,128,0.3)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="rgba(128,128,128,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                      <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                      <Bar dataKey="count" name="Students" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm font-medium">
                  Gathering student data...
                </div>
              )}
            </div>

            {/* Device Usage */}
            <div className="bg-card border border-border p-6 md:p-8 rounded-2xl md:rounded-[2.5rem]">
              <div className="mb-6">
                <h3 className="text-base md:text-lg font-black text-foreground flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" /> Device Telemetry
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-1">How students are accessing your content</p>
              </div>
              {data && data.deviceBreakdown.length > 0 ? (
                <div className="h-[250px] md:h-[300px] w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.deviceBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {data.deviceBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f59e0b'][index % 3]} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36} 
                        formatter={(value) => <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                    <Monitor className="w-6 h-6 text-muted-foreground/20 mb-1" />
                    <span className="text-xl font-black text-foreground">100%</span>
                  </div>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm font-medium">
                  Waiting for enrollments...
                </div>
              )}
            </div>
          </div>

          {/* Course Leaderboard */}
          <div className="bg-card border border-border p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] overflow-hidden">
            <div className="mb-6">
              <h3 className="text-base md:text-lg font-black text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Course Leaderboard
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-1">Sorted by revenue, then views</p>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {leaderboard.map((course, i) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-muted/30 border border-border rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-black text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground line-clamp-2">{course.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${course.price > 0 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                          {course.price > 0 ? formatCurrency(course.price) : 'FREE'}
                        </span>

                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background/50 rounded-lg p-2">
                      <span className="text-muted-foreground font-medium block text-[10px]">Revenue</span>
                      <span className="font-black text-emerald-500">{formatCurrency(course.totalRev)}</span>
                    </div>
                    <div className="bg-background/50 rounded-lg p-2">
                      <span className="text-muted-foreground font-medium block text-[10px]">Views</span>
                      <span className="font-black text-foreground">{formatNumber(course.views || 0)}</span>
                    </div>
                    <div className="bg-background/50 rounded-lg p-2">
                      <span className="text-muted-foreground font-medium block text-[10px]">Enrollments</span>
                      <span className="font-black text-foreground">{course.enrollments}</span>
                    </div>
                    <div className="bg-background/50 rounded-lg p-2">
                      <span className="text-muted-foreground font-medium block text-[10px]">Reviews</span>
                      <span className="font-black text-foreground">{course.reviews}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-4 px-3 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">#</th>
                    <th className="py-4 px-3 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Course</th>
                    <th className="py-4 px-3 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Type</th>
                    <th className="py-4 px-3 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Views</th>
                    <th className="py-4 px-3 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Enrollments</th>
                    <th className="py-4 px-3 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Reviews</th>
                    <th className="py-4 px-3 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((course, i) => (
                    <tr key={course.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-4 px-3 text-xs font-black text-muted-foreground">{i + 1}</td>
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-3">
                          {course.thumbnailUrl && (
                            <div className="w-14 h-9 bg-muted rounded-lg overflow-hidden shrink-0 border border-border">
                              <img src={course.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <span className="text-sm font-bold text-foreground line-clamp-1 max-w-[200px]">{course.title}</span>
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${course.price > 0 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                          {course.price > 0 ? formatCurrency(course.price) : 'FREE'}
                        </span>
                      </td>
                      <td className="py-4 px-3 text-xs font-bold text-foreground">{formatNumber(course.views || 0)}</td>
                      <td className="py-4 px-3 text-xs font-bold text-foreground">{course.enrollments}</td>
                      <td className="py-4 px-3 text-xs font-bold text-foreground">{course.reviews}</td>
                      <td className="py-4 px-3 text-xs font-black text-emerald-500">{formatCurrency(course.totalRev)}</td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Stats Footer */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Courses', value: metrics.totalCourses, icon: BookOpen },
                { label: 'Followers', value: metrics.totalFollowers, icon: UserPlus },
                { label: 'Free Courses', value: metrics.freeCourses, icon: Tv },
                { label: 'Paid Courses', value: metrics.paidCourses, icon: IndianRupee },
              ].map((s, i) => (
                <div key={i} className="bg-card border border-border p-4 rounded-2xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                    <s.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-black text-foreground tracking-tight">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}
