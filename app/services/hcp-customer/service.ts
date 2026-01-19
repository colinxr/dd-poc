// Services
import { CustomerRepository } from "./repository";
import { CustomerValidator } from "./validator";
import { CustomerFormParser } from "./dto";
import { ValidationError } from "../shared/errors";

export class HcpCustomerService {
  constructor(
    private repo: CustomerRepository,
    private validator: CustomerValidator,
  ) {}

  async createCustomer(
    formData: FormData,
  ): Promise<{ customer: unknown; message: string }> {
    const dto = CustomerFormParser.fromFormData(formData);

    this.validator.validate(dto);

    console.log(dto);
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) {
      throw new ValidationError([
        {
          field: "email",
          message: "A customer with this email already exists",
        },
      ]);
    }

    const customer = await this.repo.create(dto);
    return { customer, message: "HCP customer created successfully" };
  }
}
