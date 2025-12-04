// In-memory game state (em produção, use Redis ou banco de dados)
interface Player {
  id: string;
  name: string;
  health: number;
  lastSeen: number;
}

interface Match {
  id: string;
  player1: Player;
  player2: Player;
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
  private waitingPlayers: Map<string, { name: string; timestamp: number }> = new Map();
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

  joinQueue(playerId: string, playerName: string): { status: 'waiting' | 'matched'; matchId?: string; playerNumber?: number; opponent?: string } {
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
        const match: Match = {
          id: matchId,
          player1: { id: waitingId, name: waitingData.name, health: 100, lastSeen: Date.now() },
          player2: { id: playerId, name: playerName, health: 100, lastSeen: Date.now() },
          createdAt: Date.now()
        };

        this.matches.set(matchId, match);
        this.playerToMatch.set(waitingId, matchId);
        this.playerToMatch.set(playerId, matchId);
        this.waitingPlayers.delete(waitingId);

        console.log(`[GameState] Match created: ${matchId} - ${waitingData.name} vs ${playerName}`);
        return { status: 'matched', matchId, playerNumber: 2, opponent: waitingData.name };
      }
    }

    // Adicionar à fila (atualizar timestamp se já estiver na fila)
    this.waitingPlayers.set(playerId, { name: playerName, timestamp: Date.now() });
    console.log(`[GameState] Player added to queue. Queue size: ${this.waitingPlayers.size}`);
    return { status: 'waiting' };
  }

  getMatchState(matchId: string, playerId: string): Match | null {
    this.cleanupInactivePlayers();
    
    const match = this.matches.get(matchId);
    if (!match) return null;

    // Atualizar lastSeen
    if (match.player1.id === playerId) {
      match.player1.lastSeen = Date.now();
    } else if (match.player2.id === playerId) {
      match.player2.lastSeen = Date.now();
    }

    return match;
  }

  performAction(matchId: string, playerId: string, action: 'attack' | 'defend'): Match | null {
    const match = this.matches.get(matchId);
    if (!match) return null;

    const isPlayer1 = match.player1.id === playerId;
    const attacker = isPlayer1 ? match.player1 : match.player2;
    const defender = isPlayer1 ? match.player2 : match.player1;

    attacker.lastSeen = Date.now();

    if (action === 'attack') {
      const damage = Math.floor(Math.random() * 15) + 5; // 5-20 damage
      defender.health = Math.max(0, defender.health - damage);

      match.lastAction = {
        player: isPlayer1 ? 1 : 2,
        action: 'attack',
        damage,
        timestamp: Date.now()
      };

      // Verificar vitória
      if (defender.health <= 0) {
        match.winner = isPlayer1 ? 1 : 2;
      }
    } else if (action === 'defend') {
      match.lastAction = {
        player: isPlayer1 ? 1 : 2,
        action: 'defend',
        timestamp: Date.now()
      };
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
