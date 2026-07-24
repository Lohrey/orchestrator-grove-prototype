import type { ZodError } from 'zod';
import { AssistantResponseSchema } from './assistant-schema.js';
import { DslAssignmentListSchema, DslProgramSchema } from './dsl-schema.js';
import { KnowledgePackSourceSchema } from './knowledge-pack-schema.js';

export { AssistantResponseSchema } from './assistant-schema.js';
export { DslAssignmentListSchema, DslAssignmentSchema, DslAssigneeSchema, DslProgramSchema, DslStepSchema, MAX_DSL_STEPS } from './dsl-schema.js';
export { KnowledgePackSourceSchema } from './knowledge-pack-schema.js';

export type ValidationDetail = {
  code: string;
  field: string;
  path: Array<string | number>;
  message: string;
};

export function zodErrorDetails(error: ZodError): ValidationDetail[] {
  return error.issues.map(issue => ({
    code: `schema_${issue.code}`,
    field: issue.path.join('.') || 'root',
    path: issue.path.map(segment => typeof segment === 'symbol' ? String(segment) : segment),
    message: issue.message
  }));
}

function parseOrThrow<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false; error: ZodError } }, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const error = new Error(`${label}: ${parsed.error.issues.map(issue => `${issue.path.join('.') || 'root'} ${issue.message}`).join('; ')}`) as Error & { validationDetails?: ValidationDetail[] };
  error.validationDetails = zodErrorDetails(parsed.error);
  throw error;
}

export function parseAssistantResponsePayload(value: unknown) {
  return parseOrThrow(AssistantResponseSchema, value, 'assistant response failed schema validation');
}

export function parseDslAssignmentList(value: unknown) {
  return parseOrThrow(DslAssignmentListSchema, value, 'DSL assignments failed schema validation');
}

export function parseDslProgram(value: unknown) {
  return parseOrThrow(DslProgramSchema, value, 'DSL program failed schema validation');
}

export function parseKnowledgePackSource(value: unknown) {
  return parseOrThrow(KnowledgePackSourceSchema, value, 'knowledge pack failed schema validation');
}
