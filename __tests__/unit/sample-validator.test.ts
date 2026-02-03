import { describe, it, expect, beforeEach } from "vitest";
import { SampleValidator } from "../../app/services/hcp-samples/validator";
import { ValidationError } from "../../app/services/shared/errors";
import { MOCK_SAMPLE_DATA, createFormData } from "../fixtures/mock-data";

describe("SampleValidator", () => {
  let validator: SampleValidator;

  beforeEach(() => {
    validator = new SampleValidator();
  });

  describe("validate", () => {
    it("should validate correct sample request data", () => {
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

    it("should throw ValidationError for invalid email", () => {
      const invalidData = {
        email: "not-an-email",
      };

      expect(() => validator.validate(invalidData)).toThrow(ValidationError);
    });

    it("should throw ValidationError for missing product ID", () => {
      const invalidData = {
        ...MOCK_SAMPLE_DATA,
        productId: "",
      };

      expect(() => validator.validate(invalidData)).toThrow(ValidationError);
    });
  });

  describe("validateFormData", () => {
    it("should validate form data for office request (default)", () => {
      const formData = createFormData(MOCK_SAMPLE_DATA);
      const result = validator.validateFormData(formData);
      expect(result.firstName).toBe(MOCK_SAMPLE_DATA.first_name);
    });

    it("should require patient details when formType is patient", () => {
      const formData = createFormData(MOCK_SAMPLE_DATA); // No patient_email
      expect(() => validator.validateFormData(formData, "patient")).toThrow(
        ValidationError,
      );
    });

    it("should validate successfully when formType is patient", () => {
      const patientData = {
        ...MOCK_SAMPLE_DATA,
        patient_first_name: "tk",
        patient_last_name: "tk",
        patient_phone: "5555555555",
        patient_email: "patient@example.com",
      };
      const formData = createFormData(patientData);
      const result = validator.validateFormData(formData, "patient");
      expect(result.patientEmail).toBe("patient@example.com");
    });

    it("should not require patient details when formType is not patient", () => {
      const formData = createFormData(MOCK_SAMPLE_DATA);
      const result = validator.validateFormData(formData, "office");
      expect(result.patientEmail).toBeUndefined();
    });
  });
});
