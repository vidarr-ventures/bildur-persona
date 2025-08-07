// V2 Domain Entity - Built from scratch

export enum AnalysisStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING', 
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface AnalysisEntity {
  readonly id: string;
  readonly targetUrl: string;
  readonly userEmail?: string;
  readonly status: AnalysisStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
}

export interface CreateAnalysisRequest {
  targetUrl: string;
  userEmail?: string;
}

export interface AnalysisProgress {
  analysisId: string;
  status: AnalysisStatus;
  currentStep?: string;
  completedSteps: number;
  totalSteps: number;
  estimatedTimeRemaining?: number;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export class Analysis {
  constructor(
    public readonly id: string,
    public readonly targetUrl: string,
    public readonly userEmail?: string,
    public status: AnalysisStatus = AnalysisStatus.PENDING,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public startedAt?: Date,
    public completedAt?: Date
  ) {
    this.validateUrl(targetUrl);
    this.validateEmail(userEmail);
  }

  static create(request: CreateAnalysisRequest): Analysis {
    return new Analysis(
      generateId(),
      request.targetUrl,
      request.userEmail
    );
  }

  start(): void {
    if (this.status !== AnalysisStatus.PENDING) {
      throw new Error(`Cannot start analysis in ${this.status} status`);
    }
    
    this.status = AnalysisStatus.PROCESSING;
    this.startedAt = new Date();
    this.updatedAt = new Date();
  }

  complete(): void {
    if (this.status !== AnalysisStatus.PROCESSING) {
      throw new Error(`Cannot complete analysis in ${this.status} status`);
    }
    
    this.status = AnalysisStatus.COMPLETED;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  fail(error: string): void {
    this.status = AnalysisStatus.FAILED;
    this.updatedAt = new Date();
    // Error details would be stored in separate error entity
  }

  cancel(): void {
    if (this.status === AnalysisStatus.COMPLETED) {
      throw new Error('Cannot cancel completed analysis');
    }
    
    this.status = AnalysisStatus.CANCELLED;
    this.updatedAt = new Date();
  }

  getDuration(): number | null {
    if (!this.startedAt) return null;
    
    const endTime = this.completedAt || new Date();
    return endTime.getTime() - this.startedAt.getTime();
  }

  private validateUrl(url: string): void {
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }
  }

  private validateEmail(email?: string): void {
    if (email && !isValidEmail(email)) {
      throw new Error('Invalid email format');
    }
  }
}

// Utility functions
function generateId(): string {
  return `anal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}