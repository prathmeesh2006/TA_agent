import { StateGraph, Annotation } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TavilySearch } from "@langchain/tavily";

// Define the State Annotation
export const ExamStateAnnotation = Annotation.Root({
  prompt: Annotation<string>(),
  courseId: Annotation<string>(),
  totalMarks: Annotation<number>(),
  difficulty: Annotation<string>(),
  questionTypes: Annotation<string[]>(),
  units: Annotation<number[]>(),
  status: Annotation<string>(),
  logs: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  costUsd: Annotation<number>({
    reducer: (x, y) => x + y,
    default: () => 0,
  }),
  tokensUsed: Annotation<number>({
    reducer: (x, y) => x + y,
    default: () => 0,
  }),
  theoryOutput: Annotation<any>(),
  programmerOutput: Annotation<any>(),
  mathematicianOutput: Annotation<any>(),
  compiledExam: Annotation<any>(),
  feedbackComment: Annotation<string>(),
  targetRegenAgent: Annotation<string>(),
});

type ExamState = typeof ExamStateAnnotation.State;

// Helper to determine if we should run in live mode
function isLiveMode(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

// Helper to get Gemini client or null
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return new ChatGoogleGenerativeAI({
    apiKey,
    modelName: "gemini-1.5-flash",
    maxOutputTokens: 2048,
  });
}

// Tavily search helper
async function performSearch(query: string): Promise<string> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) return "No web search API key configured.";
  try {
    const search = new TavilySearch({ maxResults: 2, tavilyApiKey: tavilyKey });
    const results = await search.invoke({ query });
    // Ensure we return a string
    if (typeof results === "string") return results;
    return JSON.stringify(results);
  } catch (err: any) {
    return `Search failed: ${err.message}`;
  }
}

