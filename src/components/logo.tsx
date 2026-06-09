export function NexarenaLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative flex h-7 w-7 items-center justify-center">
        <span className="absolute inset-0 rotate-45 bg-primary" />
        <span className="absolute inset-[3px] rotate-45 bg-background" />
        <span className="relative font-display text-sm font-bold text-primary">N</span>
      </span>
      <span className="font-display text-xl tracking-widest">
        NEX<span className="text-primary">A</span>RENA
      </span>
    </div>
  );
}
