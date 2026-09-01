# Auditoria funcional + Prompt de proposta de parceria

Objetivo: validar o que já está funcionando no Golden Hour Hub, documentar cada módulo em português claro e gerar um prompt técnico completo para o Claude/Manus montarem a proposta de parceria com seu amigo (investidor de infraestrutura + cliente piloto da cafeteria).

## Etapa 1 — Teste funcional de ponta a ponta

Rodar o app localmente com navegador automatizado e percorrer as rotas reais, registrando status (funcionando / parcial / com erro) e capturando evidência:

- Landing page e planos (checkout Stripe em modo teste)
- Autenticação e onboarding de empresa
- Painel: Dashboard, Unidades, Pessoas, Cargos e times
- Escalas: turnos, escalas, modelos, histórico, conformidade de escala
- Ponto: registros, cartões de ponto, comprovantes com geolocalização
- Estoque e Itens operacionais, Entregas e regras de entrega
- Vendas (dashboard + endpoint de ingestão)
- Conformidade: exames/ASO, kits e uniformes, pendências, trocas
- Holerites: publicação, importação em lote, assinatura
- Configurações: aceite eletrônico, LGPD, marca
- Portal do Colaborador: login por PIN, escala, ponto com foto/geo, pendências, documentos, holerites, perfil
- Webhook Stripe (`/api/public/stripe-webhook`) e ingestão de vendas: teste de assinatura válida/inválida e idempotência

Onde algo falhar, o relatório aponta o problema sem corrigir agora (correções entram em uma etapa separada, se você quiser).

## Etapa 2 — Relatório de funcionalidades

Documento em português com, para cada módulo: o que faz, quem usa (gestor ou colaborador), valor para o negócio e status atual. Inclui também a arquitetura em linguagem simples (banco, autenticação, storage privado, auditoria, LGPD, biometria facial, cobrança Stripe) e os planos/preços já configurados.

## Etapa 3 — Prompt para Claude e Manus

Um prompt único, longo e autossuficiente (copiar e colar), contendo:

- Contexto do produto, módulos e diferenciais competitivos
- Modelo da parceria: **sem sociedade**, sem equity, sem vínculo societário
- Contrapartidas do parceiro: pagamento da VPS e do domínio
- Contrapartidas suas: 30 dias de uso gratuito da plataforma na cafeteria como cliente piloto, suporte próximo e prioridade em ajustes
- Compromisso do piloto: feedback estruturado semanal, lista de melhorias, uso real pela equipe
- Autorização de imagem: gravação de vídeos com funcionários, com o dono e com os irmãos (empresa de engenharia), uso em marketing e prova social
- Cronograma de 90 dias: semanas de implantação, piloto, gravações, lançamento e divulgação
- Entregáveis pedidos à IA: documento de proposta, resumo executivo de 1 página, termo simples de autorização de uso de imagem, cronograma em tabela e roteiro de conteúdo para os vídeos
- Tom, idioma (pt-BR), formato e restrições (não inventar números; usar apenas os dados do prompt)

## Detalhes técnicos

- Testes com Playwright headless contra `localhost:8080`, sessão de teste autenticada; screenshots em `/tmp/browser/`.
- Webhook testado por requisição HTTP assinada localmente (sem tocar em dados de produção).
- Entregáveis salvos como arquivos markdown em `/mnt/documents/` (relatório de funcionalidades e prompt), além de resumo no chat.
- Nenhuma alteração de código, banco ou permissões nesta etapa.

## Pontos que preciso confirmar (posso usar placeholders se preferir)

- Nome do parceiro, da cafeteria e da empresa de engenharia
- Valor estimado de VPS + domínio que ele vai custear
- O que acontece após os 30 dias: ele vira cliente pagante com desconto, segue grátis, ou a definir
