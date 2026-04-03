import json
import os

# Set testing mode before importing app
os.environ['TESTING'] = '1'

from app import app, db, db

# Set testing mode
os.environ['TESTING'] = '1'

def test_users_crud():
    with app.app_context():
        db.drop_all()
        db.create_all()
    
    client = app.test_client()

    # create
    r = client.post('/users', json={'name':'Alice','email':'alice@example.com'})
    assert r.status_code == 201
    user = r.get_json()
    assert 'id' in user
    assert user['name'] == 'Alice'

    user_id = user['id']

    # read list
    r = client.get('/users')
    assert r.status_code == 200
    users = r.get_json()
    assert isinstance(users, list) and len(users) == 1

    # read single
    r = client.get(f'/users/{user_id}')
    assert r.status_code == 200
    assert r.get_json()['name'] == 'Alice'

    # update
    r = client.put(f'/users/{user_id}', json={'name':'Alice Updated'})
    assert r.status_code == 200
    assert r.get_json()['name'] == 'Alice Updated'

    # delete
    r = client.delete(f'/users/{user_id}')
    assert r.status_code == 200

    r = client.get(f'/users/{user_id}')
    assert r.status_code == 404

    with app.app_context():
        db.drop_all()


def test_books_crud():
    with app.app_context():
        db.drop_all()
        db.create_all()
    
    client = app.test_client()

    # create
    r = client.post('/books', json={'title':'1984','author':'Orwell'})
    assert r.status_code == 201
    book = r.get_json()
    assert 'id' in book

    book_id = book['id']

    # read list
    r = client.get('/books')
    assert r.status_code == 200
    books = r.get_json()
    assert isinstance(books, list) and len(books) == 1

    # read single
    r = client.get(f'/books/{book_id}')
    assert r.status_code == 200
    assert r.get_json()['title'] == '1984'

    # update
    r = client.put(f'/books/{book_id}', json={'title':'Animal Farm'})
    assert r.status_code == 200
    assert r.get_json()['title'] == 'Animal Farm'

    # delete
    r = client.delete(f'/books/{book_id}')
    assert r.status_code == 200

    r = client.get(f'/books/{book_id}')
    assert r.status_code == 404

    with app.app_context():
        db.drop_all()
