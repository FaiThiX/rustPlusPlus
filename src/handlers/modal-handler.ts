/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus

*/

import * as discordjs from 'discord.js';

import { log, client, localeManager as lm } from '../../index';
import * as discordMessages from '../discordTools/discord-messages';
import * as guildInstance from '../util/guild-instance';
import * as constants from '../util/constants';
import { getListOfUsedKeywords } from '../util/keywords';
import { requestSteamProfileName } from '../util/request';
const Config = require('../../config');
const Battlemetrics = require('../structures/Battlemetrics');

export async function modalHandler(interaction: discordjs.ModalSubmitInteraction) {
    const guildId = interaction.guildId as string;
    const instance = guildInstance.readGuildInstanceFile(guildId);

    const verifyId = Math.floor(100000 + Math.random() * 900000);
    await client.logInteraction(interaction, verifyId, 'userModal');

    if (instance.blacklist['discordIds'].includes(interaction.user.id) && interaction.member !== null &&
        !(interaction.member.permissions as discordjs.PermissionsBitField).has(
            discordjs.PermissionsBitField.Flags.Administrator)) {
        log.info(lm.getIntl(Config.general.language, 'userPartOfBlacklist', {
            id: `${verifyId}`,
            user: `${interaction.user.username} (${interaction.user.id})`
        }));
        return;
    }

    if (interaction.customId.startsWith('CustomTimersEdit')) {
        const ids = JSON.parse(interaction.customId.replace('CustomTimersEdit', ''));
        const server = instance.serverList[ids.serverId];
        const cargoShipEgressTime = parseInt(interaction.fields.getTextInputValue('CargoShipEgressTime'));
        const oilRigCrateUnlockTime = parseInt(interaction.fields.getTextInputValue('OilRigCrateUnlockTime'));

        if (!server) {
            interaction.deferUpdate();
            return;
        }

        if (cargoShipEgressTime && ((cargoShipEgressTime * 1000) !== server.cargoShipEgressTimeMs)) {
            server.cargoShipEgressTimeMs = cargoShipEgressTime * 1000;
        }
        if (oilRigCrateUnlockTime && ((oilRigCrateUnlockTime * 1000) !== server.oilRigLockedCrateUnlockTimeMs)) {
            server.oilRigLockedCrateUnlockTimeMs = oilRigCrateUnlockTime * 1000;
        }
        guildInstance.writeGuildInstanceFile(guildId, instance);

        log.info(lm.getIntl(Config.general.language, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${server.cargoShipEgressTimeMs}, ${server.oilRigLockedCrateUnlockTimeMs}`
        }));
    }
    else if (interaction.customId.startsWith('ServerEdit')) {
        const ids = JSON.parse(interaction.customId.replace('ServerEdit', ''));
        const server = instance.serverList[ids.serverId];
        const battlemetricsId = interaction.fields.getTextInputValue('ServerBattlemetricsId');

        if (battlemetricsId !== server.battlemetricsId) {
            if (battlemetricsId === '') {
                server.battlemetricsId = null;
            }
            else if (client.battlemetricsInstances.hasOwnProperty(battlemetricsId)) {
                const bmInstance = client.battlemetricsInstances[battlemetricsId];
                server.battlemetricsId = battlemetricsId;
                server.connect = `connect ${bmInstance.server_ip}:${bmInstance.server_port}`;
            }
            else {
                const bmInstance = new Battlemetrics(battlemetricsId);
                await bmInstance.setup();
                if (bmInstance.lastUpdateSuccessful) {
                    client.battlemetricsInstances[battlemetricsId] = bmInstance;
                    server.battlemetricsId = battlemetricsId;
                    server.connect = `connect ${bmInstance.server_ip}:${bmInstance.server_port}`;
                }
            }
        }
        guildInstance.writeGuildInstanceFile(guildId, instance);

        log.info(lm.getIntl(Config.general.language, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${server.battlemetricsId}`
        }));

        await discordMessages.sendServerMessage(guildId, ids.serverId);

        /* To force search of player name via scrape */
        client.battlemetricsIntervalCounter = 0;
    }
    else if (interaction.customId.startsWith('SmartSwitchEdit')) {
        const ids = JSON.parse(interaction.customId.replace('SmartSwitchEdit', ''));
        const server = instance.serverList[ids.serverId];
        const smartSwitchName = interaction.fields.getTextInputValue('SmartSwitchName');
        const smartSwitchCommand = interaction.fields.getTextInputValue('SmartSwitchCommand');
        let smartSwitchProximity = null;
        try {
            smartSwitchProximity = parseInt(interaction.fields.getTextInputValue('SmartSwitchProximity'));
        }
        catch (e) {
            smartSwitchProximity = null;
        }

        if (!server || (server && !server.switches.hasOwnProperty(ids.entityId))) {
            interaction.deferUpdate();
            return;
        }

        server.switches[ids.entityId].name = smartSwitchName;

        if (smartSwitchCommand !== server.switches[ids.entityId].command &&
            !getListOfUsedKeywords(guildId, ids.serverId).includes(smartSwitchCommand)) {
            server.switches[ids.entityId].command = smartSwitchCommand;
        }

        if (smartSwitchProximity !== null && smartSwitchProximity >= 0) {
            server.switches[ids.entityId].proximity = smartSwitchProximity;
        }
        guildInstance.writeGuildInstanceFile(guildId, instance);

        log.info(lm.getIntl(Config.general.language, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${smartSwitchName}, ${server.switches[ids.entityId].command}`
        }));

        await discordMessages.sendSmartSwitchMessage(guildId, ids.serverId, ids.entityId);
    }
    else if (interaction.customId.startsWith('GroupEdit')) {
        const ids = JSON.parse(interaction.customId.replace('GroupEdit', ''));
        const server = instance.serverList[ids.serverId];
        const groupName = interaction.fields.getTextInputValue('GroupName');
        const groupCommand = interaction.fields.getTextInputValue('GroupCommand');

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            interaction.deferUpdate();
            return;
        }

        server.switchGroups[ids.groupId].name = groupName;

        if (groupCommand !== server.switchGroups[ids.groupId].command &&
            !getListOfUsedKeywords(guildId, ids.serverId).includes(groupCommand)) {
            server.switchGroups[ids.groupId].command = groupCommand;
        }
        guildInstance.writeGuildInstanceFile(guildId, instance);

        log.info(lm.getIntl(Config.general.language, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${groupName}, ${server.switchGroups[ids.groupId].command}`
        }));

        await discordMessages.sendSmartSwitchGroupMessage(guildId, ids.serverId, ids.groupId);
    }
    else if (interaction.customId.startsWith('GroupAddSwitch')) {
        const ids = JSON.parse(interaction.customId.replace('GroupAddSwitch', ''));
        const server = instance.serverList[ids.serverId];
        const switchId = interaction.fields.getTextInputValue('GroupAddSwitchId');

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            interaction.deferUpdate();
            return;
        }

        if (!Object.keys(server.switches).includes(switchId) ||
            server.switchGroups[ids.groupId].switches.includes(switchId)) {
            interaction.deferUpdate();
            return;
        }

        server.switchGroups[ids.groupId].switches.push(switchId);
        guildInstance.writeGuildInstanceFile(guildId, instance);

        log.info(lm.getIntl(Config.general.language, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${switchId}`
        }));

        await discordMessages.sendSmartSwitchGroupMessage(guildId, ids.serverId, ids.groupId);
    }
    else if (interaction.customId.startsWith('GroupRemoveSwitch')) {
        const ids = JSON.parse(interaction.customId.replace('GroupRemoveSwitch', ''));
        const server = instance.serverList[ids.serverId];
        const switchId = interaction.fields.getTextInputValue('GroupRemoveSwitchId');

        if (!server || (server && !server.switchGroups.hasOwnProperty(ids.groupId))) {
            interaction.deferUpdate();
            return;
        }

        server.switchGroups[ids.groupId].switches =
            server.switchGroups[ids.groupId].switches.filter(e => e !== switchId);
        guildInstance.writeGuildInstanceFile(guildId, instance);

        log.info(lm.getIntl(Config.general.language, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${switchId}`
        }));

        await discordMessages.sendSmartSwitchGroupMessage(guildId, ids.serverId, ids.groupId);
    }
    else if (interaction.customId.startsWith('SmartAlarmEdit')) {
        const ids = JSON.parse(interaction.customId.replace('SmartAlarmEdit', ''));
        const server = instance.serverList[ids.serverId];
        const smartAlarmName = interaction.fields.getTextInputValue('SmartAlarmName');
        const smartAlarmMessage = interaction.fields.getTextInputValue('SmartAlarmMessage');
        const smartAlarmCommand = interaction.fields.getTextInputValue('SmartAlarmCommand');

        if (!server || (server && !server.alarms.hasOwnProperty(ids.entityId))) {
            interaction.deferUpdate();
            return;
        }

        server.alarms[ids.entityId].name = smartAlarmName;
        server.alarms[ids.entityId].message = smartAlarmMessage;

        if (smartAlarmCommand !== server.alarms[ids.entityId].command &&
            !getListOfUsedKeywords(guildId, ids.serverId).includes(smartAlarmCommand)) {
            server.alarms[ids.entityId].command = smartAlarmCommand;
        }
        guildInstance.writeGuildInstanceFile(guildId, instance);

        log.info(lm.getIntl(Config.general.language, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${smartAlarmName}, ${smartAlarmMessage}, ${server.alarms[ids.entityId].command}`
        }));

        await discordMessages.sendSmartAlarmMessage(guildId, ids.serverId, ids.entityId);
    }
    else if (interaction.customId.startsWith('StorageMonitorEdit')) {
        const ids = JSON.parse(interaction.customId.replace('StorageMonitorEdit', ''));
        const server = instance.serverList[ids.serverId];
        const storageMonitorName = interaction.fields.getTextInputValue('StorageMonitorName');

        if (!server || (server && !server.storageMonitors.hasOwnProperty(ids.entityId))) {
            interaction.deferUpdate();
            return;
        }

        server.storageMonitors[ids.entityId].name = storageMonitorName;
        guildInstance.writeGuildInstanceFile(guildId, instance);

        log.info(lm.getIntl(Config.general.language, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${storageMonitorName}`
        }));

        await discordMessages.sendStorageMonitorMessage(guildId, ids.serverId, ids.entityId);
    }
    else if (interaction.customId.startsWith('TrackerEdit')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerEdit', ''));
        const tracker = instance.trackers[ids.trackerId];
        const trackerName = interaction.fields.getTextInputValue('TrackerName');
        const trackerBattlemetricsId = interaction.fields.getTextInputValue('TrackerBattlemetricsId');
        const trackerClanTag = interaction.fields.getTextInputValue('TrackerClanTag');

        if (!tracker) {
            interaction.deferUpdate();
            return;
        }

        tracker.name = trackerName;
        if (trackerClanTag !== tracker.clanTag) {
            tracker.clanTag = trackerClanTag;
            client.battlemetricsIntervalCounter = 0;
        }

        if (trackerBattlemetricsId !== tracker.battlemetricsId) {
            if (client.battlemetricsInstances.hasOwnProperty(trackerBattlemetricsId)) {
                const bmInstance = client.battlemetricsInstances[trackerBattlemetricsId];
                tracker.battlemetricsId = trackerBattlemetricsId;
                tracker.serverId = `${bmInstance.server_ip}-${bmInstance.server_port}`;
                tracker.image = constants.DEFAULT_SERVER_IMAGE;
                tracker.title = bmInstance.server_name;
            }
            else {
                const bmInstance = new Battlemetrics(trackerBattlemetricsId);
                await bmInstance.setup();
                if (bmInstance.lastUpdateSuccessful) {
                    client.battlemetricsInstances[trackerBattlemetricsId] = bmInstance;
                    tracker.battlemetricsId = trackerBattlemetricsId;
                    tracker.serverId = `${bmInstance.server_ip}-${bmInstance.server_port}`;
                    tracker.image = constants.DEFAULT_SERVER_IMAGE;
                    tracker.title = bmInstance.server_name;
                }
            }
        }
        guildInstance.writeGuildInstanceFile(guildId, instance);

        log.info(lm.getIntl(Config.general.language, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${trackerName}, ${tracker.battlemetricsId}, ${tracker.clanTag}`
        }));

        await discordMessages.sendTrackerMessage(guildId, ids.trackerId);
    }
    else if (interaction.customId.startsWith('TrackerAddPlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerAddPlayer', ''));
        const tracker = instance.trackers[ids.trackerId];
        const id = interaction.fields.getTextInputValue('TrackerAddPlayerId');

        if (!tracker) {
            interaction.deferUpdate();
            return;
        }

        const isSteamId64 = id.length === constants.STEAMID64_LENGTH ? true : false;
        const bmInstance = client.battlemetricsInstances[tracker.battlemetricsId];

        if ((isSteamId64 && tracker.players.some(e => e.steamId === id)) ||
            (!isSteamId64 && tracker.players.some(e => e.playerId === id && e.steamId === null))) {
            interaction.deferUpdate();
            return;
        }

        let name: string | null = null;
        let steamId: string | null = null;
        let playerId = null;

        if (isSteamId64) {
            steamId = id;
            name = await requestSteamProfileName(id);

            if (name && bmInstance) {
                playerId = Object.keys(bmInstance.players).find(e => bmInstance.players[e]['name'] === name);
                if (!playerId) playerId = null;
            }
        }
        else {
            playerId = id;
            if (bmInstance.players.hasOwnProperty(id)) {
                name = bmInstance.players[id]['name'];
            }
            else {
                name = '-';
            }
        }

        tracker.players.push({
            name: name,
            steamId: steamId,
            playerId: playerId
        });
        guildInstance.writeGuildInstanceFile(guildId, instance);

        log.info(lm.getIntl(Config.general.language, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${id}`
        }));

        await discordMessages.sendTrackerMessage(guildId, ids.trackerId);
    }
    else if (interaction.customId.startsWith('TrackerRemovePlayer')) {
        const ids = JSON.parse(interaction.customId.replace('TrackerRemovePlayer', ''));
        const tracker = instance.trackers[ids.trackerId];
        const id = interaction.fields.getTextInputValue('TrackerRemovePlayerId');

        const isSteamId64 = id.length === constants.STEAMID64_LENGTH ? true : false;

        if (!tracker) {
            interaction.deferUpdate();
            return;
        }

        if (isSteamId64) {
            tracker.players = tracker.players.filter(e => e.steamId !== id);
        }
        else {
            tracker.players = tracker.players.filter(e => e.playerId !== id || e.steamId !== null);
        }
        guildInstance.writeGuildInstanceFile(guildId, instance);

        log.info(lm.getIntl(Config.general.language, 'modalValueChange', {
            id: `${verifyId}`,
            value: `${id}`
        }));

        await discordMessages.sendTrackerMessage(guildId, ids.trackerId);
    }

    log.info(lm.getIntl(Config.general.language, 'userModalInteractionSuccess', {
        id: `${verifyId}`
    }));

    interaction.deferUpdate();
}