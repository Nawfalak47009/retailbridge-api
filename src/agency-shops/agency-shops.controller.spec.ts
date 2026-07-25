import { Test, TestingModule } from '@nestjs/testing';
import { AgencyShopsController } from './agency-shops.controller';

describe('AgencyShopsController', () => {
  let controller: AgencyShopsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgencyShopsController],
    }).compile();

    controller = module.get<AgencyShopsController>(AgencyShopsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