// Mock question banks for fallbacks
const MOCK_BANK: Record<string, any> = {
  "Random Forests": {
    theory: [
      {
        id: "q-theory-1",
        type: "MCQ",
        marks: 5,
        question: "Which of the following is true about Gini Impurity in Random Forests?",
        options: [
          "It measures the level of disorder or impurity in a node.",
          "A higher Gini impurity represents a more homogenous node.",
          "It is mathematically equivalent to Entropy.",
          "It ranges from -1 to 1."
        ],
        answer: "It measures the level of disorder or impurity in a node.",
        explanation: "Gini Impurity measures how often a randomly chosen element from the set would be incorrectly labeled. A Gini index of 0 indicates complete purity."
      },
      {
        id: "q-theory-2",
        type: "SAQ",
        marks: 10,
        question: "Explain the difference between Bagging and Boosting in ensemble learning, and describe why Random Forests utilize Bagging.",
        answer: "Bagging (Bootstrap Aggregating) trains models in parallel using bootstrap samples and averages their outputs to reduce variance. Boosting trains models sequentially, focusing on errors made by previous models. Random Forests use bagging to build independent decision trees; this reduces overfitting and makes the forest robust against noise.",
        explanation: "Bagging reduces variance via averaging, whereas Boosting reduces bias sequentially."
      }
    ],
    code: [
      {
        id: "q-code-1",
        type: "Programming",
        marks: 15,
        question: "Write a Python function `gini_impurity(labels: list[int]) -> float` that calculates the Gini Impurity of a list of classification labels.",
        starterCode: "def gini_impurity(labels: list[int]) -> float:\n    # Write your code here\n    pass",
        sampleInput: "[1, 1, 0, 0, 1, 0]",
        sampleOutput: "0.5",
        testcases: [
          { input: "[1, 1, 1]", output: "0.0" },
          { input: "[0, 1]", output: "0.5" }
        ],
        solution: "def gini_impurity(labels):\n    if not labels: return 0.0\n    length = len(labels)\n    counts = {}\n    for l in labels:\n        counts[l] = counts.get(l, 0) + 1\n    impurity = 1.0\n    for c in counts.values():\n        p = c / length\n        impurity -= p ** 2\n    return round(impurity, 3)",
        complexity: "O(N) time complexity, O(K) space complexity where K is unique labels."
      }
    ],
    math: [
      {
        id: "q-math-1",
        type: "Math",
        marks: 20,
        question: "Suppose a node contains 8 samples of Class A and 4 samples of Class B. Calculate the entropy of this node. Provide the mathematical formulation and compute the step-by-step result.",
        formulation: "Entropy(S) = -\\sum_{i=1}^c p_i \\log_2 p_i",
        solution: "Total samples N = 12.\nProbability of Class A: p_A = 8/12 = 2/3.\nProbability of Class B: p_B = 4/12 = 1/3.\nEntropy = - (2/3 * log2(2/3) + 1/3 * log2(1/3)) = - (2/3 * -0.585 + 1/3 * -1.585) = 0.390 + 0.528 = 0.918 bits.",
        explanation: "Apply standard information entropy equation."
      }
    ]
  },
  "Compiler Design": {
    theory: [
      {
        id: "q-theory-1",
        type: "MCQ",
        marks: 5,
        question: "Which phase of the compiler reads character stream and groups them into meaningful sequences called lexemes?",
        options: [
          "Lexical Analysis",
          "Syntax Analysis",
          "Semantic Analysis",
          "Intermediate Code Generation"
        ],
        answer: "Lexical Analysis",
        explanation: "Lexical analysis (scanning) breaks down the source character stream into tokens."
      },
      {
        id: "q-theory-2",
        type: "SAQ",
        marks: 10,
        question: "Explain the difference between LL(1) and LR(1) parsers. Focus on derivation style and parsing directions.",
        answer: "LL(1) is a Top-Down parser that constructs leftmost derivations using 1 lookahead token. LR(1) is a Bottom-Up parser that constructs rightmost derivations in reverse, using 1 lookahead token. LR(1) is more powerful and handles a larger class of grammars compared to LL(1).",
        explanation: "LL = Left-to-right, Leftmost derivation; LR = Left-to-right, Rightmost derivation in reverse."
      }
    ],
    code: [
      {
        id: "q-code-1",
        type: "Programming",
        marks: 15,
        question: "Write a Python function `tokenize_identifier(text: str) -> bool` that verifies if a string is a valid identifier under variable naming rules (must start with a letter or underscore, followed by letters, underscores, or digits).",
        starterCode: "def tokenize_identifier(text: str) -> bool:\n    # Write code here\n    pass",
        sampleInput: "'variable_123'",
        sampleOutput: "True",
        testcases: [
          { input: "'123var'", output: "False" },
          { input: "'_myVar'", output: "True" }
        ],
        solution: "import re\ndef tokenize_identifier(text):\n    return bool(re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', text))",
        complexity: "O(N) where N is length of string."
      }
    ],
    math: [
      {
        id: "q-math-1",
        type: "Math",
        marks: 20,
        question: "Given the grammar rules:\n1. $E \\rightarrow T E'$\n2. $E' \\rightarrow + T E' \\mid \\epsilon$\n3. $T \\rightarrow F T'$\n4. $T' \\rightarrow * F T' \\mid \\epsilon$\n5. $F \\rightarrow ( E ) \\mid \\text{id}$\nCompute the $\\text{FIRST}$ and $\\text{FOLLOW}$ sets for non-terminals $E, E', T, T', F$. Render step-by-step LaTeX derivations.",
        formulation: "\\text{FIRST}(E) = \\text{FIRST}(T) = \\text{FIRST}(F) = \\{ (, \\text{id} \\}",
        solution: "\\text{FIRST}(E) = \\{ (, \\text{id} \\}\n\\text{FIRST}(E') = \\{ +, \\epsilon \\}\n\\text{FIRST}(T) = \\{ (, \\text{id} \\}\n\\text{FIRST}(T') = \\{ *, \\epsilon \\}\n\\text{FIRST}(F) = \\{ (, \\text{id} \\}\n\\text{FOLLOW}(E) = \\{ \\$, ) \\}\n\\text{FOLLOW}(E') = \\{ \\$, ) \\}\n\\text{FOLLOW}(T) = \\{ +, \\$, ) \\}\n\\text{FOLLOW}(T') = \\{ +, \\$, ) \\}\n\\text{FOLLOW}(F) = \\{ *, +, \\$, ) \\}",
        explanation: "Derive using FIRST and FOLLOW mathematical rules for LL(1) grammars."
      }
    ]
  }
};

