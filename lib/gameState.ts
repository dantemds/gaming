// In-memory game state (em produção, use Redis ou banco de dados)
interface Player {
  id: string;
  name: string;
  health: number;
  lastSeen: number;
  color: string;
  combo: number; // Contador de ataques consecutivos bem-sucedidos
}

interface Match {
  id: string;
  player1: Player;
  player2: Player;
  currentTurn: number; // 1 ou 2
  turnStartTime: number;
  turnDuration: number; // 10 segundos em ms
  lastAction?: {
    player: number;
    action: string;
    damage?: number;
    timestamp: number;
  };
  winner?: number;
  createdAt: number;
}

class GameState {
  private waitingPlayers: Map<string, { name: string; color: string; timestamp: number }> = new Map();
  private matches: Map<string, Match> = new Map();
  private playerToMatch: Map<string, string> = new Map();

  // Limpar jogadores inativos (mais de 60 segundos sem atividade)
  private cleanupInactivePlayers() {
    const now = Date.now();
    const waitingTimeout = 120000; // 2 minutos para fila de espera
    const matchTimeout = 60000; // 1 minuto para matches ativos

    // Limpar fila de espera
    for (const [playerId, data] of this.waitingPlayers.entries()) {
      if (now - data.timestamp > waitingTimeout) {
        this.waitingPlayers.delete(playerId);
      }
    }

    // Limpar matches inativos - apenas se AMBOS jogadores estiverem inativos
    for (const [matchId, match] of this.matches.entries()) {
      const p1Inactive = now - match.player1.lastSeen > matchTimeout;
      const p2Inactive = now - match.player2.lastSeen > matchTimeout;
      
      // Só remove se AMBOS estiverem inativos OU se o match for muito antigo (5 minutos)
      const matchTooOld = now - match.createdAt > 300000; // 5 minutos
      
      if ((p1Inactive && p2Inactive) || matchTooOld) {
        this.playerToMatch.delete(match.player1.id);
        this.playerToMatch.delete(match.player2.id);
        this.matches.delete(matchId);
      }
    }
  }

