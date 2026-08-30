/**
 * Camada de validação de identidade (server-only).
 *
 * Provedor ativo definido por FACE_VALIDATION_PROVIDER:
 * - "lovable_ai" (padrão): análise real da selfie por modelo de visão do
 *   Lovable AI Gateway. Verifica presença de rosto único, enquadramento,
 *   oclusões (boné, óculos escuros, máscara) e indícios de recaptura de tela
 *   (prova de vida passiva). Não faz comparação biométrica 1:1 — o resultado
 *   é registrado como evidência auditável do aceite.
 * - "selfie_evidence": apenas registra a selfie como evidência.
 * - Outros valores: reservados; respondem "indisponivel".
 */

export type FaceValidationResult = {
  status: "aprovado" | "reprovado" | "indisponivel";
  liveness: "aprovado" | "reprovado" | "nao_avaliado";
  provider: string;
  reference: string;
  message?: string;
  details?: Record<string, unknown>;
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

const ANALYSIS_PROMPT = `Você é um verificador de qualidade de selfies para aceite eletrônico de documentos trabalhistas.
Analise a imagem e responda somente com JSON válido, sem markdown, no formato:
{"face_present":bool,"face_count":number,"face_centered":bool,"occlusion":"nenhuma"|"oculos_escuros"|"mascara"|"bone"|"outra","sharpness":"boa"|"media"|"ruim","lighting":"boa"|"media"|"ruim","screen_replay":bool,"printed_photo":bool,"confidence":0-1,"reason":"curta explicação em português"}
screen_replay = a imagem parece ser a foto de uma tela (moiré, brilho de display, bordas de aparelho).
printed_photo = a imagem parece ser a foto de uma foto impressa.`;

type Analysis = {
  face_present?: boolean;
  face_count?: number;
  face_centered?: boolean;
  occlusion?: string;
  sharpness?: string;
  lighting?: string;
  screen_replay?: boolean;
  printed_photo?: boolean;
  confidence?: number;
  reason?: string;
};

async function analyzeWithLovableAI(imageDataUrl: string, apiKey: string): Promise<Analysis | null> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ANALYSIS_PROMPT },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  const json = /\{[\s\S]*\}/.exec(raw);
  if (!json) return null;
  try {
    return JSON.parse(json[0]) as Analysis;
  } catch {
    return null;
  }
}

const OCCLUSION_MESSAGE: Record<string, string> = {
  oculos_escuros: "Retire os óculos escuros e capture novamente.",
  mascara: "Retire a máscara e capture novamente.",
  bone: "Retire o boné e capture novamente.",
  outra: "Deixe o rosto totalmente visível e capture novamente.",
};

export async function validateFace(input: {
  imageDataUrl: string;
  employeeId: string;
  deliveryId: string;
}): Promise<{ result: FaceValidationResult; bytes: Uint8Array | null }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  const provider = process.env["FACE_VALIDATION_PROVIDER"] ?? (apiKey ? "lovable_ai" : "selfie_evidence");
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

  if (provider === "lovable_ai") {
    if (!apiKey) {
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

    let analysis: Analysis | null = null;
    try {
      analysis = await analyzeWithLovableAI(input.imageDataUrl, apiKey);
    } catch {
      analysis = null;
    }

    if (!analysis) {
      return {
        result: {
          status: "indisponivel",
          liveness: "nao_avaliado",
          provider,
          reference,
          message: "Serviço de validação temporariamente indisponível. Tente novamente em instantes.",
        },
        bytes,
      };
    }

    const details: Record<string, unknown> = { ...analysis };
    const replay = analysis.screen_replay === true || analysis.printed_photo === true;
    const liveness: FaceValidationResult["liveness"] = replay ? "reprovado" : "aprovado";

    if (!analysis.face_present || (analysis.face_count ?? 1) < 1) {
      return {
        result: {
          status: "reprovado",
          liveness: "nao_avaliado",
          provider,
          reference,
          details,
          message: "Nenhum rosto identificado. Centralize o rosto no círculo e tente novamente.",
        },
        bytes,
      };
    }
    if ((analysis.face_count ?? 1) > 1) {
      return {
        result: {
          status: "reprovado",
          liveness,
          provider,
          reference,
          details,
          message: "Mais de uma pessoa na imagem. Capture a selfie sozinho.",
        },
        bytes,
      };
    }
    if (replay) {
      return {
        result: {
          status: "reprovado",
          liveness: "reprovado",
          provider,
          reference,
          details,
          message: "A imagem parece ser a foto de uma tela ou impressão. Capture a selfie ao vivo.",
        },
        bytes,
      };
    }
    if (analysis.occlusion && analysis.occlusion !== "nenhuma") {
      return {
        result: {
          status: "reprovado",
          liveness,
          provider,
          reference,
          details,
          message: OCCLUSION_MESSAGE[analysis.occlusion] ?? OCCLUSION_MESSAGE["outra"]!,
        },
        bytes,
      };
    }
    if (analysis.sharpness === "ruim" || analysis.lighting === "ruim") {
      return {
        result: {
          status: "reprovado",
          liveness,
          provider,
          reference,
          details,
          message: "Imagem sem nitidez ou iluminação suficiente. Tente novamente em local mais claro.",
        },
        bytes,
      };
    }

    return {
      result: { status: "aprovado", liveness, provider, reference, details },
      bytes,
    };
  }

  if (provider !== "selfie_evidence") {
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
