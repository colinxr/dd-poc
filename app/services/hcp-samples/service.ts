import { SampleRepository } from "./repository";
import type { ValidatedSampleInput } from "./validator";

export class HcpSamplesService {
  constructor(private repo: SampleRepository) {}

  async createSampleRequest(
    dto: ValidatedSampleInput,
  ): Promise<{ draftOrderId: string; orderNumber: string; message: string }> {
    const draftOrder = await this.repo.createDraftOrder(dto);

    return {
      draftOrderId: draftOrder.id,
      orderNumber: draftOrder.name,
      message: "Sample order created successfully",
    };
  }
}
