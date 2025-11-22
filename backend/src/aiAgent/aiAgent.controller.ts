import { Controller, Post, Body } from '@nestjs/common';
import { AiAgentService } from './aiAgent.service';

@Controller('agent')
export class AiAgentController {
  constructor(private aiAgentService: AiAgentService) {}

  @Post('query')
  async query(@Body() queryDto: { question: string }) {
    return this.aiAgentService.askAgent(queryDto.question);
  }
}
