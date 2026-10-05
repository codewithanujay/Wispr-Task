import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const PLAYER_WIDTH = 42
const PLAYER_HEIGHT = 50
const STARTING_LIVES = 3
const HIGH_SCORE_KEY = 'neon-dodge-high-score'

function readHighScore() {
  try {
    return Number(window.localStorage.getItem(HIGH_SCORE_KEY)) || 0
  } catch (error) {
    console.error('Unable to read the Neon Dodge high score.', error)
    return 0
  }
}

function App() {
  const arenaRef = useRef(null)
  const heldKeys = useRef(new Set())
  const gameRef = useRef({
    playerX: 0,
    obstacles: [],
    nextObstacleId: 0,
    elapsed: 0,
    spawnElapsed: 0,
    collisionCooldown: 0,
    lastTime: 0,
    lives: STARTING_LIVES,
  })
  const [status, setStatus] = useState('ready')
  const [playerX, setPlayerX] = useState(0)
  const [obstacles, setObstacles] = useState([])
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(STARTING_LIVES)
  const [highScore, setHighScore] = useState(readHighScore)
  const [isNewRecord, setIsNewRecord] = useState(false)

  const startGame = useCallback(() => {
    const arenaWidth = arenaRef.current?.clientWidth ?? 0
    const startX = Math.max(0, (arenaWidth - PLAYER_WIDTH) / 2)

    gameRef.current = {
      playerX: startX,
      obstacles: [],
      nextObstacleId: 0,
      elapsed: 0,
      spawnElapsed: 0,
      collisionCooldown: 0,
      lastTime: 0,
      lives: STARTING_LIVES,
    }
    setPlayerX(startX)
    setObstacles([])
    setScore(0)
    setLives(STARTING_LIVES)
    setIsNewRecord(false)
    setStatus('playing')
  }, [])

  useEffect(() => {
    if (status !== 'playing') return undefined

    let frameId
    const animate = (time) => {
      const arena = arenaRef.current
      if (!arena) {
        frameId = window.requestAnimationFrame(animate)
        return
      }

      const game = gameRef.current
      const width = arena.clientWidth
      const height = arena.clientHeight
      const delta = game.lastTime ? Math.min((time - game.lastTime) / 1000, 0.05) : 0
      game.lastTime = time
      game.elapsed += delta
      game.spawnElapsed += delta
      game.collisionCooldown = Math.max(0, game.collisionCooldown - delta)

      const difficulty = Math.floor(game.elapsed / 12)
      const spawnInterval = Math.max(0.34, 0.9 - difficulty * 0.07)
      if (game.spawnElapsed >= spawnInterval) {
        game.spawnElapsed = 0
        const size = 24 + Math.random() * 18
        game.obstacles.push({
          id: game.nextObstacleId++,
          x: Math.random() * Math.max(1, width - size),
          y: -size,
          size,
          speed: 190 + difficulty * 28 + Math.random() * 35,
          variant: Math.floor(Math.random() * 3),
        })
      }

      const direction = Number(heldKeys.current.has('arrowright') || heldKeys.current.has('d'))
        - Number(heldKeys.current.has('arrowleft') || heldKeys.current.has('a'))
      game.playerX = Math.min(
        Math.max(0, game.playerX + direction * 410 * delta),
        Math.max(0, width - PLAYER_WIDTH),
      )

      const playerTop = height - PLAYER_HEIGHT - 32
      let hit = false
      game.obstacles = game.obstacles.filter((obstacle) => {
        obstacle.y += obstacle.speed * delta
        const overlaps = obstacle.x < game.playerX + PLAYER_WIDTH
          && obstacle.x + obstacle.size > game.playerX
          && obstacle.y < playerTop + PLAYER_HEIGHT
          && obstacle.y + obstacle.size > playerTop

        if (overlaps && game.collisionCooldown === 0 && !hit) {
          hit = true
          game.collisionCooldown = 1
        }
        return obstacle.y < height + obstacle.size && !overlaps
      })

      const nextScore = Math.floor(game.elapsed * 10)
      setPlayerX(game.playerX)
      setObstacles([...game.obstacles])
      setScore(nextScore)

      if (hit) {
        game.lives -= 1
        setLives(game.lives)
        if (game.lives <= 0) {
          setStatus('over')
          if (nextScore > highScore) {
            setIsNewRecord(true)
            setHighScore(nextScore)
            try {
              window.localStorage.setItem(HIGH_SCORE_KEY, String(nextScore))
            } catch (error) {
              console.error('Unable to save the Neon Dodge high score.', error)
            }
          }
        }
      }

      frameId = window.requestAnimationFrame(animate)
    }

    frameId = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frameId)
  }, [highScore, status])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase()
      if (['arrowleft', 'arrowright', 'a', 'd', ' '].includes(key)) event.preventDefault()
      if (key === 'arrowleft' || key === 'arrowright' || key === 'a' || key === 'd') {
        heldKeys.current.add(key)
      }
      if ((key === ' ' || key === 'enter') && status !== 'playing') startGame()
    }
    const handleKeyUp = (event) => heldKeys.current.delete(event.key.toLowerCase())
    const clearKeys = () => heldKeys.current.clear()

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clearKeys)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clearKeys)
    }
  }, [startGame, status])

  useEffect(() => {
    const arena = arenaRef.current
    if (!arena || status === 'playing') return undefined

    const updatePosition = () => {
      const nextX = Math.max(0, (arena.clientWidth - PLAYER_WIDTH) / 2)
      gameRef.current.playerX = nextX
      setPlayerX(nextX)
    }
    updatePosition()
    const observer = new ResizeObserver(updatePosition)
    observer.observe(arena)
    return () => observer.disconnect()
  }, [status])

  const holdDirection = (direction) => {
    heldKeys.current.add(direction)
  }
  const releaseDirection = (direction) => {
    heldKeys.current.delete(direction)
  }
  const level = Math.floor(score / 120) + 1

  return (
    <main className="neon-app">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Neon Dodge home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>NEON<span className="brand-muted">/</span>DODGE</span>
        </a>
        <div className="topbar-right">
          <span className="live-indicator"><i /> SYSTEM ONLINE</span>
          <span className="version-tag">ARCADE SIM <b>01</b></span>
        </div>
      </header>

      <section className="game-shell" id="top">
        <div className="intro">
          <div className="eyebrow"><span>◆</span> SURVIVAL PROTOCOL <span className="eyebrow-line" /></div>
          <h1>Stay <span>alive.</span></h1>
          <p className="intro-copy">The grid is hostile. Keep moving.</p>
        </div>

        <div className="hud" aria-label="Game stats">
          <div className="hud-stat">
            <span className="stat-label">SCORE</span>
            <span className="stat-value">{String(score).padStart(5, '0')}</span>
          </div>
          <div className="hud-stat hud-level">
            <span className="stat-label">THREAT LEVEL</span>
            <span className="stat-value"><i className="level-dot" /> {String(level).padStart(2, '0')}</span>
          </div>
          <div className="hud-stat hud-lives">
            <span className="stat-label">HULL INTEGRITY</span>
            <span className="life-icons" aria-label={`${lives} of ${STARTING_LIVES} lives remaining`}>
              {Array.from({ length: STARTING_LIVES }, (_, index) => (
                <span className={index < lives ? 'life-icon' : 'life-icon life-lost'} key={index}>♥</span>
              ))}
            </span>
          </div>
        </div>

        <div className={`arena-wrap${status === 'playing' ? ' arena-active' : ''}`}>
          <div className="arena-frame">
            <div className="arena" ref={arenaRef} aria-label="Neon Dodge game arena">
              <div className="arena-scanlines" />
              <div className="arena-grid" />
              <div className="arena-glow arena-glow-left" />
              <div className="arena-glow arena-glow-right" />
              <div className="arena-coordinates" aria-hidden="true">
                <span>SECTOR 07 / NEO-TOKYO</span><span>Y: 2049.11</span>
              </div>
              <div className="lane-markers" aria-hidden="true"><i /><i /><i /><i /></div>

              {obstacles.map((obstacle) => (
                <div
                  className={`obstacle obstacle-${obstacle.variant}`}
                  key={obstacle.id}
                  style={{
                    width: obstacle.size,
                    height: obstacle.size,
                    transform: `translate(${obstacle.x}px, ${obstacle.y}px) rotate(45deg)`,
                  }}
                />
              ))}

              <div
                className={`player${status === 'playing' ? ' player-live' : ''}`}
                style={{ transform: `translateX(${playerX}px)` }}
                aria-label="Player"
              >
                <div className="player-aura" />
                <div className="player-core"><span /><i /><i /></div>
                <div className="player-thruster"><i /><i /><i /></div>
              </div>

              <div className="arena-bottom-line" />
              {status !== 'playing' && (
                <div className="game-overlay">
                  <div className="overlay-card">
                    {status === 'over' ? (
                      <>
                        <span className="overlay-kicker">SIGNAL LOST</span>
                        <h2>Run <span>ended.</span></h2>
                        <p>You survived for <b>{(score / 10).toFixed(1)}s</b>. The grid remembers.</p>
                        {isNewRecord && <span className="new-record">✦ NEW PERSONAL BEST</span>}
                        <button className="start-button" onClick={startGame}>
                          <span>↻</span> RUN IT BACK
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="start-glyph" aria-hidden="true"><span /><span /><span /></div>
                        <span className="overlay-kicker">READY WHEN YOU ARE</span>
                        <h2>Enter the <span>grid.</span></h2>
                        <p>Dodge the fall. Don't get caught standing still.</p>
                        <button className="start-button" onClick={startGame}>
                          <span>▶</span> START RUN
                        </button>
                        <div className="overlay-hint">OR PRESS <kbd>SPACE</kbd></div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="frame-corner corner-tl" />
            <div className="frame-corner corner-tr" />
            <div className="frame-corner corner-bl" />
            <div className="frame-corner corner-br" />
          </div>
        </div>

        <div className="below-arena">
          <div className="controls-hint">
            <span className="control-label">MOVE</span>
            <span className="keycap">←</span><span className="keycap">→</span>
            <span className="or-label">OR</span>
            <span className="keycap key-letter">A</span><span className="keycap key-letter">D</span>
          </div>
          <div className="best-score"><span>BEST RUN</span><b>{String(highScore).padStart(5, '0')}</b><i>✦</i></div>
        </div>

        <div className="touch-controls" aria-label="Touch movement controls">
          <button
            className="touch-button"
            aria-label="Move left"
            onPointerDown={() => holdDirection('arrowleft')}
            onPointerUp={() => releaseDirection('arrowleft')}
            onPointerCancel={() => releaseDirection('arrowleft')}
            onPointerLeave={() => releaseDirection('arrowleft')}
          >←</button>
          <span>HOLD TO MOVE</span>
          <button
            className="touch-button"
            aria-label="Move right"
            onPointerDown={() => holdDirection('arrowright')}
            onPointerUp={() => releaseDirection('arrowright')}
            onPointerCancel={() => releaseDirection('arrowright')}
            onPointerLeave={() => releaseDirection('arrowright')}
          >→</button>
        </div>

        <footer className="page-footer">
          <span>NO SAFE ZONE <i>—</i> KEEP MOVING</span>
          <span>NEON DODGE <b>©</b> 2049</span>
        </footer>
      </section>
    </main>
  )
}

export default App
