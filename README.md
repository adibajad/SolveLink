# SolveLink

> **Real Problems. Local Minds. Real Impact.**  
> Problem Statement: **SIH26043**

## Overview
SolveLink is a platform designed to bridge societal problems, government authorities, universities, students/researchers, and industry partners.

## Core Lifecycle
1. **Citizen reports problem**
2. **AI analyzes** category / severity / priority / similarity
3. **Community support & upvoting**
4. **Government authority verifies**
5. **Verified problem becomes Innovation Challenge**
6. **Challenge published**
7. **University / student / researcher / industry matching**
8. **Solutions submitted**
9. **Authority evaluates and selects**
10. **Solution approved**
11. **Implementation milestones**
12. **Impact measurement**
13. **Citizen-visible outcome**

## Technology Stack
- **Runtime:** Node.js
- **Backend Framework:** Express.js
- **Template Engine:** EJS
- **Database:** MongoDB with Mongoose ODM
- **Frontend:** HTML5, Vanilla CSS3 (Custom CSS Variables), Vanilla JavaScript

## Project Structure
```
SolveLink/
├── app.js
├── package.json
├── .env
├── .gitignore
├── README.md
├── config/
│   └── db.js
├── models/
│   ├── User.js
│   ├── Problem.js
│   ├── Challenge.js
│   └── Solution.js
├── routes/
│   ├── authRoutes.js
│   ├── problemRoutes.js
│   ├── challengeRoutes.js
│   ├── solutionRoutes.js
│   └── dashboardRoutes.js
├── controllers/
│   ├── authController.js
│   ├── problemController.js
│   ├── challengeController.js
│   └── solutionController.js
├── services/
│   ├── aiService.js
│   ├── duplicateService.js
│   └── matchingService.js
├── middleware/
│   ├── auth.js
│   └── role.js
├── views/
│   ├── partials/
│   │   ├── navbar.ejs
│   │   ├── footer.ejs
│   │   ├── sidebar.ejs
│   │   └── challenge-card.ejs
│   ├── home.ejs
│   ├── challenges.ejs
│   ├── challenge-detail.ejs
│   ├── about.ejs
│   ├── resources.ejs
│   ├── auth/
│   │   ├── login.ejs
│   │   └── register.ejs
│   ├── citizen/
│   │   ├── dashboard.ejs
│   │   ├── report-problem.ejs
│   │   ├── problem-detail.ejs
│   │   └── my-problems.ejs
│   ├── authority/
│   │   ├── dashboard.ejs
│   │   ├── problems.ejs
│   │   ├── problem-detail.ejs
│   │   ├── create-challenge.ejs
│   │   ├── solutions.ejs
│   │   └── solution-detail.ejs
│   └── university/
│       ├── dashboard.ejs
│       ├── challenges.ejs
│       ├── challenge-detail.ejs
│       └── submit-solution.ejs
└── public/
    ├── css/
    │   ├── global.css
    │   ├── components.css
    │   ├── home.css
    │   ├── challenges.css
    │   ├── forms.css
    │   ├── dashboard.css
    │   ├── problem.css
    │   └── responsive.css
    ├── js/
    │   ├── main.js
    │   ├── problems.js
    │   ├── challenges.js
    │   ├── solutions.js
    │   └── dashboard.js
    └── images/
```

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB instance (local or MongoDB Atlas)

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env`:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/solvelink
   SESSION_SECRET=your_secret_key
   ```
4. Start the server:
   ```bash
   npm start
   # or for development with watch mode:
   npm run dev
   ```
