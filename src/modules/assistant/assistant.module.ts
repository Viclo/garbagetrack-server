import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AssistantController } from './controllers/assistant.controller';
import { AssistantService } from './services/assistant.service';
import { GeminiProvider } from './services/llm/gemini.provider';
import { LLM_CLIENT } from './interfaces/llm-client.interface';

@Module({
  imports: [TypeOrmModule.forFeature([AiConversation, AiMessage])],
  controllers: [AssistantController],
  providers: [AssistantService, { provide: LLM_CLIENT, useClass: GeminiProvider }],
})
export class AssistantModule {}
