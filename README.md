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

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/assignment_submission_db

JWT_SECRET=your_super_secret_jwt_key

CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=admin@example.com
BREVO_SENDER_NAME=Assignment Portal Admin

FRONTEND_URL=http://localhost:5173
CLASS_JOIN_CODE=CLASS-2026-PORTAL
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

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
VITE_API_BASE_URL=http://localhost:5000/api
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
