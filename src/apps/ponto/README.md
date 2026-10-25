# MyFoods Ponto (`/ponto`)

Onde mexer em cada parte. As rotas em `src/routes/_authenticated/ponto*.tsx` só ligam endereço → tela.

| Aba | Endereço | Arquivo |
|---|---|---|
| Hoje | `/ponto` | `pages/dashboard-page.tsx` (+ `components/corrections.tsx`) |
| Registros | `/ponto/registros` | `pages/registros-page.tsx` |
| Cartões | `/ponto/cartoes`, `/ponto/cartoes/$id` | `pages/point-cards-page.tsx`, `pages/point-card-detail-page.tsx` |
| Escalas | `/ponto/escalas` | `pages/escalas-page.tsx` (+ `components/horario-padrao.tsx`, `escala-semana.tsx`, `horarios-prontos.tsx`; regras em `lib/schedule-rules.ts`) |
| Equipe | `/ponto/equipe`, `/ponto/equipe/cargos` | `pages/employees-page.tsx`, `pages/roles-teams-page.tsx` |
| ⚙ Configurações | `/ponto/configuracoes` | `pages/acceptance-policy-page.tsx` |

- **Abas e engrenagem:** `components/ponto-shell.tsx`. **Sub-abas de Equipe:** `components/sections.tsx`.
- **Quem acessa:** `src/routes/_authenticated/ponto.tsx` (app contratado + papéis de `lib/roles.ts`). Cada ação continua protegida no banco.
- **Textos de tipos e situações das batidas:** `lib/labels.ts`. **Consultas compartilhadas:** `lib/queries.ts`. **Datas locais:** `lib/dates.ts`.
- Colaboradores, Cargos e Políticas de aceite também aparecem em `/app` (Documentos/EPIs usam) — é a mesma tela.
- Endereços antigos de ponto em `/app` redirecionam para cá. O Portal do Colaborador não usa estes arquivos.
