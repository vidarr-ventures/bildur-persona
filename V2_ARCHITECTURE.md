# V2 Backend Architecture Design

## Core Principles
- **Clean Architecture**: Separation of concerns with distinct layers
- **Event-Driven**: Asynchronous processing with event handlers
- **Modular Services**: Independent, testable service modules
- **Type-Safe**: Full TypeScript with strict typing
- **Scalable**: Built for horizontal scaling

## Architecture Layers

### 1. API Layer (`/api/v2/`)
- **REST endpoints** for external communication
- **Request validation** with Zod schemas
- **Error handling** with standardized responses
- **Rate limiting** and security middleware

### 2. Service Layer (`/services/`)
- **AnalysisService**: Orchestrates persona analysis workflow
- **WebScrapingService**: Handles website content extraction
- **AIAnalysisService**: Manages OpenAI interactions
- **ReportService**: Generates and formats persona reports
- **NotificationService**: Handles email/webhook notifications

### 3. Repository Layer (`/repositories/`)
- **AnalysisRepository**: Database operations for analysis records
- **ReportRepository**: Manages report storage and retrieval
- **Abstract base classes** for consistent data access patterns

### 4. Domain Layer (`/domain/`)
- **Entities**: Core business objects (Analysis, Report, Website)
- **Value Objects**: Immutable data structures
- **Domain Events**: Business event definitions
- **Interfaces**: Service and repository contracts

### 5. Infrastructure Layer (`/infrastructure/`)
- **Database**: Prisma ORM with PostgreSQL
- **External APIs**: OpenAI, web scraping tools
- **Event Bus**: In-memory event handling
- **Logging**: Structured logging with context

## Data Flow

```
Frontend → API Layer → Service Layer → Repository Layer → Database
                    ↓
                Event Bus → Background Processors → External APIs
```

## New Database Schema

### Core Tables
- `analyses` - Main analysis records with metadata
- `analysis_steps` - Individual processing steps and status
- `website_content` - Cached scraped content
- `ai_responses` - Raw AI analysis responses
- `reports` - Final formatted reports
- `processing_events` - Audit trail of all processing events

### Features
- **Event sourcing** for full audit trail
- **Step-by-step tracking** for progress monitoring
- **Content caching** for performance
- **Retry mechanisms** for failed operations

## API Design

### V2 Endpoints
- `POST /api/v2/analysis/start` - Initialize new analysis
- `GET /api/v2/analysis/{id}` - Get analysis status/progress
- `GET /api/v2/analysis/{id}/report` - Retrieve final report
- `POST /api/v2/analysis/{id}/regenerate` - Regenerate report
- `GET /api/v2/health` - System health check

### Response Format
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    requestId: string;
    timestamp: string;
    version: string;
  };
}
```

## Processing Pipeline

### Step-by-Step Analysis
1. **Validation** - Verify URL and parameters
2. **Content Extraction** - Scrape website content
3. **Content Processing** - Clean and structure data
4. **AI Analysis** - Multiple AI calls for different insights
5. **Report Generation** - Compile final persona report
6. **Quality Check** - Validate report completeness
7. **Finalization** - Mark as complete and notify

### Error Handling
- **Automatic retries** with exponential backoff
- **Fallback strategies** for each processing step
- **Detailed error tracking** for debugging
- **User-friendly error messages** for frontend

## Security & Performance

### Security
- Input validation with Zod
- SQL injection prevention with Prisma
- Rate limiting per IP/user
- API key validation for sensitive operations

### Performance
- Content caching to avoid re-scraping
- Parallel processing where possible
- Database indexes for fast queries
- Connection pooling for scalability

## Monitoring & Observability

### Logging
- Structured JSON logs
- Request/response tracking
- Error context preservation
- Performance metrics

### Health Checks
- Database connectivity
- External API availability
- Processing queue health
- Memory/CPU usage

This architecture provides a solid foundation for the V2 rebuild while maintaining compatibility with the existing frontend UI.