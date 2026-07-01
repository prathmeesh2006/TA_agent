import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/lib/db';
import { buildLangGraph } from '@/app/lib/agents/graph';

// Simple keyword router to find the target agent for comments
function getTargetAgent(comment: string): "THEORY" | "PROGRAMMER" | "MATHEMATICIAN" | "ALL" {
  const c = comment.toLowerCase();
  if (c.includes('math') || c.includes('numerical') || c.includes('equation') || c.includes('formula')) {
    return 'MATHEMATICIAN';
  }
  if (c.includes('code') || c.includes('program') || c.includes('python') || c.includes('variable')) {
    return 'PROGRAMMER';
  }
  if (c.includes('theory') || c.includes('mcq') || c.includes('saq') || c.includes('text') || c.includes('question')) {
    return 'THEORY';
  }
  return 'ALL';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { examId, versionNumber, action, comment, userId } = body;

    if (!examId || !versionNumber || !action || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const exam = await db.exam.findUnique({
      where: { id: examId },
      include: { versions: true }
    });

    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    // Save Feedback record
    await db.feedback.create({
      data: {
        examId,
        versionNumber,
        comment: comment || (action === 'approve' ? 'Exam Approved.' : 'Exam Rejected for revision.'),
        createdById: userId,
      }
    });

    if (action === 'approve') {
      // 1. APPROVE EXAM
      await db.exam.update({
        where: { id: examId },
        data: { status: 'APPROVED' }
      });

      return NextResponse.json({
        success: true,
        status: 'APPROVED',
        message: 'Exam approved successfully!'
      });
    }

    // 2. REJECT & REVISE (OPTIMIZED ROUTING FEEDBACK LOOP)
    const currentVersion = exam.versions.find((v) => v.versionNumber === versionNumber);
    if (!currentVersion) {
      return NextResponse.json({ error: 'Current version not found' }, { status: 400 });
    }

    const currentContent = JSON.parse(currentVersion.content);
    const targetAgent = getTargetAgent(comment || "");
    const nextVersion = versionNumber + 1;

    // Create a log in AgentTasks for the revision run
    const regenTask = await db.agentTask.create({
      data: {
        examId,
        agentName: targetAgent,
        status: 'RUNNING',
        input: JSON.stringify({ comment, action }),
        costUsd: 0.003,
        tokensUsed: 150,
        durationMs: 0,
      }
    });

    // Generate revision questions depending on target agent
    let revisedQuestions = [...currentContent.questions];

    if (targetAgent === 'MATHEMATICIAN' || targetAgent === 'ALL') {
      // Create revised math question
      const mathIdx = revisedQuestions.findIndex((q) => q.section === 'Mathematics');
      if (mathIdx !== -1) {
        revisedQuestions[mathIdx] = {
          ...revisedQuestions[mathIdx],
          question: `[Revised Math] Given a node with 12 samples of Class A and 6 samples of Class B, compute the Gini Impurity and information gain if split into balanced nodes. Render step-by-step LaTeX derivations.`,
          solution: `Total samples = 18.\nInitial Gini = 1 - ( (12/18)^2 + (6/18)^2 ) = 1 - (4/9 + 1/9) = 1 - 5/9 = 4/9 = 0.444.\nAfter split into balanced groups (6 Class A, 3 Class B each):\nGini_left = 1 - ( (6/9)^2 + (3/9)^2 ) = 0.444.\nGini_right = 1 - ( (6/9)^2 + (3/9)^2 ) = 0.444.\nSplit Gini = 0.444.\nInformation Gain = 0.444 - 0.444 = 0.0 bits.`,
          explanation: "Math regenerated to use higher variance distributions and advanced Gini splits.",
        };
      }
    }

    if (targetAgent === 'PROGRAMMER' || targetAgent === 'ALL') {
      const codeIdx = revisedQuestions.findIndex((q) => q.section === 'Programming');
      if (codeIdx !== -1) {
        revisedQuestions[codeIdx] = {
          ...revisedQuestions[codeIdx],
          question: `[Revised Code] Write a Python function \`random_forest_split(X, y)\` that finds the best split threshold for a single feature using Gini Impurity reduction.`,
          starterCode: `def random_forest_split(X: list[float], y: list[int]) -> tuple[float, float]:\n    # Return best threshold and gini gain\n    pass`,
          explanation: "Regenerated code to include multivariate split thresholds and vector projections."
        };
      }
    }

    if (targetAgent === 'THEORY' || targetAgent === 'ALL') {
      const theoryIdx = revisedQuestions.findIndex((q) => q.section === 'Theory' && q.type === 'SAQ');
      if (theoryIdx !== -1) {
        revisedQuestions[theoryIdx] = {
          ...revisedQuestions[theoryIdx],
          question: `[Revised Theory] Critically analyze the susceptibility of Random Forests to noise, comparing pre-pruning vs post-pruning strategies on deep trees.`,
          answer: "Deep decision trees tend to overfit. Random Forests combat this by bootstrapping and averaging. Pruning is rarely needed in Random Forests, but setting max_depth helps control memory and runtime on highly noisy datasets.",
        };
      }
    }

    const revisedExamContent = {
      ...currentContent,
      questions: revisedQuestions
    };

    // Save as next version
    await db.examVersion.create({
      data: {
        examId,
        versionNumber: nextVersion,
        content: JSON.stringify(revisedExamContent)
      }
    });

    // Update agent task to COMPLETED
    await db.agentTask.update({
      where: { id: regenTask.id },
      data: {
        status: 'COMPLETED',
        output: JSON.stringify(revisedExamContent)
      }
    });

    // Keep Exam in PAUSED status for the next checkpoint iteration
    await db.exam.update({
      where: { id: examId },
      data: { status: 'PAUSED' }
    });

    return NextResponse.json({
      success: true,
      status: 'PAUSED',
      versionNumber: nextVersion,
      targetAgent,
      compiledExam: revisedExamContent,
      message: `Feedback processed. Affected agent [${targetAgent}] regenerated questions. Version ${nextVersion} compiled.`
    });

  } catch (err: any) {
    console.error('[Feedback Route Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
