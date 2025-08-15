'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Cog, Zap, Users, Globe, MessageSquare, CheckCircle, Clock } from "lucide-react"

const processingSteps = [
  { id: 1, label: "Analyzing Website", icon: Globe, description: "Extracting content and structure" },
  { id: 2, label: "Mining Reviews", icon: MessageSquare, description: "Gathering customer feedback" },
  { id: 3, label: "Processing Competitors", icon: Users, description: "Comparing market positioning" },
  { id: 4, label: "Generating Insights", icon: Zap, description: "Creating customer personas" },
  { id: 5, label: "Finalizing Report", icon: CheckCircle, description: "Compiling results" }
];

export default function ProcessingPage() {
  const router = useRouter();
  const params = useParams();
  const analysisId = params.analysisId as string;
  
  const [currentStep, setCurrentStep] = useState(1);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Check if we have results in sessionStorage (should redirect immediately)
    const cachedResults = sessionStorage.getItem(`analysis-${analysisId}`);
    if (cachedResults) {
      // If we have results, redirect immediately
      router.push(`/results/${analysisId}`);
      return;
    }

    // Poll the API to check analysis status
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/v2/analysis/${analysisId}/status`);
        const result = await response.json();
        
        if (result.success && result.data?.status === 'COMPLETED') {
          // Analysis is complete, redirect to results
          router.push(`/results/${analysisId}`);
          return true;
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
      return false;
    };

    // Check immediately
    checkStatus();

    // Then poll every 2 seconds
    const statusInterval = setInterval(async () => {
      const isComplete = await checkStatus();
      if (isComplete) {
        clearInterval(statusInterval);
        clearInterval(progressTimer);
      }
    }, 2000);

    // Visual progress animation (purely cosmetic)
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return 95; // Cap at 95% until actually complete
        return prev + Math.random() * 2;
      });
    }, 800);

    // Update current step based on progress
    const stepTimer = setInterval(() => {
      setCurrentStep(prev => {
        const newStep = Math.min(Math.floor(progress / 20) + 1, 5);
        return newStep;
      });
    }, 1000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(progressTimer);
      clearInterval(stepTimer);
    };
  }, [analysisId, router, progress]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-3xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-emerald-500/10"></div>
      
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center mb-12">
          <Badge className="mb-6 bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30 transition-all duration-300">
            <Zap className="w-3 h-3 mr-1" />
            AI Analysis In Progress
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight font-display">
            Analyzing Your{" "}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Customers
            </span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Our AI is working hard to understand your customers and generate detailed personas. 
            This usually takes 2-3 minutes.
          </p>

          {/* Animated Gears */}
          <div className="flex justify-center items-center space-x-8 mb-8">
            <Cog className="w-12 h-12 text-purple-400 animate-spin" style={{ animationDuration: '3s' }} />
            <Cog className="w-8 h-8 text-pink-400 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
            <Cog className="w-16 h-16 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
            <Cog className="w-10 h-10 text-emerald-400 animate-spin" style={{ animationDuration: '2.5s', animationDirection: 'reverse' }} />
          </div>

          {/* Time and Progress */}
          <div className="flex justify-center items-center space-x-6 mb-8">
            <div className="flex items-center text-gray-400">
              <Clock className="w-5 h-5 mr-2" />
              <span className="font-mono text-lg">{formatTime(elapsedTime)}</span>
            </div>
            <div className="text-gray-400">•</div>
            <div className="text-gray-400">
              Step {currentStep} of {processingSteps.length}
            </div>
          </div>
        </div>

        {/* Progress Card */}
        <Card className="bg-white/5 backdrop-blur-md border-white/20 shadow-2xl ring-1 ring-white/10 mb-8">
          <CardContent className="p-8">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-semibold">Overall Progress</span>
                <span className="text-purple-300 font-mono">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3 bg-white/10" />
            </div>

            {/* Current Step Info */}
            <div className="text-center">
              <div className="inline-flex items-center bg-purple-500/20 px-4 py-2 rounded-full border border-purple-500/30 mb-4">
                {processingSteps[currentStep - 1] && (
                  <>
                    {(() => {
                      const CurrentIcon = processingSteps[currentStep - 1].icon;
                      return <CurrentIcon className="w-5 h-5 text-purple-300 mr-2" />;
                    })()}
                    <span className="text-purple-300 font-medium">
                      {processingSteps[currentStep - 1].label}
                    </span>
                  </>
                )}
              </div>
              <p className="text-gray-400">
                {processingSteps[currentStep - 1]?.description}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Processing Steps */}
        <Card className="bg-white/5 backdrop-blur-md border-white/20 shadow-2xl ring-1 ring-white/10">
          <CardContent className="p-8">
            <h3 className="text-xl font-bold text-white mb-6 font-display">Processing Steps</h3>
            <div className="space-y-4">
              {processingSteps.map((step) => {
                const StepIcon = step.icon;
                const isCompleted = step.id < currentStep;
                const isCurrent = step.id === currentStep;
                const isUpcoming = step.id > currentStep;

                return (
                  <div 
                    key={step.id}
                    className={`flex items-center space-x-4 p-4 rounded-lg transition-all duration-500 ${
                      isCompleted ? 'bg-green-500/20 border border-green-500/30' : 
                      isCurrent ? 'bg-purple-500/20 border border-purple-500/30' : 
                      'bg-white/5 border border-white/10'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-green-500' : 
                      isCurrent ? 'bg-purple-500' : 
                      'bg-gray-600'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <StepIcon className={`w-5 h-5 ${isCurrent ? 'text-white animate-pulse' : 'text-gray-300'}`} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium ${
                        isCompleted ? 'text-green-300' : 
                        isCurrent ? 'text-purple-300' : 
                        'text-gray-400'
                      }`}>
                        {step.label}
                      </div>
                      <div className={`text-sm ${
                        isCompleted ? 'text-green-400' : 
                        isCurrent ? 'text-gray-300' : 
                        'text-gray-500'
                      }`}>
                        {step.description}
                      </div>
                    </div>
                    {isCompleted && (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}