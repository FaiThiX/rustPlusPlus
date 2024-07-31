/*
    Copyright (C) 2023 Alexander Emanuelsson (alexemanuelol)
    Copyright (C) 2023 Squidysquid1

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

const Builder = require('@discordjs/builders');

import { log } from '../../index';
import * as discordMessages from '../discordTools/discord-messages';

module.exports = {
    name: 'cctv',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('cctv')
            .setDescription(client.intlGet(guildId, 'commandsCctvDesc'))
            .addStringOption(option =>
                option.setName('monument')
                    .setDescription(client.intlGet(guildId, 'rustMonument'))
                    .setRequired(true)
                    .addChoices(
                        { name: client.intlGet(guildId, 'abandonedMilitaryBase'), value: 'Abandoned Military Base' },
                        { name: client.intlGet(guildId, 'banditCamp'), value: 'Bandit Camp' },
                        { name: client.intlGet(guildId, 'theDome'), value: 'Dome' },
                        { name: client.intlGet(guildId, 'largeOilRig'), value: 'Large Oil Rig' },
                        { name: client.intlGet(guildId, 'missileSilo'), value: 'Missile Silo' },
                        { name: client.intlGet(guildId, 'outpost'), value: 'Outpost' },
                        { name: client.intlGet(guildId, 'smallOilRig'), value: 'Small Oil Rig' },
                        { name: client.intlGet(guildId, 'underwaterLab'), value: 'Underwater Labs' },
                    ));

    },

    async execute(client, interaction) {
        const verifyId = Math.floor(100000 + Math.random() * 900000);
        await client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!await client.validatePermissions(interaction)) return;
        await interaction.deferReply({ ephemeral: true });

        const monument = interaction.options.getString('monument');
        const cctvCodes = client.cctv.getCodes(monument);
        const dynamic = client.cctv.isDynamic(monument);

        log.info(client.intlGet(null, 'slashCommandValueChange', {
            id: `${verifyId}`,
            value: `${monument}`
        }));

        await discordMessages.sendCctvMessage(interaction, monument, cctvCodes, dynamic);
        log.info(client.intlGet(interaction.guildId, 'commandsCctvDesc'));
    },
};