function extractJsonArray(text: string): any[] | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_e) {
    try {
      const cleaned = trimmed.replace(/```json|```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (_e2) {
      try {
        const match = trimmed.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        if (match) {
          return JSON.parse(match[0]);
        }
      } catch (_e3) {
        console.error("Regex JSON array extraction failed.");
      }
    }
  }
  return null;
}

function getMockData(topic: string, type: "theory" | "code" | "math") {
  const normalized = Object.keys(MOCK_BANK).find(
    (k) => k.toLowerCase() === topic.toLowerCase() || topic.toLowerCase().includes(k.toLowerCase())
  );
  if (normalized) {
    return MOCK_BANK[normalized][type];
  }

  // Generate dynamic fallback mock data on the fly using the prompt topic!
  if (type === "theory") {
    return [
      {
        id: `q-theory-${Date.now()}-mcq`,
        type: "MCQ",
        marks: 5,
        question: `Which of the following describes a key design concept or mechanism in ${topic}?`,
        options: [
          `Optimizing state patterns and computational bounds in ${topic}.`,
          `Minimizing compile-time constants for traditional pipelines.`,
          `Enforcing strict static scoping partitions in standard memory nodes.`,
          `None of the above.`
        ],
        answer: `Optimizing state patterns and computational bounds in ${topic}.`,
        explanation: `Under conventional design rules, managing ${topic} structures requires careful optimization of data flow and partition constraints.`
      },
      {
        id: `q-theory-${Date.now()}-saq`,
        type: "SAQ",
        marks: 10,
        question: `Explain the fundamental components of ${topic} and discuss its importance in modern distributed architectures.`,
        answer: `${topic} provides the logical framework to automate compiler/execution steps, manage concurrent variables, and optimize resource mappings. In industrial applications, this prevents computational latency bottlenecks and optimizes data consistency.`,
        explanation: `Focus on highlighting key scaling properties and logical workflows.`
      }
    ];
  } else if (type === "code") {
    const safeName = topic.toLowerCase().replace(/[^a-z0-9]/g, "_");
    return [
      {
        id: `q-code-${Date.now()}`,
        type: "Programming",
        marks: 15,
        question: `Write a Python function \`execute_${safeName}(data)\` that accepts a dataset list of input elements, aggregates them according to ${topic} rules, and returns the compiled metrics dictionary.`,
        starterCode: `def execute_${safeName}(data: list) -> dict:\n    # Write your algorithmic solution for ${topic} here\n    pass`,
        sampleInput: "[5, 10, 15]",
        sampleOutput: `{"status": "success", "topic": "${topic}"}`,
        testcases: [
          { input: "[1, 2]", output: `{"status": "success", "topic": "${topic}"}` }
        ],
        solution: `def execute_${safeName}(data):\n    return {"status": "success", "topic": "${topic}", "data_count": len(data)}`,
        complexity: "O(N) time complexity where N is the length of data."
      }
    ];
  } else {
    return [
      {
        id: `q-math-${Date.now()}`,
        type: "Math",
        marks: 20,
        question: `Given a set of nodes operating under the rules of ${topic}, compute the boundary limits of efficiency if split into two balanced sub-clusters. Render LaTeX derivations.`,
        formulation: `\\text{Limit}_{x \\rightarrow \\infty} \\frac{f(x)}{g(x)} = \\text{Gain}(${topic})`,
        solution: `Derive mathematically. Let the cost limit function be defined as limit of ratio f(x)/g(x) = x^2 / 2x^2. The asymptotic gain ratio limit evaluates to 0.5.`,
        explanation: `Evaluate boundary conditions using limit convergence.`
      }
    ];
  }
}

// 1. Manager Node
async function managerNode(state: ExamState) {
  const logs = [
    `[Manager] Analyzing exam requirements for course ID "${state.courseId}"...`,
    `[Manager] Parameters -> Marks: ${state.totalMarks}, Difficulty: ${state.difficulty}, Units: [${(state.units || [1]).join(", ")}]`,
    `[Manager] Routing parallel execution branches (Fan-Out)...`
  ];

  const activeAgents = [];
  if (state.questionTypes.includes("MCQ") || state.questionTypes.includes("SAQ")) activeAgents.push("Agent A (Theory)");
  if (state.questionTypes.includes("Programming")) activeAgents.push("Agent B (Programmer)");
  if (state.questionTypes.includes("Math") || state.questionTypes.includes("Numerical")) activeAgents.push("Agent C (Math)");

  logs.push(`[Manager] Routed to: ${activeAgents.join(", ")}.`);

  return {
    status: "generating",
    logs,
    costUsd: 0.005,
    tokensUsed: 250,
  };
}

// 2. Combined Parallel Agents Node (Theory + Programmer + Mathematician via Promise.all)
async function parallelAgentsNode(state: ExamState) {
  const logs: string[] = [];
  let totalCost = 0;
  let totalTokens = 0;

  // --- Theory Writer ---
  async function runTheory() {
    const tLogs: string[] = [`[Theory Writer] Drafting Theory section (MCQ & SAQ) for "${state.prompt}"...`];
    let outputData = null;
    let tokens = 100;
    let cost = 0.002;

    if (isLiveMode()) {
      const gemini = getGeminiClient();
      if (gemini) {
        try {
          tLogs.push("[Theory Writer] Connecting to Google Gemini API...");
          const searchContext = await performSearch(`${state.prompt} exam questions MCQs SAQs`);
          tLogs.push("[Theory Writer] Web Search results retrieved for context mapping.");

          const response = await gemini.invoke([
            {
              role: "system",
              content: `You are Agent A: The Concept Writer. Your goal is to draft exam questions in JSON format.
              Return a JSON array containing:
              1. One MCQ question (5 marks) with 'question', 'options' (array of 4), 'answer', and 'explanation'.
              2. One SAQ question (10 marks) with 'question', 'answer', and 'explanation'.
              
              Use the following context if helpful: ${searchContext}
              Return ONLY the valid JSON array. No markdown wraps.`
            },
            {
              role: "user",
              content: `Topic: ${state.prompt}. Difficulty: ${state.difficulty}. Units: [${(state.units || [1]).join(", ")}].`
            }
          ]);

          const contentStr = response.content.toString().trim();
          outputData = extractJsonArray(contentStr);
          tokens += (response as any).usage_metadata?.totalTokens || 500;
          cost += (tokens * 0.00002);
        } catch (err: any) {
          tLogs.push(`[Theory Writer] Live API call failed: ${err.message}. Falling back to default question bank.`);
        }
      }
    }

    if (!outputData) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      outputData = getMockData(state.prompt, "theory");
      tLogs.push("[Theory Writer] Completed theory drafting from local library.");
    }

    tLogs.push(`[Theory Writer] Section Drafted. Total marks: 15.`);
    return { tLogs, cost, tokens, outputData };
  }

  // --- Programmer ---
  async function runProgrammer() {
    const pLogs: string[] = [`[Programmer] Creating programming assignment questions for "${state.prompt}"...`];
    let outputData = null;
    let tokens = 120;
    let cost = 0.003;

    if (isLiveMode()) {
      const gemini = getGeminiClient();
      if (gemini) {
        try {
          pLogs.push("[Programmer] Calling Gemini to construct code question...");
          const response = await gemini.invoke([
            {
              role: "system",
              content: `You are Agent B: The Programmer. Write an algorithmic coding question in Python.
              Return a JSON array containing:
              1. One programming question (15 marks) with:
                 - 'question' (problem text)
                 - 'starterCode'
                 - 'sampleInput'
                 - 'sampleOutput'
                 - 'testcases' (array of 2 {input, output})
                 - 'solution' (full implementation)
                 - 'complexity' (e.g. O(N))
              Return ONLY the valid JSON array. No markdown wraps.`
            },
            {
              role: "user",
              content: `Topic: ${state.prompt}. Difficulty: ${state.difficulty}.`
            }
          ]);

          const contentStr = response.content.toString().trim();
          outputData = extractJsonArray(contentStr);
          tokens += (response as any).usage_metadata?.totalTokens || 600;
          cost += (tokens * 0.00002);
        } catch (err: any) {
          pLogs.push(`[Programmer] Live API call failed: ${err.message}. Using default programming bank.`);
        }
      }
    }

    if (!outputData) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      outputData = getMockData(state.prompt, "code");
      pLogs.push("[Programmer] Completed coding problem generation.");
    }

    pLogs.push(`[Programmer] Section Drafted. Total marks: 15.`);
    return { pLogs, cost, tokens, outputData };
  }

  // --- Mathematician ---
  async function runMathematician() {
    const mLogs: string[] = [`[Mathematician] Generating numerical math tasks using LaTeX math representation...`];
    let outputData = null;
    let tokens = 150;
    let cost = 0.004;

    if (isLiveMode()) {
      const gemini = getGeminiClient();
      if (gemini) {
        try {
          mLogs.push("[Mathematician] Calling Gemini to construct LaTeX numerical problem...");
          const response = await gemini.invoke([
            {
              role: "system",
              content: `You are Agent C: The Mathematician. Formulate a math problem requiring calculations. Use LaTeX formatting.
              Return a JSON array containing:
              1. One numerical question (20 marks) with:
                 - 'question'
                 - 'formulation' (LaTeX equation)
                 - 'solution' (step-by-step derivation)
                 - 'explanation'
              Return ONLY the valid JSON array. No markdown wraps.`
            },
            {
              role: "user",
              content: `Topic: ${state.prompt}. Difficulty: ${state.difficulty}.`
            }
          ]);

          const contentStr = response.content.toString().trim();
          outputData = extractJsonArray(contentStr);
          tokens += (response as any).usage_metadata?.totalTokens || 550;
          cost += (tokens * 0.00002);
        } catch (err: any) {
          mLogs.push(`[Mathematician] Live API call failed: ${err.message}. Using default math bank.`);
        }
      }
    }

    if (!outputData) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      outputData = getMockData(state.prompt, "math");
      mLogs.push("[Mathematician] Completed LaTeX equations drafting.");
    }

    mLogs.push(`[Mathematician] Section Drafted. Total marks: 20.`);
    return { mLogs, cost, tokens, outputData };
  }

  // Run all three in parallel
  logs.push("[Parallel Agents] Executing Theory Writer, Programmer, and Mathematician concurrently...");
  const [theoryResult, programmerResult, mathResult] = await Promise.all([
    runTheory(),
    runProgrammer(),
    runMathematician(),
  ]);

  // Collect all logs and costs
  logs.push(...theoryResult.tLogs, ...programmerResult.pLogs, ...mathResult.mLogs);
  totalCost = theoryResult.cost + programmerResult.cost + mathResult.cost;
  totalTokens = theoryResult.tokens + programmerResult.tokens + mathResult.tokens;

  return {
    logs,
    costUsd: totalCost,
    tokensUsed: totalTokens,
    theoryOutput: theoryResult.outputData,
    programmerOutput: programmerResult.outputData,
    mathematicianOutput: mathResult.outputData,
  };
}

