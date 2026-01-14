export interface CustomerDTO {
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
