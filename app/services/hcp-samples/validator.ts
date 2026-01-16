import { z } from "zod";
import type { SampleDTO } from "./types";
import { ValidationError } from "../shared/errors";

export const SampleSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z
    .string()
    .regex(/^\+?[\d\s-()]{10,}$/, "Invalid phone number format")
    .optional()
    .default(""),
  address1: z.string().min(1).max(255),
  address2: z.string().max(255).optional().default(""),
  city: z.string().min(1).max(100),
  province: z.string().min(2).max(50),
  country: z.string().min(2),
  zip: z.string().min(3).max(20),
  productId: z.string().min(1),
});

export type ValidatedSampleInput = z.infer<typeof SampleSchema>;

export class SampleValidator {
  validate(data: unknown): ValidatedSampleInput {
    const result = SampleSchema.safeParse(data);
    if (!result.success) {
      const errors = result.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new ValidationError(errors);
    }
    return result.data;
  }
}
