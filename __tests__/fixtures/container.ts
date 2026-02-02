import Bottle from 'bottlejs';
import { createMockAdminApi } from './mock-admin-api';
import { CustomerRepository } from '../../app/services/hcp-customer/repository';
import { CustomerValidator } from '../../app/services/hcp-customer/validator';
import { CustomerService } from '../../app/services/hcp-customer/service';
import { SampleRepository } from '../../app/services/hcp-samples/repository';
import { SampleValidator } from '../../app/services/hcp-samples/validator';
import { SamplesService } from '../../app/services/hcp-samples/service';

export function createTestContainer() {
  const bottle = new Bottle();
  const mockAdminApi = createMockAdminApi();

  // Infrastructure
  bottle.value('adminApi', mockAdminApi);

  // Validators
  bottle.service('CustomerValidator', CustomerValidator);
  bottle.service('SampleValidator', SampleValidator);

  // Repositories
  bottle.factory('CustomerRepository', (container) => {
    return new CustomerRepository(container.adminApi);
  });
  bottle.factory('SampleRepository', (container) => {
    return new SampleRepository(container.adminApi);
  });

  // Services
  bottle.factory('CustomerService', (container) => {
    return new CustomerService(
      container.CustomerRepository,
      container.CustomerValidator
    );
  });

  bottle.factory('SamplesService', (container) => {
    return new SamplesService(
      container.SampleRepository,
      container.SampleValidator
    );
  });

  return {
    container: bottle.container,
    mockAdminApi,
  };
}
