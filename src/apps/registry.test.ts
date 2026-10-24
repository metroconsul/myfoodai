import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPS, appAccess, appById, type AccessContext } from "./registry";
import { FEATURES, PLAN_APPS, PLAN_FEATURES, appForRoute } from "@/config/features";

function ctx(over: Partial<AccessContext> & { features?: string[] } = {}): AccessContext {
  const features = over.features ?? [];
  return {
    hasFeature: (code) => features.includes(code),
    roles: over.roles ?? ["owner"],
    isPlatformAdmin: over.isPlatformAdmin ?? false,
  };
}

describe("registro de aplicativos", () => {
  it("tem os cinco aplicativos, cada um com um código de acesso conhecido", () => {
    expect(APPS.map((a) => a.id).sort()).toEqual(
      ["caixa-financeiro", "compras", "documentos", "estoque", "ponto"],
    );
    for (const app of APPS) expect(FEATURES).toContain(app.entitlement);
  });

  it("Compras e Caixa & Financeiro aparecem como 'em breve' mesmo se ativados", () => {
    const compras = appById("compras");
    expect(appAccess(compras, ctx({ features: ["app_compras"] }))).toBe("soon");
    expect(appAccess(appById("caixa-financeiro"), ctx({ isPlatformAdmin: true }))).toBe("soon");
  });

  it("app não contratado não abre, mesmo para o dono", () => {
    expect(appAccess(appById("estoque"), ctx({ features: ["app_ponto"] }))).toBe("not_contracted");
  });

  it("app contratado abre para papel autorizado e não abre para papel sem acesso", () => {
    const ponto = appById("ponto");
    expect(appAccess(ponto, ctx({ features: ["app_ponto"], roles: ["supervisor"] }))).toBe("open");
    expect(appAccess(ponto, ctx({ features: ["app_ponto"], roles: ["staff"] }))).toBe("no_role");
    expect(appAccess(ponto, ctx({ features: ["app_ponto"], roles: ["cashier"] }))).toBe("no_role");
  });

  it("usuário sem papel não abre nenhum app", () => {
    for (const app of APPS.filter((a) => a.status === "available")) {
      expect(appAccess(app, ctx({ features: [app.entitlement], roles: [] }))).toBe("no_role");
    }
  });

  it("administração da plataforma abre os apps disponíveis", () => {
    expect(appAccess(appById("documentos"), ctx({ isPlatformAdmin: true, roles: [] }))).toBe("open");
  });
});

describe("acesso por aplicativo nas rotas legadas /app", () => {
  it("mapeia cada área para o app certo", () => {
    expect(appForRoute("/app/time-entries")).toBe("app_ponto");
    expect(appForRoute("/app/schedules/abc")).toBe("app_ponto");
    expect(appForRoute("/app/documentos/holerites")).toBe("app_documentos");
    expect(appForRoute("/app/deliveries/123")).toBe("app_documentos");
    expect(appForRoute("/app/inventory")).toBe("app_estoque");
  });

  it("itens, colaboradores e unidades são compartilhados (sem app obrigatório)", () => {
    expect(appForRoute("/app/items")).toBeNull();
    expect(appForRoute("/app/employees")).toBeNull();
    expect(appForRoute("/app/units")).toBeNull();
    expect(appForRoute("/app")).toBeNull();
  });
});

describe("planos e aplicativos padrão", () => {
  it("cada plano inclui os seus aplicativos padrão no fallback do cliente", () => {
    for (const [plan, apps] of Object.entries(PLAN_APPS)) {
      for (const app of apps) expect(PLAN_FEATURES[plan as keyof typeof PLAN_FEATURES]).toContain(app);
    }
  });

  it("os apps padrão do cliente são os mesmos da função SQL plan_app_codes", () => {
    const sql = readFileSync("supabase/migrations/20261024120100_app_entitlements.sql", "utf8");
    const fromSql = (label: string) => {
      const m = sql.match(new RegExp(`WHEN '${label}' THEN ARRAY\\[([^\\]]+)\\]`));
      return m?.[1] ? m[1].split(",").map((s) => s.trim().replace(/'/g, "")) : null;
    };
    const elseMatch = sql.match(/ELSE ARRAY\[([^\]]+)\]/);
    expect(fromSql("essencial")).toEqual(PLAN_APPS.essencial);
    expect(fromSql("equipe")).toEqual(PLAN_APPS.equipe);
    expect((elseMatch?.[1] ?? "").split(",").map((s) => s.trim().replace(/'/g, ""))).toEqual(PLAN_APPS.comeco);
  });
});
