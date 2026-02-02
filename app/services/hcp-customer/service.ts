import { CustomerRepository } from "./repository";
import type { CustomerDTO } from "./types";

export class CustomerService {
  constructor(private repo: CustomerRepository) {}

  async createCustomer(
    dto: CustomerDTO,
  ): Promise<{ customer: unknown; message: string }> {
    const customer = await this.repo.create(dto);
    return { customer, message: "HCP customer created successfully" };
  }
}
