/**
 * Camada de validação de identidade (server-only).
 *
 * A implementação é abstraída para permitir a troca do provedor sem alterar o
 * fluxo do Portal do Colaborador. O provedor ativo é definido pela variável de
 * ambiente FACE_VALIDATION_PROVIDER.
 *
 * - "selfie_evidence" (padrão): registra a selfie como evidência do aceite.
 *   Não realiza comparação biométrica nem prova de vida — o status de prova de
 *   vida é reportado como "nao_avaliado".
 * - Outros valores: reservados para provedores externos. Enquanto não houver
 *   credenciais configuradas, o serviço responde "indisponivel" em vez de
 *   aprovar automaticamente.
 */

export type FaceValidationResult = {
  status: "aprovado" | "reprovado" | "indisponivel";
  liveness: "aprovado" | "reprovado" | "nao_avaliado";
  provider: string;
  reference: string;
  message?: string;
};

/** Converte um data URL de imagem em bytes, validando o formato. */
export function decodeImageDataUrl(dataUrl: string): Uint8Array | null {
  const match = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  try {
    const binary = atob(match[2]!);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export async function validateFace(input: {
  imageDataUrl: string;
  employeeId: string;
  deliveryId: string;
}): Promise<{ result: FaceValidationResult; bytes: Uint8Array | null }> {
  const provider = process.env["FACE_VALIDATION_PROVIDER"] ?? "selfie_evidence";
  const bytes = decodeImageDataUrl(input.imageDataUrl);
  const reference = `${provider}:${crypto.randomUUID()}`;

  if (!bytes || bytes.byteLength < 4096) {
    return {
      result: {
        status: "reprovado",
        liveness: "nao_avaliado",
        provider,
        reference,
        message: "Não conseguimos ler a imagem. Tente novamente com mais iluminação.",
      },
      bytes: null,
    };
  }

  if (provider !== "selfie_evidence") {
    // Provedor externo configurado, porém sem credenciais disponíveis.
    return {
      result: {
        status: "indisponivel",
        liveness: "nao_avaliado",
        provider,
        reference,
        message: "Serviço de validação temporariamente indisponível.",
      },
      bytes,
    };
  }

  return {
    result: { status: "aprovado", liveness: "nao_avaliado", provider, reference },
    bytes,
  };
}

/** Hash de integridade do comprovante. */
export async function integrityHash(payload: unknown) {
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Mascara o IP mantendo apenas o prefixo de rede. */
export function maskIp(ip: string | null | undefined) {
  if (!ip) return null;
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::/48`;
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}
