// V2 Repository - Built from scratch

import { PrismaClient } from '@prisma/client';
import { Analysis, AnalysisEntity, AnalysisStatus, CreateAnalysisRequest } from '../domain/entities/Analysis';

export interface IAnalysisRepository {
  create(analysis: Analysis): Promise<AnalysisEntity>;
  findById(id: string): Promise<AnalysisEntity | null>;
  update(id: string, updates: Partial<AnalysisEntity>): Promise<AnalysisEntity>;
  delete(id: string): Promise<void>;
  findByStatus(status: AnalysisStatus): Promise<AnalysisEntity[]>;
  findRecent(limit?: number): Promise<AnalysisEntity[]>;
}

export class AnalysisRepository implements IAnalysisRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(analysis: Analysis): Promise<AnalysisEntity> {
    const created = await this.prisma.analysis.create({
      data: {
        id: analysis.id,
        targetUrl: analysis.targetUrl,
        userEmail: analysis.userEmail,
        status: analysis.status as any,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
        startedAt: analysis.startedAt,
        completedAt: analysis.completedAt,
      }
    });

    return this.mapToEntity(created);
  }

  async findById(id: string): Promise<AnalysisEntity | null> {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id }
    });

    return analysis ? this.mapToEntity(analysis) : null;
  }

  async update(id: string, updates: Partial<AnalysisEntity>): Promise<AnalysisEntity> {
    const updated = await this.prisma.analysis.update({
      where: { id },
      data: {
        ...updates,
        status: updates.status as any,
        updatedAt: new Date()
      }
    });

    return this.mapToEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.analysis.delete({
      where: { id }
    });
  }

  async findByStatus(status: AnalysisStatus): Promise<AnalysisEntity[]> {
    const analyses = await this.prisma.analysis.findMany({
      where: { status: status as any },
      orderBy: { createdAt: 'desc' }
    });

    return analyses.map(this.mapToEntity);
  }

  async findRecent(limit: number = 10): Promise<AnalysisEntity[]> {
    const analyses = await this.prisma.analysis.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    return analyses.map(this.mapToEntity);
  }

  private mapToEntity(data: any): AnalysisEntity {
    return {
      id: data.id,
      targetUrl: data.targetUrl,
      userEmail: data.userEmail,
      status: data.status as AnalysisStatus,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
    };
  }
}