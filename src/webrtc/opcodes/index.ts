/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { OPCODES, Payload, WebSocket } from "@spacebar/gateway";
import { VoiceOPCodes } from "../util";
import { onBackendVersion } from "./BackendVersion";
import { onHeartbeat } from "./Heartbeat";
import { onIdentify } from "./Identify";
import { onSelectProtocol } from "./SelectProtocol";
import { onSpeaking } from "./Speaking";
import { onVideo } from "./Video";
import { OPCodes } from "../../util/util/Constants";

export type OPCodeHandler = (this: WebSocket, data: Payload) => any;

// Create a type that encompasses both OPCodes and VoiceOPCodes
type AllOPCodes = OPCODES | VoiceOPCodes;

// Define the handler object with the combined type
const handlers: { [key in AllOPCodes]?: OPCodeHandler } = {
	[VoiceOPCodes.HEARTBEAT]: onHeartbeat,
	[VoiceOPCodes.IDENTIFY]: onIdentify,
	[VoiceOPCodes.VOICE_BACKEND_VERSION]: onBackendVersion,
	[VoiceOPCodes.VIDEO]: onVideo,
	[VoiceOPCodes.SPEAKING]: onSpeaking,
	[VoiceOPCodes.SELECT_PROTOCOL]: onSelectProtocol,
};

export default handlers;
