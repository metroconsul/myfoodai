/** Reduz a foto no navegador (lado maior 800 px, JPEG 80%) antes de enviar: o cardápio abre rápido no celular do cliente. */
export async function compressPhoto(file: File, max = 800): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (!blob) throw new Error("Não foi possível preparar a imagem.");
    if (blob.size > 1024 * 1024) throw new Error("A imagem ficou grande demais. Tente outra foto.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
