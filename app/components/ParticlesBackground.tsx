'use client';

import React, { useEffect, useRef } from 'react';

export default function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    let particles: Particle[] = [];
    let animId: number;

    const resize = () => {
      if (!canvas) return;
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };

    class Particle {
      x!: number;
      y!: number;
      r!: number;
      vx!: number;
      vy!: number;
      life!: number;
      maxLife!: number;
      hue!: number;

      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.r = Math.random() * 1.5 + 0.3;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.life = Math.random();
        this.maxLife = Math.random() * 0.6 + 0.2;
        this.hue = Math.random() < 0.6 ? 192 : 270; // Cyan or violet
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life += 0.003;
        if (this.life > this.maxLife || this.x < 0 || this.x > W || this.y < 0 || this.y > H) {
          this.reset();
          this.life = 0;
        }
      }

      draw(context: CanvasRenderingContext2D) {
        const alpha = Math.sin((this.life / this.maxLife) * Math.PI) * 0.7;
        context.beginPath();
        context.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        context.fillStyle = `hsla(${this.hue}, 100%, 70%, ${alpha})`;
        context.fill();
      }
    }

    const drawConnections = (context: CanvasRenderingContext2D) => {
      const maxDist = 120;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.12;
            context.beginPath();
            context.moveTo(particles[i].x, particles[i].y);
            context.lineTo(particles[j].x, particles[j].y);
            context.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
            context.lineWidth = 0.5;
            context.stroke();
          }
        }
      }
    };

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      drawConnections(ctx);
      particles.forEach((p) => {
        p.update();
        p.draw(ctx);
      });
      animId = requestAnimationFrame(loop);
    };

    const init = () => {
      resize();
      particles = [];
      const count = Math.min(Math.floor((W * H) / 12000), 100);
      for (let i = 0; i < count; i++) {
        particles.push(new Particle());
      }
      cancelAnimationFrame(animId);
      loop();
    };

    init();
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} id="particle-canvas" />;
}
