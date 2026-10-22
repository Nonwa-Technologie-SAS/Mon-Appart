import { applyDecorators } from "@nestjs/common"
import { OnEvent } from "@nestjs/event-emitter"

type OnEventOptions = Parameters<typeof OnEvent>[1]

/**
 * Un listener par nom d'événement. Sans wildcard, EventEmitter2 traite un
 * tableau passé à `@OnEvent` comme un seul nom (« a,b,c ») : rien ne se déclenche.
 */
export function OnEvents(
  names: readonly string[],
  options?: OnEventOptions,
): MethodDecorator {
  return applyDecorators(...names.map((name) => OnEvent(name, options)))
}
