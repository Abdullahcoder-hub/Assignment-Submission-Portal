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
- [Node.js](https://nodejs.org/) (v18+)
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
ADMIN_NAME=
ADMIN_EMAIL=
ADMIN_PASSWORD=
CLASS_JOIN_CODE=
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

The `seed:admin` command requires `ADMIN_NAME`, `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD`; it has no built-in credentials.

Before releasing authenticated Cloudinary delivery, run `npm run secure:uploads` once from `backend/` with database and Cloudinary credentials configured. It converts existing submission assets and invalidates cached public URLs. Check the command's success counts before deploying; CDN invalidation can take a few minutes.

For deployment, set `FRONTEND_URL` in the backend hosting environment to the deployed frontend URL (for example, `https://your-frontend.vercel.app`). This URL is used in email verification and password reset links.

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
