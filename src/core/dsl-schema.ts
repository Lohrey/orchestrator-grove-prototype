import { z } from 'zod';

export const MAX_DSL_STEPS = 24;

export const DslStepSchema = z.object({
  op: z.string().trim().min(1, 'step op is required')
}).catchall(z.unknown()).superRefine((step, ctx) => {
  if ('steps' in step || 'children' in step) {
    ctx.addIssue({
      code: 'custom',
      message: 'nested DSL steps are not allowed',
      path: ['steps']
    });
  }
});

export const DslProgramSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  repeat: z.boolean().optional(),
  steps: z.array(DslStepSchema).min(1, 'DSL program needs at least one step').max(MAX_DSL_STEPS, `DSL program exceeds ${MAX_DSL_STEPS} step limit`)
}).passthrough();

export const DslAssigneeSchema = z.object({
  strategy: z.literal('any_eligible')
}).passthrough();

export const DslAssignmentSchema = z.object({
  botId: z.coerce.number().int().positive().optional(),
  bot: z.union([z.string(), z.number()]).optional(),
  assignee: DslAssigneeSchema.optional(),
  program: DslProgramSchema.optional(),
  dsl: DslProgramSchema.optional(),
  reason: z.string().optional()
}).passthrough().superRefine((assignment, ctx) => {
  const inlineProgram = 'steps' in assignment;
  if (!assignment.program && !assignment.dsl && !inlineProgram) {
    ctx.addIssue({ code: 'custom', message: 'DSL assignment requires a program', path: ['program'] });
  }
  if (assignment.botId == null && assignment.bot == null && !assignment.assignee) {
    ctx.addIssue({ code: 'custom', message: 'DSL assignment requires botId, bot, or assignee', path: ['botId'] });
  }
});

export const DslAssignmentListSchema = z.array(DslAssignmentSchema).max(10, 'at most 10 DSL assignments are accepted');

export type DslStep = z.infer<typeof DslStepSchema>;
export type DslProgram = z.infer<typeof DslProgramSchema>;
export type DslAssignment = z.infer<typeof DslAssignmentSchema>;
