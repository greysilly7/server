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

import { Payload, WebSocket } from "@spacebar/gateway";
import {
	Config,
	emitEvent,
	Guild,
	Member,
	Region,
	VoiceServerUpdateEvent,
	VoiceState,
	VoiceStateUpdateEvent,
	VoiceStateUpdateSchema,
} from "@spacebar/util";
import { genVoiceToken } from "../util/SessionUtils";
import { check } from "./instanceOf";

export async function onVoiceStateUpdate(this: WebSocket, data: Payload) {
	check.call(this, VoiceStateUpdateSchema, data.d);
	const body = data.d as VoiceStateUpdateSchema;
	const isNew = body.channel_id === null && body.guild_id === null;
	let isChanged = false;

	let voiceState: VoiceState;
	try {
		voiceState = await VoiceState.findOneOrFail({
			where: { user_id: this.user_id },
		});
		if (
			voiceState.session_id !== this.session_id &&
			body.channel_id === null &&
			body.guild_id === null
		) {
			// changing deaf or mute on a client that's not the one with the same session of the voicestate in the database should be ignored
			return;
		}

		if (voiceState.channel_id !== body.channel_id) isChanged = true;

		// If a user changes voice channel between guilds, we should send a left event first
		if (
			voiceState.guild_id !== body.guild_id &&
			voiceState.session_id === this.session_id
		) {
			await emitEvent({
				event: "VOICE_STATE_UPDATE",
				data: { ...voiceState, channel_id: null },
				guild_id: voiceState.guild_id,
			});
		}

		// The event sent by Discord's client on channel leave has both guild_id and channel_id as null
		if (body.guild_id === null) body.guild_id = voiceState.guild_id;
		voiceState.assign(body);
	} catch (error) {
		console.error("Error finding voice state:", error);
		voiceState = VoiceState.create({
			...body,
			user_id: this.user_id,
			deaf: false,
			mute: false,
			suppress: false,
		});
	}

	// 'Fix' for this one voice state error. It seems to be sent on client load,
	// so maybe it's trying to find which server you were connected to before disconnecting, if any?
	if (body.guild_id == null) {
		return;
	}

	try {
		const member = await Member.findOneOrFail({
			where: { id: voiceState.user_id, guild_id: voiceState.guild_id },
			relations: ["user", "roles"],
		});
		// Ensure the member object has only the specified properties
		voiceState.member = member; /* {
            hoisted_role: member.roles.find((r) => r.hoist),
            deaf: member.deaf,
            joined_at: member.joined_at,
            mute: member.mute,
            roles: member.roles,
            user: member.user,
        };
				*/
	} catch (error) {
		console.error("Error finding member:", error);
		return;
	}

	// If the session changed, we generate a new token
	if (voiceState.session_id !== this.session_id)
		voiceState.token = genVoiceToken();
	voiceState.session_id = this.session_id;

	const { ...newObj } = voiceState;

	await Promise.all([
		voiceState.save(),
		emitEvent({
			event: "VOICE_STATE_UPDATE",
			data: newObj,
			guild_id: voiceState.guild_id,
		} as VoiceStateUpdateEvent),
	]);

	// If it's null, it means that we are leaving the channel and this event is not needed
	if ((isNew || isChanged) && voiceState.channel_id !== null) {
		const guild = await Guild.findOne({
			where: { id: voiceState.guild_id },
		});
		const regions = Config.get().regions;
		let guildRegion: Region | undefined;
		if (guild?.region) {
			guildRegion = regions.available.find((r) => r.id === guild.region);
		} else {
			guildRegion = regions.available.find(
				(r) => r.id === regions.default,
			);
		}

		if (guildRegion) {
			await emitEvent({
				event: "VOICE_SERVER_UPDATE",
				data: {
					token: voiceState.token,
					guild_id: voiceState.guild_id,
					endpoint: guildRegion.endpoint,
				},
				guild_id: voiceState.guild_id,
				user_id: voiceState.user_id,
			} as VoiceServerUpdateEvent);
		} else {
			console.error("No valid region found for guild:", guild?.id);
		}
	}
}
