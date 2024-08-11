# Farm-to-Table Express Application

This project is an Express application that allows users to manage products and cart items. Users can sign up, log in, view products, add products to their cart, and view their cart.

## Features

- User Authentication (Sign Up, Log In)
- Product Management (Add, View)
- Cart Management (Add Items to Cart, View Cart)
- Uses PostgreSQL for data storage
- Session management with `express-session`

## Prerequisites

- Node.js
- PostgreSQL

## Getting Started

### Clone the repository

```bash
git clone https://github.com/yourusername/https://github.com/MDAYYAN-007/FARM_FRESH.git
```

### Install dependencies

```bash
npm install
```

### Database Setup

1. **Create Database and Tables**

   Connect to your PostgreSQL database and run the following SQL queries to create the necessary tables:

   ```sql
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     email VARCHAR(255) UNIQUE NOT NULL,
     password VARCHAR(255) NOT NULL
   );

   CREATE TABLE products (
     id SERIAL PRIMARY KEY,
     product_name VARCHAR(255) NOT NULL,
     price DECIMAL(10, 2) NOT NULL,
     location VARCHAR(255) NOT NULL,
     product_type VARCHAR(50) NOT NULL,
     description TEXT NOT NULL,
     user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
   );

   CREATE TABLE cart_items (
     id SERIAL PRIMARY KEY,
     product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
     product_name VARCHAR(255) NOT NULL,
     product_description TEXT NOT NULL,
     quantity INTEGER NOT NULL,
     product_price DECIMAL(10, 2) NOT NULL,
     total_cost DECIMAL(10, 2) NOT NULL,
     user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
   );
   ```

### Environment Variables

Create a `.env` file in the root directory and add your PostgreSQL connection details:

```
DATABASE_URL=postgres://yourusername:yourpassword@localhost:5432/yourdatabase
SESSION_SECRET=your_session_secret
```

### Run the Application

```bash
npm start
```

The application will be running at `http://localhost:3000`.

## API Endpoints

### Authentication

- `POST /signup`: Sign up a new user
- `POST /login`: Log in an existing user

### Products

- `GET /products`: Get all products
- `POST /products`: Add a new product

### Cart

- `POST /cart`: Add an item to the cart
- `GET /cart`: Get all items in the cart

## Contributing

Feel free to open issues or submit pull requests for any improvements or bug fixes.
