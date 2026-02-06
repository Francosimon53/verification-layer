'use client';

import { useState } from 'react';

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: 'What is VLayer and how does it work?',
      answer:
        'VLayer is a static code analysis tool that scans your codebase for HIPAA compliance violations. It detects 88+ patterns including PHI exposure, weak encryption, SQL injection, and missing audit logging. Unlike general security scanners, VLayer is specifically built for healthcare applications.',
    },
    {
      question: 'Do I need to be a security expert to use VLayer?',
      answer:
        'No! VLayer is built for developers. Each finding includes a clear explanation, HIPAA reference, and actionable fix recommendations. Our auto-fix engine can remediate 13 types of issues automatically with one command.',
    },
    {
      question: 'How is VLayer different from Snyk or SonarQube?',
      answer:
        'Snyk and SonarQube are general security scanners. VLayer is purpose-built for HIPAA compliance with healthcare-specific rules. We detect PHI exposure patterns (SSN, MRN, DOB), HIPAA audit requirements, and healthcare-specific encryption standards that general tools miss.',
    },
    {
      question: 'Can VLayer integrate with my CI/CD pipeline?',
      answer:
        'Yes! VLayer has native support for GitHub Actions, GitLab CI, Jenkins, and CircleCI. You can block commits with critical violations, generate compliance reports, and track scores over time. We provide pre-built workflows and documentation.',
    },
    {
      question: 'What programming languages are supported?',
      answer:
        'VLayer currently supports JavaScript, TypeScript, Python, and Go. We detect framework-specific patterns for Next.js, React, Express, FastAPI, and more. Language support is expanding based on community feedback.',
    },
    {
      question: 'Is my code sent to VLayer servers?',
      answer:
        'No. VLayer runs 100% locally on your machine or CI/CD environment. Your code never leaves your infrastructure. The Pro and Enterprise plans include an optional web dashboard that stores scan metadata (scores, file counts) but not your actual source code.',
    },
    {
      question: 'What kind of support do you offer?',
      answer:
        'Free plan: Community support via GitHub. Starter: Email support (24h response). Pro: Priority email support (4h response). Enterprise: Dedicated Slack channel, SLA guarantee, and personalized onboarding.',
    },
    {
      question: 'Can I try before buying?',
      answer:
        'Absolutely! The Free plan is free forever with no credit card required. Paid plans include a 14-day money-back guarantee. We also offer personalized demos for Enterprise customers.',
    },
  ];

  return (
    <section className="bg-[#0F172A] py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Frequently Asked Questions</h2>
          <p className="text-xl text-slate-400">Everything you need to know</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between"
              >
                <span className="text-lg font-semibold text-white">{faq.question}</span>
                <svg
                  className={`w-5 h-5 text-slate-400 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-slate-400 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
