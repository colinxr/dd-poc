export const MOCK_CUSTOMER_DATA = {
  first_name: "John",
  last_name: "Doe",
  email: "john.doe@example.com",
  specialty: "Functional Medicine",
  credentials: "MD",
  license_npi: "1234567890",
  institution_name: "Healthy Clinic",
  business_address: "123 Health St",
  address_line_2: "Suite 100",
  city: "Wellness",
  state: "CA",
  zip_code: "90210",
  country: "US"
};

export const MOCK_SAMPLE_DATA = {
  first_name: "Jane",
  last_name: "Smith",
  email: "jane.smith@example.com",
  phone: "1234567890",
  address1: "456 Patient Rd",
  address2: "",
  city: "Caring",
  province: "NY",
  country: "US",
  zip: "10001",
  product: "gid://shopify/Product/123456789"
};

export function createFormData(data: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  return formData;
}
