'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export function Hero() {
  const [terminalText, setTerminalText] = useState('');
  const fullCommand = '$ vlayer scan ./my-healthcare-app';
  const output = `
Scanning for HIPAA compliance issues...
✓ Scanned 342 files in 1.8s

Found 8 issues:
  2 Critical  PHI exposure in console.log
  3 High      SQL injection vulnerabilities
  2 Medium    Weak encryption (MD5)
  1 Low       Missing audit logging

Compliance Score: 92/100 (Grade A)

Run 'vlayer fix --auto' to remediate 5 issues automatically.
  `;

  useEffect(() => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < fullCommand.length) {
        setTerminalText(fullCommand.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setTerminalText(fullCommand + output);
        }, 500);
      }
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#0A1628] via-[#0F172A] to-[#1E293B] pt-32 pb-20">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20"></div>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-3xl"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Now with AI-powered detection
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight">
              HIPAA Compliance Scanner for{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Healthcare Developers
              </span>
            </h1>

            <p className="text-xl text-slate-400 leading-relaxed">
              Detect, fix, and monitor HIPAA violations in your code. From commit to production.
              Built for healthcare startups shipping fast with AI-generated code.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/30 transition-all text-center"
              >
                Start Free Scan →
              </Link>
              <button className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg border border-slate-700 transition-all">
                Book a Demo
              </button>
            </div>

            <div className="flex items-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Free forever
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                No credit card
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                88+ rules
              </div>
            </div>
          </div>

          {/* Right: Terminal */}
          <div className="relative">
            <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
              {/* Terminal header */}
              <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="text-sm text-slate-400 ml-4">terminal</span>
              </div>

              {/* Terminal content */}
              <div className="p-6 font-mono text-sm">
                <pre className="text-emerald-400 whitespace-pre-wrap">
                  {terminalText}
                  <span className="animate-pulse">▊</span>
                </pre>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -top-4 -right-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg px-4 py-2 shadow-lg">
              <div className="text-white font-bold text-sm">92/100</div>
              <div className="text-white/80 text-xs">Grade A</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
