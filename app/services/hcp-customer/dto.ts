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
      address1: formData.get("address1")?.toString() || "",
      address2: formData.get("address2")?.toString() || "",
      city: formData.get("city")?.toString() || "",
      province: formData.get("province")?.toString() || "",
      zip: formData.get("zip")?.toString() || "",
      country: formData.get("country")?.toString() || "US",
    };
  }
}
