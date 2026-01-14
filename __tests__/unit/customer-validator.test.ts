import { describe, it, expect, beforeEach } from 'vitest';
import { CustomerValidator } from '../../app/services/hcp-customer/validator';
import { ValidationError } from '../../app/services/shared/errors';
import { MOCK_CUSTOMER_DATA } from '../fixtures/mock-data';
import { CustomerFormParser } from '../../app/services/hcp-customer/dto';

describe('CustomerValidator', () => {
  let validator: CustomerValidator;

  beforeEach(() => {
    validator = new CustomerValidator();
  });

  it('should validate correct customer data', () => {
    const dto = CustomerFormParser.fromFormData(new FormData()); // Placeholder, usually from form
    // Instead of using real FormData which might be tricky in Node without a polyfill if not set up, 
    // we use the object directly as the validator expects 'unknown' and parses with Zod
    const validData = {
      firstName: MOCK_CUSTOMER_DATA.first_name,
      lastName: MOCK_CUSTOMER_DATA.last_name,
      email: MOCK_CUSTOMER_DATA.email,
      specialty: MOCK_CUSTOMER_DATA.specialty,
      credentials: MOCK_CUSTOMER_DATA.credentials,
      licenseNpi: MOCK_CUSTOMER_DATA.license_npi,
      institutionName: MOCK_CUSTOMER_DATA.institution_name,
      businessAddress: MOCK_CUSTOMER_DATA.business_address,
      addressLine2: MOCK_CUSTOMER_DATA.address_line_2,
      city: MOCK_CUSTOMER_DATA.city,
      state: MOCK_CUSTOMER_DATA.state,
      zipCode: MOCK_CUSTOMER_DATA.zip_code,
      country: MOCK_CUSTOMER_DATA.country,
    };

    expect(() => validator.validate(validData)).not.toThrow();
  });

  it('should throw ValidationError for invalid email', () => {
    const invalidData = {
      ...MOCK_CUSTOMER_DATA,
      email: 'invalid-email',
    };

    expect(() => validator.validate(invalidData)).toThrow(ValidationError);
  });

  it('should throw ValidationError for missing required fields', () => {
    const invalidData = {
      firstName: '',
    };

    expect(() => validator.validate(invalidData)).toThrow(ValidationError);
  });

  it('should throw ValidationError for invalid NPI format', () => {
    const invalidData = {
      ...MOCK_CUSTOMER_DATA,
      licenseNpi: '123', // Must be 10 digits
    };

    expect(() => validator.validate(invalidData)).toThrow(ValidationError);
  });
});
