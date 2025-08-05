# Project Dependency Matrix

A full-stack web application for tracking project dependencies with Angular 17.3.0 frontend and Node.js 20.9.0 backend with Express.js.

## Project Structure

The project is organized into two main folders:
- `frontend/` - Angular 17.3.0 application
- `backend/` - Node.js 20.9.0 with Express.js server

## Features

- User authentication with login functionality
- Project dependency matrix dashboard with tabular view
- Add and edit matrix items through a popup dialog
- User profile menu with logout functionality

## Getting Started

### Backend Setup

```bash
cd backend
npm install
npm start
```

The backend server will run on http://localhost:3000.

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

The Angular application will run on http://localhost:4200.

## Login Credentials

Two hardcoded users are available for testing:

1. Admin User
   - Username: admin
   - Password: admin123

2. Regular User
   - Username: user
   - Password: user123

## API Endpoints

- `POST /api/login` - Authenticate user
- `GET /api/matrix` - Get all matrix items
- `POST /api/matrix` - Add new matrix item
- `PUT /api/matrix/:id` - Update existing matrix item

## Technologies Used

- **Frontend**: Angular 17.3.0, Angular Material
- **Backend**: Node.js 20.9.0, Express.js
- **Authentication**: JWT-based authentication (simulated)
- **Styling**: SCSS with responsive design