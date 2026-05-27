// catProgress.js

export function initCatProgress(canvas) {
  const ctx = canvas.getContext('2d')

  const img = document.createElement('img')
  img.src = 'https://res.cloudinary.com/penumbra1/image/upload/v1521568365/cat_sprite_emjlbm.png'

  canvas.classList.add('cado-sprite-cat')

  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width || canvas.width
  canvas.height = rect.height || canvas.height

  const spriteW = 197
  const spriteH = 98.15
  const renderH = 34
  const renderW = (spriteW / spriteH) * renderH

  const sprites = {
    stop: { spriteIndex: 1, maxFrame: 5, loop: false, freezeFrame: 5 }, // 5-й кадр посадки
    run: { spriteIndex: 3, maxFrame: 12, loop: true },
  }

  let targetPercent = 0
  let animationFrameId = null

  const startX = renderW / 2
  let catX = startX

  let currentAction = 'run'
  let currentFrame = 0

  let lastTime = performance.now()

  // Настройки скорости
  const fps = 22
  const frameInterval = 1000 / fps
  const maxRunSpeed = 5.0

  let celebrationTime = 0
  let canvasOpacity = 1.0
  let isImageLoaded = false

  img.onload = () => {
    isImageLoaded = true
  }

  function drawCatSprite(x, y, action, frame) {
    if (!isImageLoaded) return
    const config = sprites[action] || sprites.run
    ctx.save()
    ctx.translate(x, y - renderH / 2)
    ctx.scale(-1, 1)
    ctx.drawImage(
      img,
      spriteW * config.spriteIndex,
      spriteH * Math.floor(frame),
      spriteW,
      spriteH,
      -renderW / 2,
      -renderH / 2,
      renderW,
      renderH
    )
    ctx.restore()
  }

  function draw(currentTime) {
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    ctx.globalAlpha = canvasOpacity
    const deltaTime = currentTime - lastTime

    const finishX = w - (renderW / 2)
    let targetX = startX + ((finishX - startX) * targetPercent) / 100

    if (targetPercent >= 100) {
      targetX = finishX
    }

    // === СИНХРОНИЗАЦИЯ СКОРОСТИ ===
    const distanceToTarget = targetX - catX

    if (currentAction === 'run') {
      if (distanceToTarget > 0.5) {
        // ТУРБО-РЕЖИМ: Если прилетело 100%, а кот позади — включаем скорость х3, чтобы он не тормозил процесс
        const dynamicMaxSpeed = targetPercent >= 100 ? maxRunSpeed * 3 : maxRunSpeed
        const speed = Math.min(dynamicMaxSpeed, distanceToTarget * 0.3)

        catX += Math.max(2.5, speed)
        if (catX > targetX) catX = targetX
      }

      // Переход в посадку строго на финише
      if (targetPercent >= 100 && catX >= finishX - 1) {
        catX = finishX
        currentAction = 'stop'
        currentFrame = 0
      }
    }

    // Обновление кадров ног кота
    if (deltaTime >= frameInterval) {
      const framesPassed = Math.floor(deltaTime / frameInterval)
      const config = sprites[currentAction]

      if (config.loop) {
        // Если включен турбо-режим, лапки должны перебираться быстрее
        const turboFrames = targetPercent >= 100 ? framesPassed * 2 : framesPassed
        currentFrame = (currentFrame + turboFrames) % config.maxFrame
      } else {
        if (currentFrame < config.freezeFrame) {
          currentFrame = Math.min(currentFrame + framesPassed, config.freezeFrame)
        }
      }
      lastTime = currentTime - (deltaTime % frameInterval)
    }

    drawCatSprite(catX, h, currentAction, currentFrame)
    ctx.globalAlpha = 1.0

    // Моментальный уход со сцены после короткой посадки
    if (targetPercent >= 100 && currentAction === 'stop' && currentFrame === sprites.stop.freezeFrame && canvas.id !== 'testCatCanvas') {
      celebrationTime += 1
      if (celebrationTime > 15) { // Минимальная задержка (меньше секунды)
        canvasOpacity -= 0.05 // Быстрое, но плавное скрытие
        if (canvasOpacity <= 0) {
          canvasOpacity = 0
          canvas.style.display = 'none'
          cancelAnimationFrame(animationFrameId)
          return
        }
      }
    }

    animationFrameId = requestAnimationFrame(draw)
  }

  return {
    start: () => {
      requestAnimationFrame((timestamp) => {
        const r = canvas.getBoundingClientRect()
        canvas.width = r.width || canvas.width
        canvas.height = r.height || canvas.height
        lastTime = timestamp
        draw(timestamp)
      })
    },
    updateProgress: (percent) => {
      if (percent > targetPercent) {
        targetPercent = percent
      }
    },
    hideImmediately: () => {
      canvas.style.display = 'none'
    }
  }
}