# Auto TA Agent — Enterprise-Grade Specifications

This document outlines the complete architectural design, requirements, and systems engineering specifications for the Auto TA Agent multi-agent platform.

---

## 1. User Stories

### Persona: Professor (Primary Creator & Reviewer)
* **As a** Professor of Compiler Design,
* **I want to** configure parameters (marks, duration, difficulty, Bloom levels, topics) and generate a balanced exam,
* **So that** I don't spend hours writing questions, editing LaTeX, drafting solutions, and formatting PDFs.
* **Acceptance Criteria**:
  * Ability to specify marks distribution (e.g. 50 marks divided into MCQs, SAQs, and Programming).
  * Access to a Human-in-the-Loop review screen to approve/reject draft questions.
  * Direct comments on rejected questions to trigger localized regeneration without affecting approved parts of the exam.

### Persona: Student (End User & Learner)
* **As a** Computer Science Student,
* **I want to** practice customized mock tests created by the platform and chat with an interactive AI Tutor about my weak areas,
* **So that** I can prepare effectively for my actual university exams.
* **Acceptance Criteria**:
  * Access to a smart quiz portal with instant semantic grading and step-by-step math rendering (LaTeX).
  * Interaction with an AI Tutor that recalls past doubts and suggests customized flashcards.

### Persona: Administrator (Platform Supervisor)
* **As a** University System Administrator,
* **I want to** monitor API token consumption, credits usage, and set rate limits on LLM calls,
* **So that** the university doesn't exceed its budget or hit rate limit barriers on LLM providers.
* **Acceptance Criteria**:
  * Dashboard displaying total courses, questions generated, and cumulative costs.
  * Detailed execution logs with latency, token count, and cost breakdown per agent.

---

## 2. Functional Requirements

### Core Module Breakdown
1. **Authentication & Authorization**: OAuth2 integrations (Google, GitHub, SAML University login) with Role-Based Access Control (RBAC): Admin, Professor, Student.
2. **Course & Topic Management**: Hierarchical mapping: Course ➔ Units ➔ Topics ➔ Learning Outcomes ➔ Bloom's Levels.
3. **Agent Pipeline Orchestration (LangGraph)**:
   * **The Manager**: Router agent that parses input prompts, estimates costs/tokens, and branches execution.
   * **Parallel Generators (Theory Writer, Programmer, Mathematician, Diagram Agent)**: Asynchronously compile questions in their respective domains.
   * **rubric Agent**: Generates marking schemes mapped to Course Outcomes (CO) and Program Outcomes (PO).
   * **Reference Agent**: Connects to digital libraries to supply textbook citations.
   * **Fact Checker & Plagiarism Checker**: Performs hallucination validation and compares similarity percentages against prior databases.
   * **Formatting Agent**: Compiles Markdown/LaTeX to output PDF, docx, or canvas formats.
4. **Human Review Loop**: A graphical interface rendering generated exams. Supports inline editing, specific node regeneration commands, and final export commands.
5. **Personalized Student Portal**: Contains Quiz Engine, AI Tutor chat sidebar, customized flashcards, and weak topic analytics dashboards.

---

## 3. Edge Cases & Mitigation Strategies

* **LLM Token-Limit Exceeded**: For deep units or extensive books, inputs might exceed contexts. Mitigated by using LangChain's Document Transformers and semantic chunking (ChromaDB vectors).
* **Hallucinated Math Equations**: Latex symbols mismatch. Mitigated by running outputs through a Python SymPy parser validation tool node in LangGraph before aggregation.
* **Non-Compiling Programming Code**: The Programmer agent may write code with syntax errors. Mitigated by executing the code inside a secure sandbox container against sample test cases during the compile phase. If output fails, the agent retries with error logs.
* **High Plagiarism/Similarity %**: If a generated question is too close to a previous exam question, the Plagiarism Checker flags it and automatically routes it back to the Concept Writer with a prompt modifier directive to rewrite it.

---

## 4. Failure Recovery & Resiliency

* **Orchestration Fault Tolerance**: Individual agent node crashes are caught by LangGraph's error boundary. A Celery queue manages retries (up to 3 times with exponential backoff).
* **LLM Failures / Outages**: If the primary LLM (e.g. Claude 3.5 Sonnet) fails due to rate limits or connection dropouts, the router falls back to a secondary model (e.g. Gemini 1.5 Pro) and then to a self-hosted local model (Llama-3-70B on internal cluster).
* **State Preservation**: LangGraph state is stored in a Redis backend memory store, enabling the system to resume interrupted workflows from the exact point of failure without wasting tokens.

---

## 5. API Contracts

