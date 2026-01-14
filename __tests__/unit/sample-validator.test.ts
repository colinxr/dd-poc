import { describe, it, expect, beforeEach } from 'vitest';
import { SampleValidator } from '../../app/services/hcp-samples/validator';
import { ValidationError } from '../../app/services/shared/errors';
import { MOCK_SAMPLE_DATA } from '../fixtures/mock-data';

describe('SampleValidator', () => {
  let validator: SampleValidator;

  beforeEach(() => {
    validator = new SampleValidator();
  });

  it('should validate correct sample request data', () => {
    const validData = {
      firstName: MOCK_SAMPLE_DATA.first_name,
      lastName: MOCK_SAMPLE_DATA.last_name,
      email: MOCK_SAMPLE_DATA.email,
      phone: MOCK_SAMPLE_DATA.phone,
      address1: MOCK_SAMPLE_DATA.address1,
      address2: MOCK_SAMPLE_DATA.address2,
      city: MOCK_SAMPLE_DATA.city,
      province: MOCK_SAMPLE_DATA.province,
      country: MOCK_SAMPLE_DATA.country,
      zip: MOCK_SAMPLE_DATA.zip,
      productId: MOCK_SAMPLE_DATA.product,
    };

    expect(() => validator.validate(validData)).not.toThrow();
  });

  it('should throw ValidationError for invalid email', () => {
    const invalidData = {
      email: 'not-an-email',
    };

    expect(() => validator.validate(invalidData)).toThrow(ValidationError);
  });

  it('should throw ValidationError for missing product ID', () => {
    const invalidData = {
      ...MOCK_SAMPLE_DATA,
      productId: '',
    };

    expect(() => validator.validate(invalidData)).toThrow(ValidationError);
  });
});
