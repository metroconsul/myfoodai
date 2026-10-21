# Arquivos alterados, criados e removidos

Comparação com o commit original; alterações locais ainda não publicadas no GitHub. Nenhuma migration histórica foi reescrita.

## Alterados (25)

| Arquivo | Motivo |
| --- | --- |
| `.gitignore` | Impede versionar arquivos de ambiente e secrets, preservando .env.example. |
| `AGENTS.md` | Instruções locais independentes e preservação de histórico/rotas/segredos. |
| `README.md` | Substitui o prompt histórico por instruções reais de instalação, execução, configuração e deploy. |
| `e2e/portal-fixtures.ts` | Exige dados explícitos para cenários com colaborador real. |
| `eslint.config.js` | Separa formatação e lint; exclui artefatos gerados. |
| `package.json` | Remove SDKs Lovable, configura Node/npm, adiciona fontes locais e comandos de validação/produção; remove plugins redundantes. |
| `playwright.config.ts` | Alinha a URL dos testes à porta 5173. |
| `src/integrations/supabase/auth-middleware.ts` | Mantém validação de sessão/RLS e substitui instrução de configuração via Cloud. |
| `src/integrations/supabase/client.server.ts` | Mantém service role exclusivamente no servidor e documenta configuração local. |
| `src/integrations/supabase/client.ts` | Usa persistência Supabase padrão, env Vite e instruções locais, sem bridge/erro process undefined no browser. |
| `src/integrations/supabase/cron-auth.ts` | Segredos de cron neutros, preservando validação e rotação. |
| `src/lib/face-validation.server.ts` | Adapter de visão configurável; mesmas regras/prompt/retornos, sem gateway Lovable. |
| `src/lib/policies.functions.schemas.ts` | Aceita identificador vision_api no schema de política. |
| `src/lib/policies.functions.ts` | Substitui any e casts never por cliente Supabase tipado. |
| `src/lib/policies.shared.ts` | Tipo, padrão e mapa de provedor independentes; mantém rótulos exibidos. |
| `src/lib/portal-compliance.functions.ts` | Remove escape redundante na sanitização de nome de arquivo. |
| `src/lib/timesheet.server.ts` | Tipa cliente, JSON e campos de evidência, sem mudar cálculos de negócio. |
| `src/routes/__root.tsx` | Remove metadado/telemetria Lovable e links de fontes remotas, mantendo estrutura. |
| `src/routes/_authenticated/onboarding.tsx` | Descarta o workspace sem empresa após criar a operação, evitando retorno indevido ao onboarding; encontrado no teste real do novo backend. |
| `src/routes/auth.tsx` | Login Google direto no Supabase e renderização no cliente para corrigir hidratação. |
| `src/routes/portal.tsx` | Guard comum redireciona visitante sem token para login, inclusive em documentos. |
| `src/styles.css` | Inclui as mesmas fontes via Fontsource; demais regras visuais preservadas. |
| `supabase/config.toml` | ID local neutro e URLs de autenticação para desenvolvimento independente. |
| `tsconfig.json` | Inclui testes e config Playwright na checagem sem relaxar strict. |
| `vite.config.ts` | Plugins oficiais, build Nitro/Node, env seguro, alias nativo, pré-bundle e porta 5173. |

## Criados (17)

| Arquivo | Motivo |
| --- | --- |
| `.env.example` | Modelo de configuração pública/privada e dos provedores independentes. |
| `.nvmrc` | Declara Node 22 para desenvolvimento. |
| `docs/BACKUP-RECEIVED.md` | Documenta o snapshot, a restauração real e a conferência de dados/Storage, sem dados pessoais. |
| `docs/CHANGES.md` | Relação completa de arquivos alterados/criados/removidos e motivos. |
| `docs/FILES.md` | Inventário legível de todos os 227 arquivos recebidos. |
| `docs/MIGRATION.md` | Análise técnica, serviços, lacunas, limites e procedimento de transferência do backend. |
| `docs/PRODUCT-SPEC.original.md` | Preserva a especificação antiga como referência histórica. |
| `docs/VALIDATION.md` | Comandos, resultados e limitações dos testes efetivamente realizados. |
| `docs/audit.json` | Inventário estruturado com evidência por arquivo e commit de origem. |
| `e2e/migration.functions.spec.ts` | Testa compatibilidade de PIN/tokens e decisões do adapter de visão. |
| `e2e/migration.smoke.spec.ts` | Testa layout público, fontes, assets, redirects e OAuth interceptado. |
| `package-lock.json` | Lockfile npm reproduzível sem dependências Lovable. |
| `scripts/audit.mjs` | Inventaria todos os arquivos originais, hashes, imports e tabelas, sem expor env. |
| `src/lib/error-reporting.ts` | Diagnóstico local independente. |
| `supabase/migrations/20260905000000_independent_face_provider.sql` | Migra apenas o identificador legado de visão, preservando políticas e evidências. |
| `supabase/migrations/20260905000001_create_storage_buckets.sql` | Recria os cinco buckets privados ausentes nas migrations originais. |
| `supabase/verify.sql` | Consultas de conferência do schema, políticas e buckets no destino. |

## Removidos do versionamento (10)

| Arquivo | Motivo |
| --- | --- |
| `.env` | Retira a configuração antiga do versionamento e do runtime; arquivada privadamente, substituída por .env.local do destino. |
| `.lovable/plan/auditoria-funcional-prompt-de-proposta-de-parceria-2026-09-01.md` | Metadados/planos exclusivos do editor removidos; recuperáveis no histórico Git. |
| `.lovable/plan/plano-começo-simplificado-conta-piloto-da-cafeteria-2026-09-01.md` | Metadados/planos exclusivos do editor removidos; recuperáveis no histórico Git. |
| `.lovable/plan/saas-de-gestão-para-food-service-modelo-de-dados-e-rotas-2026-08-29.md` | Metadados/planos exclusivos do editor removidos; recuperáveis no histórico Git. |
| `.lovable/project.json` | Metadados/planos exclusivos do editor removidos; recuperáveis no histórico Git. |
| `bun.lock` | Substituído pelo package-lock.json do npm. |
| `bunfig.toml` | Remove configuração exclusiva de Bun e exceções de pacotes do editor. |
| `src/integrations/lovable/index.ts` | Remove intermediador proprietário de OAuth. |
| `src/integrations/supabase/previewAuthStorage.ts` | Remove compartilhamento de tokens/sessão com o editor por postMessage. |
| `src/lib/lovable-error-reporting.ts` | Remove hooks de telemetria do editor. |


## Arquivos locais privados (não versionados)

- `.env.local`: conexão pública e credenciais de servidor do Supabase de destino.
- `.migration-private/`: backup original, objetos de Storage, manifesto de hashes,
  conexão de restauração, scripts SQL, logs e teste de integração temporário. Preservam
  evidências da transferência sem publicar dados pessoais ou chaves.
