import { z } from 'zod';
import { DslAssignmentListSchema } from './dsl-schema.js';

const ToolCallSchema = z.object({
  name: z.string().optional(),
  function: z.object({ name: z.string(), arguments: z.unknown().optional() }).passthrough().optional(),
  arguments: z.unknown().optional()
}).passthrough();

export const AssistantResponseSchema = z.object({
  dsl_assignments: DslAssignmentListSchema.optional(),
  dslAssignments: DslAssignmentListSchema.optional(),
  tool_calls: z.array(ToolCallSchema).max(10).optional(),
  calls: z.array(ToolCallSchema).max(10).optional(),
  help: z.boolean().optional(),
  reason: z.string().optional(),
  error: z.string().optional(),
  missingOps: z.array(z.string()).optional(),
  requiredPacks: z.array(z.string()).optional()
}).passthrough().superRefine((value, ctx) => {
  const assignments = value.dsl_assignments || value.dslAssignments || [];
  const calls = value.tool_calls || value.calls || [];
  if (!assignments.length && !calls.length && !value.help && !value.reason && !value.error) {
    ctx.addIssue({
      code: 'custom',
      message: 'assistant response must include assignments, tool calls, or help',
      path: ['dsl_assignments']
    });
  }
});

export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;
