// V2 Repository - Built from scratch

import { PrismaClient } from '@prisma/client';
import { Report, ReportEntity, ReportType, PersonaData, CustomerQuote } from '../domain/entities/Report';

export interface IReportRepository {
  create(report: Report): Promise<ReportEntity>;
  findById(id: string): Promise<ReportEntity | null>;
  findByAnalysisId(analysisId: string): Promise<ReportEntity[]>;
  findLatestByAnalysisId(analysisId: string): Promise<ReportEntity | null>;
  update(id: string, updates: Partial<ReportEntity>): Promise<ReportEntity>;
  delete(id: string): Promise<void>;
}

export class ReportRepository implements IReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(report: Report): Promise<ReportEntity> {
    const created = await this.prisma.report.create({
      data: {
        id: report.id,
        analysisId: report.analysisId,
        version: report.version,
        reportType: report.reportType as any,
        demographics: report.personaData.demographics,
        painPoints: report.personaData.painPoints,
        motivations: report.personaData.motivations,
        behaviors: report.personaData.behaviors,
        channels: report.personaData.preferredChannels,
        values: report.personaData.values,
        objections: report.personaData.objections,
        decisionFactors: report.personaData.decisionFactors,
        quotes: report.quotes,
        fullReport: report.fullReport,
        summary: report.summary,
        generatedAt: report.generatedAt,
      }
    });

    return this.mapToEntity(created);
  }

  async findById(id: string): Promise<ReportEntity | null> {
    const report = await this.prisma.report.findUnique({
      where: { id }
    });

    return report ? this.mapToEntity(report) : null;
  }

  async findByAnalysisId(analysisId: string): Promise<ReportEntity[]> {
    const reports = await this.prisma.report.findMany({
      where: { analysisId },
      orderBy: { version: 'desc' }
    });

    return reports.map(this.mapToEntity);
  }

  async findLatestByAnalysisId(analysisId: string): Promise<ReportEntity | null> {
    const report = await this.prisma.report.findFirst({
      where: { analysisId },
      orderBy: { version: 'desc' }
    });

    return report ? this.mapToEntity(report) : null;
  }

  async update(id: string, updates: Partial<ReportEntity>): Promise<ReportEntity> {
    const updateData: any = {};
    
    if (updates.personaData) {
      updateData.demographics = updates.personaData.demographics;
      updateData.painPoints = updates.personaData.painPoints;
      updateData.motivations = updates.personaData.motivations;
      updateData.behaviors = updates.personaData.behaviors;
      updateData.channels = updates.personaData.preferredChannels;
      updateData.values = updates.personaData.values;
      updateData.objections = updates.personaData.objections;
      updateData.decisionFactors = updates.personaData.decisionFactors;
    }
    
    if (updates.quotes) updateData.quotes = updates.quotes;
    if (updates.fullReport) updateData.fullReport = updates.fullReport;
    if (updates.summary) updateData.summary = updates.summary;

    const updated = await this.prisma.report.update({
      where: { id },
      data: updateData
    });

    return this.mapToEntity(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.report.delete({
      where: { id }
    });
  }

  private mapToEntity(data: any): ReportEntity {
    const personaData: PersonaData = {
      demographics: data.demographics || {},
      painPoints: data.painPoints || [],
      motivations: data.motivations || [],
      behaviors: data.behaviors || [],
      preferredChannels: data.channels || [],
      values: data.values || [],
      objections: data.objections || [],
      decisionFactors: data.decisionFactors || [],
    };

    return {
      id: data.id,
      analysisId: data.analysisId,
      version: data.version,
      reportType: data.reportType as ReportType,
      personaData,
      quotes: data.quotes as CustomerQuote[] || [],
      fullReport: data.fullReport || '',
      summary: data.summary || '',
      generatedAt: data.generatedAt,
    };
  }
}