### Generate Exam Node
* **Endpoint**: `POST /api/v1/exams/generate`
* **Request Header**: `Authorization: Bearer <JWT>`
* **Request Body**:
  ```json
  {
    "course_id": "cs-401-compiler",
    "total_marks": 50,
    "difficulty": "Medium",
    "duration_minutes": 90,
    "question_types": ["MCQ", "SAQ", "Programming"],
    "units": [1, 2, 3]
  }
  ```
* **Response Body**:
  ```json
  {
    "execution_id": "exec-abc-123",
    "status": "queued",
    "estimated_cost_usd": 0.18,
    "estimated_duration_seconds": 45
  }
  ```

### Live Stream Status
* **Endpoint**: `GET /api/v1/exams/stream/<execution_id>`
* **Protocol**: Server-Sent Events (SSE)
* **Events**:
  * `status`: Current running agent node, execution logs, and completed outputs.
  * `token`: Real-time markdown tokens of compile text.

---

## 6. Database Schema (PostgreSQL)

```sql
-- Core users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'PROFESSOR', 'STUDENT')),
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Course mappings
CREATE TABLE courses (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    professor_id UUID REFERENCES users(id)
);

-- Exams
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR(100) REFERENCES courses(id),
    title VARCHAR(255) NOT NULL,
    total_marks INT NOT NULL,
    duration_min INT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Exam versions (for rollback & auditing)
CREATE TABLE exam_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id),
    version_number INT NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(exam_id, version_number)
);

-- Individual agent tasks for execution tracking
CREATE TABLE agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id),
    agent_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
    input JSONB,
    output JSONB,
    cost_usd NUMERIC(10, 6) DEFAULT 0.0,
    tokens_used INT DEFAULT 0,
    duration_ms INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 7. UI Wireframes & Layout Specs

### Professor Console (Layout Grid)
* **Header**: Navigation Bar, Command Search trigger (`Ctrl+K`), profile settings.
* **Sidebar**: Tab options to quickly filter workspace view (Dashboard, Courses, Editor, Analytics, Database).
* **Main Area (Grid)**:
  * **Top Row**: 3 Metric cards displaying total courses (with growth trends), exams compiled, and outstanding reviews.
  * **Center Area**: Live flow diagrams mapping out active nodes and compiler queues.
  * **Bottom Row**: Table list showing active templates, compilation stats, and publish timelines.

### Live Agent Visualizer (React Flow canvas)
* Displays structured nodes as floating blocks. The color indicates status (Blue: Active, Green: Complete, Orange: Paused/Feedback, Red: Failed).
* Glowing lines between nodes represent routing. A mini-window on the side streams raw console outputs from the currently active agent.

---

## 8. Component Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                     AppLayout                           │
│  ┌──────────────┐ ┌──────────────────────────────────┐  │
│  │  Navbar      │ │  CommandPalette                  │  │
│  └──────────────┘ └──────────────────────────────────┘  │
│  ┌──────────────┐ ┌──────────────────────────────────┐  │
│  │  Sidebar     │ │  MainViewContainer               │  │
│  │              │ │  ┌────────────────────────────┐  │  │
│  │              │ │  │   ProfessorDashboard       │  │  │
│  │              │ │  │   ┌────────────────────┐   │  │  │
│  │              │ │  │   │  StatsGrid         │   │  │  │
│  │              │ │  │   └────────────────────┘   │  │  │
│  │              │ │  │   ┌────────────────────┐   │  │  │
│  │              │ │  │   │  WorkflowCanvas    │   │  │  │
│  │              │ │  │   │  (React Flow Graph)│   │  │  │
│  │              │ │  │   └────────────────────┘   │  │  │
│  │              │ │  │   ┌────────────────────┐   │  │  │
│  │              │ │  │   │  ExamListTable     │   │  │  │
│  │              │ │  │   └────────────────────┘   │  │  │
│  │              │ │  └────────────────────────────┘  │  │
│  │              │ │  ┌────────────────────────────┐  │  │
│  │              │ │  │   PromptPlayground         │  │  │
│  │              │ │  │   ┌──────────┐ ┌──────────┐│  │  │
│  │              │ │  │   │ConfigForm│ │LiveDiff  ││  │  │
│  │              │ │  │   └──────────┘ └──────────┘│  │  │
│  │              │ │  └────────────────────────────┘  │  │
│  └──────────────┘ └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 9. State Management (Zustand Stores)

### Exam Builder Store (`useExamStore`)
* **State**:
  * `subject`: Current course subject (string)
  * `marks`: Target exam total marks (number)
  * `difficulty`: Mode parameter (string)
  * `questionTypes`: Active question formats (array of strings)
  * `currentVersion`: Loaded exam configuration revision (number)
* **Actions**:
  * `setSubject(sub)`: Changes subject target.
  * `toggleQuestionType(type)`: Inserts/removes formats and recalculates default marks distributions.
  * `resetBuilder()`: Flushes builder states.

### Workflow Execution Store (`useWorkflowStore`)
* **State**:
  * `activeExecutionId`: Current execution identifier.
  * `activeNode`: The running agent node (string).
  * `nodeProgress`: Map of node statuses (`RUNNING`, `COMPLETED`, `PAUSED`).
  * `liveLogs`: Real-time streaming logs (array of strings).
* **Actions**:
  * `startWorkflow(prompt)`: Begins pipeline trigger and opens Server-Sent Event stream.
  * `updateNodeStatus(nodeId, status)`: Alters graph visual states.
  * `appendLog(line)`: Enqueues console strings.

---

## 10. Security & Threat Mitigation

* **User Authentication**: Handled using standard OAuth2 mechanisms. All JWT tokens are signed using HS256/RS256 algorithms and expire after 1 hour, requesting automated refresh token rotations.
* **Data Isolation**: Multi-tenant database architecture where all queries partition data by `professor_id` or `course_id` (Row-Level Security in PostgreSQL).
* **Sandboxed Code Run**: To verify programming task outputs safely, code from students or generated by the Programmer Agent is ran inside a gVisor-hardened Docker container with resource constraints:
  * Timeout: 2 seconds max
  * Memory: 64MB max
  * Network: Disabled entirely.
* **LLM Input Sanitization**: Prompt injections are parsed by a dedicated Guardrails layer before reaching the LangGraph compiler.

---

## 11. Rate Limiting & Queue Orchestration

* **User Rate Limits**: Implemented via FastAPI middleware backed by Redis:
  * Web requests: 60 queries/minute per user ID.
  * AI Exam Generations: 5 requests/hour per Professor account.
* **LLM Provider Backoffs**: The system intercepts `429 Too Many Requests` codes from OpenAI/Anthropic APIs, implementing token bucket counters in Redis and automatically pacing agent calls using exponential backoffs and jitter.

---

## 12. Testing Strategy

### Unit Tests
* **Agents Testing**: PyTest tests verifying agent response formats:
  * Validate JSON output formats match required schemas (Pydantic models).
  * Test fact-checking functions on mocked hallucinated text.
* **Frontend Components**: Vitest/React Testing Library checking layout states and command palette triggers.

### Integration Tests
* **LangGraph Integration**: Tests routing rules under failure events (e.g. mathematician node returns invalid JSON; verify manager triggers a retry).
* **End-to-End Tests**: Playwright scripts that automate a full user flow: Login ➔ Create Course ➔ Build Prompt ➔ Run Agents ➔ Edit & Approve Draft.

---

## 13. Deployment Architecture

* **Frontend**: Next.js deployed on Vercel. Global caching via Vercel Edge Network.
* **Backend API**: FastAPI application packaged into a Docker container and deployed on Google Cloud Run with autoscaling (0 to 10 instances based on concurrency).
* **Background Processors**: Celery workers running on Google Kubernetes Engine (GKE) to execute the LangGraph multi-agent pipelines.
* **Services**:
  * **Database**: Managed PostgreSQL (Supabase/Google Cloud SQL).
  * **Cache/Broker**: Managed Redis Cluster.
  * **Storage**: Amazon S3 / Google Cloud Storage for rendered PDF exam artifacts.

---

## 14. Monitoring, Metrics & Observability

* **Observability Agent**: OpenTelemetry collector reporting logs and spans from GKE.
* **LLM Tracing**: **LangSmith** integrates directly into the LangGraph pipelines, tracking inputs, outputs, tokens, step durations, and logical routing choices.
* **Dashboards**: Grafana dashboards tracking:
  * Active Celery worker counts.
  * HTTP status codes (2xx, 4xx, 5xx) on FastAPI endpoints.
  * API latency charts.
  * Monthly API credit consumption metrics.

---

## 15. Performance Optimizations

* **Parallel Agent Execution (Fan-Out)**: By splitting tasks, the Mathematician, Theory Writer, and Programmer agents run concurrently in separate Celery tasks, reducing compilation time by up to 60%.
* **Semantic Caching**: Common question types, instructions, and syllabus references are semantically hashed and cached using Redis, preventing repetitive API hits on identical inputs.
* **Streaming Rendering**: Rather than rendering the complete document at once, compiled text streams live via Server-Sent Events (SSE) directly to the Professor Dashboard.
* **Frontend Optimization**: Heavy components (e.g. Monaco Editor, React Flow canvas) are lazy-loaded dynamically, resulting in an initial bundle size reduction of 45%.