// 3. Editor Node (Compiler & Fan-in)
async function editorNode(state: ExamState) {
  const logs = [
    `[Editor] Aggregating sections from worker nodes (Fan-In)...`,
    `[Editor] Section A (Theory): Received ${state.theoryOutput ? "OK" : "Empty"}`,
    `[Editor] Section B (Programming): Received ${state.programmerOutput ? "OK" : "Empty"}`,
    `[Editor] Section C (Mathematician): Received ${state.mathematicianOutput ? "OK" : "Empty"}`,
    `[Editor] Adjusting mark distribution to match target marks: ${state.totalMarks}...`
  ];

  await new Promise((resolve) => setTimeout(resolve, 600));

  const questions: any[] = [];
  let currentTotal = 0;

  // Gather questions
  if (state.theoryOutput) {
    const arr = Array.isArray(state.theoryOutput) ? state.theoryOutput : [state.theoryOutput];
    arr.forEach((q: any) => {
      questions.push({ ...q, section: "Theory" });
      currentTotal += q.marks || 10;
    });
  }

  if (state.programmerOutput) {
    const arr = Array.isArray(state.programmerOutput) ? state.programmerOutput : [state.programmerOutput];
    arr.forEach((q: any) => {
      questions.push({ ...q, section: "Programming" });
      currentTotal += q.marks || 15;
    });
  }

  if (state.mathematicianOutput) {
    const arr = Array.isArray(state.mathematicianOutput) ? state.mathematicianOutput : [state.mathematicianOutput];
    arr.forEach((q: any) => {
      questions.push({ ...q, section: "Mathematics" });
      currentTotal += q.marks || 20;
    });
  }

  // Adjust marks to hit target exactly
  const difference = state.totalMarks - currentTotal;
  if (difference !== 0 && questions.length > 0) {
    logs.push(`[Editor] Adjusting question marks (current total: ${currentTotal}, target: ${state.totalMarks})`);
    questions[questions.length - 1].marks = Math.max(2, (questions[questions.length - 1].marks || 5) + difference);
  }

  const compiledExam = {
    title: `Exam on ${state.prompt}`,
    difficulty: state.difficulty,
    totalMarks: state.totalMarks,
    durationMin: 90,
    questions: questions.map((q, idx) => ({ ...q, number: idx + 1 }))
  };

  logs.push(`[Editor] Exam compilation successful. System entering Human-in-the-Loop checkpoint...`);

  return {
    status: "paused",
    logs,
    costUsd: 0.002,
    tokensUsed: 150,
    compiledExam
  };
}

// Build the LangGraph — linear: manager -> parallelAgents -> editor -> end
export function buildLangGraph() {
  const workflow = new StateGraph(ExamStateAnnotation)
    .addNode("manager", managerNode)
    .addNode("parallel_agents", parallelAgentsNode)
    .addNode("editor", editorNode);

  // Linear flow: each node runs sequentially, but parallel work is done inside parallelAgentsNode
  workflow.addEdge("__start__", "manager");
  workflow.addEdge("manager", "parallel_agents");
  workflow.addEdge("parallel_agents", "editor");
  workflow.addEdge("editor", "__end__");

  return workflow.compile();
}
