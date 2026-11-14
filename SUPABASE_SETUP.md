# Guia Passo a Passo: Integrando o Krono com o Supabase

Este guia explica, do zero, como conectar o **Krono** a um banco de dados gratuito e seguro no **Supabase** (PostgreSQL).  
Nenhuma senha ou chave do banco fica exposta no navegador — toda a comunicação acontece exclusivamente no servidor.

---

## Passo 1: Criar sua conta e um projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com) e clique em **Start your project** (pode entrar com sua conta do GitHub).
2. Clique em **New Project**.
3. Preencha:
   - **Name**: `krono` (ou o nome que preferir).
   - **Database Password**: crie uma senha forte e guarde-a em um lugar seguro.
   - **Region**: escolha a região mais próxima (ex: `South America (São Paulo)`).
4. Clique em **Create new project** e aguarde cerca de 1 a 2 minutos até o projeto ficar pronto.

---

## Passo 2: Criar as tabelas no banco de dados

1. No menu lateral esquerdo do seu projeto no Supabase, clique em **SQL Editor** (ícone `>_`).
2. Clique em **New query**.
3. Abra o arquivo [supabase/schema.sql](supabase/schema.sql) aqui da pasta do projeto, copie **todo** o conteúdo dele e cole dentro do editor do Supabase.
4. Clique no botão **Run** (ou pressione `Ctrl + Enter`).
5. Deve aparecer a mensagem **`Success. No rows returned`**. Isso significa que todas as tabelas (`users`, `study_plans`, `study_records`, `review_records`, `simulado_records`, `study_cycles`) e a proteção de segurança (**RLS**) foram criadas.

> Você pode conferir em **Table Editor** no menu lateral esquerdo que as 6 tabelas apareceram lá.

---

## Passo 3: Pegar as chaves de acesso (URL e `service_role`)

1. No menu lateral esquerdo do Supabase, clique em **Project Settings** (ícone de engrenagem lá embaixo).
2. Clique na aba **API**.
3. Você vai precisar de **apenas dois valores**:
   - **Project URL**: algo parecido com `https://abcdefghijklmno.supabase.co`
   - **Project API keys → `service_role` (secret)**: clique em **Reveal** para mostrar a chave secreta.

> ⚠️ **MUITO IMPORTANTE (SEGURANÇA):**
> - **NUNCA** compartilhe a chave `service_role` com ninguém e **NUNCA** coloque ela no GitHub.
> - **NUNCA** renomeie as variáveis colocando `NEXT_PUBLIC_` na frente. Se fizer isso, o Next.js envia a chave para o navegador do usuário.

---

## Passo 4: Configurar o arquivo `.env.local` (ou Docker)

### Opção A — Rodando localmente com Node.js
1. Na raiz do projeto (`Krono/`), crie um arquivo chamado `.env.local` (você pode copiar o `.env.example`).
2. Coloque dentro dele:

```env
NEXTAUTH_SECRET=coloque_aqui_um_texto_aleatorio_bem_grande_e_secreto
NEXTAUTH_URL=http://localhost:3000

SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_que_voce_copiou_no_passo_3
```

> Dica: para gerar um `NEXTAUTH_SECRET` forte no Linux, rode no terminal: `openssl rand -hex 32`

### Opção B — Rodando com Docker / Docker Compose
No seu `docker-compose.yml` (ou passando um `env_file: .env`), adicione as mesmas variáveis em `environment:`:

```yaml
    environment:
      - NEXTAUTH_SECRET=coloque_aqui_um_texto_aleatorio_bem_grande_e_secreto
      - NEXTAUTH_URL=http://localhost:3000
      - SUPABASE_URL=https://SEU-PROJETO.supabase.co
      - SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_aqui
```

---

## Passo 5: Instalar dependências e iniciar o sistema

### Rodando local (Node.js 20+)
```bash
npm install
npm run dev
```
Acesse `http://localhost:3000`, crie sua conta na tela de registro e faça login.

### Rodando com Docker
```bash
docker compose build
docker compose up -d
```

---

## Passo 5.1: Acessando o Painel Administrativo

O Krono conta com um painel administrativo isolado em **`/admin/login`** (separado das contas de estudantes):
- **Admins padrão iniciais**: `byfred` e `gustavo` (senha inicial: `senha123`).
- Novos estudantes que se cadastrarem em `/register` ficam com status **Pendente** até serem aprovados por um administrador em `/admin`.
- **Importante**: Após o primeiro acesso em produção, altere as senhas padrão na aba **Admins** ou via banco de dados.

---

## Passo 6: Backup e Restauração de Emergência (`.json`)

Mesmo usando o Supabase, o Krono mantém a página **Backup e Restauração** (`/backup`) 100% funcional para que você tenha controle total dos seus dados:

- **Exportar Backup Completo**: gera um arquivo `.json` contendo **100% dos seus dados** no banco (todos os planos, editais verticalizados, matérias, pesos, sessões de estudo, revisões, simulados, ciclos de estudo e metas).
- **Restaurar a partir de Arquivo**: se o servidor/VPS cair ou você quiser migrar para um novo banco Supabase do zero, basta subir uma nova instância do Krono, criar/logar na sua conta, ir em **Backup e Restauração** e enviar o `.json`. O sistema limpa os dados atuais daquela conta e grava tudo automaticamente nas tabelas do novo Supabase.
