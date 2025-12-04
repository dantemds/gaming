# 🎮 Jogo de Luta Online

Um jogo de luta multiplayer em tempo real desenvolvido com Next.js, Socket.IO e CSS puro.

## 🚀 Características

- **Matchmaking Automático**: Sistema de fila que conecta dois jogadores automaticamente
- **Combate em Tempo Real**: Ações sincronizadas via WebSocket
- **Animações CSS**: Bonecos animados com ataques e defesas
- **Barras de Vida**: Sistema de HP visual para cada jogador
- **Responsivo**: Funciona em desktop e mobile

## 🛠️ Tecnologias

- **Next.js 14**: Framework React para SSR e API routes
- **Socket.IO**: Comunicação em tempo real entre jogadores
- **TypeScript**: Tipagem estática
- **CSS Modules**: Estilos isolados e animações

## 📦 Instalação

1. Clone o repositório
2. Instale as dependências:

```bash
npm install
```

## 🎯 Como Jogar

1. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

2. Abra o navegador em `http://localhost:3000`
3. Digite seu nome e entre na fila
4. Aguarde outro jogador se conectar
5. Use os botões para atacar ou defender
6. Vença reduzindo a vida do oponente a zero!

## 🎮 Controles

- **👊 Atacar**: Causa 5-20 de dano no oponente
- **🛡️ Defender**: Prepara defesa (mecânica visual)

## 🚀 Deploy na Vercel

Este projeto está pronto para deploy na Vercel:

1. Faça push do código para o GitHub
2. Conecte o repositório na Vercel
3. A Vercel detectará automaticamente o Next.js
4. Deploy será feito automaticamente

**Nota**: Para funcionalidade completa com WebSocket na Vercel, considere usar Vercel Serverless Functions ou um serviço externo de WebSocket como Pusher ou Ably.

## 📁 Estrutura do Projeto

```
├── pages/
│   ├── _app.tsx          # App wrapper
│   ├── _document.tsx     # Document customizado
│   ├── index.tsx         # Página principal do jogo
│   └── api/
│       └── socket.ts     # API route para Socket.IO
├── styles/
│   ├── globals.css       # Estilos globais
│   └── Game.module.css   # Estilos do jogo
├── server.js             # Servidor customizado com Socket.IO
└── package.json
```

## 🎨 Mecânicas do Jogo

1. **Entrada**: Jogador digita nome e entra na fila
2. **Matchmaking**: Sistema conecta 2 jogadores automaticamente
3. **Combate**: Jogadores alternam ataques e defesas
4. **Vitória**: Primeiro a reduzir HP do oponente a 0 vence
5. **Reconexão**: Possibilidade de jogar novamente

## 🔧 Desenvolvimento

O jogo usa um servidor Node.js customizado que integra Next.js com Socket.IO para comunicação em tempo real. Cada partida é gerenciada no servidor, garantindo sincronização entre os jogadores.

## 📝 Licença

MIT

---

Desenvolvido com ❤️ usando Next.js e Socket.IO
