# The Telegram bot

The Tabletop bot lives in your Telegram group. It turns feature requests into GitHub issues and a list in [REQUESTS.md](REQUESTS.md), and it answers "what's new?" and "where do I download it?".

It runs on **Cloudflare Workers** (free), so it answers within a second or two and nothing has to run on your PC. Until the Worker is set up, a slower backup on GitHub answers every 10 minutes or so; it stands down by itself once the Worker is working.

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

**Spam control:**
- **Who:** only your group counts, plus private messages from its members.
- **How many:** each person can send 10 requests a day; the group's owner and admins have no limit. To change it, add a variable `REQUESTS_PER_DAY` in Cloudflare (and on GitHub) with the number you want, or `0` for no limit.
- **How short:** requests need at least 10 characters.

Plain questions ("what's new?") get an answer when they end in a question mark, mention the bot, or reply to it.

## Part 1: the bot and the GitHub backup (done already)

1. **Make the bot.** With **@BotFather**: `/newbot`, then `/setprivacy` → your bot → **Disable** (so it sees "what's new?", not only commands).
2. **Add it to your group.** It has to be a group: members can't post in a channel. A channel's discussion group works.
3. **On GitHub,** under **Settings → Secrets and variables → Actions**:
   - **Secret** `TELEGRAM_TOKEN`: the bot's token. If you ever make a new token in @BotFather, update it here **and** in Cloudflare, or the release announcements stop.
   - If Telegram ever turns the group into a **supergroup** (it can happen when you change some group settings, make someone an admin, or the group grows), the group gets a new id starting with `-100`. The **Announce a release** run prints the new id as a warning; put it in `TELEGRAM_CHAT_ID` here and in Cloudflare.
   - **Variable** `TELEGRAM_CHAT_ID`: the group's id (`-944196680`).

   To find a group's id, send a message there and open `https://api.telegram.org/bot<token>/getUpdates` in your browser; look for `"chat":{"id":…`.

## Part 2: instant answers with Cloudflare (about 15 minutes)

### A GitHub token for the bot

The Worker creates the request issues on GitHub, so it needs its own key.

1. On GitHub, click your picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Token name:** `Tabletop bot`.
3. **Expiration:** the longest it offers. Put a reminder in your calendar to make a new one before then.
4. **Resource owner:** **BobsDomain**.
5. **Repository access:** **Only select repositories → VTT**.
6. **Permissions → Repository permissions:** **Issues: Read and write**, **Contents: Read-only**.
7. Click **Generate token** and copy it (it starts with `github_pat_`).

If BobsDomain is an organisation, it may have to allow the token first: in the organisation's **Settings → Personal access tokens**, approve the pending request.

### The Worker

1. Make a free account at [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Workers & Pages → Create → Create Worker** (Hello World). Name it `tabletop-bot` and click **Deploy**.
3. Click **Edit code**. Delete everything in the editor, paste the whole of [`bot/worker.js`](../bot/worker.js) from the repository, and click **Deploy**.
4. Back on the Worker's page: **Settings → Variables and Secrets → Add**, five times:

   | Type | Name | Value |
   | --- | --- | --- |
   | Secret | `TELEGRAM_TOKEN` | the bot's token from @BotFather |
   | Secret | `GITHUB_TOKEN` | the `github_pat_…` token from above |
   | Secret | `WEBHOOK_SECRET` | any 30 or so random letters and numbers (no spaces); only Telegram and the Worker know it |
   | Text | `TELEGRAM_CHAT_ID` | `-944196680` |
   | Text | `GITHUB_REPOSITORY` | `BobsDomain/VTT` |

   Click **Deploy** (or **Save and deploy**) when they're all in.
5. Copy the Worker's address from its page. It looks like `https://tabletop-bot.yourname.workers.dev`.
6. **Switch Telegram over.** In your browser, open that address with `/setup?key=` and your `WEBHOOK_SECRET` added. For example:
   `https://tabletop-bot.yourname.workers.dev/setup?key=YourLongRandomWord`

   It should show four ✔ lines. A ✖ line says what's wrong: usually a token pasted wrong, or a missing setting.
7. Send `/help` in the group: the answer comes straight away.

From now on, the GitHub backup sees that the Worker is answering and leaves the group alone. It still rebuilds `docs/REQUESTS.md` whenever a request changes.

### When the bot changes

When a new Tabletop version changes the bot, the release notes say so. Open the Worker → **Edit code**, paste the new `bot/worker.js` and **Deploy**. Your settings stay.

## New versions in the group

When you publish a release (tag and push), the release workflow posts it in the group. The post has the headlines from the changelog, the requests it finishes (the `(#2)` numbers), and links to the installers and the player guide. It uses the same `TELEGRAM_TOKEN` secret and `TELEGRAM_CHAT_ID` variable as the bot on GitHub, so there's nothing to set up.

**To post in your channel as well, or instead:**
1. Add the bot to the channel as an **administrator**, with permission to post messages.
2. On GitHub, under **Settings → Secrets and variables → Actions → Variables**, add `TELEGRAM_ANNOUNCE_CHAT_ID`. Its value is where to post: the channel's public name (like `@tabletopvtt`), its `-100…` id, or several separated by commas. For the group and the channel, use `-944196680,@tabletopvtt`.

If the post fails (the bot isn't in the chat, say), the release still goes out; the workflow's **Tell the Telegram group** step shows why.

## Looking after the requests

Every request is a GitHub issue with the **feature-request** label.

- **Planned:** add a `planned` label. The list and `/status` show 📅 Planned.
- **Done:** close it as **completed**. It shows ✅ Done.
- **Not doing it:** close it as **not planned**. It drops off the list.
- **To build it:** move it into the [roadmap](ROADMAP.md) as part of a release.

The list `docs/REQUESTS.md` is committed by GitHub itself, so in GitHub Desktop click **Fetch origin / Pull origin** before you commit, as GitHub Desktop will remind you.

## If something's wrong

- **No answer at all:** open the Worker's `/setup?key=…` address again. Its last line shows Telegram's view, including any error.
- **Going back to the GitHub backup only:** open `https://api.telegram.org/bot<token>/deleteWebhook` in your browser.
- **The group's id changed:** linking the group to a channel, or growing past 200 members, gives it a new `-100…` id. Update `TELEGRAM_CHAT_ID` in both places, on the Worker and on GitHub.
- **Free limits:** Cloudflare's free plan allows 100,000 messages a day, far more than a group sends. GitHub pauses the backup's schedule after 60 days without activity in the repository; **Actions → Telegram bot → Enable workflow** turns it back on.
