"""
Database Setup Script for Windows
Runs SQL migrations without requiring psql client
"""

import psycopg2
import os

# Supabase Database Connection
DATABASE_URL = "postgresql://postgres:Shadow19*@db.rjkcbdvnnzfqgxgwlabi.supabase.co:5432/postgres"

def run_sql_file(cursor, filepath):
    """Execute SQL file"""
    print(f"📄 Running {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        sql = f.read()
        cursor.execute(sql)
    print(f"✅ {filepath} executed successfully")

def main():
    print("🚀 Setting up AI Trader's Shadow Database")
    print("=" * 60)

    try:
        # Connect to database
        print(f"\n📡 Connecting to Supabase...")
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cursor = conn.cursor()
        print("✅ Connected successfully!")

        # Run schema.sql
        print("\n📋 Creating database schema...")
        schema_path = "database/schema.sql"
        if os.path.exists(schema_path):
            run_sql_file(cursor, schema_path)
        else:
            print(f"⚠️  {schema_path} not found, skipping...")

        # Run migration
        print("\n🔄 Running migrations...")
        migration_path = "database/migrations/001_add_expert_demonstrations.sql"
        if os.path.exists(migration_path):
            run_sql_file(cursor, migration_path)
        else:
            print(f"⚠️  {migration_path} not found, skipping...")

        # Verify tables created
        print("\n🔍 Verifying tables...")
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema='public'
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()

        print("\n✅ Database tables created:")
        for table in tables:
            print(f"   - {table[0]}")

        # Check expert_demonstrations table
        cursor.execute("""
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema='public'
            AND table_name='expert_demonstrations';
        """)
        exists = cursor.fetchone()[0]

        if exists:
            print("\n✅ expert_demonstrations table: READY")
        else:
            print("\n⚠️  expert_demonstrations table: NOT FOUND")

        cursor.close()
        conn.close()

        print("\n" + "=" * 60)
        print("🎉 Database setup completed successfully!")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nTroubleshooting:")
        print("1. Check internet connection")
        print("2. Verify Supabase credentials")
        print("3. Check if Supabase project is active")
        return 1

    return 0

if __name__ == "__main__":
    exit(main())
