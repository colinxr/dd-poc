import Bottle from 'bottlejs';
import { createMockAdminApi } from './mock-admin-api';
import { CustomerRepository } from '../../app/services/hcp-customer/repository';
import { CustomerValidator } from '../../app/services/hcp-customer/validator';
import { HcpCustomerService } from '../../app/services/hcp-customer/service';
import { SampleRepository } from '../../app/services/hcp-samples/repository';
import { SampleValidator } from '../../app/services/hcp-samples/validator';
import { HcpSamplesService } from '../../app/services/hcp-samples/service';

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
  bottle.factory('HcpCustomerService', (container) => {
    return new HcpCustomerService(
      container.CustomerRepository,
      container.CustomerValidator
    );
  });

  bottle.factory('HcpSamplesService', (container) => {
    return new HcpSamplesService(
      container.SampleRepository,
      container.SampleValidator
    );
  });

  return {
    container: bottle.container,
    mockAdminApi,
  };
}
