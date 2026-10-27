# Jungle Marketplace

Marketplace de NFTs em React + TypeScript com mocks em MSW.

## Stack
- React 19
- TypeScript
- Vite
- TanStack Router
- TanStack Query
- Axios
- MSW
- Tailwind CSS

## API simulada no deploy
- Em desenvolvimento, o MSW é iniciado automaticamente.
- No build de demonstração, configure `VITE_ENABLE_MSW=true` para iniciar o mesmo worker publicado.
- O build executa `msw init public --save` antes do Vite para garantir que `public/mockServiceWorker.js` esteja atualizado e seja copiado para `dist`.
- A aplicação aguarda o worker estar pronto antes de montar o React e iniciar as consultas.
- `vercel.json` mantém o fallback de rotas SPA e define o worker como JavaScript, com revalidação para evitar servir uma versão antiga.
- Se a inicialização do MSW falhar, a aplicação mostra uma mensagem explícita em vez de iniciar sem os mocks.

## Contratos REST utilizados

### Sessão e conta
- POST /api/auth/login
- POST /api/auth/register
- GET /api/users/:id/profile
- PUT /api/users/:id/profile
- GET /api/users/:id/favorites
- POST /api/users/:id/favorites
- POST /api/users/:id/wallets
- PUT /api/users/:id/wallets/primary

### NFTs
- GET /api/nfts
  - query: q, sort, page, category
  - response: { items, total }
- GET /api/nfts/:id

### Carrinho e cotação
- POST /api/cart/quote
  - body: { items, coupon }
  - response: { subtotal, discount, networkFee, total }

### Pedidos
- POST /api/orders
  - body: { userId, items, coupon, idempotencyKey }
  - response: snapshot do pedido
- GET /api/orders/:id

## Política de cache, retries e sincronização
- Queries usam staleTime de 30s.
- Retry fica em 1 tentativa para evitar duplicações em simulação.
- QueryKey separa catálogo, cotação, favoritos e pedidos por contexto.
- Carrinho e sessão são persistidos em localStorage e rehydrados ao abrir a aplicação.
- Preço, estoque e cupom são revalidados antes do envio do pedido.
- A chave de idempotência previne reenvios duplicados na mesma tentativa de compra.

## Observações de UX
- Rotas privadas redirecionam para login com retorno ao fluxo anterior.
- O último pedido confirmado é preservado para recuperação após refresh.
- Erros de validação e de recurso inexistente são tratados com mensagens explícitas.
