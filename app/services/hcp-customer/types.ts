import { HCP_CUSTOMER_TAG } from "./constants";

export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  specialty: string;
  credentials: string;
  licenseNpi: string;
  institutionName: string;
  businessAddress: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
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

export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  email: string;
  specialty: string;
  credentials: string;
  licenseNpi: string;
  institutionName: string;
  businessAddress: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
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
