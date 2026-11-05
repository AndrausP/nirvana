# Nirvana Desk

App desktop (Electron) para acompanhar o comportamento dos agentes do Claude Code / Nirvana,
no estilo de um chat. Somente leitura: nada é escrito em `~/.claude`.

- **Agentes**: cada `~/.claude/agents/*.md` vira um contato; a conversa mostra o briefing do broker,
  as respostas do agente e as ferramentas usadas.
- **Cadeia**: todas as execuções de uma sessão em ordem, como um grupo.
- **Memória**: lê `~/.claude/agents-memory/*.md`.
- Atualiza sozinho a cada 4 s.

```
npm install
npm start
```

## Atalhos e convenções

`Ctrl+K` paleta de comandos · `Ctrl+1…7` Broker/Agentes/Cadeia/Organograma/Memória/Memória geral/Projetos · `Ctrl+,` Configurações ·
`↑ ↓` navega a lista · `/` busca na lista · `Ctrl+F` busca na conversa · `Home`/`End` início/fim ·
`Ctrl+Shift+E` exporta Markdown · `Ctrl+E` edita · `Ctrl+S` salva · `F5` atualiza · `?` mostra todos.
Também: copiar mensagem (passe o mouse), "Ir para o fim", bolinha de novidade por agente, notificação quando um
agente começa a trabalhar (com a janela sem foco), janela única, posição/tamanho e última tela lembrados.

## Testes

```
node test/scan.test.js          # leitura/gravação de agentes e memória (HOME temporário)
npm run test:e2e                # app real em Electron oculto, com pasta de fixture (não toca ~/.claude)
```

## Broker e Organograma

- **Broker** (`Ctrl+1`): a conversa principal (você ↔ broker), ao vivo, lida dos transcripts. Agentes aparecem só como cartões de chamada (com o tamanho do briefing); clicar abre o chat daquele agente. Cada agente só tem chat se o broker o chamou e só vê o briefing + a própria memória, nunca esta conversa (por isso o custo de tokens não cresce).
- **Organograma** (`Ctrl+4`): hierarquia da cadeia; ao redor de cada agente, neurônios = itens da memória dele + briefings recebidos; nuvem inferior = memória compartilhada (docs/knowledge, memória do Claude, CLAUDE.md). Arraste, zoom com scroll, clique para ler.

## Falar pelo app (Claude Code de verdade)

No **Broker**, o compositor conversa com o Claude Code instalado (`claude -p`, stream-json): mesmos comandos `/`, skills, hooks, plugins, ferramentas e memória, com resposta em streaming, pedidos de permissão (Permitir / Permitir nesta sessão / Negar), `Esc` para parar, troca de modelo e de modo de permissão. Conversas existentes são retomadas (`--resume`); "Nova conversa" começa uma na pasta escolhida.

## Projetos

A aba **Projetos** (`Ctrl+7`) registra pastas. Com um projeto ativo, Broker, Agentes, Cadeia, Organograma e Memória mostram só o que pertence àquela pasta, e novas conversas nascem nela: contexto separado entre projetos.

## Instalador (Windows)

```
npm install
npm run dist     # gera dist/Nirvana-Desk-Setup-<versão>.exe (NSIS, instala por usuário, sem admin)
```

O instalador **não é assinado** (sem certificado de code signing); o Windows SmartScreen pode avisar na primeira execução. A chave de licença do Windows não serve para assinar código: isso exige um certificado próprio.
