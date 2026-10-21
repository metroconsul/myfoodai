# Prompt para o Claude Design — Motion do ecossistema MyFoods

Copie tudo abaixo da linha e cole no Claude Design.

---

## Objetivo

Crie um **motion design (vídeo/animação de apresentação, 16:9, 60–75 s, com versão vertical 9:16 em cortes de 15 s)** que explique, de forma clara e premium, as funções de cada aplicativo do ecossistema **MyFoods**. Público: donos e gerentes de restaurantes, lanchonetes, cafeterias e redes de food service no Brasil. Idioma de todos os textos: **português do Brasil**. Tom: direto, prático, sem jargão técnico.

## O que é o MyFoods

MyFoods é uma **plataforma modular de produtos operacionais para restaurantes**: "uma plataforma, várias soluções operacionais". Cada aplicativo resolve um problema específico, tem interface própria, pode ser contratado **individualmente ou em pacotes**, e todos compartilham a mesma identidade visual, o mesmo login único e a mesma base de dados (organização, unidades, colaboradores, permissões).

Slogan de apoio: **"Operação de food service em um só lugar."**
Atende desde o pequeno estabelecimento em que o dono está na rotina até redes com várias unidades, em que proprietários acompanham resultados e equipes gerenciam a operação.

## Estrutura do vídeo

1. **Abertura (0–5 s)** — logo MyFoods surge; fala-texto: "Uma plataforma. Várias soluções para a sua operação."
2. **Portal central (5–12 s)** — o usuário faz login **uma única vez** e vê cards dos aplicativos que contratou. Ao clicar num card, abre o app sem novo login; um botão "voltar ao portal" permite alternar entre apps. Cards não contratados aparecem apagados com cadeado (conceito: "contrate só o que precisa").
3. **Seis aplicativos (12–60 s, ~8 s cada)** — um bloco por app, seguindo o roteiro abaixo.
4. **Integração (60–68 s)** — linhas de conexão ligam os apps (ex.: Compras → Estoque, Caixa → Financeiro, Documentos → Ponto), com a legenda "Cada app funciona sozinho. Juntos, ficam mais fortes."
5. **Encerramento (68–75 s)** — logo + "MyFoods. Simplifique a operação. Enxergue os resultados." + CTA "Comece pelo app que você mais precisa".

## Roteiro por aplicativo

Para cada app: um ícone/emblema próprio, nome ("MyFoods Ponto"), uma frase-missão, **3 funções animadas** em tela de produto (mockup de UI estilizada, não captura literal) e um destaque de resultado.

### 1. MyFoods Ponto
- Missão: "Controle a jornada da equipe sem planilha."
- Funções: (a) colaborador bate ponto pelo celular (portal com CPF + PIN, confirmação com microanimação de check e foto/geolocalização); (b) cartão de ponto e histórico de entradas, saídas e intervalos; (c) fila "O que precisa de você": gestor aprova ou recusa correções e trata inconsistências (saída não registrada, batida fora da área).
- Destaque: "Menos erro, menos retrabalho na folha."

### 2. MyFoods Estoque
- Missão: "Saiba o que tem, onde tem e quando vai acabar."
- Funções: (a) cards de itens com foto e saldo por unidade; (b) entradas, saídas, ajustes e transferências com histórico rastreável; (c) estoque mínimo com alerta visual (barra que fica âmbar/vermelha) e inventário.
- Destaque: "Fim da ruptura surpresa e do desperdício."

### 3. MyFoods Compras
- Missão: "Do 'está faltando' ao pedido aprovado."
- Funções: (a) lista/solicitação de compra por unidade; (b) fluxo de aprovação (solicitado → aprovado → pedido → recebido); (c) fornecedores e acompanhamento de status, com recebimento refletindo no estoque.
- Destaque: "Compra certa, na hora certa, com aprovação."

### 4. MyFoods Caixa
- Missão: "Cada turno de caixa conferido e registrado."
- Funções: (a) abertura e fechamento de caixa com operador e unidade; (b) entradas, saídas, sangrias e suprimentos; (c) conferência com destaque de divergência e histórico de fechamentos.
- Destaque: "Divergência aparece no mesmo dia." (Caixa é operacional, distinto do Financeiro.)

### 5. MyFoods Financeiro
- Missão: "Enxergue para onde o dinheiro vai."
- Funções: (a) receitas e despesas por categoria; (b) contas a pagar e a receber com vencimentos; (c) fluxo de caixa gerencial e relatórios por período e por unidade (gráficos que desenham ao entrar).
- Destaque: "Resultado por unidade, num só painel."

### 6. MyFoods Documentos
- Missão: "Documentos organizados e sempre em dia."
- Funções: (a) upload e organização por empresa, unidade e colaborador; (b) datas de vencimento com alertas (ASO, exames, certificados, contratos); (c) controle de acesso com cadeado para documentos sensíveis, e colaborador consultando só os seus (holerites, comprovantes, EPIs com aceite digital).
- Destaque: "Nada vence sem você saber."

### Menção rápida (fase futura, 3 s, em estilo "em breve")
- **MyFoods Executive**: visão consolidada para proprietários, liberada para quem tem **2 ou mais apps ativos**. **MyFoods Completo**: pacote com todos os apps. Mostrar como cards "em breve", sem preços.

## Identidade visual (usar exatamente)

- **Cores:** tinta `#09090b` (preto), papel `#f8f4e8` (creme), ácido `#d2e823` (lima, cor de ação/destaque), brasa `#f26b38` (laranja, apoio/alertas), cartão `#fffdf6`, texto secundário `#5e5a50`. Fundos alternando creme e preto; lima como acento principal. Não usar azul ou roxo.
- **Tipografia:** títulos em **Dela Gothic One**; texto em **Space Grotesk** (500/700); números, rótulos e dados em **Space Mono**.
- **Logo:** `public/myfoods-logo.png` (anexar).
- **Estilo:** editorial e ousado, com blocos grandes, cantos levemente arredondados, bordas pretas finas, sombras duras (offset, sem blur) nos cards. Cada app tem um emblema simples (formas geométricas), todos na mesma família visual.
- Dados nas telas devem ser **fictícios e plausíveis** (ex.: "Café Aurora — Unidade Centro"), nunca nomes ou marcas reais.

## Direção de movimento

- Ritmo rápido e limpo; entradas suaves de cards (ease-out, 250–400 ms), elevação discreta, mudança de status com transição de cor e escala curta, gráficos que se desenham, drawers deslizando, microconfirmação (check) após cada ação.
- Transições entre apps com "wipe" lima ou corte por bloco de cor, mantendo continuidade com o portal.
- Sem efeitos exagerados, sem loops excessivos, sem tremores. Prever versão sem movimento (frames estáticos) respeitando `prefers-reduced-motion` caso seja exportado para web.
- Trilha: instrumental leve e moderna (sem letra); efeitos sonoros sutis de clique/confirmação. Legendas em português sempre visíveis.

## Entregáveis

1. Vídeo principal 16:9 (1920×1080, 30 fps), 60–75 s.
2. Sete cortes verticais 9:16 de ~15 s: um por app + um do portal/ecossistema.
3. Loop curto (5 s) do portal com os seis cards para uso no site.
4. Storyboard com os quadros-chave de cada cena e a lista de textos na tela.

## Restrições

- Não inventar preços, planos, números de clientes ou integrações com bancos, adquirentes ou PDVs.
- Não afirmar que Executive e Completo já estão disponíveis.
- Não copiar logos, marcas, textos ou layouts de outros produtos.
