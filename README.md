# Expense-Tracker
# 🚀 Expense Tracker (2-Tier Full Stack App with DevOps)

A full-stack Expense Tracker application built using **Node.js, Express, SQLite (Backend)** and **HTML, CSS, JavaScript (Frontend)**, containerized with **Docker**, and deployed on **AWS EC2 using ECR and GitHub Actions CI/CD**.

---

## 🧠 Architecture

This project follows a **2-tier architecture**:

```
Frontend (Nginx - Port 80)
        ↓
Backend (Node.js - Internal Port 3000)
        ↓
SQLite Database
```

* Frontend and backend run in **separate containers**
* Nginx acts as a **reverse proxy**
* Backend is **not exposed publicly**
* API is accessed via `/api`

---

## ✨ Features

* Add, delete, and track expenses
* Category-wise expense tracking
* Real-time total calculation
* Clean UI with responsive design
* API health monitoring
* Currency formatting (₹ INR)

---

## 🐳 Docker Setup

### Build & Run Locally

```bash
docker-compose up --build
```

### Access App

```text
http://localhost:3000
```

---

## ⚙️ Docker Compose

* Frontend runs on **port 3000**
* Backend runs internally via Docker network
* SQLite database persisted via volume

---

## ☁️ AWS Deployment

### Services Used

* **AWS EC2** → Hosting containers
* **AWS ECR** → Storing Docker images
* **GitHub Actions** → CI/CD pipeline

---

## 🔄 CI/CD Pipeline

On every push to `main`:

1. Build Docker images (frontend & backend)
2. Push images to AWS ECR
3. SSH into EC2
4. Pull latest images
5. Deploy using Docker Compose

---

## 🔐 Environment Setup

### Required GitHub Secrets

```
AWS_ACCESS_KEY
AWS_SECRET_KEY
AWS_ACCOUNT_ID
EC2_HOST
EC2_SSH_KEY
```

---

## 📁 Project Structure

```
expense-tracker/
│
├── backend/
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
│
├── frontend/
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   ├── nginx.conf
│   └── Dockerfile
│
├── docker-compose.yml
└── .github/workflows/deploy.yml
```

---

## 🔧 API Endpoints

| Method | Endpoint      | Description      |
| ------ | ------------- | ---------------- |
| GET    | /api/health   | Health check     |
| GET    | /api/expenses | Get all expenses |
| POST   | /api/expenses | Add expense      |
| GET    | /api/total    | Total expenses   |

---

## 🌍 Live Deployment

```
http://<EC2_PUBLIC_IP>
```

---

## ⚠️ Important Notes

* Backend is accessed internally via `/api`
* Do NOT expose backend port in production
* Ensure security group allows:

  * Port 80 (HTTP)
  * Port 22 (SSH)

---


