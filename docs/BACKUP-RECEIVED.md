# Backup recebido e conferido

Destino indicado: `obfwapckvwjpjzlumlei`.

- Backup PostgreSQL custom, versão de formato 1.16, comprimido com zstd; extraído para inspeção sem execução de SQL.
- Banco de origem PostgreSQL 17.6; ferramenta de exportação pg_dump 18.6.
- 4 usuários administrativos, 4 empresas e 2 colaboradores.
- Todos os 5 objetos do Storage presentes no snapshot foram encontrados nos arquivos enviados.
- Cada arquivo foi associado ao caminho original por tamanho e MD5 (eTag); SHA-256 também registrado no manifesto privado.
- As 3 selfies de mesmo nome foram separadas por seus caminhos de entrega. Nenhuma foi sobrescrita.
- Buckets do produto: item-photos, avatars, signatures, documents e payslips. O bucket de exportação é apenas backup e não integra o produto.
- Dados privados e arquivos preparados ficam em `.migration-private/`, ignorado pelo Git. A pasta Ventoy não participa da migração.

## Restauração concluída

O destino foi verificado vazio antes da importação. Foram aplicadas as 18 migrations
originais e as duas migrations de portabilidade, com histórico registrado no destino.
As 68 tabelas públicas e seus 291 registros foram comparados campo a campo com o backup,
sem divergências. RLS está habilitado em todas as tabelas públicas.

Foram preservados os UUIDs de quatro usuários e quatro identidades de autenticação,
seus vínculos e os hashes disponíveis. Sessões administrativas, refresh tokens e tokens
de recuperação/confirmação antigos não foram importados. O usuário precisa fazer novo login.
Os hashes de PIN dos colaboradores foram preservados.

Os cinco objetos foram enviados aos buckets privados com os caminhos originais e
baixados novamente para comparação SHA-256, sem divergências. Buckets vazios do produto
também foram recriados, com os limites de tamanho do snapshot.

A aplicação usa as credenciais novas em `.env.local`, ignorado pelo Git. A configuração
antiga foi arquivada na pasta privada. O dump completo não foi executado indiscriminadamente:
schemas internos, vault, roles globais e event triggers do servidor original não foram restaurados.

A conferência cobre o snapshot fornecido; alterações posteriores na origem não fazem parte
desse backup. O projeto antigo não foi excluído e nenhum push foi feito ao GitHub.
