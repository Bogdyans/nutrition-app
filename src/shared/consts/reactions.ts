import { SeverityLevel } from '@prisma/client';

export const severityScore: Record<SeverityLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};
