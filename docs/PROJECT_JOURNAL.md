# NotebookLM Local: Project Journal

This journal documents the architectural decisions, challenges, and solutions encountered during the development of **NotebookLM Local**—a 100% private, offline-first AI document research assistant.

---

## 1. Technology Stack & Rationale

We set out to build a highly responsive, privacy-first desktop application that runs complex AI retrieval tasks locally. 

- **Backend:** `FastAPI` (Python). Python is the undisputed king of AI and machine learning libraries. FastAPI gave us the speed of Node.js with the deep ecosystem of Python, allowing us to seamlessly integrate local LLMs and vector databases.
- **Frontend:** `Vite` + `Vanilla Web Components`. We wanted a lightning-fast, lightweight UI without the heavy overhead of frameworks like React or Angular. By using Vanilla JS and native Web Components, we achieved a modern, glassmorphism-inspired design that feels native and premium.
- **Vector Database:** `ChromaDB`. Chosen for its excellent local persistent storage capabilities. It allowed us to generate and store semantic embeddings entirely on the user's machine without relying on external cloud vector stores like Pinecone.
- **Relational Database:** `SQLite` + `SQLAlchemy`. We needed a lightweight, serverless relational database to store user settings, chat histories, and file metadata.
- **Packaging:** `Electron` + `PyInstaller`. (We initially explored Tauri, but pivoted to Electron). Packaging a heavy Python backend for average users is notoriously difficult. PyInstaller allowed us to freeze the Python environment into a standalone binary, and Electron gave us a robust shell to spawn that binary in the background and render the Vite UI.

---

## 2. Problems & Solutions

### Challenge 1: Information Retrieval & Indexing
**Problem:** In the early stages, feeding raw text or dumping everything into a single, unoptimized index led to poor retrieval. When a user asked a question, the AI either lacked the necessary context or was fed irrelevant noise, resulting in poor answers.

**Solution (Multiple Indexing & Chunking):** 
We implemented a robust Retrieval-Augmented Generation (RAG) pipeline. 
1. We stopped dumping raw text and instead implemented smart **chunking**—breaking documents into smaller, semantically meaningful paragraphs.
2. We generated high-quality embeddings for these chunks and stored them in ChromaDB.
3. We utilized **metadata filtering** and multiple logical collections. When a user asks a question, we perform a semantic similarity search to retrieve *only* the top-K most relevant chunks, dramatically improving the accuracy and precision of the LLM's answers.

### Challenge 2: Context Window Management
**Problem:** LLMs have strict limits on how many tokens (words) they can process at once (the "context window"). If a user had a long conversation or uploaded a massive PDF, feeding all of that data into the LLM prompt would cause it to crash with `token limit exceeded` errors, or cause the LLM to hallucinate and lose focus.

**Solution (Dynamic Context Injection):**
We solved this by strictly managing what gets sent to the LLM. 
1. **System Prompt:** We establish a strict persona.
2. **RAG Context:** We inject *only* the top 3-5 most relevant document chunks retrieved from ChromaDB based on the user's *current* question.
3. **Conversation History:** We query our SQLite database and retrieve only the last `N` messages of the conversation to maintain the flow of dialogue without overwhelming the context window.

### Challenge 3: Persistent Chat & State Management
**Problem:** A research assistant is useless if it forgets your conversation the moment you close the app. We needed a way to link uploaded files to specific conversations and remember the chat history persistently across app restarts.

**Solution (SQLite & Repository Pattern):**
We implemented `SQLite` using `SQLAlchemy` async sessions. We designed a normalized schema:
- **Chats Table:** Represents a conversation thread.
- **Messages Table:** Stores the exact user prompts and AI responses, linked to a Chat via foreign keys.
- **Files Table:** Tracks metadata of uploaded documents.
By using a Repository pattern (`sqlite_chat_repo.py`), we decoupled the database logic from the API routes. This allows the backend to instantly load past conversations and feed the most recent messages back into the LLM's context window seamlessly.

### Challenge 4: Packaging and Distribution (The Final Boss)
**Problem:** We built a great app, but it required running `npm run dev` and `python main.py` in separate terminals—impossible for a non-technical end-user. We needed a double-clickable `.dmg` / `.exe`.

**Solution (PyInstaller + Electron):**
1. We wrote `build_backend.sh` to utilize `PyInstaller`. This tool tracks every Python dependency (including massive libraries like Torch and ChromaDB) and bundles them into a single, standalone binary executable.
2. We wrote an `electron/main.cjs` script. When the user double-clicks the app, Electron invisibly spawns the Python binary in the background, waits for the `api/health` endpoint to return 200 OK, and *then* opens the beautiful native desktop window to load the frontend. 
3. We wired it all together using `electron-builder` in `package.json`, resulting in a seamless, professional installation experience.
