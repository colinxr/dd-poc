import { SampleRepository } from "./repository";
import { SampleValidator } from "./validator";
import { SampleFormParser } from "./dto";

export class HcpSamplesService {
  constructor(
    private repo: SampleRepository,
    private validator: SampleValidator,
  ) {}

  async createSampleRequest(formData: FormData): Promise<{ draftOrderId: string; orderNumber: string; message: string }> {
    const dto = SampleFormParser.fromFormData(formData);
    const validatedData = this.validator.validate(dto);

    const draftOrder = await this.repo.createDraftOrder(validatedData);

    return {
      draftOrderId: draftOrder.id,
      orderNumber: draftOrder.name,
      message: "Sample order created successfully",
    };
  }
}
