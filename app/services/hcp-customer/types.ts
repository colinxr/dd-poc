import { HCP_CUSTOMER_TAG } from "./constants";

export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  specialty: string;
  credentials: string;
  licenseNpi: string;
  institutionName: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  zip: string;
  country: string;
  phone: string;
}

export type CustomerDTO = CreateCustomerInput & {
  readonly tags: readonly [typeof HCP_CUSTOMER_TAG];
};

export function createCustomerDTO(data: CreateCustomerInput): CustomerDTO {
  return {
    ...data,
    tags: [HCP_CUSTOMER_TAG] as const,
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tags: string[];
}

export interface CustomerResponse {
  customer: Customer;
  message: string;
}
