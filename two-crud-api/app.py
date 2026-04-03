from flask import Flask, jsonify, request, abort, render_template, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os

app = Flask(__name__)

# Enable CORS for all routes
CORS(app)

# Database configuration
if os.getenv('TESTING'):
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///test.db'
else:
    db_user = os.getenv('DB_USER', 'username')
    db_password = os.getenv('DB_PASSWORD', 'password')
    db_host = os.getenv('DB_HOST', 'localhost')
    db_name = os.getenv('DB_NAME', 'your_database_name')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'mysql+pymysql://{db_user}:{db_password}@{db_host}/{db_name}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Association table for many-to-many relationship
user_books = db.Table('user_books',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('book_id', db.Integer, db.ForeignKey('book.id'), primary_key=True)
)

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    address = db.Column(db.String(200))
    books = db.relationship('Book', secondary=user_books, backref=db.backref('users', lazy='dynamic'))

class Book(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(100))
    genre = db.Column(db.String(50))
    description = db.Column(db.Text)

# Users CRUD
@app.route('/users', methods=['GET'])
def list_users():
    users = User.query.all()
    return jsonify([{
        'id': u.id, 
        'name': u.name, 
        'email': u.email,
        'phone': u.phone,
        'address': u.address,
        'books': [{'id': b.id, 'title': b.title} for b in u.books]
    } for u in users])

@app.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'id': user.id, 
        'name': user.name, 
        'email': user.email,
        'phone': user.phone,
        'address': user.address,
        'books': [{'id': b.id, 'title': b.title} for b in user.books]
    })

