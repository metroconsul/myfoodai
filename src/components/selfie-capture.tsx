import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { PortalButton } from "@/components/portal-ui";

type CameraState = "iniciando" | "pronta" | "negada" | "indisponivel";

/** Captura de selfie para validação de identidade no aceite de itens. */
export function SelfieCapture({
  onCapture,
  onFallback,
  disabled,
}: {
  onCapture: (dataUrl: string) => void;
  onFallback: () => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("iniciando");
  const [preview, setPreview] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const start = useCallback(async () => {
    setState("iniciando");
    setWarning(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("indisponivel");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setState("pronta");
    } catch {
      setState("negada");
    }
  }, []);

  useEffect(() => {
    void start();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [start]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      640,
      640,
    );

    // Verificação simples de iluminação antes de enviar.
    const { data } = ctx.getImageData(0, 0, 640, 640);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4 * 40) {
      sum += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    }
    const avg = sum / (data.length / (4 * 40));
    if (avg < 45) {
      setWarning("Iluminação insuficiente. Procure um local mais claro e tente de novo.");
      return;
    }
    if (avg > 235) {
      setWarning("Imagem muito clara. Evite luz forte atrás de você.");
      return;
    }

    setWarning(null);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreview(dataUrl);
    onCapture(dataUrl);
  };

  if (state === "negada" || state === "indisponivel") {
    return (
      <div className="space-y-3 rounded-[24px] border-2 border-foreground bg-warning p-5 text-warning-foreground shadow-[4px_4px_0_var(--ink)]">
        <p className="display-type text-base">
          {state === "negada" ? "Câmera bloqueada" : "Câmera indisponível"}
        </p>
        <p className="text-sm">
          {state === "negada"
            ? "Libere o acesso à câmera nas configurações do navegador para validar sua identidade."
            : "Este dispositivo não oferece câmera para a validação de identidade."}
        </p>
        <div className="flex flex-wrap gap-2">
          <PortalButton type="button" variant="dark" onClick={() => void start()}>
            <RefreshCw className="size-4" aria-hidden />
            Tentar novamente
          </PortalButton>
          <PortalButton type="button" variant="secondary" onClick={onFallback}>
            Seguir sem validação
          </PortalButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-[32px] border-2 border-foreground bg-foreground shadow-[4px_4px_0_var(--ink)]">
        {preview ? (
          <img src={preview} alt="Pré-visualização da selfie capturada" className="size-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label="Pré-visualização da câmera frontal"
            className="size-full scale-x-[-1] object-cover"
          />
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-6 rounded-full border-2 border-dashed border-accent"
        />
      </div>

      {warning ? (
        <p role="alert" className="rounded-[16px] border-2 border-foreground bg-warning px-4 py-3 text-sm font-medium text-warning-foreground">
          {warning}
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Centralize o rosto no círculo, sem boné, óculos escuros ou máscara.
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <PortalButton type="button" onClick={capture} disabled={disabled || state !== "pronta"}>
          <Camera className="size-4" aria-hidden />
          {preview ? "Capturar novamente" : "Capturar selfie"}
        </PortalButton>
      </div>
    </div>
  );
}
