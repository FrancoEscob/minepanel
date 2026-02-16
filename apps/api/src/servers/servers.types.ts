import type {
  CreateServerInput,
  SendServerCommandInput,
  ServerPropertiesInput
} from "@minepanel/contracts";

export interface CreateServerBody extends CreateServerInput {}

export interface SendServerCommandBody extends SendServerCommandInput {}

export interface UpdateServerPropertiesBody extends ServerPropertiesInput {}
