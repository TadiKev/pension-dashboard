# Postgres local setup

Use your OS package manager or installer to install Postgres.
Create DB and user per .env.example:
psql -U postgres -c "CREATE USER dashboard_user WITH PASSWORD 'changeme';"
psql -U postgres -c "CREATE DATABASE dashboard_db OWNER dashboard_user;"
