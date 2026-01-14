import type { CreateCustomerInput } from "./types";

export class CustomerFormParser {
  static fromFormData(formData: FormData): CreateCustomerInput {
    return {
      firstName: formData.get("first_name")?.toString() || "",
      lastName: formData.get("last_name")?.toString() || "",
      email: formData.get("email")?.toString() || "",
      specialty: formData.get("specialty")?.toString() || "",
      credentials: formData.get("credentials")?.toString() || "",
      licenseNpi: formData.get("license_npi")?.toString() || "",
      institutionName: formData.get("institution_name")?.toString() || "",
      businessAddress: formData.get("business_address")?.toString() || "",
      addressLine2: formData.get("address_line_2")?.toString() || "",
      city: formData.get("city")?.toString() || "",
      state: formData.get("state")?.toString() || "",
      zipCode: formData.get("zip_code")?.toString() || "",
      country: formData.get("country")?.toString() || "US",
    };
  }
}
