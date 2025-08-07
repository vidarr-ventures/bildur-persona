'use client';

import Link from 'next/link';
import { ArrowRight, Globe, MessageSquare, Brain } from 'lucide-react';
import Section from '@/components/brainwave/Section';
import Button from '@/components/brainwave/Button';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-n-8 text-n-1">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 border-b border-n-6 lg:bg-n-8/90 lg:backdrop-blur-sm">
        <div className="flex items-center px-5 lg:px-7.5 xl:px-10 max-lg:py-4">
          <Link href="/" className="block w-[12rem] xl:mr-8">
            <span className="h2 font-bold text-n-1">
              Persona<span className="text-color-1">AI</span>
            </span>
          </Link>
          
          <nav className="hidden fixed top-[5rem] left-0 right-0 bottom-0 bg-n-8 lg:static lg:flex lg:mx-auto lg:bg-transparent">
            <div className="relative z-2 flex flex-col items-center justify-center m-auto lg:flex-row">
              <Link href="/analyze" className="block relative font-code text-2xl uppercase text-n-1 transition-colors hover:text-color-1 lg:text-xs lg:font-semibold lg:leading-5 lg:hover:text-color-1 xl:px-12">
                Start Analysis
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <Section
        className="-mt-[5.25rem] pt-[12.25rem] lg:pt-[15.25rem] xl:pt-[20.25rem]"
        crosses
        crossesOffset="lg:translate-y-[5.25rem]"
        customPaddings
      >
        <div className="container relative">
          <div className="relative z-1 max-w-[62rem] mx-auto text-center mb-[3.875rem] md:mb-20 lg:mb-[6.25rem]">
            <h1 className="h1 mb-6">
              Understand Your{" "}
              <span className="inline-block relative">
                Customers
                <svg
                  className="absolute top-full left-0 w-full xl:-mt-2"
                  width="624"
                  height="28"
                  viewBox="0 0 624 28"
                  fill="none"
                >
                  <path
                    d="M1 14.5C204.5 -4.5 621 -4.5 623 14.5"
                    stroke="url(#gradient)"
                    strokeWidth="2"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#89F9E8" />
                      <stop offset="100%" stopColor="#FACB7B" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>
            <p className="body-1 max-w-3xl mx-auto mb-6 text-n-2 lg:mb-8">
              Generate detailed customer personas using AI analysis of website content. 
              Discover what your customers really want with our completely rebuilt V2 system.
            </p>
            <Button href="/analyze" white>
              Start Free Analysis
            </Button>
          </div>

          {/* Feature Icons */}
          <div className="relative max-w-[50rem] mx-auto mb-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center space-y-4 p-6 border border-n-6 rounded-2xl bg-n-7">
                <div className="w-12 h-12 bg-gradient-to-r from-color-1 to-color-5 rounded-lg flex items-center justify-center">
                  <Globe className="h-6 w-6 text-n-1" />
                </div>
                <span className="font-semibold text-n-1">Website Analysis</span>
                <span className="text-sm text-n-3 text-center">Extract customer insights from your website content and messaging</span>
              </div>
              <div className="flex flex-col items-center space-y-4 p-6 border border-n-6 rounded-2xl bg-n-7">
                <div className="w-12 h-12 bg-gradient-to-r from-color-2 to-color-4 rounded-lg flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-n-1" />
                </div>
                <span className="font-semibold text-n-1">Quote Extraction</span>
                <span className="text-sm text-n-3 text-center">Find and analyze customer testimonials and feedback</span>
              </div>
              <div className="flex flex-col items-center space-y-4 p-6 border border-n-6 rounded-2xl bg-n-7">
                <div className="w-12 h-12 bg-gradient-to-r from-color-4 to-color-6 rounded-lg flex items-center justify-center">
                  <Brain className="h-6 w-6 text-n-1" />
                </div>
                <span className="font-semibold text-n-1">AI Persona Generation</span>
                <span className="text-sm text-n-3 text-center">Generate detailed customer personas with V2 AI analysis</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* CTA Section */}
      <Section className="pt-[4rem] pb-[8rem]">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="h2 mb-4">
              Ready to Understand Your Customers?
            </h2>
            <p className="body-1 text-n-3 mb-8">
              Our V2 system uses advanced AI to analyze any website and generate comprehensive customer personas in minutes.
            </p>
            <Button href="/analyze" white>
              Start Analysis Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}