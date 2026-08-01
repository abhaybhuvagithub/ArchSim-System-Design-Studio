// Long-form problem breakdowns for the Breakdown tab.
//
// Keyed by template name. A breakdown is a flat list of sections so the
// contents rail and scroll-spy stay trivial; `h: 1` is a major heading and
// `h: 2` is a sub-heading nested under the previous major one.
//
// Block shorthand (first element is the type):
//   ['p',    text]                        paragraph, supports **bold** and [links](url)
//   ['steps',[...]]                       numbered list
//   ['bul',  [...]]                       bulleted list
//   ['reqs', { core: [], out: [] }]       requirements with "below the line"
//   ['nums', [[value, label], ...]]       back-of-envelope cards
//   ['ent',  [[name, description], ...]]  core entities
//   ['api',  [{ dir, name, body }, ...]]  commands / endpoints
//   ['note'|'warn'|'calc', text]          callouts
//   ['code', text]                        preformatted block
//   ['opts', [{ rating, title, approach, challenges, best }]]
//   ['links',[[label, url, note], ...]]   references

export const BREAKDOWNS = {

  'Chat (WhatsApp)': {
    title: 'WhatsApp',
    meta: 'Real-time updates · medium · ~35 minutes',
    intro:
      'A messaging service that lets users send and receive encrypted messages from their phones and computers. ' +
      'Famously built on Erlang and renowned for handling enormous scale on a tiny infrastructure footprint. ' +
      'Two distinct problems hide inside this one: delivering messages durably, and delivering them in real time.',
    sections: [

      // ─────────────────────────── Understanding the Problem
      {
        id: 'understanding', h: 1, title: 'Understanding the Problem',
        blocks: [
          ['p', 'Messaging apps have an enormous surface area, and your interviewer does not want all of it. The obvious capabilities are almost certainly in scope, but it is worth asking whether they want you to go further. Spending too long here makes it harder to give detail everywhere else, so scope quickly and move.'],
          ['note', 'Before settling the non-functional requirements, ask how the app is actually used. Mostly 1:1 chats, or large groups? How often do people send? These are not strictly requirements, but they dictate design decisions later — and getting them wrong is expensive.'],
        ],
      },
      {
        id: 'functional-requirements', h: 2, title: 'Functional Requirements',
        blocks: [
          ['reqs', {
            core: [
              'Users should be able to start group chats with multiple participants (limit 100).',
              'Users should be able to send/receive messages.',
              'Users should be able to receive messages sent while they are not online (up to 30 days).',
              'Users should be able to send/receive media in their messages.',
            ],
            out: ['Audio/video calling', 'Interactions with businesses', 'Registration and profile management'],
          }],
          ['note', 'The third requirement is not obvious to everyone, but it is the most interesting one to design. A good interviewer will steer you towards it if you do not raise it yourself.'],
        ],
      },
      {
        id: 'non-functional-requirements', h: 2, title: 'Non-Functional Requirements',
        blocks: [
          ['reqs', {
            core: [
              'Messages delivered to available users with low latency, < 500ms.',
              'Guaranteed deliverability — messages must make their way to users.',
              'Handle billions of users at high throughput.',
              'Messages stored on centralised servers no longer than necessary.',
              'Resilient against failures of individual components.',
            ],
            out: ['Exhaustive treatment of security and E2E encryption internals', 'Spam and scraping prevention'],
          }],
          ['nums', [
            ['200M', 'daily active users'],
            ['20', 'messages per user per day'],
            ['~40K/s', 'messages sent (≈ 4B/day)'],
            ['~100K/s', 'DB writes (message + inbox rows)'],
            ['200M', 'concurrent connections at peak'],
            ['1–2M', 'connections per host → hundreds of servers'],
          ]],
          ['note', 'Listing out-of-scope requirements is a nice-to-have. It shows product thinking and lets the interviewer reprioritise. But if nothing comes to mind quickly, do not burn clock on it — it contributes almost nothing to a hiring decision.'],
        ],
      },

      // ─────────────────────────── The Set Up
      { id: 'the-set-up', h: 1, title: 'The Set Up', blocks: [] },
      {
        id: 'planning-the-approach', h: 2, title: 'Planning the Approach',
        blocks: [
          ['p', 'Take a moment to plan the session before drawing anything. First, notice that a 1:1 message is simply a group chat with two participants — so solve the general case even while you talk through the 1:1 one. Second, notice the design splits cleanly in two: durably delivering messages, and doing it in real time.'],
          ['p', 'From there, walk the core requirements and solve each as simply as possible. The result will be slow and unscalable. That is fine and expected — it is a starting point to optimise from in the deep dives, where scaling, robustness and any extra features the interviewer throws in get addressed.'],
          ['note', 'For infrastructure-flavoured problems, reason about a single node first. The path to scale is usually straightforward from there. Solve for scale before you understand the mechanics and you will very likely back yourself into a corner.'],
        ],
      },
      {
        id: 'core-entities', h: 2, title: 'Defining the Core Entities',
        blocks: [
          ['p', 'Think through the main nouns of the system. The point is to give yourself the right language to reason with, and to set up the API and data model that follow.'],
          ['ent', [
            ['User', 'A person on the platform. Owns one or more clients.'],
            ['Chat', 'A conversation between 2–100 users. A 1:1 chat is just a chat of size two.'],
            ['Message', 'Text plus optional attachment URLs, stamped with a server receive time.'],
            ['Client', 'A single device — phone, laptop, tablet. Delivery is tracked per client, not per user.'],
          ]],
          ['note', 'Interviewers are not scoring the entity list itself; it is an intermediate step. That does not make it unimportant — getting the entities wrong is a great way to build on a broken foundation. Spend a moment, get them right, keep moving.'],
        ],
      },
      {
        id: 'api', h: 2, title: 'API or System Interface',
        blocks: [
          ['p', 'Unlike most products where REST is appropriate, a chat app has high-frequency updates flowing in both directions. That is a perfect case for a bi-directional socket. We will use **WebSockets over TLS**, though a custom protocol over a raw TLS-encrypted TCP connection would work equally well.'],
          ['p', 'The client opens the socket on app launch, and both sides exchange commands over it. Those commands are our API.'],
          ['api', [
            { dir: '→', name: 'createChat', body: '{\n  "participants": [],\n  "name": ""\n} -> {\n  "chatId": ""\n}' },
            { dir: '→', name: 'sendMessage', body: '{\n  "chatId": "",\n  "message": "",\n  "attachments": []\n} -> {\n  "status": "SUCCESS" | "FAILURE",\n  "messageId": ""\n}' },
            { dir: '→', name: 'getAttachmentTarget', body: '{\n  "hash": "",\n  "size": 0\n} -> {\n  "uploadUrl": "",\n  "attachmentUrl": ""\n}' },
            { dir: '→', name: 'modifyChatParticipants', body: '{\n  "chatId": "",\n  "userId": "",\n  "operation": "ADD" | "REMOVE"\n} -> "SUCCESS" | "FAILURE"' },
            { dir: '←', name: 'chatUpdate', body: '{\n  "chatId": "",\n  "participants": []\n} -> "RECEIVED"' },
            { dir: '←', name: 'newMessage', body: '{\n  "chatId": "",\n  "userId": "",\n  "message": "",\n  "attachments": []\n} -> "RECEIVED"' },
            { dir: '↔', name: 'ping / pong', body: 'heartbeat; carries the user\'s current sequence number' },
          ]],
          ['warn', 'The client acknowledgement is non-obvious but crucial. By forcing clients to ack, we know for certain a message reached the device — and only then is it safe to delete from the inbox. Without acks we cannot tell "delivered" from "lost".'],
          ['note', 'Enumerating every command eats clock. In a real interview, write the command names, sketch one or two payloads, and say "I\'ll come back to this as I learn more". That is completely acceptable, and it is usually wise to summarise the API before the high-level design in case things need to change.'],
        ],
      },

      // ─────────────────────────── High-Level Design
      {
        id: 'high-level-design', h: 1, title: 'High-Level Design',
        blocks: [['p', 'Now that we have a base to work with, let us implement the requirements one at a time while satisfying them as simply as possible.']],
      },
      {
        id: 'hld-1', h: 2, title: '1) Users should be able to start group chats with multiple participants (limit 100)',
        focus: ['a', 'lb', 'ws'],
        blocks: [
          ['p', 'Start with a simple service behind an **L4 load balancer** (we are using WebSockets) that writes chat metadata to a database. A key/value store gives us fast lookups and easy scale-out, though there are plenty of workable alternatives.'],
          ['steps', [
            'User connects to the service and sends a createChat message.',
            'The service creates a Chat record plus a ChatParticipant record per member. For small chats this is a single transaction (up to 100 items); near the participant limit we batch the writes.',
            'The service returns the chatId to the user.',
          ]],
          ['p', '**Data model.** The Chat table is only ever looked up by id, so a simple primary key on chatId is enough. ChatParticipant needs two access patterns: all participants in a chat, and all chats for a user.'],
          ['bul', [
            'Composite primary key — chatId as partition key, participantId as sort key. Querying the partition returns every participant in a chat.',
            'A Global Secondary Index keyed participantId (partition) + chatId (sort) returns every chat for a user. The index is kept in sync automatically.',
          ]],
          ['note', 'Can we use an L7 load balancer? In many cases yes — WebSocket support is widespread. But we need none of L7\'s capabilities here: no path or header routing, no spreading HTTP requests across servers behind one client connection. L4 is sufficient and generally faster.'],
        ],
      },
      {
        id: 'hld-2', h: 2, title: '2) Users should be able to send/receive messages.',
        focus: ['a', 'b', 'lb', 'ws'],
        blocks: [
          ['p', 'Now we start taking advantage of the WebSocket connection. To keep things simple while we get off the ground, assume a **single host** for the Chat Server.'],
          ['p', 'When users connect, we track them in an in-memory hash map from user id to WebSocket connection. That map is how we know who is online and how to reach them.'],
          ['steps', [
            'User sends a sendMessage message to the Chat Server.',
            'The Chat Server looks up all participants in the chat via the ChatParticipant table.',
            'The Chat Server finds each participant\'s connection in its internal hash table and sends the message down it.',
          ]],
          ['warn', 'This is obviously a terrible solution for scale — say so out loud to stop your interviewer itching. We are also assuming every user is online and connected to this same server. Both are false. But under those conditions it works, and the mechanics are right, which is what we needed to establish.'],
        ],
      },
      {
        id: 'hld-3', h: 2, title: '3) Users should be able to receive messages sent while they are not online (up to 30 days).',
        focus: ['a', 'b', 'lb', 'ws', 'q', 'inbox', 'push'],
        blocks: [
          ['p', 'This requirement forces us to store messages, which is also our opportunity to make delivery robust rather than best-effort. Keep an **Inbox** per user holding all undelivered messages. When a message is sent, write it to each recipient\'s inbox first; if they are online, attempt immediate delivery too.'],
          ['calc', 'How much write throughput does this add? The vast majority of chats are 1:1, and the average user sends about 20 messages per day. With 200M active users that is 4B messages/day, roughly 40K messages/second. Each 1:1 message writes once to Messages and once to Inbox, so even accounting for group chats we are around 100K writes/second — well within reach with userId as the partition key.'],
          ['p', '**Sending a message:**'],
          ['steps', [
            'Sender sends sendMessage to the Chat Server.',
            'The Chat Server looks up all participants via the ChatParticipant table.',
            'The Chat Server writes the message to the Message table and creates an Inbox entry for each recipient.',
            'The Chat Server returns SUCCESS or FAILURE to the sender with the final message id.',
            'The Chat Server looks up each participant\'s connection and attempts delivery via newMessage.',
            'On receipt the client sends an ack, and the Chat Server deletes that entry from the Inbox.',
          ]],
          ['p', '**When a disconnected client comes back:**'],
          ['steps', [
            'Look up the user\'s Inbox and find undelivered message ids.',
            'For each id, look up the body in the Message table.',
            'Write those messages to the client\'s connection via newMessage.',
            'The client acks on receipt.',
            'The Chat Server deletes the entries from the Inbox.',
          ]],
          ['p', 'Finally, set a TTL on items in both tables so old messages age out automatically. We promised not to keep them longer than necessary, and it saves writing a cleanup job.'],
        ],
      },
      {
        id: 'hld-4', h: 2, title: '4) Users should be able to send/receive media in their messages.',
        focus: ['a', 'b', 'lb', 'ws', 'q', 'inbox', 'media'],
        blocks: [
          ['p', 'Media is annoying: bandwidth- and storage-intensive, and exactly the wrong job for a server holding hundreds of thousands of sockets. Better to use purpose-built technology — which is how WhatsApp actually works, with attachments uploaded over a separate HTTP path rather than the socket.'],
          ['opts', [
            {
              rating: 'Bad', title: 'Keep attachments in the database',
              approach: 'The Chat Server accepts the attachment media over the WebSocket connection and saves it in the database. Add another message type for users to retrieve attachments.',
              challenges: 'Most databases are not optimised for large binary blobs. Worse, we cripple the bandwidth available to our Chat Servers by occupying them with comparatively dumb storage and retrieval.',
            },
            {
              rating: 'Good', title: 'Send attachments via the chat server',
              approach: 'The Chat Server accepts the media, then pushes it off to blob storage with a 30-day TTL. Recipients query blob storage directly via a pre-signed URL.',
              challenges: 'Chat Servers still have to ingest the media and forward it — a wasted step. Expiring attachments once every recipient has downloaded them is unhandled, and encryption and security need extra work.',
            },
            {
              rating: 'Great', title: 'Manage attachments separately',
              approach: 'Give users permission to upload directly to blob storage. The client sends getAttachmentTarget and receives a pre-signed URL; once uploaded it has a URL it passes to the Chat Server as an opaque string inside the message. Recipients download directly with their own pre-signed URL. Bytes never touch our servers.',
              challenges: 'Still does not expire media once all recipients have it. A CDN in front of blob storage buys little — capped at 100 participants, the cache benefits are small.',
              best: true,
            },
          ]],
          ['p', 'So we now have real-time delivery, persistence for offline use, and attachments. It just does not scale — yet.'],
        ],
      },

      // ─────────────────────────── Deep Dives
      {
        id: 'deep-dives', h: 1, title: 'Potential Deep Dives',
        blocks: [
          ['p', 'With the functional requirements met, it is time to dig into the non-functional ones and solve the issues we earmarked along the way — the obvious scalability problems plus the auxiliary questions that demonstrate command of the material.'],
          ['note', 'How much you should proactively lead here is a function of seniority. Every level should be quick to point out that the single-host design will not scale. Beyond that, it is reasonable for a mid-level interviewer to drive; for senior and staff+ the expectation is that you look around corners yourself.'],
        ],
      },
      {
        id: 'dd-1', h: 2, title: '1) How can we handle billions of simultaneous users?',
        focus: ['a', 'b', 'lb', 'ws', 'sess', 'q', 'inbox'],
        blocks: [
          ['p', 'Our single-host system is convenient but unrealistic. With 1B users we might expect 200M connected at any one time. WhatsApp famously served 1–2M users per host, which still leaves us needing hundreds of chat servers — a lot of simultaneous connections.'],
          ['p', 'Adding servers introduces a new problem: sender and recipient may be connected to different hosts. If User A sends to Users B and C via Chat Server 1, but C is connected to Chat Server 2, Server 1 has no socket to deliver on. This is a **routing** problem.'],
          ['opts', [
            {
              rating: 'Bad', title: 'Naively horizontally scale',
              approach: 'Put a load balancer in front of the Chat Servers and add hosts.',
              challenges: 'This will not work. A server can accept a message for a chat but is no longer guaranteed to hold connections for each client that needs to receive it. Events and messages get silently dropped. Do not be tempted by this in an interview.',
            },
            {
              rating: 'Bad', title: 'Keep a Kafka topic per user',
              approach: 'Model the Inbox as a Kafka topic per user. On connect, a Chat Server subscribes to that user\'s topic; to send, publish to the recipient\'s topic and whichever server is subscribed forwards it down the socket.',
              challenges: 'Kafka is not built for billions of topics and carries significant overhead per topic — on the order of 50KB, so 50TB+ of storage for 1B users. You can conceive of fixes like "super topics" grouping users on a server, but you quickly find yourself reinventing the good parts of the alternatives below with none of the benefit.',
            },
            {
              rating: 'Good', title: 'Consistent hashing of chat servers',
              approach: 'Always assign a user to a specific Chat Server based on their user id, so we always know which server owns them. Keep a central registry of server count, addresses and hash ranges in ZooKeeper or etcd. To deliver, connect directly to the owning server and call an API that pushes to the connected user.',
              challenges: 'Each Chat Server must maintain a connection to every other, forcing servers to be large in size and small in number. Scaling requires careful orchestration of dropped connections so users reconnect elsewhere without a thundering herd, and events must be sent to both servers during a rebalance to avoid dropping messages. All solvable — but your interviewer will expect you to talk through each.',
            },
            {
              rating: 'Great', title: 'Offload to Pub/Sub',
              approach: 'Use a purpose-built system for bouncing messages between servers. Redis Pub/Sub keeps a very lightweight hashmap of socket connections and lets you ferry messages to arbitrary destinations. On connect, the Chat Server subscribes to a channel for that user id and forwards anything received down the socket. To send, publish to the recipient\'s channel; the subscribing server delivers it.',
              challenges: 'It adds latency for the Redis hop — small, single-digit milliseconds, but real. Every Chat Server needs a connection to every Redis node, which is surmountable because the cluster stays small. Pub/Sub is at-most-once, so a transient failure loses that delivery.',
              best: true,
            },
          ]],
          ['p', '**Why is at-most-once acceptable?** Because we write to the Inbox and Message tables *before* publishing:'],
          ['steps', [
            'Write the message to the Message table and create Inbox entries — durable.',
            'Return success to the sender.',
            'Publish to Pub/Sub for real-time delivery — best effort.',
          ]],
          ['p', 'If step 3 fails, the message is still durably stored. Recipients receive it when they reconnect via the Inbox sync, or through periodic polling for connected clients that missed a publish. Durability and realtime are deliberately separated.'],
          ['note', 'The difference from Kafka is that Pub/Sub does not manage storage. Kafka persists to disk and maintains consumer offsets, which is where the per-topic overhead comes from. Redis Pub/Sub channels are essentially in-memory pointers to subscriber connections. In practice you would still shard channels across a Redis cluster by user id rather than running everything through one instance.'],
          ['p', '**Should we partition by chat or by user?** It depends on the number of chats per user and the size of those chats. Two scenarios make it clear:'],
          ['bul', [
            '**Users have 250 chats each, all 1:1.** Partition by chat and each server subscribes to 250 channels per connected user. Partition by user and it subscribes to one. Clear win for per-user.',
            '**Users have 1 chat each, with 100 participants.** Partition by chat and a message is one publish. Partition by user and it is 99 publishes. Clear win for per-chat.',
          ]],
          ['p', 'WhatsApp is dominated by 1:1 chats, and we explicitly capped participants at 100. Hundreds of redundant channels would stress Redis for little benefit, so **partition by user**.'],
          ['note', 'Senior/staff follow-up: this is a "celebrity problem" — an uncommon edge case disproportionately affecting the system. A good answer is to adapt the strategy by size. On connect, list the user\'s chats above some threshold (say 25 members) and subscribe to channels for those chats specifically, in addition to the user channel. When a message is sent to a large chat, publish to the chat channel instead. Watch the transition: publish to both for a short window while servers pick up the new subscription.'],
          ['note', 'On Pub/Sub scalability — Canva benchmarked 100,000 mouse-position updates per second on a single Redis host at 27% utilisation. Pub/Sub is deliberately dumb and just passes messages, so it can be extremely efficient.'],
        ],
      },
      {
        id: 'dd-2', h: 2, title: '2) What do we do to handle multiple clients for a given user?',
        focus: ['a', 'b', 'lb', 'ws', 'sess', 'inbox'],
        blocks: [
          ['p', 'So far we assumed one device per user, but many people have a phone, a tablet, a laptop, maybe a work computer. If my phone received the latest message while my laptop was off, waking the laptop must sync it. We can no longer rely on a user-level Inbox to track delivery — my phone acking should not clear my laptop\'s copy.'],
          ['p', 'Three new problems: resolving a user to one or more active clients, deactivating clients so we stop storing messages for devices that no longer exist, and updating delivery to handle multiple clients. We can account for all of it with minimal changes:'],
          ['bul', [
            'Create a **Clients** table tracking clients by user id.',
            'When looking up chat participants, expand each user to their clients.',
            'Change the Inbox table to be **per-client** rather than per-user.',
            'When sending a message, send it to every client of every recipient.',
            'On the Pub/Sub side, nothing changes — servers still subscribe by userId, and the owning server fans out to that user\'s local sockets.',
          ]],
          ['p', 'We will probably want a limit — three clients per account is reasonable — to avoid blowing up storage and throughput.'],
        ],
      },
      {
        id: 'dd-3', h: 2, title: '3) What happens if the WebSocket connection fails?',
        focus: ['a', 'b', 'lb', 'ws', 'inbox'],
        blocks: [
          ['p', 'Users often sit on poor networks. A WebSocket can be technically open while functionally severed, and we will not know until a send times out. TCP keepalives can take minutes to detect a dead connection — far too slow for a chat app.'],
          ['opts', [
            {
              rating: 'Bad', title: 'Rely on TCP timeouts',
              approach: 'Do nothing special. When the connection dies, TCP eventually times out and the socket closes. The client reconnects and syncs from the Inbox.',
              challenges: 'TCP keepalives are often configured in minutes, not seconds. Users stare at a "connected" app that is actually dead, missing messages the whole time. Not acceptable for real-time chat.',
            },
            {
              rating: 'Good', title: 'ACK timeouts with server-side retry',
              approach: 'When the Chat Server delivers over the socket it waits for an ACK. If none arrives within 500–2000ms it retries. After a few failures it assumes the socket is broken, closes it, and forces the client to reconnect and sync from the Inbox. This pairs naturally with the ack mechanism we already have.',
              challenges: 'It only detects failures when we are actively sending. If the connection dies during a quiet period we will not notice until the next message arrives.',
            },
            {
              rating: 'Great', title: 'Application-level heartbeats',
              approach: 'The Chat Server sends a ping every 10–30 seconds. The client must respond with a pong within a timeout, say 5 seconds, or the server closes the connection. The client then reconnects and syncs any missed messages from the Inbox. Dead connections are caught in seconds rather than minutes.',
              challenges: 'Heartbeats add overhead — 200M connected users on a 10-second interval is 20M ping/pong exchanges per second. In practice this is fine because the messages are tiny, but it is worth noting. The payoff is a guaranteed upper bound: a 10s interval with a 5s timeout detects any dead connection within 15 seconds.',
              best: true,
            },
          ]],
        ],
      },
      {
        id: 'dd-4', h: 2, title: '4) What happens if Redis fails to deliver a message?',
        focus: ['ws', 'sess', 'q', 'inbox'],
        blocks: [
          ['p', 'Redis Pub/Sub is at-most-once: with no subscriber listening, or a transient Redis failure, the message is lost from the realtime path. Durability is already handled — we write to the Inbox before publishing, so **all messages will eventually get delivered**. The question is how a *connected* client quickly receives something Pub/Sub dropped.'],
          ['opts', [
            {
              rating: 'Good', title: 'Periodic polling',
              approach: 'Connected clients poll for missed messages every 30–60 seconds. The server checks the Inbox for anything undelivered and sends it down.',
              challenges: 'Load scales with connected users. 200M clients polling every 30 seconds is roughly 7M queries/second purely for sync checks. Longer intervals mitigate it, but you are trading latency for load. The interval is a tunable knob and this is good enough for most cases.',
            },
            {
              rating: 'Good', title: 'Sequence numbers per chat with gap detection',
              approach: 'Every message gets a monotonically increasing sequence number within its chat, generated by a simple atomic increment. Clients track the last sequence seen; receiving #5 after #3 tells them #4 is missing and they request a re-sync.',
              challenges: 'Gap detection only works when you do receive a message. If the chat goes quiet after the missed one, you will not detect the gap until the next message arrives. You still need polling as a backstop.',
            },
            {
              rating: 'Great', title: 'Piggyback the sequence on heartbeats',
              approach: 'Maintain a single incrementing sequence per user, bumped by every message to them. Include that sequence in each heartbeat ping. If the client\'s local sequence is behind the server\'s, it immediately requests a sync. Fast detection — within one heartbeat interval — with essentially no additional load, because the heartbeats already exist.',
              challenges: 'A global per-user sequence requires an atomic counter, which is another coordination dependency. The benefit is that one sequence catches every missed message regardless of which chat it was in.',
              best: true,
            },
          ]],
          ['p', 'In practice most production systems combine all three: heartbeats detect dead connections, sequence numbers detect missed messages, and periodic polling serves as the final backstop.'],
        ],
      },
      {
        id: 'dd-5', h: 2, title: '5) How do we handle out-of-order messages?',
        focus: ['ws', 'q', 'inbox'],
        blocks: [
          ['p', 'The simple answer is: **we don\'t** — at least not directly.'],
          ['p', 'Out-of-order delivery is a fact of life in distributed systems, and engineering it away is a considerable amount of extra complexity. You need a delay to give late messages time to arrive, plus a re-ordering mechanism to handle them. Stream processors do exactly this with bounded out-of-orderness watermarks, waiting for stragglers before processing.'],
          ['p', 'But that is not how chat apps work, because users would rather see new messages quickly than have a guaranteed order. So instead: sync all Chat Servers over NTP. That does not guarantee perfect time, but it is pretty good. Stamp each message with the time it was received by the server, and have clients display messages ordered by that timestamp. Ordering is then consistent across every client even when arrival order differs.'],
          ['p', 'On occasion a message will pop in above another that was actually sent later. Users find this acceptable.'],
        ],
      },
      {
        id: 'dd-6', h: 2, title: '6) How can we handle a "last seen" functionality?',
        focus: ['a', 'b', 'lb', 'ws', 'sess'],
        blocks: [
          ['p', 'Your interviewer asks how to show when the other person was last online. Ideally we want something both efficient and scalable.'],
          ['opts', [
            {
              rating: 'Bad', title: 'Write to the DB on every heartbeat',
              approach: 'Update a lastSeen timestamp every time a user does anything — sends a message, receives one, or answers a heartbeat.',
              challenges: 'Massive write amplification. With 200M connected users and heartbeats every 10–30 seconds, that is millions of writes per second purely for presence. Even a scale-out database struggles, and you pay a fortune for writes of minimal value. The data is also stale immediately — you are buying strong consistency you do not need.',
            },
            {
              rating: 'Great', title: 'Utilise active connections',
              approach: 'Two insights: when a user disconnects (or we close the connection on missed heartbeats) *we know about it*; and if a user is online, *they can tell us*. So keep a table of the last disconnect per user, written once on disconnect, guarded by a conditional expression so two servers cannot race and overwrite a more recent time. Then answer queries by racing the database against the live connection.',
              challenges: 'The two responses can arrive slightly apart, so the client must either wait a moment before rendering or update the UI seamlessly. We also depend on Chat Servers reporting disconnects — if a server fails, its users reconnect shortly anyway, and you can write on connect too for extra robustness.',
              best: true,
            },
          ]],
          ['p', '**The request flow.** A client asks for a target user\'s last seen:'],
          ['code', '// -> getLastSeen\n{\n    "targetUserId": "",\n    "requestingUserId": ""\n}\n\n// <- updateLastSeen\n{\n    "targetUserId": "",\n    "reporter": "DATABASE" | "SERVER",\n    "lastSeen": "ONLINE" | "$DATE"\n}'],
          ['steps', [
            'The client publishes getLastSeen with targetUserId and requestingUserId.',
            'The Chat Server receives it and, in parallel: (a) checks the LastSeen table for targetUserId and publishes updateLastSeen to the requester\'s channel, and (b) forwards getLastSeen to the target user\'s channel.',
            'If the target\'s Chat Server receives that and the user is connected, it publishes updateLastSeen with "ONLINE" to the requester\'s channel.',
            'The client merges the responses. An ONLINE message turns the bubble green; otherwise it shows when the user last disconnected.',
          ]],
          ['p', 'This minimises both storage — one record per user — and updates, since we only write to durable storage when a user disconnects.'],
        ],
      },

      // ─────────────────────────── Levels
      {
        id: 'levels', h: 1, title: 'What is Expected at Each Level?',
        blocks: [['p', 'That was a lot. You may be wondering how much of it is actually required of you in an interview. Let us break it down.']],
      },
      {
        id: 'level-mid', h: 2, title: 'Mid-level',
        blocks: [
          ['bul', [
            '**Breadth vs depth:** mostly breadth, around 80/20. Craft a high-level design that meets the functional requirements you defined; many components can be abstractions you know only at surface level.',
            '**Probing the basics:** expect the interviewer to confirm you know what each component does. If you use WebSockets, expect to be asked what they are and how they work. Nothing is taken for granted.',
            '**Driving:** you should drive the early stages, but you are not expected to spot problems in your own design with high precision. It is reasonable for the interviewer to take over and drive later while probing.',
            '**The bar:** clearly define the API, land on a functional high-level design that meets the requirements. Your scaling solution will have rough edges, but you should know where they are.',
          ]],
        ],
      },
      {
        id: 'level-senior', h: 2, title: 'Senior',
        blocks: [
          ['bul', [
            '**Depth of expertise:** roughly 60% breadth, 40% depth. Go into technical detail in areas where you have hands-on experience.',
            '**Advanced system design:** consistent hashing is essential knowledge for this problem, and you are expected to understand the mechanics of long-running sockets.',
            '**Articulating decisions:** clearly state pros and cons of architectural choices and how they affect scalability, performance and maintainability. The partition-by-chat versus partition-by-user discussion is exactly this.',
            '**Proactivity:** anticipate challenges and suggest improvements. Identify bottlenecks before being pointed at them.',
            '**The bar:** speed through the initial high-level design so you can spend real time on scaling and robustness.',
          ]],
        ],
      },
      {
        id: 'level-staff', h: 2, title: 'Staff+',
        blocks: [
          ['bul', [
            '**Emphasis on depth:** around 40% breadth, 60% depth. You may not have solved this exact problem, but you have solved enough real ones to design a solution backed by experience.',
            '**Practical application:** know which technologies to use in practice, not just in theory, and draw on how they behave in real deployments.',
            '**High proactivity:** identify and solve issues independently. The interviewer should intervene only to focus you, not to steer you.',
            '**The bar:** go two or three levels deep on failure modes and bottlenecks. There is ample discussion around fault tolerance, database optimisation, regionalisation and cell-based architecture.',
          ]],
        ],
      },

      // ─────────────────────────── References
      {
        id: 'references', h: 1, title: 'References',
        blocks: [
          ['links', [
            ['Hello Interview — Design a Messaging App Like WhatsApp', 'https://www.hellointerview.com/learn/system-design/problem-breakdowns/whatsapp', 'The breakdown this outline follows, by Stefan Mai.'],
            ['Hello Interview — Real-time Updates pattern', 'https://www.hellointerview.com/learn/system-design/patterns/realtime-updates', 'The general pattern behind persistent connections, pub/sub fan-out and state management.'],
            ['What Happens When You Make a Move in Lichess', 'https://www.davidreis.me/2024/what-happens-when-you-make-a-move-in-lichess', 'A concrete walk through a production real-time system, cited in the original breakdown.'],
            ['Canva — Realtime mouse pointers', 'https://www.canva.dev/blog/engineering/realtime-mouse-pointers/', '100,000 updates/second on a single Redis host at 27% utilisation — the Pub/Sub scalability benchmark.'],
            ['Redis — Pub/Sub documentation', 'https://redis.io/docs/latest/develop/interact/pubsub/', 'At-most-once semantics, channels and pattern subscriptions.'],
            ['Hello Interview — ZooKeeper deep dive', 'https://www.hellointerview.com/learn/system-design/deep-dives/zookeeper', 'Coordination and hash-ring registry for the consistent-hashing approach.'],
            ['Hello Interview — DynamoDB deep dive', 'https://www.hellointerview.com/learn/system-design/deep-dives/dynamodb', 'GSIs, conditional writes and TTL, all used in the data model above.'],
            ['RFC 6455 — The WebSocket Protocol', 'https://datatracker.ietf.org/doc/html/rfc6455', 'Framing, ping/pong control frames and close semantics.'],
          ]],
          ['note', 'This breakdown was written for ArchSim from public material on these well-known interview problems. It is a study aid, not a reproduction of any paywalled content.'],
        ],
      },
    ],
  },
}

// Which template a breakdown belongs to, for the "load it" prompt.
export const BREAKDOWN_NAMES = Object.keys(BREAKDOWNS)

export function breakdownFor(template) {
  return (template && BREAKDOWNS[template.name]) || null
}
