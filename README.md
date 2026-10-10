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

### DOC/DOCX conversion and deployment

Group-submission ZIP downloads convert DOC/DOCX and supported image files to PDF, then merge them in each student's selected sequence. Before merging, text-based submissions are checked for the student's current account name and roll number. If one detail is missing, it is added beside the existing one on the first page in a matching font style; if both are missing (including scanned/image-only PDFs), an identity page with both details is added at the start of that student's section. ZIP, PPT/PPTX, Excel, and CSV files remain original files. LibreOffice is installed in the backend Docker image. If conversion or PDF merging fails, the ZIP request returns an error rather than silently placing a mergeable file beside the group PDF. LibreOffice supports rich Word layouts, but exact pagination can differ from Microsoft Word when fonts or rendering behavior differ.

The GitHub Actions workflow builds the backend, frontend, and Docker image on every pull request and `main` push. Render is configured to deploy only after CI checks pass.

**One-time Render setup:** the existing `assignment-submission-api` service must use the Docker runtime. If it is managed by the Render Blueprint, sync this file after confirming its diff updates the existing service (not a duplicate). Otherwise, in the existing service's **Settings → Build → Source**, change Runtime to **Docker**, keep the same repository, `main` branch, and `backend` root directory, set Dockerfile path to `Dockerfile`, and set Auto-Deploy to **After CI Checks Pass**. Keep the existing service and its environment variables; do not create a second service or change the public URL. The `render.yaml` records the Docker and CI-gated auto-deploy configuration for future Blueprint syncs.

After this one-time setup, pushing to `main` runs CI, then Render deploys the Docker image and Vercel builds the frontend (assuming both existing services have Git auto-deploy enabled on `main`). Before switching Render runtime, confirm required production environment variables are present in the existing service. Render keeps the same service URL and environment values when its runtime is changed.

For local DOC/DOCX conversion, stop the native backend (`npm run dev`) and run `docker compose up --build` from `backend/`. The backend `.env` must exist; if MongoDB is installed on the host rather than using Atlas, set its URI host to `host.docker.internal` while running in Docker.

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