@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json() or {}
    if 'name' not in data:
        return jsonify({'error': 'name is required'}), 400
    user = User(
        name=data['name'], 
        email=data.get('email'),
        phone=data.get('phone'),
        address=data.get('address')
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({
        'id': user.id, 
        'name': user.name, 
        'email': user.email,
        'phone': user.phone,
        'address': user.address,
        'books': []
    }), 201

@app.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    data = request.get_json() or {}
    if 'name' in data:
        user.name = data['name']
    if 'email' in data:
        user.email = data['email']
    if 'phone' in data:
        user.phone = data['phone']
    if 'address' in data:
        user.address = data['address']
    db.session.commit()
    return jsonify({
        'id': user.id, 
        'name': user.name, 
        'email': user.email,
        'phone': user.phone,
        'address': user.address,
        'books': [{'id': b.id, 'title': b.title} for b in user.books]
    })

@app.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    db.session.delete(user)
    db.session.commit()
    return jsonify({
        'id': user.id, 
        'name': user.name, 
        'email': user.email,
        'phone': user.phone,
        'address': user.address,
        'books': []
    })

# Books CRUD
@app.route('/books', methods=['GET'])
def list_books():
    books = Book.query.all()
    return jsonify([{
        'id': b.id, 
        'title': b.title, 
        'author': b.author,
        'genre': b.genre,
        'description': b.description,
        'users': [{'id': u.id, 'name': u.name} for u in b.users]
    } for b in books])

@app.route('/books/<int:book_id>', methods=['GET'])
def get_book(book_id):
    book = db.session.get(Book, book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    return jsonify({
        'id': book.id, 
        'title': book.title, 
        'author': book.author,
        'genre': book.genre,
        'description': book.description,
        'users': [{'id': u.id, 'name': u.name} for u in book.users]
    })

@app.route('/books', methods=['POST'])
def create_book():
    data = request.get_json() or {}
    if 'title' not in data:
        return jsonify({'error': 'title is required'}), 400
    book = Book(
        title=data['title'], 
        author=data.get('author'),
        genre=data.get('genre'),
        description=data.get('description')
    )
    db.session.add(book)
    db.session.commit()
    return jsonify({
        'id': book.id, 
        'title': book.title, 
        'author': book.author,
        'genre': book.genre,
        'description': book.description,
        'users': []
    }), 201

@app.route('/books/<int:book_id>', methods=['PUT'])
def update_book(book_id):
    book = db.session.get(Book, book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    data = request.get_json() or {}
    if 'title' in data:
        book.title = data['title']
    if 'author' in data:
        book.author = data['author']
    if 'genre' in data:
        book.genre = data['genre']
    if 'description' in data:
        book.description = data['description']
    db.session.commit()
    return jsonify({
        'id': book.id, 
        'title': book.title, 
        'author': book.author,
        'genre': book.genre,
        'description': book.description,
        'users': [{'id': u.id, 'name': u.name} for u in book.users]
    })

@app.route('/books/<int:book_id>', methods=['DELETE'])
def delete_book(book_id):
    book = db.session.get(Book, book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    db.session.delete(book)
    db.session.commit()
    return jsonify({
        'id': book.id, 
        'title': book.title, 
        'author': book.author,
        'genre': book.genre,
        'description': book.description,
        'users': []
    })

if __name__ == '__main__':
    with app.app_context():
        if os.getenv('TESTING'):
            db.drop_all()
        db.create_all()
        # Add sample data if tables are empty
        if not User.query.first():
            alice = User(name="Alice Johnson", email="alice@example.com", phone="123-456-7890", address="123 Main St")
            bob = User(name="Bob Smith", email="bob@example.com", phone="987-654-3210", address="456 Oak Ave")
            charlie = User(name="Charlie Brown", email="charlie@example.com", phone="555-123-4567", address="789 Pine Rd")
            db.session.add_all([alice, bob, charlie])
            db.session.commit()
            
            # Add books
            book1 = Book(title="1984", author="George Orwell", genre="Dystopian", description="A classic novel about totalitarianism")
            book2 = Book(title="To Kill a Mockingbird", author="Harper Lee", genre="Fiction", description="A story of racial injustice")
            book3 = Book(title="The Great Gatsby", author="F. Scott Fitzgerald", genre="Classic", description="The American Dream in the Jazz Age")
            book4 = Book(title="Pride and Prejudice", author="Jane Austen", genre="Romance", description="A romantic novel of manners")
            db.session.add_all([book1, book2, book3, book4])
            db.session.commit()
            
            # Link users to books
            alice.books.append(book1)
            alice.books.append(book2)
            bob.books.append(book3)
            charlie.books.append(book4)
            charlie.books.append(book1)
            db.session.commit()
    app.run(debug=True, port=8080)

@app.route('/users/<int:user_id>/books', methods=['POST'])
def assign_book_to_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    data = request.get_json() or {}
    book_id = data.get('book_id')
    if not book_id:
        return jsonify({'error': 'book_id is required'}), 400
    book = db.session.get(Book, book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    if book not in user.books:
        user.books.append(book)
        db.session.commit()
    return jsonify({'message': 'Book assigned to user'})

@app.route('/users/<int:user_id>/books/<int:book_id>', methods=['DELETE'])
def remove_book_from_user(user_id, book_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    book = db.session.get(Book, book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404
    if book in user.books:
        user.books.remove(book)
        db.session.commit()
    return jsonify({'message': 'Book removed from user'})
@app.route('/')
def index():
    return render_template('base.html')

@app.route('/users', methods=['GET', 'POST'])
def users_ui():
    if request.method == 'POST':
        data = request.form
        if 'id' in data and data['id']:
            # Update
            user = db.session.get(User, int(data['id']))
            if user:
                user.name = data['name']
                user.email = data.get('email')
                db.session.commit()
        else:
            # Create
            user = User(name=data['name'], email=data.get('email'))
            db.session.add(user)
            db.session.commit()
        return redirect(url_for('users_ui'))
    
    users = User.query.all()
    return render_template('users.html', users=users)

@app.route('/users/<int:user_id>/delete', methods=['POST'])
def delete_user_ui(user_id):
    user = db.session.get(User, user_id)
    if user:
        db.session.delete(user)
        db.session.commit()
    return redirect(url_for('users_ui'))

@app.route('/books', methods=['GET', 'POST'])
def books_ui():
    if request.method == 'POST':
        data = request.form
        if 'id' in data and data['id']:
            # Update
            book = db.session.get(Book, int(data['id']))
            if book:
                book.title = data['title']
                book.author = data.get('author')
                db.session.commit()
        else:
            # Create
            book = Book(title=data['title'], author=data.get('author'))
            db.session.add(book)
            db.session.commit()
        return redirect(url_for('books_ui'))
    
    books = Book.query.all()
    return render_template('books.html', books=books)

@app.route('/books/<int:book_id>/delete', methods=['POST'])
def delete_book_ui(book_id):
    book = db.session.get(Book, book_id)
    if book:
        db.session.delete(book)
        db.session.commit()
    return redirect(url_for('books_ui'))
