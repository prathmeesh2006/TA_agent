'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Play, RotateCcw, Check, Layers,
  Terminal, Shield, FileText, Compass, 
  LogOut, User, AlertCircle 
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Simple lightweight LaTeX to HTML formatter
function renderLatex(text: string) {
  if (!text) return '';
  // Basic translation of math blocks
  let formatted = text
    .replace(/\$\$(.*?)\$\$/g, '<div class="math-block">$1</div>')
    .replace(/\$(.*?)\$/g, '<span class="math-inline">$1</span>')
    .replace(/\\sum_{i=1}\^n/g, '<span class="math-symbol">&sum;</span><sub>i=1</sub><sup>n</sup>')
    .replace(/\\sum_{i=1}\^c/g, '<span class="math-symbol">&sum;</span><sub>i=1</sub><sup>c</sup>')
    .replace(/p_i \\log_2 p_i/g, 'p<sub>i</sub> log<sub>2</sub> p<sub>i</sub>')
    .replace(/p_A = 8\/12 = 2\/3/g, 'p<sub>A</sub> = 8/12 = 2/3')
    .replace(/p_B = 4\/12 = 1\/3/g, 'p<sub>B</sub> = 4/12 = 1/3')
    .replace(/\\log_2/g, 'log<sub>2</sub>')
    .replace(/\\epsilon/g, '&epsilon;')
    .replace(/\\rightarrow/g, '&rarr;')
    .replace(/\\mid/g, '|')
    .replace(/\\text{(.*?)}/g, '<span class="math-text">$1</span>')
    .replace(/\\{/g, '{')
    .replace(/\\}/g, '}');

  return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'student' | 'admin'>('dashboard');

  // Form parameters
  const [prompt, setPrompt] = useState('Random Forests');
  const [totalMarks, setTotalMarks] = useState(50);
  const [difficulty, setDifficulty] = useState('Medium');
  const [questionTypes, setQuestionTypes] = useState<string[]>(['MCQ', 'SAQ', 'Programming', 'Math']);
  const [units] = useState<number[]>([1, 2, 3]);
  const [courseId, setCourseId] = useState('cs-452-ml');

  // Courses list
  const [courses, setCourses] = useState<any[]>([]);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [currentExamId, setCurrentExamId] = useState<string | null>(null);
  const [examState, setExamState] = useState<any>(null);
  const [activeNode, setActiveNode] = useState<string>('idle'); // idle, manager, theory_writer, programmer, mathematician, editor, checkpoint
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [stats, setStats] = useState<any>({
    totalCourses: 3,
    totalExams: 0,
    pendingReviews: 0,
    approvedExams: 0,
    totalCost: 0,
    totalTokens: 0
  });

  // Iterative feedback checkpoint state
  const [feedbackComment, setFeedbackComment] = useState('');
  const [reviewingExam, setReviewingExam] = useState<any>(null);
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number>(1);
  const [targetRegenAgent, setTargetRegenAgent] = useState<string>('ALL');

  // Logs stream auto scroll
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [liveLogs]);

  // Authenticate user
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Fetch initial data
  useEffect(() => {
    if (status === 'authenticated') {
      fetchCourses();
      fetchDashboardStats();
    }
  }, [status]);

  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/courses');
      const data = await res.json();
      if (Array.isArray(data)) setCourses(data);
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      const data = await res.json();
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchExamDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/exams/${id}`);
      const data = await res.json();
      if (data && data.versions && data.versions.length > 0) {
        setReviewingExam(data);
        const sortedVersions = [...data.versions].sort((a, b) => b.versionNumber - a.versionNumber);
        setCurrentVersionNumber(sortedVersions[0].versionNumber);
        setExamState(JSON.parse(sortedVersions[0].content));
      }
    } catch (err) {
      console.error('Failed to fetch exam:', err);
    }
  };

  const toggleQuestionType = (type: string) => {
    if (questionTypes.includes(type)) {
      setQuestionTypes(questionTypes.filter((t) => t !== type));
    } else {
      setQuestionTypes([...questionTypes, type]);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setGenerating(true);
    setExamState(null);
    setReviewingExam(null);
    setLiveLogs(['Initializing Manager Agent...']);
    setActiveNode('manager');

    // Use a local variable to capture examId from the SSE stream to avoid React state closure issues
    let streamedExamId: string | null = null;

    try {
      const userId = (session?.user as any)?.id || 'mock-user-id';
      const response = await fetch('/api/exams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          totalMarks,
          difficulty,
          questionTypes,
          units,
          courseId,
          userId
        })
      });

      if (!response.body) throw new Error('No readable stream returned');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (part.startsWith('event: status')) {
            const dataStr = part.replace('event: status\ndata: ', '');
            try {
              const data = JSON.parse(dataStr);
              if (data.nodeId) {
                setActiveNode(data.nodeId);
              }
              if (data.logs) {
                setLiveLogs((prev) => [...prev, ...data.logs]);
              }
              if (data.costUsd != null || data.tokensUsed != null) {
                setStats((prev: any) => ({
                  ...prev,
                  totalCost: Number(Number(data.costUsd || 0).toFixed(4)),
                  totalTokens: data.tokensUsed || 0
                }));
              }
              if (data.compiledExam) {
                setExamState(data.compiledExam);
              }
              if (data.examId) {
                // Update both the local variable and React state
                streamedExamId = data.examId;
                setCurrentExamId(data.examId);
              }
            } catch (err) {
              console.error('Error parsing SSE data:', err);
            }
          } else if (part.startsWith('event: error')) {
            const dataStr = part.replace('event: error\ndata: ', '');
            try {
              const data = JSON.parse(dataStr);
              setLiveLogs((prev) => [...prev, `[Error] ${data.message}`]);
            } catch (_e) {
              // ignore parse errors on error events
            }
            setGenerating(false);
          }
        }
      }

      setGenerating(false);
      fetchDashboardStats();
      // Use the local variable which is reliably set during the async stream
      if (streamedExamId) {
        fetchExamDetails(streamedExamId);
      }
    } catch (err: any) {
      setLiveLogs((prev) => [...prev, `[Error] ${err.message}`]);
      setGenerating(false);
    }
  };

  const handleFeedback = async (action: 'approve' | 'reject') => {
    if (!currentExamId || !examState) return;
    setGenerating(true);
    setLiveLogs((prev) => [...prev, `Submitting ${action.toUpperCase()} action to backend...`]);

    try {
      const userId = (session?.user as any)?.id || 'mock-user-id';
      const res = await fetch('/api/exams/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: currentExamId,
          versionNumber: currentVersionNumber,
          action,
          comment: action === 'reject' ? feedbackComment : 'Exam approved.',
          userId
        })
      });

      const data = await res.json();
      if (data.success) {
        if (action === 'approve') {
          setActiveNode('idle');
          setFeedbackComment('');
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
          setLiveLogs((prev) => [...prev, '✔ Exam Approved and Published successfully!']);
          fetchDashboardStats();
          fetchExamDetails(currentExamId);
        } else {
          // Reject & Revise
          setFeedbackComment('');
          setLiveLogs((prev) => [
            ...prev,
            `➔ [Optimized Routing] Feedback targets: ${data.targetAgent}`,
            `➔ Regenerating affected questions...`,
            `✔ Version ${data.versionNumber} Compiled.`
          ]);
          fetchDashboardStats();
          fetchExamDetails(currentExamId);
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="nav-logo-icon" style={{ width: '50px', height: '50px', fontSize: '24px' }}>🤖</div>
      </div>
    );
  }

  // Define nodes in visualizer
  const nodes = [
    { id: 'manager', label: 'The Manager', desc: 'Routing Agent', emoji: '🔀', color: 'var(--cyan)' },
    { id: 'theory_writer', label: 'Agent A', desc: 'Concept Writer', emoji: '✍️', color: 'var(--violet)' },
    { id: 'programmer', label: 'Agent B', desc: 'Programmer', emoji: '💻', color: 'var(--violet)' },
    { id: 'mathematician', label: 'Agent C', desc: 'Mathematician', emoji: '🔢', color: 'var(--violet)' },
    { id: 'editor', label: 'The Editor', desc: 'Compiler Agent', emoji: '📝', color: 'var(--green)' },
    { id: 'checkpoint', label: 'Checkpoint', desc: 'HITL Review', emoji: '⏸️', color: 'var(--orange)' },
  ];

  return (
    <div className="dashboard-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside style={{ background: 'rgba(5, 11, 24, 0.9)', borderRight: '1px solid var(--glass-border)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="nav-logo">
          <div className="nav-logo-icon">🤖</div>
          <span className="nav-logo-text">Auto TA Agent</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'dashboard' ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
              color: activeTab === 'dashboard' ? 'var(--cyan)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              textAlign: 'left',
              transition: 'var(--transition)'
            }}
          >
            <Compass size={18} /> Professor Console
          </button>

          <button
            onClick={() => router.push('/student')}
            className="sidebar-link"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              textAlign: 'left',
            }}
          >
            <FileText size={18} /> Student Portal
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`sidebar-link ${activeTab === 'admin' ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'admin' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
              color: activeTab === 'admin' ? 'var(--violet)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              textAlign: 'left',
            }}
          >
            <Shield size={18} /> Admin Dashboard
          </button>
        </nav>

        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan)', border: '1px solid var(--cyan)' }}>
              <User size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{session?.user?.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{(session?.user as any)?.role}</div>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--pink)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ padding: '40px', overflowY: 'auto', maxHeight: '100vh', position: 'relative' }}>
        {activeTab === 'dashboard' && (
          <div>
            {/* Header Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
              <div className="metric-card" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--card-radius)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>TOTAL COURSES</span>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--cyan)' }}>{stats.totalCourses}</span>
              </div>
              <div className="metric-card" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--card-radius)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>EXAMS GENERATED</span>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--violet)' }}>{stats.totalExams}</span>
              </div>
              <div className="metric-card" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--card-radius)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>PENDING REVIEWS</span>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--orange)' }}>{stats.pendingReviews}</span>
              </div>
              <div className="metric-card" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--card-radius)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>ESTIMATED COST (USD)</span>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--green)' }}>${Number(stats.totalCost || 0).toFixed(4)}</span>
              </div>
            </div>

            {/* Prompt Builder & Live visualizer Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '32px', marginBottom: '32px' }}>
              {/* Form panel */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--card-radius-lg)', padding: '32px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '24px', color: '#fff' }}>Exam Prompt Builder</h3>

                <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>COURSE SELECTOR</label>
                    <select
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'rgba(5, 11, 24, 0.8)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.9rem',
                      }}
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                      {courses.length === 0 && (
                        <option value="cs-452-ml">Machine Learning (CS452)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>TOPIC PROMPT</label>
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g. Random Forests, LL(1) Parsers"
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'rgba(5, 11, 24, 0.8)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>DIFFICULTY</label>
                      <select
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          background: 'rgba(5, 11, 24, 0.8)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '0.9rem',
                        }}
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>TOTAL MARKS</label>
                      <input
                        type="number"
                        value={totalMarks}
                        onChange={(e) => setTotalMarks(Number(e.target.value))}
                        min={10}
                        max={100}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          background: 'rgba(5, 11, 24, 0.8)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '0.9rem',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>QUESTION FORMATS</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {['MCQ', 'SAQ', 'Programming', 'Math'].map((t) => (
                        <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={questionTypes.includes(t)}
                            onChange={() => toggleQuestionType(t)}
                            style={{ accentColor: 'var(--cyan)' }}
                          />
                          {t}
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={generating}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      gap: '8px',
                      marginTop: '12px',
                    }}
                  >
                    <Play size={16} /> {generating ? 'Generating State...' : 'Initiate AI Generation'}
                  </button>
                </form>
              </div>

              {/* Workflow Simulator Visualizer */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--card-radius-lg)', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>Interactive Architecture Simulator</h3>
                  <span className={`live-badge ${generating ? 'active' : ''}`} style={{ background: generating ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255,255,255,0.05)', color: generating ? 'var(--green)' : 'var(--text-secondary)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                    {generating ? 'GENERATING' : 'IDLE'}
                  </span>
                </div>

                {/* Animated Graph Canvas Simulation */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', padding: '16px', background: 'rgba(5, 11, 24, 0.4)', borderRadius: '12px', border: '1px solid rgba(0,212,255,0.05)' }}>
                  {nodes.map((node) => {
                    const isNodeActive = activeNode === node.id;
                    return (
                      <motion.div
                        key={node.id}
                        animate={isNodeActive ? { scale: 1.05, boxShadow: `0 0 20px ${node.color}` } : { scale: 1, boxShadow: 'none' }}
                        transition={{ duration: 0.3 }}
                        style={{
                          padding: '16px',
                          background: isNodeActive ? 'rgba(255,255,255,0.05)' : 'rgba(5, 11, 24, 0.8)',
                          border: isNodeActive ? `2px solid ${node.color}` : '1px solid var(--glass-border)',
                          borderRadius: '12px',
                          textAlign: 'center',
                          position: 'relative'
                        }}
                      >
                        <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{node.emoji}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{node.label}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{node.desc}</div>
                        {isNodeActive && (
                          <div style={{ position: 'absolute', top: '8px', right: '8px', width: '6px', height: '6px', borderRadius: '50%', background: node.color, animation: 'pulse 1s infinite' }}></div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Live Console Stream */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Terminal size={14} className="text-secondary" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>AGENT EXECUTION LOGS</span>
                  </div>
                  <div
                    ref={logContainerRef}
                    style={{
                      height: '140px',
                      background: '#040810',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      padding: '12px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: 'var(--cyan)',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    {liveLogs.map((log, idx) => (
                      <div key={idx} style={{ lineBreak: 'anywhere' }}>{log}</div>
                    ))}
                    {liveLogs.length === 0 && (
                      <div style={{ color: 'var(--text-muted)' }}>Console idle. Launch generation to stream logs...</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Exam Preview & Feedback Loop section */}
            {examState && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--card-radius-lg)',
                  padding: '32px',
                  marginBottom: '32px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '20px', marginBottom: '24px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>{examState.title}</h3>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      <span>Difficulty: <strong>{examState.difficulty}</strong></span>
                      <span>Total Marks: <strong>{examState.totalMarks}</strong></span>
                      <span>Duration: <strong>{examState.durationMin} mins</strong></span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ background: 'rgba(0, 212, 255, 0.1)', color: 'var(--cyan)', border: '1px solid rgba(0, 212, 255, 0.3)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                      Draft Version {currentVersionNumber}
                    </span>
                  </div>
                </div>

                {/* Render questions list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                  {examState.questions.map((q: any) => (
                    <div key={q.number} style={{ padding: '24px', background: 'rgba(5, 11, 24, 0.6)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--violet)', textTransform: 'uppercase' }}>Section: {q.section}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--cyan)' }}>[{q.marks} Marks]</span>
                      </div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '12px' }}>
                        Q{q.number}. {q.question}
                      </h4>

                      {/* Display MCQ choices */}
                      {q.options && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                          {q.options.map((opt: string, idx: number) => (
                            <div key={idx} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '0.85rem' }}>
                              <strong>{String.fromCharCode(65 + idx)}.</strong> {opt}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Code Block for Starter Code */}
                      {q.starterCode && (
                        <div style={{ margin: '16px 0' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>STARTER CODE:</div>
                          <pre style={{ background: '#030712', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#00ff88', overflowX: 'auto' }}>
                            <code>{q.starterCode}</code>
                          </pre>
                        </div>
                      )}

                      {/* Math rendering formula */}
                      {q.formulation && (
                        <div style={{ padding: '16px', background: 'rgba(0, 212, 255, 0.03)', border: '1px solid rgba(0, 212, 255, 0.1)', borderRadius: '8px', margin: '16px 0', textAlign: 'center', fontSize: '1.1rem' }}>
                          {renderLatex(q.formulation)}
                        </div>
                      )}

                      <div style={{ borderTop: '1px dashed var(--glass-border)', paddingTop: '16px', marginTop: '16px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--green)', marginBottom: '4px' }}>SOLUTION/EXPLANATION:</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {renderLatex(q.solution || q.answer || q.explanation)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* HITL Checkpoint Controls */}
                <div style={{ marginTop: '40px', borderTop: '1px solid var(--glass-border)', paddingTop: '32px' }}>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <AlertCircle size={18} /> Human-in-the-Loop Checkpoint
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                    You can approve this exam to publish it to the student portal, or request a localized revision. Providing detailed comments (e.g., mentioning "math" or "code") will route the edit strictly to that agent.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <textarea
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Comment for revision (e.g., 'The math question is too easy, make it advanced level.')"
                      style={{
                        width: '100%',
                        height: '100px',
                        padding: '16px',
                        background: 'rgba(5, 11, 24, 0.8)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.9rem',
                        resize: 'none'
                      }}
                    />

                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button
                        onClick={() => handleFeedback('approve')}
                        disabled={generating}
                        className="btn btn-primary"
                        style={{ background: 'var(--green)', color: '#050b18', padding: '12px 24px', fontWeight: 700 }}
                      >
                        <Check size={16} /> Approve Exam
                      </button>

                      <button
                        onClick={() => handleFeedback('reject')}
                        disabled={generating || !feedbackComment.trim()}
                        className="btn"
                        style={{ background: 'var(--pink)', color: '#fff', padding: '12px 24px', fontWeight: 700 }}
                      >
                        <RotateCcw size={16} /> Reject & Revise
                      </button>
                    </div>
                  </div>
                </div>

                {/* Version history list */}
                {reviewingExam && reviewingExam.versions.length > 1 && (
                  <div style={{ marginTop: '40px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={16} /> Version Control Diff Timeline
                    </h4>
                    <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '10px' }}>
                      {reviewingExam.versions.map((ver: any) => (
                        <button
                          key={ver.id}
                          onClick={() => {
                            setCurrentVersionNumber(ver.versionNumber);
                            setExamState(JSON.parse(ver.content));
                          }}
                          style={{
                            padding: '10px 18px',
                            background: currentVersionNumber === ver.versionNumber ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255,255,255,0.03)',
                            border: currentVersionNumber === ver.versionNumber ? '1px solid var(--cyan)' : '1px solid var(--glass-border)',
                            borderRadius: '8px',
                            color: currentVersionNumber === ver.versionNumber ? 'var(--cyan)' : 'var(--text-secondary)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Version {ver.versionNumber} ({new Date(ver.createdAt).toLocaleTimeString()})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* Admin panel tab */}
        {activeTab === 'admin' && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--card-radius-lg)', padding: '32px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginBottom: '24px' }}>System Administrator Board</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>API Token Usage & Rate Limits</h3>
                <div style={{ padding: '20px', background: 'rgba(5, 11, 24, 0.6)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gemini API Limit</span>
                    <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 700 }}>5,000 / month</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tavily Search Limit</span>
                    <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 700 }}>1,000 / month</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>System Rate Limit</span>
                    <span style={{ fontSize: '0.85rem', color: '#00ff88', fontWeight: 700 }}>60 req/min (Active)</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>Workspace User List</h3>
                <div style={{ padding: '16px', background: 'rgba(5, 11, 24, 0.6)', border: '1px solid var(--glass-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span>professor@university.edu</span>
                    <span style={{ color: 'var(--cyan)' }}>PROFESSOR</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span>student@university.edu</span>
                    <span style={{ color: 'var(--green)' }}>STUDENT</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '6px 0' }}>
                    <span>admin@university.edu</span>
                    <span style={{ color: 'var(--violet)' }}>ADMIN</span>
                  </div>
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>System Execution Logs</h3>
            <div style={{ height: '200px', background: '#040810', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', overflowY: 'auto', color: 'var(--text-secondary)' }}>
              <div>[System] Server initialization verified on port 3000.</div>
              <div>[Database] Connected successfully to SQLite database.</div>
              <div>[Auth] JWT Session Secret verified.</div>
              <div>[Prisma] Loaded models User, Course, Exam, ExamVersion, AgentTask, Feedback.</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
