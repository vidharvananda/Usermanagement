# Two CRUD API with MySQL & UI

This repository includes a Flask CRUD API with MySQL database and a web UI for managing users and books. Features a many-to-many relationship between users and books.

## Features

- **Users Management**: Create, read, update, delete users
- **Books Management**: Create, read, update, delete books  
- **User-Book Relationships**: Link multiple books to users
- **Web UI**: Bootstrap-based interface for all operations
- **REST API**: JSON API endpoints
- **Database**: MySQL (production) or SQLite (testing)

## Database Schema

- **Users**: id, name, email, phone, address
- **Books**: id, title, author, genre, description
- **Relationships**: Many-to-many user-book associations

## Setup

1. Install MySQL and create a database:
   - Install MySQL server (e.g., via Homebrew: `brew install mysql`)
   - Start MySQL: `brew services start mysql`
   - Create database: `mysql -u root -p` then `CREATE DATABASE your_database_name;`

2. Set environment variables for database connection:
   ```bash
   export DB_USER=your_mysql_username
   export DB_PASSWORD=your_mysql_password
   export DB_HOST=localhost
   export DB_NAME=your_database_name
   ```

   Or update the defaults in `app.py` directly.

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Activate venv: `source .venv/bin/activate`

5. Run: `python app.py`

6. Test with curl or Postman, or use the web UI at http://localhost:8080/users or http://localhost:8080/books, or use the web UI at http://localhost:5000/users or http://localhost:5000/books

## API Endpoints

### Users
- `GET /users` - List all users with their books
- `GET /users/<id>` - Get user details
- `POST /users` - Create user
- `PUT /users/<id>` - Update user
- `DELETE /users/<id>` - Delete user
- `POST /users/<user_id>/books` - Assign book to user
- `DELETE /users/<user_id>/books/<book_id>` - Remove book from user

### Books
- `GET /books` - List all books with their users
- `GET /books/<id>` - Get book details
- `POST /books` - Create book
- `PUT /books/<id>` - Update book
- `DELETE /books/<id>` - Delete book

## Web UI

The application includes a web interface for performing CRUD operations:

- **Users**: http://localhost:8080/users
- **Books**: http://localhost:8080/books

### UI Features:
- View all records in responsive tables
- Add new records using comprehensive forms
- Edit existing records with pre-populated forms
- Delete records with confirmation dialogs
- View user-book relationships in tables
- Bootstrap styling for modern appearance
