# Ottimate Grocery ROI Calculator

Margin Defense Value calculator for grocery retail operations.

## Deploy to GitHub Pages — Step by Step

### Prerequisites
- A GitHub account
- Git installed on your machine ([download here](https://git-scm.com/downloads))
- Node.js installed ([download here](https://nodejs.org/) — get the LTS version)

### Steps

**1. Create a new GitHub repository**
- Go to [github.com/new](https://github.com/new)
- Name it `grocery-roi-calculator` (or whatever you want — see note below)
- Set it to **Private** (this is an internal sales tool)
- Do NOT initialize with a README (we already have one)
- Click **Create repository**

**2. Open your terminal and navigate to this project folder**
```bash
cd grocery-roi-calculator
```

**3. Install dependencies and test locally**
```bash
npm install
npm run dev
```
This will start a local server (usually `http://localhost:5173`). Open it in your browser to confirm everything works.

**4. Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit - Grocery ROI Calculator"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/grocery-roi-calculator.git
git push -u origin main
```
Replace `YOUR_USERNAME` with your GitHub username.

**5. Enable GitHub Pages**
- Go to your repo on GitHub
- Click **Settings** → **Pages** (in the left sidebar)
- Under **Source**, select **GitHub Actions**
- That's it — the workflow file we included will handle the rest

**6. Wait for deployment**
- Go to the **Actions** tab in your repo
- You'll see the "Deploy to GitHub Pages" workflow running
- Once it shows a green checkmark (1-2 minutes), your calculator is live

**7. Access your calculator**
Your URL will be:
```
https://YOUR_USERNAME.github.io/grocery-roi-calculator/
```

## ⚠️ Important: If you name the repo something different

If you use a different repo name than `grocery-roi-calculator`, you need to update one line in `vite.config.js`:

```js
base: '/your-repo-name/'
```

This tells the build system where the site lives. If this doesn't match your repo name, the page will load blank.

## Making Changes

Edit the calculator in `src/GroceryROICalculator.jsx`. Push changes to `main` and GitHub Actions will automatically rebuild and redeploy within 1-2 minutes.

## Running Locally

```bash
npm run dev      # Start dev server with hot reload
npm run build    # Build for production
npm run preview  # Preview the production build locally
```
