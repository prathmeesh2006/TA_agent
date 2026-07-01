import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { buildLangGraph } from '@/app/lib/agents/graph';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, totalMarks, difficulty, questionTypes, units, courseId, userId } = body;

    if (!prompt || !totalMarks || !courseId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Create Exam in Database with status GENERATING
    const exam = await db.exam.create({
      data: {
        title: `Exam on ${prompt}`,
        totalMarks: Number(totalMarks),
        durationMin: 90,
        courseId,
        createdById: userId,
        status: 'GENERATING'
      }
    });

    // Capture examId in local variable to avoid React state closure issues
    const examId = exam.id;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendEvent('status', {
            nodeId: 'manager',
            status: 'RUNNING',
            logs: ['Initializing Multi-Agent Workflow...'],
            costUsd: 0,
            tokensUsed: 0,
            examId
          });

          // Compile the LangGraph
          const graph = buildLangGraph();

          // Prepare state parameters
          const initialState = {
            prompt,
            courseId,
            totalMarks: Number(totalMarks),
            difficulty: difficulty || 'Medium',
            questionTypes: questionTypes || ['MCQ', 'SAQ', 'Programming', 'Math'],
            units: units || [1, 2, 3],
            status: 'routing',
            logs: [],
            costUsd: 0.0,
            tokensUsed: 0,
          };

          let finalState: any = {
            ...initialState,
            logs: []
          };

          // Stream the Graph steps
          const eventStream = await graph.stream(initialState);

          for await (const event of eventStream) {
            const nodeName = Object.keys(event)[0];
            const nodeOutput = event[nodeName];

            // Record this agent task in DB
            try {
              await db.agentTask.create({
                data: {
                  examId,
                  agentName: nodeName.toUpperCase(),
                  status: 'COMPLETED',
                  input: JSON.stringify({ prompt, difficulty, totalMarks }),
                  output: JSON.stringify(nodeOutput),
                  costUsd: nodeOutput.costUsd || 0,
                  tokensUsed: nodeOutput.tokensUsed || 0,
                  durationMs: 600,
                }
              });
            } catch (dbErr: any) {
              console.error('[Generate Route DB Task Error]:', dbErr.message);
            }

            // Merge updates
            finalState = {
              ...finalState,
              ...nodeOutput,
              logs: [...(finalState.logs || []), ...(nodeOutput.logs || [])],
              costUsd: (finalState.costUsd || 0) + (nodeOutput.costUsd || 0),
              tokensUsed: (finalState.tokensUsed || 0) + (nodeOutput.tokensUsed || 0),
            };

            // Stream state updates to frontend
            sendEvent('status', {
              nodeId: nodeName,
              status: 'COMPLETED',
              logs: nodeOutput.logs || [],
              costUsd: finalState.costUsd,
              tokensUsed: finalState.tokensUsed,
              theoryOutput: finalState.theoryOutput,
              programmerOutput: finalState.programmerOutput,
              mathematicianOutput: finalState.mathematicianOutput,
              compiledExam: finalState.compiledExam,
              examId
            });

            // Pause slightly for frontend visual pacing
            await new Promise((resolve) => setTimeout(resolve, 800));
          }

          // 2. Save final compiled result as Exam Version 1
          if (finalState.compiledExam) {
            await db.examVersion.create({
              data: {
                examId,
                versionNumber: 1,
                content: JSON.stringify(finalState.compiledExam)
              }
            });

            // Update exam status to PAUSED (awaiting human check)
            await db.exam.update({
              where: { id: examId },
              data: { status: 'PAUSED' }
            });

            sendEvent('status', {
              nodeId: 'checkpoint',
              status: 'PAUSED',
              logs: ['System PAUSED. Human-in-the-Loop checkpoint reached.', 'Awaiting Professor Feedback...'],
              costUsd: finalState.costUsd,
              tokensUsed: finalState.tokensUsed,
              compiledExam: finalState.compiledExam,
              examId
            });
          } else {
            throw new Error('Exam compilation failed - Editor did not return completed exam structure.');
          }

          controller.close();
        } catch (error: any) {
          console.error('[Generate Route Stream Error]:', error);
          // Safely attempt to mark exam as failed
          try {
            await db.exam.update({
              where: { id: examId },
              data: { status: 'FAILED' }
            });
          } catch (updateErr: any) {
            console.error('[Generate Route Status Update Error]:', updateErr.message);
          }
          sendEvent('error', { message: error.message || 'Workflow Execution Interrupted' });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (err: any) {
    console.error('[Generate Route Root Error]:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
