# Super Admin Setup Guide

## Prerequisites
1. **Database Setup**: You need a PostgreSQL database running
2. **Environment Variables**: Set `DATABASE_URL` environment variable
3. **Dependencies**: Run `npm install` to install all required packages

## Option 1: Run the Seed Script (Recommended)
Once your database is configured, the super admin user will be automatically created when you start the server:

```bash
npm run dev
```

The seed function runs automatically and creates:
- **Email**: cc@siwaht.com
- **Password**: Hola173!
- **Role**: super_admin
- **Name**: Super Admin

## Option 2: Manual Creation
If you want to create the user manually, you can run:

```bash
npx tsx server/seedAdmin.ts
```

## Option 3: Standalone Script
Use the provided `create-super-admin.js` script:

```bash
node create-super-admin.js
```

## Database Configuration
Make sure your `DATABASE_URL` is set to a valid PostgreSQL connection string:

```bash
# Example for local PostgreSQL
export DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# Example for Neon (cloud PostgreSQL)
export DATABASE_URL="postgresql://username:password@ep-xxx-xxx-xxx.region.aws.neon.tech/database_name"
```

## Verification
After creation, you can verify the user exists by:
1. Starting the application
2. Logging in with cc@siwaht.com / Hola173!
3. Checking the super admin dashboard

## Troubleshooting
- **"DATABASE_URL must be set"**: Set your database connection string
- **"Connection refused"**: Check if your database is running
- **"Authentication failed"**: Verify database credentials
- **"Database does not exist"**: Create the database first
