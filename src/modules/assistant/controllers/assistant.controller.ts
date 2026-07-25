import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AssistantService } from '../services/assistant.service';
import { SendMessageInput } from '../dtos/inputs/send-message.input';
import { AiMessage } from '../entities/ai-message.entity';
import { IConversationSummary } from '../interfaces/assistant-event.interface';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserRole } from '../../../common/enums/user-role.enum';
import { IJwtPayload } from '../../../common/interfaces/jwt-payload.interface';

@ApiTags('assistant')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('assistant')
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);

  constructor(private readonly assistantService: AssistantService) {}

  /**
   * Streams the reply as SSE. Writes to `res` directly (bypassing the global
   * ResponseInterceptor, which only wraps JSON responses); errors after the
   * headers are flushed can only travel as an `error` event on the stream.
   */
  @Post('chat')
  @ApiOperation({ summary: 'Send a message to the AI assistant (SSE stream)' })
  async chat(
    @CurrentUser() user: IJwtPayload,
    @Body() input: SendMessageInput,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const event of this.assistantService.chatStream(user, input)) {
        // Client gone (tab closed / abort): stop pulling from the model.
        // Breaking runs the generator's finally, persisting partial output.
        if (res.destroyed) break;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      const message =
        error instanceof HttpException
          ? error.message
          : 'El asistente no está disponible en este momento. Intenta nuevamente.';
      this.logger.error(
        `chat stream failed (user ${user.sub}): ${error instanceof Error ? error.message : error}`,
      );
      if (!res.destroyed) {
        res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
      }
    } finally {
      res.end();
    }
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List my assistant conversations' })
  listConversations(@CurrentUser() user: IJwtPayload): Promise<IConversationSummary[]> {
    return this.assistantService.listConversations(user);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get the messages of one of my conversations' })
  getMessages(
    @CurrentUser() user: IJwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AiMessage[]> {
    return this.assistantService.getMessages(user, id);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one of my conversations' })
  deleteConversation(
    @CurrentUser() user: IJwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.assistantService.deleteConversation(user, id);
  }
}
