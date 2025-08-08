// Debug storage service for production environment
// Uses Redis/KV for persistence instead of database to avoid Prisma issues

export interface DebugStep {
  analysisId: string;
  stepName: string;
  stepOrder: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  input?: any;
  output?: any;
  errorInfo?: any;
  debugData?: any;
}

export class DebugStorage {
  private static instance: DebugStorage;
  private storage = new Map<string, DebugStep[]>(); // Temporary fallback
  
  private constructor() {}
  
  static getInstance(): DebugStorage {
    if (!DebugStorage.instance) {
      DebugStorage.instance = new DebugStorage();
    }
    return DebugStorage.instance;
  }
  
  async initializeSteps(analysisId: string, stepNames: string[]): Promise<void> {
    try {
      const stepsData: DebugStep[] = stepNames.map((name, index) => ({
        analysisId,
        stepName: name,
        stepOrder: index + 1,
        status: 'pending' as const,
        startedAt: undefined,
        completedAt: undefined,
        duration: undefined,
        input: undefined,
        output: undefined,
        errorInfo: undefined,
        debugData: undefined
      }));
      
      // Try to use KV/Redis if available, otherwise use in-memory
      if (typeof process !== 'undefined' && process.env.KV_REST_API_URL) {
        await this.setKV(`debug:${analysisId}`, JSON.stringify(stepsData));
      } else {
        this.storage.set(analysisId, stepsData);
      }
    } catch (error) {
      console.warn('Could not initialize debug steps:', error);
      // Fallback to in-memory
      const stepsData: DebugStep[] = stepNames.map((name, index) => ({
        analysisId,
        stepName: name,
        stepOrder: index + 1,
        status: 'pending' as const,
        startedAt: undefined,
        completedAt: undefined,
        duration: undefined,
        input: undefined,
        output: undefined,
        errorInfo: undefined,
        debugData: undefined
      }));
      this.storage.set(analysisId, stepsData);
    }
  }
  
  async getSteps(analysisId: string): Promise<DebugStep[]> {
    try {
      // Try to get from KV/Redis first
      if (typeof process !== 'undefined' && process.env.KV_REST_API_URL) {
        const data = await this.getKV(`debug:${analysisId}`);
        if (data) {
          return JSON.parse(data);
        }
      }
      
      // Fallback to in-memory
      return this.storage.get(analysisId) || [];
    } catch (error) {
      console.warn('Could not retrieve debug steps:', error);
      return this.storage.get(analysisId) || [];
    }
  }
  
  async updateStep(analysisId: string, stepName: string, updates: Partial<DebugStep>): Promise<void> {
    try {
      const steps = await this.getSteps(analysisId);
      const stepIndex = steps.findIndex(s => s.stepName === stepName);
      
      if (stepIndex >= 0) {
        steps[stepIndex] = { ...steps[stepIndex], ...updates };
        
        // Save back to storage
        if (typeof process !== 'undefined' && process.env.KV_REST_API_URL) {
          await this.setKV(`debug:${analysisId}`, JSON.stringify(steps));
        } else {
          this.storage.set(analysisId, steps);
        }
      }
    } catch (error) {
      console.warn('Could not update debug step:', error);
      // Try in-memory fallback
      const steps = this.storage.get(analysisId) || [];
      const stepIndex = steps.findIndex(s => s.stepName === stepName);
      if (stepIndex >= 0) {
        steps[stepIndex] = { ...steps[stepIndex], ...updates };
        this.storage.set(analysisId, steps);
      }
    }
  }
  
  private async getKV(key: string): Promise<string | null> {
    try {
      const response = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
        headers: {
          'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.result;
      }
    } catch (error) {
      console.warn('KV get failed:', error);
    }
    return null;
  }
  
  private async setKV(key: string, value: string): Promise<void> {
    try {
      await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      });
    } catch (error) {
      console.warn('KV set failed:', error);
    }
  }
}