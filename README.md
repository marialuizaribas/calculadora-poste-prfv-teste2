# Postes PRFV — Calculadora Estrutural

Software web para dimensionamento estrutural de postes de Plástico Reforçado com Fibra de Vidro (PRFV), baseado no memorial de cálculo UTE.

---

## Como publicar no Vercel (passo a passo)

### Passo 1 — Criar conta no GitHub
1. Acesse https://github.com
2. Clique em "Sign up" e crie uma conta gratuita

### Passo 2 — Criar um repositório
1. Após fazer login no GitHub, clique no "+" no canto superior direito
2. Clique em "New repository"
3. Nome sugerido: `calculadora-poste-prfv`
4. Deixe como "Public"
5. Clique em "Create repository"

### Passo 3 — Enviar os arquivos para o GitHub
Na página do repositório criado, clique em "uploading an existing file" e envie os 4 arquivos:
- `index.html`
- `style.css`
- `calculo.js`
- `app.js`

Clique em "Commit changes" para salvar.

### Passo 4 — Criar conta no Vercel
1. Acesse https://vercel.com
2. Clique em "Sign Up" → escolha "Continue with GitHub"
3. Autorize o Vercel a acessar sua conta do GitHub

### Passo 5 — Publicar o projeto
1. No Vercel, clique em "Add New Project"
2. Selecione o repositório `calculadora-poste-prfv`
3. Clique em "Deploy"
4. Em 30 segundos, seu site estará no ar em um endereço como:
   `calculadora-poste-prfv.vercel.app`

### Passo 6 — Atualizar o software
Sempre que eu gerar código novo aqui no Claude:
1. Substitua o arquivo no GitHub (clique no arquivo → ícone de lápis → cole o novo código → "Commit changes")
2. O Vercel atualiza automaticamente em segundos

---

## Testar localmente (sem internet)

Você pode abrir o arquivo `index.html` diretamente no navegador
(Chrome, Firefox ou Edge) clicando duas vezes nele.

**Atenção:** os gráficos precisam de internet para carregar a biblioteca Chart.js.
Para testar offline, a estrutura e os cálculos funcionam, mas os gráficos não aparecerão.

---

## Credenciais de acesso (demonstração)

| E-mail           | Senha  | Perfil        |
|------------------|--------|---------------|
| demo@prfv.com    | 123456 | Usuário Demo  |
| admin@prfv.com   | admin  | Administrador |

> **Nota:** O login atual é simulado. Para login real com banco de dados,
> será necessário conectar ao Supabase (próxima etapa do desenvolvimento).

---

## Estrutura dos arquivos

```
poste-prfv/
├── index.html   → Estrutura da página (HTML puro, sem frameworks)
├── style.css    → Toda a aparência visual
├── calculo.js   → Motor de cálculo (equações do memorial)
└── app.js       → Interface, gráficos, PDF e login
```

### O que cada arquivo faz

**index.html**
Define a estrutura visual: tela de login, formulário de entradas e área de resultados.
Você não precisará editar este arquivo frequentemente.

**style.css**
Controla cores, fontes, tamanhos e layout.
Edite aqui se quiser mudar a aparência (cores da empresa, por exemplo).

**calculo.js**
Contém APENAS matemática. Implementa as equações 1 a 64 do memorial de cálculo.
Não tem nada relacionado à tela — só cálculos.

**app.js**
Liga tudo: lê os campos do formulário, chama o calculo.js, e mostra os resultados
(gráficos, tabelas, PDF).

---

## Próximas etapas planejadas

- [ ] Login real com Supabase (banco de dados online)
- [ ] Salvar histórico de cálculos por usuário
- [ ] Comparar diferentes modelos de postes
- [ ] Exportar relatório PDF completo com gráficos
- [ ] Validação automática conforme norma UTE

---

## Referências do cálculo

- BARBERO, E.J. — Introduction to Composite Materials Design
- BEER & JOHNSTON — Resistência dos Materiais
- BRAZIER, L.G. — On the flexure of thin-walled tubes
- MARINUCCI, G. — Materiais Compósitos Poliméricos
