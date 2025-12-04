const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Game state
const waitingPlayers = [];
const activeMatches = new Map();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('join-queue', (playerName) => {
      console.log(`${playerName} joined queue`);
      
      // Check if there's a waiting player
      if (waitingPlayers.length > 0) {
        const opponent = waitingPlayers.shift();
        
        // Create match
        const matchId = `match-${Date.now()}`;
        const match = {
          id: matchId,
          player1: { id: opponent.id, name: opponent.name, health: 100 },
          player2: { id: socket.id, name: playerName, health: 100 }
        };
        
        activeMatches.set(matchId, match);
        
        // Join both players to match room
        socket.join(matchId);
        opponent.socket.join(matchId);
        
        // Notify both players
        opponent.socket.emit('match-found', {
          matchId,
          playerNumber: 1,
          opponent: { name: playerName },
          you: { name: opponent.name }
        });
        
        socket.emit('match-found', {
          matchId,
          playerNumber: 2,
          opponent: { name: opponent.name },
          you: { name: playerName }
        });
        
        console.log(`Match created: ${matchId}`);
      } else {
        // Add to waiting queue
        waitingPlayers.push({ id: socket.id, name: playerName, socket });
        socket.emit('waiting');
      }
    });

    socket.on('player-action', ({ matchId, action }) => {
      const match = activeMatches.get(matchId);
      if (!match) return;

      const isPlayer1 = socket.id === match.player1.id;
      const attacker = isPlayer1 ? match.player1 : match.player2;
      const defender = isPlayer1 ? match.player2 : match.player1;

      if (action === 'attack') {
        const damage = Math.floor(Math.random() * 15) + 5; // 5-20 damage
        defender.health = Math.max(0, defender.health - damage);
        
        io.to(matchId).emit('game-update', {
          player1Health: match.player1.health,
          player2Health: match.player2.health,
          lastAction: {
            player: isPlayer1 ? 1 : 2,
            action: 'attack',
            damage
          }
        });

        // Check for winner
        if (defender.health <= 0) {
          io.to(matchId).emit('game-over', {
            winner: isPlayer1 ? 1 : 2,
            winnerName: attacker.name
          });
          activeMatches.delete(matchId);
        }
      } else if (action === 'defend') {
        io.to(matchId).emit('game-update', {
          player1Health: match.player1.health,
          player2Health: match.player2.health,
          lastAction: {
            player: isPlayer1 ? 1 : 2,
            action: 'defend'
          }
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      
      // Remove from waiting queue
      const waitingIndex = waitingPlayers.findIndex(p => p.id === socket.id);
      if (waitingIndex !== -1) {
        waitingPlayers.splice(waitingIndex, 1);
      }
      
      // Handle active matches
      for (const [matchId, match] of activeMatches.entries()) {
        if (match.player1.id === socket.id || match.player2.id === socket.id) {
          const winnerId = match.player1.id === socket.id ? match.player2.id : match.player1.id;
          io.to(winnerId).emit('opponent-disconnected');
          activeMatches.delete(matchId);
        }
      }
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
