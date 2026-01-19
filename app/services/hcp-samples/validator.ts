import { z } from "zod";
import type { SampleDTO } from "./types";
import { ValidationError } from "../shared/errors";

const RawFormDataSchema = z.object({
  first_name: z.string().optional().default(""),
  last_name: z.string().optional().default(""),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  address1: z.string().optional().default(""),
  address2: z.string().optional().default(""),
  city: z.string().optional().default(""),
  province: z.string().optional().default(""),
  country: z.string().optional().default(""),
  zip: z.string().optional().default(""),
  product: z.string().optional().default(""),
});

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

  validateFormData(formData: FormData): ValidatedSampleInput {
    const rawData: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      rawData[key] = value.toString();
    }

    const rawResult = RawFormDataSchema.safeParse(rawData);
    if (!rawResult.success) {
      const errors = rawResult.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new ValidationError(errors);
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      address1,
      address2,
      city,
      province,
      country,
      zip,
      product,
    } = rawResult.data;

    return this.validate({
      firstName: first_name,
      lastName: last_name,
      email,
      phone,
      address1,
      address2,
      city,
      province,
      country,
      zip,
      productId: product,
    });
  }
}
