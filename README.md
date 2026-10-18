# 🚀 Class Assignment Submission Portal

A modern, full-stack web application designed for universities and schools to streamline class assignment creation, management, and student submissions. Built with **React**, **TypeScript**, **Node.js**, **Express**, and **MongoDB**.

---

## ✨ Features

### 🎓 Student Portal
- **Secure Registration & Login**: Self-registration using a custom Class Join Code, Email & Password, or Google OAuth.
- **Email Verification & Resend**: Email verification powered by **Brevo API** with token expiration and a resend email option.
- **Password Controls**: Password strength validation, show/hide eye toggle, and a complete Forgot & Reset Password workflow.
- **Assignment Submission**: Submit homework files (PDF, Word, Zip, etc.) with automatic deadline enforcement and late-submission flags.
- **Submission History**: View submitted assignments and download receipt records.
- **Account Deletion**: Students can permanently delete their account and personal records while leaving other group members' data intact.

### 👑 CR / Admin Portal
- **Custom Class Join Code**: Class Representative (CR) can view, auto-generate, or manually edit custom Class Join Codes.
- **Subject & Assignment Management**: Create, update, toggle active status, and set custom deadlines for subjects and assignments.
- **Submission Review & Export**: Filter submissions by subject, assignment, or status (On-Time / Late), download individual files, or export bulk submissions.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Axios.
- **Backend**: Node.js, Express, TypeScript, tsx, Mongoose.
- **Database**: MongoDB / MongoDB Atlas.
- **Integrations**: Brevo (Sendinblue) for transactional emails, Cloudinary for file storage.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v22.13+)
- [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas cluster)

---

### 1️⃣ Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

Generate a fresh JWT secret for each environment with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Set the generated value as `JWT_SECRET` (minimum 32 characters). Production also requires valid MongoDB, Cloudinary, Brevo, `FRONTEND_URL`, and `BACKEND_URL` settings; both public URLs must use HTTPS. Never use sample credentials in production.

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/assignment_submission_db

JWT_SECRET=

CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=admin@example.com
BREVO_SENDER_NAME=Assignment Portal Admin

FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000/api
SUPER_ADMIN_1_NAME=
SUPER_ADMIN_1_EMAIL=
SUPER_ADMIN_1_PASSWORD=
SUPER_ADMIN_2_NAME=
SUPER_ADMIN_2_EMAIL=
SUPER_ADMIN_2_PASSWORD=
CLASS_JOIN_CODE=
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

Set `SUPER_ADMIN_1_NAME`, `SUPER_ADMIN_1_EMAIL`, and a strong `SUPER_ADMIN_1_PASSWORD`. Add sequential `SUPER_ADMIN_2_*`, `SUPER_ADMIN_3_*` sets for more Super Admins. The `seed:admin` command creates or updates these accounts and removes only unconfigured Super Admin accounts. If a configured email already belongs to a staff account, that same account is promoted to Super Admin (its record and related data are retained, and its name/password are updated from the environment); other Teacher/CR accounts and unrelated data are unchanged. Legacy `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` are supported when no numbered settings are present. No credentials are built in.

Run `npm run seed:admin` from `backend/` after configuring the accounts. The backend start command also syncs these accounts before starting the API, so Render applies its configured Super Admins on each service start. Teachers and Class Representatives (CRs) register themselves at `/staff/register`, verify their email from the emailed link, and remain unable to sign in until the Super Admin approves them under **Staff Management**. Students do not apply for CR roles from the student portal. Assign a class to each CR before approving. They sign in at `/admin/login`; the Super Admin can approve, edit names/roles, or delete staff accounts, while each Teacher/CR changes their own password from **My Password**. Assigned CRs manage their class join codes; codes are generated when a class is created. There are no default staff or Super Admin credentials.

Before releasing authenticated Cloudinary delivery, run `npm run secure:uploads` once from `backend/` with database and Cloudinary credentials configured. It converts existing submission assets and invalidates cached public URLs. Check the command's success counts before deploying; CDN invalidation can take a few minutes.

For deployment, set `FRONTEND_URL` in the backend hosting environment to the deployed frontend URL (for example, `https://your-frontend.vercel.app`). This URL is used in email verification and password reset links.

### Bulk ZIP downloads and deployment

