# Validação realizada em 05/09/2026

Ambiente: Linux, Node.js **22.22.1**, npm **9.2.0**. Branch local:
`codex/independent-runtime`. Nenhum push foi feito ao GitHub.

| Verificação | Resultado |
| --- | --- |
| `npm install` (cache local em `/tmp/myfoodai-npm-cache`) | Sucesso; 415 pacotes auditados, 0 vulnerabilidades reportadas |
| `npm run dev` | Sucesso; Vite 8.1.5 em `http://127.0.0.1:5173` |
| `npm run build` | Sucesso; saída Node `.output/server/index.mjs` e assets `.output/public` |
| `PORT=4173 HOST=127.0.0.1 npm start` | Sucesso; build atende em `http://127.0.0.1:4173` |
| `npm run typecheck` | Sucesso, strict preservado; frontend, backend, configurações e testes |
| `npm run lint` | 0 erros; 14 avisos preexistentes de hooks/Fast Refresh |
| `npm run test:migration` contra dev | 7 testes aprovados (26,3 s) |
| Mesmos testes contra produção | 7 testes aprovados (12,8 s) |
| Auditoria de imports locais | 227 arquivos originais inventariados; nenhum import local sem resolução |
| Tabelas SQL × tipos gerados | 68 nomes em ambos; nenhuma tabela ausente na comparação de nomes |
| Componentes e assets públicos | 58 arquivos comparados byte a byte com Git original, todos preservados |
| Dependências/endpoints Lovable ativos | Nenhuma ocorrência em `src`, package/lock/config Vite e assets compilados |
| `git diff --check` | Sucesso |
| Restauração do Supabase | 68 tabelas, 291 registros públicos, 4 usuários/identidades e 5 objetos de Storage comparados sem divergências com o backup |
| Teste integrado no Supabase novo | Sucesso: login, onboarding, RLS entre empresas e Portal por CPF/PIN; os registros temporários foram removidos |
| Conferência após o teste | 4 usuários e 5 objetos de Storage, API pública e administrativa respondendo HTTP 200 |

O teste de OAuth intercepta a requisição de autorização: confirma a chamada direta ao
Supabase e o retorno para `/auth`, mas **não autentica uma conta Google real**.
Os testes de visão usam respostas simuladas e validam as mesmas decisões: rosto único,
ausência/múltiplos rostos, recaptura, oclusão, qualidade ruim e provedor indisponível.
Os testes de PIN verificam hash correto/incorreto e token de sessão.

As páginas públicas foram renderizadas em 1440×1000 e 390×844. Capturas estão em
`test-results/landing-1440.png` e `test-results/landing-390.png` (artefatos locais ignorados).
Os testes verificam ausência de exceções JavaScript nas telas públicas, carregamento
local das fontes, guards de oito URLs, favicon/robots e HTTP 404.

## Reproduzir

Configure `.env.local` conforme o README e instale o navegador de teste:

```sh
npm install
npx playwright install chromium
npm run dev
# Em outro terminal:
npm run test:migration
```

Para produção:

```sh
npm run build
PORT=4173 HOST=127.0.0.1 npm start
# Em outro terminal:
E2E_BASE_URL=http://127.0.0.1:4173 npm run test:migration
```

Neste computador, o navegador foi instalado em `/tmp/myfoodai-browsers`; as execuções
usaram `PLAYWRIGHT_BROWSERS_PATH=/tmp/myfoodai-browsers`. Como a versão herdada do
Playwright não reconhece Ubuntu 26.04, o download usou o build Ubuntu 24.04, que executou
os testes com sucesso. Isso não é necessário para `npm install`, `dev` ou `build`.

## O que não foi validado

- Login Google real, pois o provedor OAuth precisa ser configurado no novo projeto Supabase.
- Cobranças/eventos reais Stripe, provedor real de visão e envio de WhatsApp/e-mail.
- Fluxos manuais completos de upload, holerites e cartões assinados com as contas reais.
- Equivalência pixel a pixel com a aplicação antiga autenticada.

O teste integrado criou uma empresa e colaborador temporários, fez o login por CPF/PIN e
apagou a empresa e o usuário ao fim. A suíte antiga do Portal exige colaborador e ambiente
de teste; ela não foi executada contra produção. A fixture agora exige CPF/PIN explícitos
para cenários que dependem deles.

O build ainda emite avisos de depreciação de `inputValidator` do TanStack e de tamanho
de chunks. São avisos, não falhas; a API e a divisão original de módulos foram preservadas.
Prettier permanece disponível como `npm run format`, separado do lint, para evitar uma
reescrita apenas cosmética do repositório.
