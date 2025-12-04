import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import styles from '@/styles/Game.module.css'

let socket: Socket;

export default function Home() {
  const [gameState, setGameState] = useState<'login' | 'waiting' | 'playing' | 'gameover'>('login')
  const [playerName, setPlayerName] = useState('')
  const [matchData, setMatchData] = useState<any>(null)
  const [player1Health, setPlayer1Health] = useState(100)
  const [player2Health, setPlayer2Health] = useState(100)
  const [lastAction, setLastAction] = useState<any>(null)
  const [winner, setWinner] = useState<string>('')
  const [canAttack, setCanAttack] = useState(true)

  useEffect(() => {
    socketInitializer()

    return () => {
      if (socket) socket.disconnect()
    }
  }, [])

  const socketInitializer = async () => {
    await fetch('/api/socket')
    socket = io()

    socket.on('waiting', () => {
      setGameState('waiting')
    })

    socket.on('match-found', (data) => {
      setMatchData(data)
      setPlayer1Health(100)
      setPlayer2Health(100)
      setGameState('playing')
    })

    socket.on('game-update', (data) => {
      setPlayer1Health(data.player1Health)
      setPlayer2Health(data.player2Health)
      setLastAction(data.lastAction)
      
      setTimeout(() => setLastAction(null), 1000)
    })

    socket.on('game-over', (data) => {
      setWinner(data.winnerName)
      setGameState('gameover')
    })

    socket.on('opponent-disconnected', () => {
      alert('Oponente desconectou!')
      window.location.reload()
    })
  }

  const handleJoinQueue = (e: React.FormEvent) => {
    e.preventDefault()
    if (playerName.trim()) {
      socket.emit('join-queue', playerName)
    }
  }

  const handleAction = (action: 'attack' | 'defend') => {
    if (!canAttack && action === 'attack') return
    
    socket.emit('player-action', {
      matchId: matchData.matchId,
      action
    })

    if (action === 'attack') {
      setCanAttack(false)
      setTimeout(() => setCanAttack(true), 1000)
    }
  }

  const handlePlayAgain = () => {
    window.location.reload()
  }

  return (
    <div className={styles.container}>
      {gameState === 'login' && (
        <div className={styles.loginScreen}>
          <h1 className={styles.title}>⚔️ Jogo de Luta Online ⚔️</h1>
          <form onSubmit={handleJoinQueue} className={styles.loginForm}>
            <input
              type="text"
              placeholder="Digite seu nome"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className={styles.input}
              maxLength={20}
              required
            />
            <button type="submit" className={styles.button}>
              Entrar na Fila
            </button>
          </form>
        </div>
      )}

      {gameState === 'waiting' && (
        <div className={styles.waitingScreen}>
          <h1 className={styles.title}>Procurando oponente...</h1>
          <div className={styles.loader}></div>
          <p className={styles.waitingText}>Aguarde enquanto procuramos um adversário para você!</p>
        </div>
      )}

      {gameState === 'playing' && matchData && (
        <div className={styles.gameScreen}>
          <div className={styles.gameHeader}>
            <div className={styles.playerInfo}>
              <h2>{matchData.playerNumber === 1 ? matchData.you.name : matchData.opponent.name}</h2>
              <div className={styles.healthBarContainer}>
                <div 
                  className={`${styles.healthBar} ${styles.player1Health}`}
                  style={{ width: `${player1Health}%` }}
                ></div>
              </div>
              <span className={styles.healthText}>{player1Health} HP</span>
            </div>

            <div className={styles.vs}>VS</div>

            <div className={styles.playerInfo}>
              <h2>{matchData.playerNumber === 2 ? matchData.you.name : matchData.opponent.name}</h2>
              <div className={styles.healthBarContainer}>
                <div 
                  className={`${styles.healthBar} ${styles.player2Health}`}
                  style={{ width: `${player2Health}%` }}
                ></div>
              </div>
              <span className={styles.healthText}>{player2Health} HP</span>
            </div>
          </div>

          <div className={styles.arena}>
            <div className={`${styles.fighter} ${styles.fighter1} ${
              lastAction?.player === 1 && lastAction?.action === 'attack' ? styles.attacking : ''
            } ${
              lastAction?.player === 2 && lastAction?.action === 'attack' ? styles.hurt : ''
            }`}>
              <div className={styles.head}></div>
              <div className={styles.body}></div>
              <div className={styles.armLeft}></div>
              <div className={styles.armRight}></div>
              <div className={styles.legLeft}></div>
              <div className={styles.legRight}></div>
            </div>

            <div className={`${styles.fighter} ${styles.fighter2} ${
              lastAction?.player === 2 && lastAction?.action === 'attack' ? styles.attacking : ''
            } ${
              lastAction?.player === 1 && lastAction?.action === 'attack' ? styles.hurt : ''
            }`}>
              <div className={styles.head}></div>
              <div className={styles.body}></div>
              <div className={styles.armLeft}></div>
              <div className={styles.armRight}></div>
              <div className={styles.legLeft}></div>
              <div className={styles.legRight}></div>
            </div>

            {lastAction && (
              <div className={styles.actionFeedback}>
                {lastAction.action === 'attack' && `💥 ${lastAction.damage} de dano!`}
                {lastAction.action === 'defend' && '🛡️ Defendendo!'}
              </div>
            )}
          </div>

          <div className={styles.controls}>
            <button 
              onClick={() => handleAction('attack')}
              className={`${styles.actionButton} ${styles.attackButton}`}
              disabled={!canAttack}
            >
              👊 Atacar
            </button>
            <button 
              onClick={() => handleAction('defend')}
              className={`${styles.actionButton} ${styles.defendButton}`}
            >
              🛡️ Defender
            </button>
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className={styles.gameoverScreen}>
          <h1 className={styles.title}>
            {winner === playerName ? '🎉 Você Venceu! 🎉' : '💀 Você Perdeu! 💀'}
          </h1>
          <p className={styles.winnerText}>
            {winner === playerName ? 'Parabéns pela vitória!' : `${winner} venceu a luta!`}
          </p>
          <button onClick={handlePlayAgain} className={styles.button}>
            Jogar Novamente
          </button>
        </div>
      )}
    </div>
  )
}
