import { useState, useEffect, useRef } from 'react'
import styles from '@/styles/Game.module.css'

export default function Home() {
  const [gameState, setGameState] = useState<'login' | 'waiting' | 'playing' | 'gameover'>('login')
  const [playerName, setPlayerName] = useState('')
  const [playerId] = useState(() => `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const [matchData, setMatchData] = useState<any>(null)
  const [player1Health, setPlayer1Health] = useState(100)
  const [player2Health, setPlayer2Health] = useState(100)
  const [lastAction, setLastAction] = useState<any>(null)
  const [winner, setWinner] = useState<string>('')
  const [canAttack, setCanAttack] = useState(true)
  const pollingInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current)
      }
    }
  }, [])

  const startPolling = (matchId: string) => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current)
    }

    let consecutiveErrors = 0
    const maxConsecutiveErrors = 10 // Permitir 10 erros consecutivos (5 segundos)

    pollingInterval.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/match/${matchId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId })
        })

        if (response.ok) {
          consecutiveErrors = 0 // Reset contador de erros
          const match = await response.json()
          
          setPlayer1Health(match.player1.health)
          setPlayer2Health(match.player2.health)

          if (match.lastAction && match.lastAction.timestamp) {
            const actionAge = Date.now() - match.lastAction.timestamp
            if (actionAge < 2000) { // Mostrar ação se foi nos últimos 2 segundos
              setLastAction(match.lastAction)
              setTimeout(() => setLastAction(null), 1000)
            }
          }

          if (match.winner) {
            const winnerName = match.winner === matchData.playerNumber ? playerName : matchData.opponent
            setWinner(winnerName)
            setGameState('gameover')
            if (pollingInterval.current) {
              clearInterval(pollingInterval.current)
            }
          }
        } else {
          consecutiveErrors++
          console.warn(`Erro no polling (${consecutiveErrors}/${maxConsecutiveErrors})`)
          
          // Só mostra erro após muitas tentativas falhas
          if (consecutiveErrors >= maxConsecutiveErrors) {
            if (pollingInterval.current) {
              clearInterval(pollingInterval.current)
            }
            alert('Partida encerrada ou expirada!')
            window.location.reload()
          }
        }
      } catch (error) {
        consecutiveErrors++
        console.error(`Erro no polling (${consecutiveErrors}/${maxConsecutiveErrors}):`, error)
        
        // Só mostra erro após muitas tentativas falhas
        if (consecutiveErrors >= maxConsecutiveErrors) {
          if (pollingInterval.current) {
            clearInterval(pollingInterval.current)
          }
          alert('Erro de conexão. Recarregando...')
          window.location.reload()
        }
      }
    }, 500) // Poll a cada 500ms
  }

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playerName.trim()) return

    setGameState('waiting')

    // Tentar entrar na fila
    const checkQueue = async () => {
      try {
        const response = await fetch('/api/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, playerName })
        })

        const result = await response.json()

        if (result.status === 'matched') {
          setMatchData({
            matchId: result.matchId,
            playerNumber: result.playerNumber,
            opponent: result.opponent,
            you: { name: playerName }
          })
          setPlayer1Health(100)
          setPlayer2Health(100)
          setGameState('playing')
          startPolling(result.matchId)
        } else {
          // Continuar verificando
          setTimeout(checkQueue, 1000)
        }
      } catch (error) {
        console.error('Erro ao entrar na fila:', error)
        setTimeout(checkQueue, 1000)
      }
    }

    checkQueue()
  }

  const handleAction = async (action: 'attack' | 'defend') => {
    if (!canAttack && action === 'attack') return
    
    try {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: matchData.matchId,
          playerId,
          action
        })
      })

      if (response.ok) {
        const match = await response.json()
        setPlayer1Health(match.player1.health)
        setPlayer2Health(match.player2.health)
        
        if (match.lastAction) {
          setLastAction(match.lastAction)
          setTimeout(() => setLastAction(null), 1000)
        }

        if (match.winner) {
          const winnerName = match.winner === matchData.playerNumber ? playerName : matchData.opponent
          setWinner(winnerName)
          setGameState('gameover')
          if (pollingInterval.current) {
            clearInterval(pollingInterval.current)
          }
        }
      }
    } catch (error) {
      console.error('Erro ao executar ação:', error)
    }

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
