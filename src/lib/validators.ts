import { z } from "zod";

export const reservationCreateSchema = z.object({
  resourceId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  userNote: z.string().max(500).optional(),
});

export const adminDecisionSchema = z.object({
  adminNote: z.string().max(500).optional(),
  reason: z.string().max(500).optional(),
});
