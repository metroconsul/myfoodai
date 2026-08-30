import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Campo de assinatura desenhada (mouse, caneta ou toque). */
export function SignaturePad({
  onChange,
  className,
  label = "Assine no campo abaixo",
}: {
  onChange: (dataUrl: string | null) => void;
  className?: string;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#09090B";
  }, []);

  useEffect(() => {
    setup();
    window.addEventListener("resize", setup);
    return () => window.removeEventListener("resize", setup);
  }, [setup]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const emit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <canvas
        ref={canvasRef}
        aria-label="Área de assinatura"
        role="img"
        className="h-40 w-full touch-none rounded-[20px] border-2 border-dashed border-foreground bg-card shadow-[3px_3px_0_var(--ink)]"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = canvasRef.current?.getContext("2d");
          if (!ctx) return;
          drawing.current = true;
          const p = point(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvasRef.current?.getContext("2d");
          if (!ctx) return;
          const p = point(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          if (!hasInk) setHasInk(true);
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          emit();
        }}
        onPointerLeave={() => {
          if (!drawing.current) return;
          drawing.current = false;
          emit();
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {hasInk ? "Assinatura registrada." : "Use o dedo, a caneta ou o mouse."}
        </p>
        <button
          type="button"
          onClick={clear}
          className="min-h-11 rounded-full border-2 border-foreground bg-card px-4 text-xs font-bold uppercase tracking-[0.08em] shadow-[2px_2px_0_var(--ink)]"
        >
          Limpar
        </button>
      </div>
    </div>
  );
}
