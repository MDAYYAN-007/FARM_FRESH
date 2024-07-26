# Express.js Recipe Management Application

## Overview

This application is a recipe management system using Express.js, PostgreSQL, Passport.js for authentication, and JWT for secure user sessions. It allows users to register, log in, and manage their products including fruits, vegetables, and grains. Users can add items to their cart and manage their product listings.

## Features

- User registration and login with password hashing
- Google OAuth 2.0 for authentication
- JWT-based session management
- CRUD operations for products
- Cart functionality to manage product purchases
- Secure handling of user sessions and data

## Technologies Used

- **Express.js**: Web framework for Node.js
- **PostgreSQL**: Database for storing user and product data
- **Passport.js**: Authentication middleware
- **JWT (JSON Web Tokens)**: Token-based authentication
- **bcrypt**: Password hashing
- **EJS**: Templating engine for rendering views

## Getting Started

### Prerequisites

- Node.js
- PostgreSQL
- Google Developer credentials (for Google OAuth)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/MDAYYAN-007/your-repo.git
   cd your-repo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following content:
   ```plaintext
   PG_USER=your_pg_user
   PG_HOST=localhost
   PG_DATABASE=your_db_name
   PG_PASSWORD=your_pg_password
   PG_PORT=5432
   SESSION_SECRET=your_session_secret
   JWT_SECRET=your_jwt_secret
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

4. Run database migrations:
   Make sure your PostgreSQL database is set up with the required tables and schemas.

5. Start the server:
   ```bash
   npm start
   ```

6. Access the application:
   Open your browser and navigate to `http://localhost:3000`.

## Routes

- `GET /` - Home page
- `GET /register` - User registration page
- `GET /login` - User login page
- `GET /buy` - Buy products page (requires authentication)
- `GET /sell` - Sell products page (requires authentication)
- `GET /info` - Information page
- `GET /crop-safety` - Weather and crop safety information page
- `GET /about` - About page
- `GET /fruits` - List of fruits (requires authentication)
- `GET /vegetables` - List of vegetables (requires authentication)
- `GET /grains` - List of grains (requires authentication)
- `GET /my-products` - User's products page (requires authentication)
- `GET /cart` - User's cart page (requires authentication)
- `POST /register` - User registration
- `POST /login` - User login
- `POST /submit-product` - Submit a new product (requires authentication)
- `POST /cart/add/:id` - Add item to cart (requires authentication)
- `GET /auth/google` - Google OAuth authentication
- `GET /auth/google/callback` - Google OAuth callback
- `GET /logout` - Logout and clear session

## Contributing

Feel free to fork the repository, make improvements, and submit pull requests.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Express.js](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Passport.js](http://www.passportjs.org/)
- [JWT](https://jwt.io/)
- [bcrypt](https://www.npmjs.com/package/bcrypt)
- [EJS](https://www.npmjs.com/package/ejs)
```
