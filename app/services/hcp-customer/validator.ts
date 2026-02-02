import { z } from "zod";
import type { CreateCustomerInput } from "./types";
import { ValidationError } from "../shared/errors";

const RawFormDataSchema = z.object({
  first_name: z.string().optional().default(""),
  last_name: z.string().optional().default(""),
  email: z.string().optional().default(""),
  specialty: z.string().optional().default(""),
  credentials: z.string().optional().default(""),
  license_npi: z.string().optional().default(""),
  institution_name: z.string().optional().default(""),
  address1: z.string().optional().default(""),
  address2: z.string().optional().default(""),
  city: z.string().optional().default(""),
  province: z.string().optional().default(""),
  zip: z.string().optional().default(""),
  country: z.string().optional().default("US"),
  country_code: z.string().optional().default(""),
  phone: z.string().optional().default(""),
});

export const CreateCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  specialty: z.string().min(1).max(100),
  credentials: z.string().min(1).max(50),
  licenseNpi: z
    .string()
    .regex(/^\d{10}$/, "NPI must be 10 digits")
    .optional()
    .default(""),
  institutionName: z.string().min(1).max(200),
  address1: z.string().min(1).max(255),
  address2: z.string().max(255).optional().default(""),
  city: z.string().min(1).max(100),
  province: z.string().min(2).max(50),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),
  country: z.string().length(2).default("US"),
  phone: z.string().optional().default(""),
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

  validateFormData(formData: FormData): ValidatedCustomerInput {
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
      specialty,
      credentials,
      license_npi,
      institution_name,
      address1,
      address2,
      province,
      zip,
      country,
      country_code,
      phone,
    } = rawResult.data;

    const phoneNumber = phone && country_code ? `${country_code}${phone}` : "";

    return this.validate({
      firstName: first_name,
      lastName: last_name,
      email,
      specialty,
      credentials,
      licenseNpi: license_npi,
      institutionName: institution_name,
      address1: address1,
      address2: address2,
      province: province,
      zip: zip,
      country,
      phone: phoneNumber,
    });
  }
}