For CR exports, the backend authenticates the CR, checks that the assignment belongs to the CR's assigned class, and returns an authorized manifest. It streams each original submission from Cloudinary to temporary disk one at a time; DOC/DOCX conversion remains on the backend through LibreOffice, and supported images are converted individually. The browser retrieves each resulting PDF sequentially. For group assignments, it merges only the members of the same group, ordered by each member's submitted sequence number, and places one PDF per group in the ZIP. Sequence gaps are allowed (for example, submitted members 1, 3, and 4 are merged in that order). A submitted file with no sequence is still included after numbered files, ordered by roll number; duplicate or invalid sequence values stop the export to avoid ambiguous ordering. For individual assignments, each student's PDF remains a separate ZIP entry. The generated PDFs and ZIP are never uploaded back to the backend. The browser enforces stricter defaults of 40 MB, 100 files, and 500 PDF pages to reduce mobile-device memory risk; configure `VITE_CLIENT_EXPORT_MAX_SIZE_MB`, `VITE_CLIENT_EXPORT_MAX_FILES`, and `VITE_CLIENT_EXPORT_MAX_PDF_PAGES` at frontend build time to adjust those client-side caps. Backend export limits default to 200 files, 50 MB per source file, and 200 MB total source size; set `MAX_ZIP_EXPORT_FILES`, `MAX_ZIP_EXPORT_FILE_SIZE_MB`, and `MAX_ZIP_EXPORT_TOTAL_SIZE_MB` in the backend environment to adjust them. The backend also advertises a 2000-page ceiling by default, configurable through `MAX_ZIP_EXPORT_PDF_PAGES`, which the browser enforces alongside its lower client-side cap. Only one source conversion/retrieval request is allowed at a time per backend process. Browsers with the File System Access API stream ZIP output to a user-selected file; other browsers use a Blob download fallback subject to the lower client limits. PDF merging still requires browser memory, so mobile support and practical limits must be validated on target devices. LibreOffice remains installed in Docker for server-side document conversion, and qpdf remains installed for the separate teacher shared-assignment ZIP workflow.

The GitHub Actions workflow builds the backend, frontend, and Docker image on every pull request and `main` push. Render is configured to deploy only after CI checks pass.

**One-time Render setup:** the existing `assignment-submission-api` service must use the Docker runtime. If it is managed by the Render Blueprint, sync this file after confirming its diff updates the existing service (not a duplicate). Otherwise, in the existing service's **Settings → Build → Source**, change Runtime to **Docker**, keep the same repository, `main` branch, and `backend` root directory, set Dockerfile path to `Dockerfile`, and set Auto-Deploy to **After CI Checks Pass**. Keep the existing service and its environment variables; do not create a second service or change the public URL. The `render.yaml` records the Docker and CI-gated auto-deploy configuration for future Blueprint syncs.

After this one-time setup, pushing to `main` runs CI, then Render deploys the Docker image and Vercel builds the frontend (assuming both existing services have Git auto-deploy enabled on `main`). Before switching Render runtime, confirm required production environment variables are present in the existing service. Render keeps the same service URL and environment values when its runtime is changed.

### Multiple Render backends and browser failover

This feature does not create Render services or combine their quotas. Deploy the same repository manually as a separate Docker web service for each backend. Configure and verify every service before adding it to the pool:

1. Set each service's Docker root directory to `backend` and Dockerfile path to `Dockerfile`.
2. Use the **same** `MONGODB_URI` (same database), `JWT_SECRET`, Cloudinary account/credentials, `FRONTEND_URL`, `BACKEND_POOL_ID`, and `API_COMPATIBILITY_VERSION` on every compatible backend. Keep application/API versions compatible. Shared MongoDB makes database reads and writes visible to each instance; it does not copy data between different databases. Shared Cloudinary credentials make the same stored assets available.
3. Set `BACKEND_PUBLIC_URL` to that service's own HTTPS origin (for example, `https://service-name.onrender.com`, without `/api`). Keep `BACKEND_URL` in the existing `/api` form for email links. These URLs are not credentials.
4. Set `BACKEND_POOL_ID` to the same non-secret value on all pool members (for example, `assignment-portal-production`) and `API_COMPATIBILITY_VERSION` to the same value (initially `v1`). A matching label does not prove configuration compatibility; update the version when API contracts are incompatible.
5. In Vercel, set the frontend build variables:

   ```env
   VITE_API_URL=https://primary-service.onrender.com/api
   VITE_BACKEND_URLS=https://backup-service.onrender.com,https://another-backup.onrender.com
   VITE_BACKEND_POOL_ID=assignment-portal-production
   VITE_API_COMPATIBILITY_VERSION=v1
   ```

   `VITE_BACKEND_URLS` is the browser's cold-start discovery list: include every backup origin here even when the primary is currently down. `VITE_API_URL` and these `VITE_*` values are embedded during the frontend build, so changing them in Vercel requires a new frontend deployment. They contain public service URLs and compatibility labels only, never secrets.
