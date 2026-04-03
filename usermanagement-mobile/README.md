# User Management iOS App

React Native + Expo mobile app that connects to Flask REST API at `http://<server-ip>:8080`.

## Run locally

1. Start backend API (make sure it's accessible to your device):
   ```bash
   cd /Users/vnanda/projects/two-crud-api
   source .venv/bin/activate
   TESTING=1 python app.py
   ```

2. Start Expo app:
   ```bash
   cd /Users/vnanda/projects/usermanagement-mobile
   npm install
   npm run ios
   # or `expo start` for QR code scanning
   ```

## API endpoints used

- GET /users
- POST /users
- DELETE /users/:id
- GET /books
- POST /books
- DELETE /books/:id

## Important

For iOS Simulator, use `http://127.0.0.1:8080` default.
For physical device use local host IP, e.g. `http://192.168.0.200:8080`.
