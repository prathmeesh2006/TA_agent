import React from 'react';
import './globals.css';
import { Providers } from './providers';
import ParticlesBackground from './components/ParticlesBackground';

export const metadata = {
  title: 'Auto TA Agent — AI Powered Multi-Agent Teaching Assistant Platform',
  description: 'Auto TA Agent is an enterprise-grade AI Teaching Assistant Platform powered by LangGraph multi-agent orchestration, Human-in-the-Loop review, parallel execution, and a stunning futuristic dashboard.',
  keywords: 'AI Teaching Assistant, Multi-Agent, LangGraph, Auto TA, Education AI, Exam Generation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <Providers>
          <ParticlesBackground />
          <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
        </Providers>
      </body>
    </html>
  );
}
