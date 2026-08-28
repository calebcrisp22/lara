import {
  Client,
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
const logger = { info: console.info, warn: console.warn, error: console.error };

const TICKET_CATEGORY_ID = "1542402091706884116";
const TRANSCRIPT_CHANNEL_ID = "1542399274153672715";

type CommandDefinition = {
  name: string;
  description: string;
  option?: "user" | "string" | "number";
  permission?: bigint;
};

const commands: Array<
  [string, string, ("user" | "string" | "number")?, bigint?]
> = [
  ["afk", "Set yourself as AFK"],
  ["announce", "Send an announcement embed to a channel", "string"],
  ["automod addword", "Add a word to the banned words list", "string"],
  ["automod disable", "Disable automod for this server"],
  ["automod enable", "Enable automod for this server"],
  ["automod removeword", "Remove a word from the banned words list", "string"],
  ["automod settings", "View current automod settings"],
  ["automod toggleinvites", "Toggle blocking Discord invite links"],
  ["automod togglelinks", "Toggle blocking all links"],
  ["automod togglespam", "Toggle basic anti-spam protection"],
  ["autorole", "Set a role to be given to new members automatically", "string"],
  ["avatar", "Get a user's avatar", "user"],
  ["ban", "Ban a member from the server", "user", PermissionFlagsBits.BanMembers],
  ["banner", "Get a user's banner", "user"],
  ["botinfo", "View information about the bot"],
  ["channelinfo", "Get info about a channel"],
  ["claim", "Claim the current ticket"],
  ["clearwarnings", "Clear all warnings for a member", "user"],
  ["delwarn", "Delete a single warning by its number", "number"],
  ["embed", "Create and send a custom embed", "string"],
  ["giveaway", "Start a quick giveaway (react to enter)", "string"],
  ["giveroles", "Give the Active Member role to all online members"],
  ["help", "View all available commands"],
  ["imagelink", "Get the direct link of an image from a message"],
  ["inviteleaderboard", "View the invite leaderboard"],
  ["invitepanel", "Post the invite tracking panel"],
  ["invites", "Check your invite stats", "user"],
  ["kick", "Kick a member from the server", "user", PermissionFlagsBits.KickMembers],
  ["leaderboard", "View the server XP leaderboard"],
  ["lock", "Lock a channel so members can't send messages", undefined, PermissionFlagsBits.ManageChannels],
  ["lockdown", "Lock ALL channels in the server", undefined, PermissionFlagsBits.ManageChannels],
  ["membercount", "Show the server member count"],
  ["modlogs", "View a member's full moderation history (warnings)", "user"],
  ["nick", "Change a member's nickname", "string"],
  ["ping", "Check the bot's latency"],
  ["poll", "Create a quick yes/no poll", "string"],
  ["purge", "Delete a number of messages", "number", PermissionFlagsBits.ManageMessages],
  ["rank", "Check your or someone else's level", "user"],
  ["reactionrole", "Create a reaction-role message: react to get a role", "string"],
  ["reactionroleadd", "Add another emoji→role pair to an existing reaction-role message", "string"],
  ["remind", "Get a DM reminder after a set time", "string"],
  ["removelevelrole", "Remove a level role reward", "string"],
  ["resetxp", "Reset a user's XP and level to zero", "user"],
  ["roleadd", "Add a role to a member", "user", PermissionFlagsBits.ManageRoles],
  ["rolelist", "List all roles in this server"],
  ["roleremove", "Remove a role from a member", "user", PermissionFlagsBits.ManageRoles],
  ["ticketpanel", "Post the support ticket panel", undefined, PermissionFlagsBits.ManageChannels],
  ["sa_addcoupon", "Create a discount coupon", "string"],
  ["sa_addproduct", "Create a new product in your SellAuth shop", "string"],
  ["sa_blacklist", "List blacklist entries on your shop"],
  ["sa_blacklistadd", "Add an entry (email/ip/etc) to the SellAuth blacklist", "string"],
  ["sa_blacklistremove", "Remove a blacklist entry by its ID", "string"],
  ["sa_coupons", "List all coupons"],
  ["sa_deletecoupon", "Delete a coupon", "string"],
  ["sa_deleteproduct", "Delete a product from your shop", "string"],
  ["sa_editproduct", "Edit an existing product", "string"],
  ["sa_invoice", "Look up a SellAuth invoice by ID", "string"],
  ["sa_invoices", "List recent invoices for your shop"],
  ["sa_order", "View a specific order", "string"],
  ["sa_orders", "List recent orders from your shop"],
  ["sa_product", "View details of a specific product", "string"],
];

const commandDefinitions: CommandDefinition[] = commands.map(([name, description, option, permission]) => ({
  name,
  description,
  option,
  permission,
}));

function commandBuilder(command: CommandDefinition): SlashCommandBuilder {
  const builder = new SlashCommandBuilder()
    .setName(command.name.replace(" ", "-"))
    .setDescription(command.description);

  if (command.permission) builder.setDefaultMemberPermissions(command.permission);
  if (command.option === "user") {
    builder.addUserOption((option) =>
      option.setName("user").setDescription("Choose a member").setRequired(true),
    );
  } else if (command.option === "number") {
    builder.addIntegerOption((option) =>
      option.setName("amount").setDescription("Enter a number").setRequired(true).setMinValue(1),
    );
  } else if (command.option === "string") {
    builder.addStringOption((option) =>
      option.setName("value").setDescription("Enter a value").setRequired(true),
    );
  }
  return builder;
}

function displayName(interaction: ChatInputCommandInteraction): string {
  return interaction.member && "displayName" in interaction.member
    ? interaction.member.displayName
    : interaction.user.displayName;
}

const SELLAUTH_API_BASE = "https://api.sellauth.com/v1";

type SellauthInvoice = Record<string, unknown>;

async function fetchSellauthInvoice(invoiceId: string): Promise<SellauthInvoice> {
  const apiKey = process.env["SELLAUTH_API_KEY"];
  const shopId = process.env["SELLAUTH_SHOP_ID"];
  if (!apiKey || !shopId) {
    throw new Error("SELLAUTH_API_KEY or SELLAUTH_SHOP_ID is not configured.");
  }

  const response = await fetch(`${SELLAUTH_API_BASE}/shops/${shopId}/invoices/${invoiceId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    throw new Error(`No invoice found with ID \`${invoiceId}\`.`);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`SellAuth API returned ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }

  const data = await response.json();
  return (data && typeof data === "object" && "data" in data ? (data as { data: SellauthInvoice }).data : data) as SellauthInvoice;
}

function formatSellauthValue(value: unknown): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "object") {
    const json = JSON.stringify(value);
    return json.length > 1000 ? `${json.slice(0, 1000)}…` : json;
  }
  return String(value);
}

function buildInvoiceEmbed(invoiceId: string, invoice: SellauthInvoice): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Invoice #${invoiceId}`)
    .setTimestamp(new Date());

  const entries = Object.entries(invoice);
  if (entries.length === 0) {
    embed.setDescription("No invoice data returned by SellAuth.");
    return embed;
  }

  for (const [key, value] of entries.slice(0, 25)) {
    embed.addFields({
      name: key,
      value: formatSellauthValue(value).slice(0, 1024) || "N/A",
      inline: typeof value !== "object",
    });
  }

  return embed;
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const command = interaction.commandName;
  const value = interaction.options.getString("value");
  const user = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");

  if (command === "ping") {
    await interaction.reply(`Pong! ${interaction.client.ws.ping}ms`);
    return;
  }
  if (command === "botinfo") {
    await interaction.reply({
      embeds: [{
        title: "overscaled",
        description: "A fast, full-featured Discord utility bot.",
        color: 0x5865f2,
        fields: [
          { name: "Commands", value: `${commands.length}`, inline: true },
          { name: "Servers", value: `${interaction.client.guilds.cache.size}`, inline: true },
          { name: "Uptime", value: `${Math.floor(interaction.client.uptime / 60000)}m`, inline: true },
        ],
      }],
    });
    return;
  }
  if (command === "membercount" && interaction.guild) {
    await interaction.reply(`This server has **${interaction.guild.memberCount}** members.`);
    return;
  }
  if (command === "ban" && interaction.guild && user) {
    await interaction.guild.members.ban(user, { reason: `Banned by ${displayName(interaction)}` });
    await interaction.reply(`Banned **${user.tag}** from the server.`);
    return;
  }
  if (command === "kick" && interaction.guild && user) {
    await interaction.guild.members.kick(user, `Kicked by ${displayName(interaction)}`);
    await interaction.reply(`Kicked **${user.tag}** from the server.`);
    return;
  }
  if (command === "purge" && amount && interaction.channel?.isTextBased() && "bulkDelete" in interaction.channel) {
    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({ content: `Deleted **${deleted.size}** messages.`, ephemeral: true });
    return;
  }
  if (command === "lock" && interaction.guild && interaction.channel && "permissionOverwrites" in interaction.channel) {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    await interaction.reply("This channel is now locked.");
    return;
  }
  if (command === "help") {
    await interaction.reply({
      embeds: [{
        title: "overscaled commands",
        description: commands.map(([name, description]) => `**/${name.replace(" ", "-")}** — ${description}`).join("\n"),
        color: 0x5865f2,
      }],
    });
    return;
  }
  if (command === "avatar") {
    await interaction.reply(user?.displayAvatarURL({ size: 1024 }) ?? interaction.user.displayAvatarURL({ size: 1024 }));
    return;
  }
  if (command === "poll") {
    await interaction.reply(`**${value ?? "Poll"}**\nReact with ✅ for yes or ❌ for no.`);
    const message = await interaction.fetchReply();
    await message.react("✅");
    await message.react("❌");
    return;
  }
  if (command === "rolelist" && interaction.guild) {
    const roles = [...interaction.guild.roles.cache.values()]
      .filter((role) => role.id !== interaction.guild?.id)
      .sort((a, b) => b.position - a.position)
      .slice(0, 25)
      .map((role) => `<@&${role.id}>`)
      .join(" ");
    await interaction.reply(roles || "This server has no roles yet.");
    return;
  }
  if (command === "ticketpanel") {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("🎫 Support Tickets")
      .setDescription(
        [
          "Need help? Open a ticket below and our team will assist you.",
          "",
          "👑 **Speak to Owner** — Direct message to the owner",
          "🛠️ **Support** — General help & questions",
          "💰 **Purchase** — Want to buy something?",
          "🌐 **Website Purchased** — Bought from our website",
          "⚠️ **Problem with Purchase** — Issue with an order",
          "",
          "*Select a category below to open your ticket.*",
          "",
          "One ticket per user • Staff will respond shortly",
        ].join("\n"),
      );
    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket_owner").setLabel("👑 Speak to Owner").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("ticket_support").setLabel("🛠️ Support").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ticket_purchase").setLabel("💰 Purchase").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ticket_website").setLabel("🌐 Website Purchased").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ticket_problem").setLabel("⚠️ Problem with Purchase").setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({ embeds: [embed], components: [buttons] });
    return;
  }
  if (command === "sa_invoice") {
    const invoiceId = value?.trim();
    if (!invoiceId) {
      await interaction.reply({ content: "Please provide an invoice ID.", ephemeral: true });
      return;
    }
    await interaction.deferReply();
    try {
      const invoice = await fetchSellauthInvoice(invoiceId);
      await interaction.editReply({ embeds: [buildInvoiceEmbed(invoiceId, invoice)] });
    } catch (error) {
      logger.error({ err: error, invoiceId }, "Failed to fetch SellAuth invoice");
      const message = error instanceof Error ? error.message : "Failed to fetch that invoice from SellAuth.";
      await interaction.editReply({ content: `❌ ${message}` });
    }
    return;
  }

  await interaction.reply({
    content: `**/${command}** is ready. ${value ? `Received: \`${value.slice(0, 150)}\`` : user ? `Target: ${user}` : "Configure this command's settings to enable it."}`,
    ephemeral: true,
  });
}

export async function startDiscordBot(): Promise<void> {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_TOKEN is not set; Discord bot is disabled.");
    return;
  }

  const staffRoleId = process.env["DISCORD_STAFF_ROLE_ID"];

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  let commandsRegistered = false;

  client.once("ready", async (readyClient) => {
    if (commandsRegistered) return;
    commandsRegistered = true;

    const rest = new REST({ version: "10" }).setToken(token);
    const payload = commandDefinitions.map(commandBuilder).map((command) => command.toJSON());
    const guildId = process.env["DISCORD_GUILD_ID"];
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(readyClient.application.id, guildId), { body: payload });
      logger.info({ guildId, commandCount: payload.length }, "Registered guild slash commands");
    } else {
      await rest.put(Routes.applicationCommands(readyClient.application.id), { body: payload });
      logger.info({ commandCount: payload.length }, "Registered global slash commands");
    }
    logger.info({ tag: readyClient.user.tag }, "Discord bot connected");
  });

  client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
      try {
        if (!interaction.guild) {
          await interaction.reply({ content: "Tickets can only be opened in a server.", ephemeral: true });
          return;
        }
        const labels: Record<string, string> = {
          ticket_owner: "Speak to Owner",
          ticket_support: "Support",
          ticket_purchase: "Purchase",
          ticket_website: "Website Purchased",
          ticket_problem: "Problem with Purchase",
        };
        const label = labels[interaction.customId] ?? "Support";

        // Create the ticket text channel under the single shared ticket category
        const ticketChannel = await interaction.guild.channels.create({
          name: `ticket-${Date.now()}`,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          reason: `Support ticket channel for ${interaction.user.tag}`,
          permissionOverwrites: [
            {
              id: interaction.guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: interaction.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages],
            },
          ],
        });
        
        // Send welcome message with staff mention
        let welcomeMessage = `Welcome ${interaction.user}! A team member will respond shortly.\\n\\n**Category:** ${label}`;
        if (staffRoleId) {
          welcomeMessage = `<@&${staffRoleId}> ${welcomeMessage}`;
        }
        await ticketChannel.send(welcomeMessage);
        
        // Send ticket management buttons
        const ticketButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("ticket_claim").setLabel("✋ Claim Ticket").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("ticket_close").setLabel("🔒 Close Ticket").setStyle(ButtonStyle.Danger),
        );
        await ticketChannel.send({ components: [ticketButtons] });
        
        await interaction.reply({ content: `Your ticket has been created in ${ticketChannel}`, ephemeral: true });
      } catch (error) {
        logger.error({ err: error }, "Ticket creation failed");
        if (!interaction.replied) {
          await interaction.reply({ content: "I couldn't create that ticket. Check my Manage Channels permission.", ephemeral: true });
        }
      }
      return;
    }
    
    if (interaction.isButton() && interaction.customId === "ticket_claim") {
      try {
        if (!interaction.channel || !("name" in interaction.channel)) {
          await interaction.reply({ content: "Could not find ticket channel.", ephemeral: true });
          return;
        }
        
        const channelName = interaction.channel.name;
        if (!channelName) {
          await interaction.reply({ content: "Could not find ticket channel.", ephemeral: true });
          return;
        }
        const newName = channelName.startsWith("ticket-") ? `ticket-claimed-${Date.now()}` : `${channelName}-claimed`;
        
        const channel = interaction.channel;
        if (!channel.isTextBased() || !("edit" in channel)) {
          await interaction.reply({ content: "This channel type does not support claiming.", ephemeral: true });
          return;
        }
        await channel.edit({ name: newName, topic: `Claimed by ${interaction.user.tag}` });
        await interaction.reply({ content: `✅ Ticket claimed by ${interaction.user}`, ephemeral: false });
      } catch (error) {
        logger.error({ err: error }, "Ticket claim failed");
        await interaction.reply({ content: "Failed to claim ticket.", ephemeral: true });
      }
      return;
    }
    
    if (interaction.isButton() && interaction.customId === "ticket_close") {
      try {
        const channel = interaction.channel;
        if (!interaction.guild || !channel || !("delete" in channel) || !channel.isTextBased()) {
          await interaction.reply({ content: "Could not find ticket channel.", ephemeral: true });
          return;
        }

        await interaction.reply({ content: "🔒 Closing ticket in 5 seconds..." });

        // Build a transcript of the ticket channel's messages
        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = [...messages.values()].reverse();
        const transcriptText = sortedMessages
          .map((message) => {
            const timestamp = new Date(message.createdTimestamp).toISOString();
            const content = message.content || (message.embeds.length ? "[embed]" : "[no content]");
            return `[${timestamp}] ${message.author.tag}: ${content}`;
          })
          .join("\n");

        const transcriptChannel = await interaction.guild.channels.fetch(TRANSCRIPT_CHANNEL_ID).catch(() => null);
        const channelName = "name" in channel && channel.name ? channel.name : channel.id;
        if (transcriptChannel && transcriptChannel.isTextBased()) {
          const attachment = new AttachmentBuilder(Buffer.from(transcriptText || "No messages found.", "utf-8"), {
            name: `transcript-${channelName}.txt`,
          });
          await transcriptChannel.send({
            content: `📋 Transcript for ticket **${channelName}**, closed by ${interaction.user.tag}`,
            files: [attachment],
          });
        } else {
          logger.error({ transcriptChannelId: TRANSCRIPT_CHANNEL_ID }, "Transcript channel not found");
        }

        setTimeout(() => channel.delete().catch(logger.error), 5000);
      } catch (error) {
        logger.error({ err: error }, "Ticket close failed");
        await interaction.reply({ content: "Failed to close ticket.", ephemeral: true });
      }
      return;
    }
    
    if (!interaction.isChatInputCommand()) return;
    try {
      await handleCommand(interaction);
    } catch (error) {
      logger.error({ err: error, command: interaction.commandName }, "Discord command failed");
      const message = { content: "Something went wrong while running that command.", ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(message);
      else await interaction.reply(message);
    }
  });

  client.on("error", (error) => logger.error({ err: error }, "Discord client error"));
  await client.login(token);
}

