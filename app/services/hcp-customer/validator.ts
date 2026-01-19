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
  business_address: z.string().optional().default(""),
  address_line_2: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  zip_code: z.string().optional().default(""),
  country: z.string().optional().default("US"),
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
      business_address,
      address_line_2,
      city,
      state,
      zip_code,
      country,
    } = rawResult.data;

    return this.validate({
      firstName: first_name,
      lastName: last_name,
      email,
      specialty,
      credentials,
      licenseNpi: license_npi,
      institutionName: institution_name,
      businessAddress: business_address,
      addressLine2: address_line_2,
      city,
      state,
      zipCode: zip_code,
      country,
    });
  }
}
