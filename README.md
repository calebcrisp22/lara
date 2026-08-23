# Overscaled Discord Bot

This is the complete, minimal project for hosting the bot on Railway.

## Put it on GitHub

1. Create a new empty GitHub repository.
2. Upload **everything inside this folder** to the repository root:
   - `package.json`
   - `tsconfig.json`
   - `.env.example`
   - `README.md`
   - `src/bot.ts`
   - `src/index.ts`
3. Do not upload your real Discord token or create a `.env` file in GitHub.

## Deploy on Railway

1. Create a new Railway project from the GitHub repository.
2. In Railway, open **Variables** and add:
   - `DISCORD_TOKEN` = your Discord bot token
   - `DISCORD_GUILD_ID` = optional server ID for instant command registration
3. Railway should detect the Node project automatically.
4. If Railway asks for commands, use:
   - Build: `npm run build`
   - Start: `npm start`

The bot registers its slash commands when it starts. Without `DISCORD_GUILD_ID`, global commands can take a while to appear. With it, they appear in that server almost immediately.

## Discord permissions

Invite the bot with the `bot` and `applications.commands` scopes. For the ticket panel, allow View Channel, Send Messages, Embed Links, Manage Threads, and Use Application Commands.

Use `/ticketpanel` in a text channel to post the support embed. Its five buttons create private ticket threads.