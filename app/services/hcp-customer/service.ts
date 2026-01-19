// Services
import { CustomerRepository } from "./repository";
import type { CustomerDTO } from "./types";
import { CustomerAlreadyExistsError } from "./errors";

export class HcpCustomerService {
  constructor(private repo: CustomerRepository) {}

  async createCustomer(
    dto: CustomerDTO,
  ): Promise<{ customer: unknown; message: string }> {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) {
      throw new CustomerAlreadyExistsError(existing.id);
    }

    const customer = await this.repo.create(dto);
    return { customer, message: "HCP customer created successfully" };
  }
}