  joinQueue(playerId: string, playerName: string, playerColor: string = '#FF6347'): { status: 'waiting' | 'matched'; matchId?: string; playerNumber?: number; opponent?: string; opponentColor?: string } {
    this.cleanupInactivePlayers();

    console.log(`[GameState] Player ${playerName} (${playerId}) joining queue`);

    // Verificar se já está em uma partida
    const existingMatchId = this.playerToMatch.get(playerId);
    if (existingMatchId) {
      const match = this.matches.get(existingMatchId);
      if (match) {
        const playerNumber = match.player1.id === playerId ? 1 : 2;
        const opponent = playerNumber === 1 ? match.player2.name : match.player1.name;
        console.log(`[GameState] Player already in match ${existingMatchId}`);
        return { status: 'matched', matchId: existingMatchId, playerNumber, opponent };
      } else {
        // Match não existe mais, limpar referência
        this.playerToMatch.delete(playerId);
      }
    }

    // Procurar oponente na fila
    for (const [waitingId, waitingData] of this.waitingPlayers.entries()) {
      if (waitingId !== playerId) {
        // Criar match
        const matchId = `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Sortear quem começa (1 ou 2)
        const firstPlayer = Math.random() < 0.5 ? 1 : 2;
        const now = Date.now();
        
        const match: Match = {
          id: matchId,
          player1: { id: waitingId, name: waitingData.name, health: 100, lastSeen: now, color: waitingData.color, combo: 0 },
          player2: { id: playerId, name: playerName, health: 100, lastSeen: now, color: playerColor, combo: 0 },
          currentTurn: firstPlayer,
          turnStartTime: now,
          turnDuration: 10000, // 10 segundos
          createdAt: now
        };

        this.matches.set(matchId, match);
        this.playerToMatch.set(waitingId, matchId);
        this.playerToMatch.set(playerId, matchId);
        this.waitingPlayers.delete(waitingId);

        console.log(`[GameState] Match created: ${matchId} - ${waitingData.name} vs ${playerName} - Player ${firstPlayer} starts`);
        return { status: 'matched', matchId, playerNumber: 2, opponent: waitingData.name, opponentColor: waitingData.color };
      }
    }

    // Adicionar à fila (atualizar timestamp se já estiver na fila)
    this.waitingPlayers.set(playerId, { name: playerName, color: playerColor, timestamp: Date.now() });
    console.log(`[GameState] Player added to queue. Queue size: ${this.waitingPlayers.size}`);
    return { status: 'waiting' };
  }

  getMatchState(matchId: string, playerId: string): Match | null {
    this.cleanupInactivePlayers();
    
    const match = this.matches.get(matchId);
    if (!match) return null;

    const now = Date.now();

    // Atualizar lastSeen
    if (match.player1.id === playerId) {
      match.player1.lastSeen = now;
    } else if (match.player2.id === playerId) {
      match.player2.lastSeen = now;
    }

    // Verificar se o turno expirou (10 segundos)
    const turnElapsed = now - match.turnStartTime;
    if (turnElapsed >= match.turnDuration && !match.winner) {
      // Turno expirou, passar para o próximo jogador
      match.currentTurn = match.currentTurn === 1 ? 2 : 1;
      match.turnStartTime = now;
      match.lastAction = {
        player: match.currentTurn === 1 ? 2 : 1,
        action: 'timeout',
        timestamp: now
      };
      console.log(`[GameState] Turn timeout in match ${matchId}. Now it's player ${match.currentTurn}'s turn`);
    }

    return match;
  }

  performAction(matchId: string, playerId: string, action: 'attack' | 'defend' | 'special'): Match | null {
    const match = this.matches.get(matchId);
    if (!match) return null;

    const isPlayer1 = match.player1.id === playerId;
    const playerNumber = isPlayer1 ? 1 : 2;
    const attacker = isPlayer1 ? match.player1 : match.player2;
    const defender = isPlayer1 ? match.player2 : match.player1;

    const now = Date.now();
    attacker.lastSeen = now;

    // Verificar se é o turno deste jogador
    if (match.currentTurn !== playerNumber) {
      console.log(`[GameState] Player ${playerNumber} tried to act but it's player ${match.currentTurn}'s turn`);
      return match; // Retorna sem fazer nada
    }

    if (action === 'attack') {
      const damage = Math.floor(Math.random() * 15) + 5; // 5-20 damage
      defender.health = Math.max(0, defender.health - damage);

      // Incrementar combo do atacante
      attacker.combo++;
      // Resetar combo do defensor
      defender.combo = 0;

      match.lastAction = {
        player: playerNumber,
        action: 'attack',
        damage,
        timestamp: now
      };

      console.log(`[GameState] Player ${playerNumber} attacked for ${damage} damage. Combo: ${attacker.combo}`);

      // Verificar vitória
      if (defender.health <= 0) {
        match.winner = playerNumber;
        console.log(`[GameState] Player ${playerNumber} wins!`);
      }
    } else if (action === 'special') {
      // Ataque especial: requer 3 combos e causa 30-45 de dano
      if (attacker.combo < 3) {
        console.log(`[GameState] Player ${playerNumber} tried special but only has ${attacker.combo} combo`);
        return match; // Não faz nada se não tiver combo suficiente
      }

      const damage = Math.floor(Math.random() * 16) + 30; // 30-45 damage
      defender.health = Math.max(0, defender.health - damage);

      // Resetar combo após usar especial
      attacker.combo = 0;
      defender.combo = 0;

      match.lastAction = {
        player: playerNumber,
        action: 'special',
        damage,
        timestamp: now
      };

      console.log(`[GameState] Player ${playerNumber} used SPECIAL ATTACK for ${damage} damage!`);

      // Verificar vitória
      if (defender.health <= 0) {
        match.winner = playerNumber;
        console.log(`[GameState] Player ${playerNumber} wins!`);
      }
    } else if (action === 'defend') {
      // Defender não reseta combo
      match.lastAction = {
        player: playerNumber,
        action: 'defend',
        timestamp: now
      };
      console.log(`[GameState] Player ${playerNumber} defended`);
    }

    // Trocar turno após ação (se o jogo não acabou)
    if (!match.winner) {
      match.currentTurn = match.currentTurn === 1 ? 2 : 1;
      match.turnStartTime = now;
      console.log(`[GameState] Turn changed to player ${match.currentTurn}`);
    }

    return match;
  }

  leaveMatch(playerId: string): void {
    const matchId = this.playerToMatch.get(playerId);
    if (matchId) {
      const match = this.matches.get(matchId);
      if (match) {
        // Definir o outro jogador como vencedor
        if (match.player1.id === playerId) {
          match.winner = 2;
        } else {
          match.winner = 1;
        }
      }
      this.playerToMatch.delete(playerId);
    }
    this.waitingPlayers.delete(playerId);
  }
}

// Singleton instance
export const gameState = new GameState();
