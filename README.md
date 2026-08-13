# ExamHub - Proctored Online Assessment Portal

ExamHub is a full-stack, secure online examination platform engineered with advanced browser-level proctoring features to prevent cheating. The repository is split into two independent modules: the **Student Panel** (for taking exams and viewing marks) and the **Examiner Panel** (for designing exams and inspecting proctor warning logs).

---

## 📂 Repository Architecture

```
proctor-exam-portal/
├── student/
│   ├── backend/               # Student API Server (Auth, Exam session, Warning logs)
│   │   ├── src/...
│   │   ├── package.json
│   │   └── database.sqlite    # SQLite database file (Synchronized/Shared)
│   └── frontend/              # Student React App (Portal for taking tests & grade sheets)
│       ├── src/...
│       └── package.json
└── examiner/
    ├── backend/               # Examiner API Server (Creates exams, monitors attempts)
    │   ├── src/...
    │   └── package.json       # Synced directly to student/backend/database.sqlite
    └── frontend/              # Examiner React App (Exam builder form, student logs timeline)
        ├── src/...
        └── package.json
```

---

## 🛡️ Proctoring & Security Features

*   🖥️ **Fullscreen Enforcement**: Candidates cannot view or take the test outside of fullscreen mode. Exiting fullscreen immediately triggers a cheating warning and blocks the screen.
*   🗂️ **Tab-Switching Detection**: Uses the HTML5 Page Visibility API to detect tab switches or browser minimization, logging warnings immediately.
*   🔊 **Web Audio Synthesizer**: Generates dynamic alarm sounds natively on the client browser on proctor violations (no external audio files required).
*   🚨 **Red vignette Pulse Flash**: Flashes a red vignette overlay around the screen boundary on violation events for real-time visual deterrence.
*   🚫 **Cut, Copy, Paste & Selection Block**: Text selection is disabled (`user-select: none`), and clipboard events (`copy`, `cut`, `paste`, `contextmenu`) are strictly blocked.
*   ⌨️ **Keyboard Shortcut Blocks**: Blocks DevTools triggers (`F12`, `Ctrl+Shift+I`), save, print, and standard copying shortcuts.
*   ⚡ **Auto-Submission limit**: Reaching the limit of **5 warnings** automatically locks the interface, disqualifies the candidate, and submits the attempt as flagged.

---

## ⚙️ How to Run Locally

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### 2. Setup Student Panel (Sync Database)
Navigate to the student directories to install dependencies and run:
```bash
# Start Student Backend (Port 5000)
cd student/backend
npm install
npm run start

# Start Student Frontend (Port 5173)
cd ../frontend
npm install
npm run dev
```
*Note: The SQLite database file will be automatically initialized and seeded in `student/backend/database.sqlite` on first startup.*

### 3. Setup Examiner Panel
Open another terminal to install dependencies and run:
```bash
# Start Examiner Backend (Port 5001)
cd examiner/backend
npm install
npm run start

# Start Examiner Frontend (Port 5174)
cd ../frontend
npm install
npm run dev
```

---

## 🔑 Default Credentials (Auto-Seeded)

The database is pre-seeded with the following credentials on the first run of the backend server:

| Portal | Role | Username | Email | Password | URL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Student** | Candidate | `student` | `student@examhub.com` | `student123` | [http://localhost:5173/](http://localhost:5173/) |
| **Examiner** | Administrator | `admin` | `admin@examhub.com` | `admin123` | [http://localhost:5174/](http://localhost:5174/) |

---

## 📈 Testing the Synchronization
1. Log in as Examiner on [http://localhost:5174/](http://localhost:5174/). Go to **Create New Exam** and publish a test.
2. Log in as Student on [http://localhost:5173/](http://localhost:5173/). Select the exam and click **Start**.
3. Trigger warnings by pressing `Esc` or changing tabs. Hear the alarm and see the red vignette.
4. Complete the test, then return to the Examiner panel to inspect the scored attempt and its detailed proctoring violation logs.
