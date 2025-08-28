# 🚀 Quick Database Setup with Neon (Free)

## Step 1: Create Free Neon Database
1. Go to [neon.tech](https://neon.tech)
2. Click "Sign Up" and create an account
3. Click "Create New Project"
4. Choose a project name (e.g., "echosensei11")
5. Select a region close to you
6. Click "Create Project"

## Step 2: Get Your Connection String
1. In your Neon dashboard, click on your project
2. Click "Connection Details"
3. Copy the connection string that looks like:
   ```
   postgresql://username:password@ep-xxx-xxx-xxx.region.aws.neon.tech/database_name
   ```

## Step 3: Update Your .env File
1. Open the `.env` file in your project
2. Replace the DATABASE_URL line with your Neon connection string
3. Save the file

## Step 4: Run Database Setup
```bash
npm run db:push
```

## Step 5: Start the Application
```bash
npm run dev
```

## Step 6: Login as Super Admin
- **Email**: cc@siwaht.com
- **Password**: Hola173!

## 🎯 Alternative: Supabase (Also Free)
1. Go to [supabase.com](https://supabase.com)
2. Create account and new project
3. Get connection string from Settings > Database
4. Follow steps 3-6 above

## 🆘 Need Help?
- Check the console output for error messages
- Make sure your DATABASE_URL is correct
- Verify the database is accessible from your network
