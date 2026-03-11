# Demo Concept: AI Storybook Workshop

This demo illustrates a conversational workspace where a user collaborates with specialized AI personas to produce a simple artifact: a children’s picture book.

The goal is to demonstrate a workflow that feels like directing a small creative team rather than interacting with a single monolithic assistant. Each AI persona performs a specific task and communicates through clearly defined outputs written to the filesystem. The user acts as the editor and creative director throughout the process.

The demo highlights several key ideas:

- addressing AI participants directly
- short conversational interactions
- clear role separation between participants
- artifacts written to files instead of buried in chat
- iterative collaboration between the user and AI

---

# Roles

## User (Editor)

The user acts as the editor and director of the project. They provide the creative direction and decide what should happen next.

Responsibilities include:

- choosing the story idea
- requesting pages to be written
- requesting illustrations
- revising story or image direction
- deciding when to continue or stop
- Exporting final copy? (not sure what format, maybe HTML page?)

The user interacts with the AI personas by addressing them directly in conversation.

---

## @facilitator

The facilitator helps guide the session and lowers the barrier for new users. It behaves like a meeting moderator.

Responsibilities:

- prompt the user for the next decision
- suggest which persona to address
- keep the session moving forward
- clarify available options

The facilitator does not produce artifacts or creative work. It only provides brief guidance.

Example behavior:

- asking the user for the story idea
- suggesting that the user ask the author to write the first page
- suggesting that the user ask the illustrator to create an image

The facilitator should remain concise and speak only when helpful.

---

## @author

The author is responsible for writing the story.

Responsibilities:

- write story pages
- update text when the user requests changes
- maintain narrative continuity
- Respect text length constraints (children book, needs to fit on the page)

Outputs are written to the filesystem so they can be inspected and versioned.

Example output location:

book/page1.md
book/page2.md

Each page contains the text of the story for that part of the book.

---

## @illustrator

The illustrator generates images corresponding to the story pages.

Responsibilities:

- create illustrations for story scenes
- update images when the user requests visual changes
- maintain visual consistency where possible
- Respect image sizing constraints

Outputs are written to the filesystem.

Example output location:

book/page1.png
book/page2.png

Images correspond to the story pages written by the author.

---

# Workflow

The session begins with the facilitator prompting the user for a story idea. The user provides a concept, such as a shy dragon who is afraid to fly.

The facilitator then suggests the next step, typically asking the user to direct the author to write the first page of the story.

The author produces the first page and saves it to the filesystem.

The facilitator may then suggest that the user ask the illustrator to generate an image for the scene. The illustrator produces an image corresponding to that page.

The user can then iterate on either component. For example:

- revise the story text
- adjust the appearance of the dragon
- continue writing the next page

This process continues until the book is complete.

---

# Filesystem Artifacts

All meaningful outputs are written to files rather than remaining inside the conversation.

Example structure:

book/
page1.md
page1.png
page2.md
page2.png

This approach provides several benefits:

- outputs can be inspected easily
- files can be versioned with Git
- artifacts remain usable outside the chat environment
- the conversation stays concise

Bonus, we export the final book as an html zip or something
