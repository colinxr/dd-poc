import Bottle from "bottlejs";
import { CustomerRepository } from "../services/hcp-customer/repository";
import { CustomerValidator } from "../services/hcp-customer/validator";
import { CustomerService } from "../services/hcp-customer/service";
import { SampleRepository } from "../services/hcp-samples/repository";
import { SampleValidator } from "../services/hcp-samples/validator";
import { SamplesService } from "../services/hcp-samples/service";

// Define the AdminApi interface locally to avoid circular dependencies if needed
interface AdminApi {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

export function createContainer(admin: AdminApi) {
  const bottle = new Bottle();

  // Infrastructure
  bottle.value("adminApi", admin);

  // Validators (Singletons)
  bottle.service("CustomerValidator", CustomerValidator);
  bottle.service("SampleValidator", SampleValidator);

  // Repositories (Request-scoped because of adminApi)
  bottle.factory(
    "CustomerRepository",
    (container) => new CustomerRepository(container.adminApi),
  );

  bottle.factory(
    "SampleRepository",
    (container) => new SampleRepository(container.adminApi),
  );

  // Services
  bottle.factory(
    "CustomerService",
    (container) => new CustomerService(container.CustomerRepository),
  );

  bottle.factory(
    "SamplesService",
    (container) => new SamplesService(container.SampleRepository),
  );

  return bottle.container;
}

export type Container = ReturnType<typeof createContainer>;
