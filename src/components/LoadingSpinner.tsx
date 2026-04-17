export function LoadingSpinner({ 
  className = '', 
  size = 'md' 
}: { 
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-[3px]'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizeClasses[size]} border-muted border-t-primary rounded-full animate-spin`} />
    </div>
  );
}
