import { Module } from "@nestjs/common"

import { IdentityModule } from "../identity/identity.module"
import { SearchModule } from "../search/search.module"
import { AssistantService } from "./application/assistant.service"
import { AiAssistantConfig } from "./ai-assistant.config"
import { ConversationStore } from "./infrastructure/conversation.store"
import { OpenAiTextProvider } from "./infrastructure/openai-ai.provider"
import { RulesAiProvider } from "./infrastructure/rules-ai.provider"
import { AiAssistantController } from "./presentation/ai-assistant.controller"

/**
 * Assistant immobilier conversationnel.
 * NLU déterministe + Search existant ; LLM optionnel pour reformuler uniquement.
 */
@Module({
  imports: [IdentityModule, SearchModule],
  controllers: [AiAssistantController],
  providers: [
    AiAssistantConfig,
    ConversationStore,
    RulesAiProvider,
    OpenAiTextProvider,
    AssistantService,
  ],
  exports: [AssistantService],
})
export class AiAssistantModule {}
