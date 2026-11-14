# The Telegram bot

The Tabletop bot lives in your Telegram group. It turns feature requests into GitHub issues and a list in [REQUESTS.md](REQUESTS.md), and it answers "what's new?" and "where do I download it?". It runs on GitHub every 10 minutes (`.github/workflows/telegram-bot.yml`), so nothing has to stay running on your PC; replies come within about 10 minutes.

## What people in the group can do

| Type | What happens |
| --- | --- |
| `/request Let players draw on the map` | A new request (#42), or a vote for an open one that looks the same |
| `/requests` | The open requests, most votes first |
| `/upvote 42` | A vote for #42 (one each) |
| `/status 42` | Requested, Planned, Done or Closed |
| `/new` or "what's new?" | The headlines of the latest release, with its link |
| `/download` or "where do I download it?" | The Player and DM installers and the player guide (PDF) |
| `/help` | The list of commands |

Spam control: only your group counts (and private messages from its members), each person can send 3 requests a day, and requests need at least 10 characters.

## Setting it up (about 10 minutes, once)

1. **Make the bot.** In Telegram, message **@BotFather**: `/newbot`, give it a name (Tabletop) and a username (for example `TabletopVTT_bot`). Copy the token it gives you.
2. **Let it read questions.** Still with @BotFather: `/setprivacy`, pick your bot, choose **Disable**. Without this it only sees commands like `/new`, not "what's new?".
3. **Show its commands.** @BotFather: `/setcommands`, pick your bot, and paste:
   ```
   request - Ask for a feature
   requests - What's been asked
   upvote - Vote for a request (its number)
   status - Where a request stands (its number)
   new - What's in the latest version
   download - Where to get the apps
   help - What I can do
   ```
4. **Add it to the group.** Add the bot to your Telegram group. For a channel, add it to the channel's discussion group: members can't post in the channel itself.
5. **Give GitHub the token.** On GitHub, open the VTT repository → **Settings → Secrets and variables → Actions → New repository secret**. Name: `TELEGRAM_TOKEN`, value: the token from step 1.
6. **Find the group's id.** Send any message in the group. Then on GitHub open **Actions → Telegram bot → Run workflow**. When it finishes, open the run and the **Read the group and answer** step: it shows `Message in chat -100… (your group)`. Copy that number, minus sign included.
7. **Tell the bot which group.** **Settings → Secrets and variables → Actions → Variables → New repository variable**. Name: `TELEGRAM_CHAT_ID`, value: the number from step 6.
8. **Try it.** In the group, send `/help`, then run the workflow once more (or wait up to 10 minutes).

If the run says it can't push, open **Settings → Actions → General → Workflow permissions** and choose **Read and write permissions**.

## Looking after the requests

Every request is a GitHub issue with the **feature-request** label.

- **Planned:** add a `planned` label. The list and `/status` show 📅 Planned.
- **Done:** close it as **completed**. It shows ✅ Done.
- **Not doing it:** close it as **not planned**. It drops off the list.
- **To build it:** move it into the [roadmap](ROADMAP.md) as part of a release.

The bot rewrites `docs/REQUESTS.md` and commits it itself, so in GitHub Desktop click **Fetch origin / Pull origin** before you commit, as GitHub Desktop will remind you.

## Good to know

- **The 10 minutes are approximate.** GitHub runs scheduled jobs when it can, and at busy times that can be later.
- **Inactive repos:** GitHub pauses scheduled jobs in a repository with no activity for 60 days. If the bot goes quiet, open **Actions → Telegram bot** and click **Enable workflow**.
- **Telegram keeps messages for 24 hours.** If the bot is paused longer than that, anything older is lost.