6. Sign in as a Super Admin, open **Backend Services**, test each deployed URL, set the primary and backup order, enable the intended services, and save. The editable registry is persisted in the shared MongoDB database and takes effect at runtime. Do not add a service until its health check, shared configuration, and API compatibility have been verified.

The browser probes `/health` (which requires a connected MongoDB), pool identity, and API compatibility. A backend is considered failed only after repeated unsuccessful readiness checks; transport errors and HTTP 502/503/504 cause a health recheck. HTTP 400/401/403, 429, and ordinary application errors do not switch services, and a 503 alone is not proof that Render free instance-hours are exhausted. Only safe GET/HEAD requests may be retried once, after a healthy alternate is selected; writes and uploads are never replayed automatically. The primary is checked periodically and failback requires three successful checks, at least 60 seconds of stability, and a cooldown. If the primary recovers, the browser selects it automatically. If all services fail health checks, requests fail rather than being reported as successful.

Selection and manual switching are **per browser**, not a global Render traffic switch. Each browser independently tracks health; the Super Admin panel shows that browser's active backend. The panel can store automatic switch events centrally when it is open; the browser also keeps a local recent-event history. There is no Socket.IO/WebSocket in the current frontend. All backend services must use compatible CORS settings and the same JWT secret for session continuity. Do not expect a separate MongoDB database, JWT secret, Cloudinary account, or incompatible deployment to become consistent through failover.

Each Render service/account remains subject to its own usage limits and terms. Failover neither transfers instance-hours nor increases a service's allowance; use only independently configured services in compliance with Render's terms. Browser failover improves availability only when the backups are deployed, configured, reachable, compatible, and tested.

### Run the backend with Docker (Windows)

1. Install and start Docker Desktop. In PowerShell, go to the backend folder and create your local environment file:

   ```powershell
   cd "D:\Assignment Submission Portal\backend"
   Copy-Item .env.example .env
   ```

2. Open `backend/.env` and enter your real MongoDB, JWT, Cloudinary, email, frontend URL, and Super Admin settings. Do not commit this file. For MongoDB Atlas, use its connection string. If MongoDB is running directly on your Windows computer, use `mongodb://host.docker.internal:27017/assignment_submission_db` instead of `localhost`; inside Docker, `localhost` refers to the container itself.

3. Build the backend image and start the container:

   ```powershell
   docker compose up --build
   ```

   The first build can take several minutes. Keep this terminal open to see startup logs. The API is available at `http://localhost:5000`; open `http://localhost:5000/health` and confirm the response reports `"database":"connected"`.

4. In another PowerShell window, configure the frontend's `VITE_API_URL` as `http://localhost:5000/api` and run the frontend as described below.

Press **Ctrl+C** in the Docker terminal to stop the service. To remove the stopped container, run `docker compose down` from `backend/`. This does not remove your source files or external MongoDB data. The image includes LibreOffice and qpdf for the backend features that require them.

Run the backend development server:

```bash
npm run dev
```

---

### 2️⃣ Frontend Setup

```bash
cd ../frontend
npm install
```

Create a `.env` file in the `frontend/` directory (optional):

```env
VITE_API_URL=http://localhost:5000/api
```

Run the frontend development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📜 Available Scripts

### Backend (`/backend`)
- `npm run dev` - Starts the backend dev server with `tsx watch`.
- `npm run build` - Compiles TypeScript to `dist/`.
- `npm run start` - Runs the compiled production code.

### Frontend (`/frontend`)
- `npm run dev` - Starts Vite dev server.
- `npm run build` - Builds production assets.
- `npm run preview` - Previews production build locally.

---

## 📄 License
Licensed under the [MIT License](LICENSE).
