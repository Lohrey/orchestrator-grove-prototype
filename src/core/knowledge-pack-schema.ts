import { z } from 'zod';

const TextListSchema = z.union([z.string(), z.array(z.string())]);

export const KnowledgePackSourceSchema = z.object({
  id: z.string().trim().min(1, 'knowledge pack id is required'),
  name: z.string().trim().min(1).optional(),
  custom: z.boolean().optional(),
  concepts: TextListSchema.optional(),
  vocabulary: TextListSchema.optional(),
  optionalContext: TextListSchema.optional(),
  contextVariables: TextListSchema.optional(),
  unlockedOps: z.array(z.string().trim().min(1)).optional(),
  selectedOps: z.array(z.string().trim().min(1)).optional(),
  ops: z.array(z.string().trim().min(1)).optional(),
  actionPartAliases: z.record(z.string(), z.unknown()).optional(),
  partAliases: z.record(z.string(), z.unknown()).optional(),
  examples: z.union([z.string(), z.array(z.unknown())]).optional()
}).passthrough();

export type KnowledgePackSource = z.infer<typeof KnowledgePackSourceSchema>;
