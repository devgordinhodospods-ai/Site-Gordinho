# Site-Gordinho

E-commerce completo (loja + painel administrativo) para a tabacaria do cliente, construído para ser
"genérico" o suficiente para trocar de nicho e identidade visual todo ano sem reescrever nada — o
nome da loja e a logo são configurados pelo próprio cliente no painel admin e refletem automaticamente
na navbar e no rodapé do site.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Supabase** (Postgres + Storage) como banco de dados e armazenamento de imagens
- **NextAuth** (Google OAuth + e-mail/senha) para login de clientes
- **Mercado Pago** (Checkout Pro) para pagamento — o cliente usa a própria conta dele
- **Resend** para e-mails transacionais (confirmação de pedido, mudança de status)
- **Zustand** para o carrinho (persistido no navegador)

## Funcionalidades

- Catálogo de produtos com categorias, estoque e imagens — tudo editável pelo painel admin
- Carrinho de compras e checkout com resumo estilo "iFood": **subtotal + frete + taxa de serviço**
- **Frete dinâmico por região**: o lojista cadastra as regiões de entrega com uma taxa base e a
  distância aproximada até a loja. Na hora do checkout, o preço final sobe automaticamente:
  - em horário de pico (11h30–14h e 18h–21h),
  - quando está chovendo no local da loja (consulta de clima real via Open-Meteo, API gratuita e sem
    chave),
  - de madrugada (22h–6h).
  Isso imita o comportamento de preço dinâmico de apps como 99/iFood sem depender de uma API privada
  de cotação de frete (a 99 não oferece API pública de cotação para lojistas comuns). Toda a lógica
  está isolada em `src/lib/shipping.ts` — se um dia o cliente conseguir acesso a uma API real de
  entrega (99, Lalamove, Loggi...), basta trocar a implementação dessa função mantendo a mesma
  assinatura.
- Cadastro de cliente (e-mail/senha) + login social com Google
- Pagamento via Mercado Pago (Checkout Pro) com webhook que confirma o pagamento automaticamente
- E-mail de confirmação de pedido e de atualização de status (enviado, entregue, etc.)
- Painel administrativo (`/admin`, acesso restrito por e-mail):
  - Produtos (criar/editar/excluir, upload de imagens)
  - Categorias
  - Regiões de entrega (taxa base + distância)
  - Pedidos (listar, filtrar por status, avançar status: pago → confirmado → em preparo → enviado →
    entregue, ou cancelar — cancelar devolve os itens ao estoque automaticamente)
  - Configurações da loja: **nome, logo, favicon, contatos e endereço de origem** — é aqui que o
    cliente troca a identidade visual da loja quando decidir mudar de nicho

## Configuração do ambiente

1. Copie `.env.example` para `.env.local` e preencha:
   - **Supabase**: crie um projeto em [supabase.com](https://supabase.com), rode o conteúdo de
     `supabase/schema.sql` no SQL Editor do projeto, e copie a URL + chaves em
     *Project Settings > API*.
   - **NextAuth**: gere `NEXTAUTH_SECRET` com `openssl rand -base64 32`.
   - **Google OAuth**: crie credenciais OAuth 2.0 em
     [Google Cloud Console](https://console.cloud.google.com/apis/credentials), com redirect URI
     `https://SEU_DOMINIO/api/auth/callback/google` (e `http://localhost:3000/api/auth/callback/google`
     em desenvolvimento).
   - **ADMIN_EMAILS**: e-mail(s) do cliente que terão acesso ao painel `/admin`.
   - **Mercado Pago**: pegue o `Access Token` de produção em
     [mercadopago.com.br/developers/panel/app](https://www.mercadopago.com.br/developers/panel/app)
     (conta do próprio cliente, já que ele mesmo paga as taxas do Mercado Pago).
   - **Resend**: crie uma conta em [resend.com](https://resend.com) e gere uma API key para o envio
     dos e-mails de pedido.

2. Instale as dependências e rode localmente:

   ```bash
   npm install
   npm run dev
   ```

3. Configure o webhook do Mercado Pago para apontar para
   `https://SEU_DOMINIO/api/mercadopago/webhook` (isso é feito automaticamente via
   `notification_url` em cada preferência de pagamento criada, mas vale confirmar no painel do
   Mercado Pago em produção).

4. Deploy recomendado: [Vercel](https://vercel.com) — basta importar o repositório e configurar as
   mesmas variáveis de ambiente do `.env.example`.

## Sobre a identidade visual

O projeto está propositalmente **sem logo, nome definitivo ou paleta de cores da marca** — o cliente
disse que troca o nicho e a marca da loja todo ano, então a arte final (logo, favicon, nome, cores)
é responsabilidade dele e deve ser cadastrada em **Painel admin → Configurações da loja** quando
estiver pronta. Até lá, o site funciona com um nome genérico (“Minha Loja”) e sem logo.

## Próximos passos sugeridos

- Popular categorias, produtos e regiões de entrega reais da tabacaria pelo painel admin
- Ajustar os multiplicadores de frete dinâmico (`src/lib/shipping.ts`) com o cliente, caso ele ache
  o acréscimo de chuva/pico muito alto ou baixo
- Definir a identidade visual (logo, cores, favicon) e cadastrar no painel
- Testar o fluxo de pagamento no Mercado Pago com um pedido real de baixo valor antes de divulgar a
  loja
