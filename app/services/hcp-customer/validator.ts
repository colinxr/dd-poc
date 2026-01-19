import { z } from "zod";
import type { CreateCustomerInput } from "./types";
import { ValidationError } from "../shared/errors";

export const CreateCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  specialty: z.string().min(1).max(100),
  credentials: z.string().min(1).max(50),
  licenseNpi: z.string().regex(/^\d{10}$/, "NPI must be 10 digits").optional().default(""),
  institutionName: z.string().min(1).max(200),
  businessAddress: z.string().min(1).max(255),
  addressLine2: z.string().max(255).optional().default(""),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(50),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),
  country: z.string().length(2).default("US"),
});

export type ValidatedCustomerInput = z.infer<typeof CreateCustomerSchema>;

export class CustomerValidator {
  validate(data: unknown): ValidatedCustomerInput {
    const result = CreateCustomerSchema.safeParse(data);
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
