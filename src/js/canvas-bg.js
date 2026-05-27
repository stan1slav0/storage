// canvas-bg.js
(function () {
  const canvas = document.getElementById('heroCanvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const section = canvas.parentElement

  let particles = []
  const particleCount = 130
  let mouse = { x: null, y: null, radius: 130 }

  function resizeCanvas() {
    canvas.width = section.offsetWidth
    canvas.height = section.offsetHeight
    initParticles()
  }

  section.addEventListener('mousemove', function (e) {
    const rect = section.getBoundingClientRect()
    mouse.x = e.clientX - rect.left
    mouse.y = e.clientY - rect.top
  })

  section.addEventListener('mouseleave', function () {
    mouse.x = null
    mouse.y = null
  })

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width
      this.y = Math.random() * canvas.height
      this.baseX = this.x
      this.baseY = this.y
      this.size = Math.random() * 3.5 + 1.5

      this.angle = Math.random() * Math.PI * 2
      this.bounceSpeed = Math.random() * 0.015 + 0.005
      this.bounceRadius = Math.random() * 20 + 5
      this.returnSpeed = Math.random() * 0.06 + 0.03

      // Фиолетовая неоновая палитра под новый UI
      const colors = [
        '124, 58, 237',  // Насыщенный фиолетовый
        '167, 139, 250', // Нежная лаванда
        '192, 132, 252', // Пурпурный неон
        '255, 255, 255'  // Кристально белый
      ]
      this.colorBase = colors[Math.floor(Math.random() * colors.length)]
      this.alpha = Math.random() * 0.4 + 0.15
    }

    update() {
      this.angle += this.bounceSpeed
      let homeX = this.baseX + Math.cos(this.angle) * this.bounceRadius
      let homeY = this.baseY + Math.sin(this.angle) * this.bounceRadius

      if (mouse.x !== null && mouse.y !== null) {
        let dx = this.x - mouse.x
        let dy = this.y - mouse.y
        let distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < mouse.radius) {
          let force = (mouse.radius - distance) / mouse.radius
          let pushX = (dx / distance) * force * 9
          let pushY = (dy / distance) * force * 9

          this.x += pushX
          this.y += pushY
          return
        }
      }

      let dxHome = homeX - this.x
      let dyHome = homeY - this.y

      this.x += dxHome * this.returnSpeed
      this.y += dyHome * this.returnSpeed
    }

    draw() {
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${this.colorBase}, ${this.alpha})`
      ctx.fill()
    }
  }

  function initParticles() {
    particles = []
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle())
    }
  }

  function animate() {
    // Идеальная очистка кадра прозрачностью. 
    // Теперь фон канваса не закрашивается, и твой CSS-градиент '--hero-bg' больше ничего не перебивает!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Рисуем частицы поверх прозрачного слоя
    for (let i = 0; i < particles.length; i++) {
      particles[i].update()
      particles[i].draw()
    }
    requestAnimationFrame(animate)
  }

  window.addEventListener('resize', resizeCanvas)
  resizeCanvas()
  animate()
})()