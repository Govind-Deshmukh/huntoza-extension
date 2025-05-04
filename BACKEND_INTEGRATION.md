# Backend Integration Guide for Job Hunt Assist Extension

This guide explains how to implement the necessary backend APIs to support the Job Hunt Assist Chrome extension. These APIs will enable job data extraction, AI enhancement, and integration with your Job Hunt Tracker app.

## API Endpoints

Your backend should implement the following endpoints to fully support the extension:

### 1. Authentication Check

```
GET /api/auth/check
```

This endpoint checks if the user is currently authenticated and has a valid session.

**Response:**

- `200 OK` if the user is authenticated
- `401 Unauthorized` if the user is not authenticated

### 2. Job Application Creation

```
POST /api/jobs
```

This endpoint creates a new job application in your database.

**Request Body:**

```json
{
  "company": "Acme Inc.",
  "position": "Software Engineer",
  "jobLocation": "San Francisco, CA",
  "jobType": "full-time",
  "salary": {
    "min": 100000,
    "max": 150000,
    "currency": "USD"
  },
  "jobDescription": "Long text description...",
  "jobUrl": "https://example.com/job/123"
}
```

**Response:**

- `201 Created` with the newly created job application data
- `400 Bad Request` if the request data is invalid
- `401 Unauthorized` if the user is not authenticated

### 3. AI Enhancement (Optional)

```
POST /api/enhance-job-data
```

This endpoint processes job data through AI to improve and complete missing information.

**Request Body:**

```json
{
  "company": "Acme Inc.",
  "position": "Software Engineer",
  "jobLocation": "San Francisco, CA",
  "jobType": "full-time",
  "salary": {
    "min": 0,
    "max": 0,
    "currency": "USD"
  },
  "jobDescription": "Long text description...",
  "jobUrl": "https://example.com/job/123"
}
```

**Response:**

```json
{
  "company": "Acme Inc.",
  "position": "Software Engineer",
  "jobLocation": "San Francisco, CA",
  "jobType": "remote", // AI might correct this based on description
  "salary": ""
}
```
