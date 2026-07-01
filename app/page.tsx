'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: 'professor' | 'student' | 'admin') => {
    setEmail(`${role}@university.edu`);
    setPassword('password123');
  };

  return (
    <div className="landing-wrap">
      {/* Hero Section */}
      <section id="hero" style={{ padding: '160px 0 100px 0' }}>
        <div className="hero-grid-overlay"></div>
        <div className="hero-glow-1"></div>
        <div className="hero-glow-2"></div>

        <div className="container">
          <div className="hero-flex" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '48px', alignItems: 'center' }}>
            <div className="hero-content">
              <div className="hero-badge">
                <span className="badge-dot"></span>
                Multi-Agent Orchestration — Powered by LangGraph
              </div>

              <h1 className="hero-title" style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '24px' }}>
                <span className="line1" style={{ display: 'block', color: '#fff' }}>The Auto-TA:</span>
                <span className="line2" style={{ display: 'block', background: 'linear-gradient(90deg, var(--cyan), var(--violet))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  Interactive AI Platform
                </span>
              </h1>

              <p className="hero-desc" style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '40px', maxWidth: '600px' }}>
                An enterprise-grade AI Teaching Assistant powered by a multi-agent architecture.
                Generates exams, evaluates coding and theory answers, and provides interactive doubt solving — with complete Human-in-the-Loop review.
              </p>

              <div className="hero-actions" style={{ display: 'flex', gap: '16px', marginBottom: '48px' }}>
                <a href="#login" className="btn btn-primary" style={{ display: 'inline-flex', padding: '12px 28px', borderRadius: '10px' }}>
                  <span>🔬</span> Launch Console
                </a>
                <a href="#architecture" className="btn btn-outline" style={{ display: 'inline-flex', padding: '12px 28px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)' }}>
                  <span>🤖</span> View Simulator
                </a>
              </div>

              <div className="hero-stats" style={{ display: 'flex', gap: '48px' }}>
                <div className="stat-item">
                  <span className="stat-number" style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--cyan)' }}>9</span>
                  <span className="stat-label" style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>AI Agents</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number" style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--green)' }}>50</span>
                  <span className="stat-label" style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Mark Exams</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number" style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--violet)' }}>12</span>
                  <span className="stat-label" style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Weeks Roadmap</span>
                </div>
              </div>
            </div>

            {/* Login Glassmorphism Box */}
            <div id="login" className="login-card-container">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{
                  background: 'var(--bg-card)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--card-radius-lg)',
                  padding: '40px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>Sign In</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
                  Access the AI Teaching Assistant Platform
                </p>

                {error && (
                  <div style={{ background: 'rgba(255, 61, 154, 0.1)', border: '1px solid var(--pink)', color: 'var(--pink)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '20px' }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>EMAIL ADDRESS</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="professor@university.edu"
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'rgba(5, 11, 24, 0.6)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>PASSWORD</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'rgba(5, 11, 24, 0.6)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      marginTop: '8px',
                    }}
                  >
                    {loading ? 'Authenticating...' : 'Sign In'}
                  </button>
                </form>

                <div style={{ marginTop: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>QUICK LOGIN AS:</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleQuickLogin('professor')}
                      style={{ flex: 1, padding: '8px', fontSize: '0.8rem', background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: '6px', color: 'var(--cyan)', cursor: 'pointer' }}
                    >
                      Professor
                    </button>
                    <button
                      onClick={() => handleQuickLogin('student')}
                      style={{ flex: 1, padding: '8px', fontSize: '0.8rem', background: 'rgba(0, 255, 136, 0.1)', border: '1px solid rgba(0, 255, 136, 0.3)', borderRadius: '6px', color: 'var(--green)', cursor: 'pointer' }}
                    >
                      Student
                    </button>
                    <button
                      onClick={() => handleQuickLogin('admin')}
                      style={{ flex: 1, padding: '8px', fontSize: '0.8rem', background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.3)', borderRadius: '6px', color: 'var(--violet)', cursor: 'pointer' }}
                    >
                      Admin
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Simulator Section */}
      <section id="architecture" style={{ padding: '80px 0', borderTop: '1px solid var(--glass-border)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>Multi-Agent Workflow Simulator</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '700px', margin: '0 auto' }}>
              Understand the core LangGraph state graph. The Manager routes parallel fan-out agents, gathers inputs at compilation, and holds for feedback.
            </p>
          </div>

          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--card-radius-lg)',
              padding: '32px',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            }}
          >
            {/* Visualizer Flow Graph Simulation */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', overflowX: 'auto', padding: '24px 0' }}>
              <div style={{ padding: '16px', background: 'rgba(0, 212, 255, 0.05)', border: '1px solid var(--cyan)', borderRadius: '12px', minWidth: '150px' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>👨‍🏫</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Professor Input</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--green)' }}>● READY</div>
              </div>

              <div style={{ color: 'var(--cyan)', fontSize: '1.5rem' }}>➔</div>

              <div style={{ padding: '16px', background: 'rgba(0, 212, 255, 0.05)', border: '1px solid var(--cyan)', borderRadius: '12px', minWidth: '150px' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>🔀</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>The Manager</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Router Node</div>
              </div>

              <div style={{ color: 'var(--violet)', fontSize: '1.5rem' }}>➔</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'rgba(124, 58, 237, 0.05)', border: '1px solid var(--violet)', borderRadius: '12px', minWidth: '160px' }}>
                  <div style={{ fontSize: '1.1rem', marginBottom: '4px' }}>✍️</div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Agent A: Concept Writer</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Theory Drafting</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(124, 58, 237, 0.05)', border: '1px solid var(--violet)', borderRadius: '12px', minWidth: '160px' }}>
                  <div style={{ fontSize: '1.1rem', marginBottom: '4px' }}>💻</div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Agent B: Programmer</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Python Tasks</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(124, 58, 237, 0.05)', border: '1px solid var(--violet)', borderRadius: '12px', minWidth: '160px' }}>
                  <div style={{ fontSize: '1.1rem', marginBottom: '4px' }}>🔢</div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Agent C: Mathematician</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>LaTeX & Equations</div>
                </div>
              </div>

              <div style={{ color: 'var(--violet)', fontSize: '1.5rem' }}>➔</div>

              <div style={{ padding: '16px', background: 'rgba(0, 255, 136, 0.05)', border: '1px solid var(--green)', borderRadius: '12px', minWidth: '150px' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>📝</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>The Editor</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Compiler Node</div>
              </div>

              <div style={{ color: 'var(--orange)', fontSize: '1.5rem' }}>➔</div>

              <div style={{ padding: '16px', background: 'rgba(255, 107, 53, 0.05)', border: '1px solid var(--orange)', borderRadius: '12px', minWidth: '150px' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>⏸️</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>The Checkpoint</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--orange)' }}>● PAUSED (HITL)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Meet the Agents Section */}
      <section id="agents" style={{ padding: '80px 0', borderTop: '1px solid var(--glass-border)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>Meet the Specialist Agents</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Nine integrated autonomous workers working inside the LangGraph pipeline</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <div className="agent-card" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
              <div style={{ width: '40px', height: '40px', background: 'rgba(0,212,255,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '16px', color: 'var(--cyan)' }}>🔀</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>The Manager (Router)</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Analyzes prompting requests, delegates tasks in parallel, handles model errors and maps dependencies.</p>
            </div>

            <div className="agent-card" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
              <div style={{ width: '40px', height: '40px', background: 'rgba(124,58,237,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '16px', color: 'var(--violet)' }}>✍️</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>Agent A: Concept Writer</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Drafts conceptual multiple choice questions, short answers, and structural definitions mapped to Bloom levels.</p>
            </div>

            <div className="agent-card" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
              <div style={{ width: '40px', height: '40px', background: 'rgba(0,255,136,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '16px', color: 'var(--green)' }}>💻</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>Agent B: Programmer</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Builds coding exercises, complete with starter code parameters, sample inputs, and validation testcases.</p>
            </div>

            <div className="agent-card" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
              <div style={{ width: '40px', height: '40px', background: 'rgba(255,107,53,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '16px', color: 'var(--orange)' }}>🔢</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>Agent C: Mathematician</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Creates complex numerical problems, computes formulas, and produces clean mathematical expressions in LaTeX.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '40px 0', textAlign: 'center', borderTop: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <p>© 2026 Auto TA Agent Platform. Designed for Next-Generation Classrooms.</p>
      </footer>
    </div>
  );
}
