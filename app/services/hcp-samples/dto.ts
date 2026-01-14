import type { SampleDTO } from "./types";

export class SampleFormParser {
  static fromFormData(formData: FormData): SampleDTO {
    return {
      firstName: formData.get("first_name")?.toString() || "",
      lastName: formData.get("last_name")?.toString() || "",
      email: formData.get("email")?.toString() || "",
      phone: formData.get("phone")?.toString() || "",
      address1: formData.get("address1")?.toString() || "",
      address2: formData.get("address2")?.toString() || "",
      city: formData.get("city")?.toString() || "",
      province: formData.get("province")?.toString() || "",
      country: formData.get("country")?.toString() || "",
      zip: formData.get("zip")?.toString() || "",
      productId: formData.get("product")?.toString() || "",
    };
  }
}
