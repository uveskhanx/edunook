import { Link } from '@tanstack/react-router';

interface CourseCardProps {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl: string | null;
  price: number;
  category: string;
  creatorName: string;
  creatorAvatar: string | null;
}

export function CourseCard({ id, title, thumbnailUrl, price, category, creatorName, creatorAvatar }: CourseCardProps) {
  return (
    <Link
      to="/course/$courseId"
      params={{ courseId: id }}
      className="group block rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:glow-primary animate-fade-in"
    >
      <div className="aspect-video bg-muted relative overflow-hidden">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </div>
        )}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${price === 0 ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'}`}>
            {price === 0 ? 'Free' : `$${price}`}
          </span>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0 overflow-hidden mt-0.5">
            {creatorAvatar ? (
              <img src={creatorAvatar} alt={creatorName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground font-bold">
                {creatorName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-card-foreground line-clamp-2 group-hover:text-primary transition-colors">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{creatorName}</p>
            <span className="text-xs text-muted-foreground/70 capitalize">{category}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
