import { Test, TestingModule } from '@nestjs/testing';
import { AgencyShopsService } from './agency-shops.service';

describe('AgencyShopsService', () => {
  let service: AgencyShopsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgencyShopsService],
    }).compile();

    service = module.get<AgencyShopsService>(AgencyShopsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
