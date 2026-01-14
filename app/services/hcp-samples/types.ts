export interface SampleDTO {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  productId: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface SampleResponse {
  draftOrderId: string;
  orderNumber: string;
  message: string;
}

export interface DraftOrder {
  id: string;
  name: string;
}
