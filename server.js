import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import bcrypt from 'bcrypt';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;
const saltRounds = 10;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());

// Configure express-session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}));

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/login');
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Error verifying token:", err);
    return res.redirect('/login');
  }
};

app.get("/", (req, res) => {
  res.render('index.ejs');
});
  
app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/buy", verifyToken, (req, res) => {
  res.render("buy.ejs");
});

app.get("/sell", verifyToken, (req, res) => {
  res.render("sell.ejs");
});

app.get("/info", (req, res) => {
  res.render("info.ejs");
});

app.get("/crop-safety",(req,res) => {
  res.render("weather.ejs")
})

app.get("/about",(req, res) => {
  res.render("about.ejs");
});

app.get("/fruits", verifyToken, async (req, res) => {
  try {
    const result = await db.query("SELECT * from products where product_type='fruits'")
    res.render("fruits.ejs", {
      fruits: result.rows
    });
  } catch (error) {
    console.log(error)
  }
});

app.get("/vegetables", verifyToken, async (req, res) => {
  try {
    const result = await db.query("SELECT * from products where product_type='vegetables'")
    res.render("vegetables.ejs", {
      fruits : result.rows
    });
  } catch (error) {
    console.log(error)
  }
});

app.get("/grains", verifyToken, async (req, res) => {
  try {
    const result = await db.query("SELECT * from products where product_type='grains'")
    res.render("grains.ejs", {
      fruits : result.rows
    });
  } catch (error) {
    console.log(error)
  }
});

app.get("/my-products", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query("SELECT * FROM products WHERE user_id = $1", [userId]);
    const products = result.rows;
    res.render("products.ejs", { products });
  } catch (err) {
    console.error("Error fetching user's products:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get('/cart', verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch cart items for the logged-in user
    const result = await db.query('SELECT * FROM cart_items WHERE user_id = $1', [userId]);
    const cartItems = result.rows;

    // Calculate total price
    let totalPrice = 0;
    cartItems.forEach(item => {
      // Ensure total_cost is treated as a number
      let t_c=parseFloat(item.total_cost);
      totalPrice += t_c; // Use parseFloat() to parse total_cost to a number
    });

    // Render the cart.ejs template with cartItems and totalPrice
    res.render('cart.ejs', { cartItems, totalPrice });
  } catch (err) {
    console.error('Error fetching cart items:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), async (req, res) => {
  try {
    const existingUser = await db.query("SELECT * FROM users WHERE email = $1", [req.user.email]);

    if (existingUser.rows.length > 0) {
      // User already exists, log them in
      const userId = existingUser.rows[0].id;
      const token = jwt.sign({ email: req.user.email, id: userId }, JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true });
      res.redirect(`/`);
    } else {
      // New user, create an account with a default or temporary password
      const defaultPassword = 'temporaryPassword'; // Example default password
      const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);
      const newUser = await db.query(
        "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
        [req.user.email, hashedPassword]
      );
      const userId = newUser.rows[0].id;
      const token = jwt.sign({ email: req.user.email, id: userId }, JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true });
      res.redirect(`/`);
    }
  } catch (err) {
    console.error("Error handling Google OAuth callback:", err);
    res.redirect("/login"); // Handle error appropriately
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie('token');
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (checkResult.rows.length > 0) {
      res.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
          res.redirect("/login");
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          const user = result.rows[0];
          const token = jwt.sign({ email: user.email, id: user.id }, JWT_SECRET, { expiresIn: '1h' });
          res.cookie('token', token, { httpOnly: true });
          res.redirect(`/`);
        }
      });
    }
  } catch (err) {
    console.error("Error registering user:", err);
    res.redirect("/login");
  }
});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect("/register");
    }
    const token = jwt.sign({ email: user.email, id: user.id }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true });
    return res.redirect(`/`);
  })(req, res, next);
});

app.post("/submit-product", verifyToken, async (req, res) => {
  const { productName, price, location, productType, description } = req.body;
  const userId = req.user.id;

  try {
    const result = await db.query(
      "INSERT INTO products (product_name, price, location, product_type, description, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [productName, price, location, productType, description, userId]
    );
    res.redirect("/my-products");
  } catch (err) {
    console.error("Error submitting product:", err);
    res.status(500).json({ success: false, error: "Failed to submit product" });
  }
});

app.post('/add-to-cart-fruits/:id', verifyToken, async (req, res) => {
  const productId = req.params.id;
  const { productName, productDesc, quantity } = req.body;
  const userId = req.user.id;

  try {
    // Convert quantity to a number (if necessary)
    const parsedQuantity = parseInt(quantity, 10); // Base 10

    // Validate parsedQuantity if needed
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    // Check if the product is already in the cart for this user
    const existingCartItemQuery = await db.query(
      'SELECT * FROM cart_items WHERE product_id = $1 AND user_id = $2',
      [productId, userId]
    );
    if (existingCartItemQuery.rows.length > 0) {
      // Update the existing cart item with new quantity and total cost
      const existingCartItem = existingCartItemQuery.rows[0];
      const updatedQuantity = existingCartItem.quantity + parsedQuantity;
      const updatedTotalCost = existingCartItem.product_price * updatedQuantity;

      await db.query(
        'UPDATE cart_items SET quantity = $1, total_cost = $2 WHERE id = $3',
        [updatedQuantity, updatedTotalCost, existingCartItem.id]
      );

      return res.redirect('/fruits');
    }

    // Fetch product details including price from database
    const productQuery = await db.query('SELECT price FROM products WHERE id = $1', [productId]);
    if (productQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const productPrice = productQuery.rows[0].price;

    // Calculate total cost
    const totalCost = productPrice * parsedQuantity;

    // Insert into cart_items table
    const result = await db.query(
      'INSERT INTO cart_items (product_id, product_name, product_description, quantity, total_cost, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [productId, productName, productDesc, parsedQuantity, totalCost, userId]
    );

    res.redirect('/fruits');
  } catch (err) {
    console.error('Error adding item to cart:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/add-to-cart-vegetables/:id', verifyToken, async (req, res) => {
  const productId = req.params.id;
  const { productName, productDesc, quantity } = req.body;
  const userId = req.user.id;

  try {
    // Convert quantity to a number (if necessary)
    const parsedQuantity = parseInt(quantity, 10); // Base 10

    // Validate parsedQuantity if needed
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    // Check if the product is already in the cart for this user
    const existingCartItemQuery = await db.query(
      'SELECT * FROM cart_items WHERE product_id = $1 AND user_id = $2',
      [productId, userId]
    );
    if (existingCartItemQuery.rows.length > 0) {
      // Update the existing cart item with new quantity and total cost
      const existingCartItem = existingCartItemQuery.rows[0];
      const updatedQuantity = existingCartItem.quantity + parsedQuantity;
      const updatedTotalCost = existingCartItem.product_price * updatedQuantity;

      await db.query(
        'UPDATE cart_items SET quantity = $1, total_cost = $2 WHERE id = $3',
        [updatedQuantity, updatedTotalCost, existingCartItem.id]
      );

      return res.redirect('/fruits');
    }

    // Fetch product details including price from database
    const productQuery = await db.query('SELECT price FROM products WHERE id = $1', [productId]);
    if (productQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const productPrice = productQuery.rows[0].price;

    // Calculate total cost
    const totalCost = productPrice * parsedQuantity;

    // Insert into cart_items table
    const result = await db.query(
      'INSERT INTO cart_items (product_id, product_name, product_description, quantity, total_cost, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [productId, productName, productDesc, parsedQuantity, totalCost, userId]
    );

    res.redirect('/vegetables');
  } catch (err) {
    console.error('Error adding item to cart:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/add-to-cart-grains/:id', verifyToken, async (req, res) => {
  const productId = req.params.id;
  const { productName, productDesc, quantity } = req.body;
  const userId = req.user.id;

  try {
    // Convert quantity to a number (if necessary)
    const parsedQuantity = parseInt(quantity, 10); // Base 10

    // Validate parsedQuantity if needed
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }

    // Fetch product details including price from database
    const productQuery = await db.query('SELECT price FROM products WHERE id = $1', [productId]);
    if (productQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const productPrice = productQuery.rows[0].price;

    // Calculate total cost
    const totalCost = productPrice * parsedQuantity;

    // Insert into cart_items table
    const result = await db.query(
      'INSERT INTO cart_items (product_id, product_name, product_description, quantity, total_cost, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [productId, productName, productDesc, parsedQuantity, totalCost, userId]
    );

    res.redirect("/grains");
  } catch (err) {
    console.error('Error adding item to cart:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/delete-product/:id', async (req, res) => {
  const productId = req.params.id;

  try {
      await db.query('DELETE FROM products WHERE id = $1', [productId]);

      res.redirect('/my-products'); // Redirect to product list page after deletion
  } catch (err) {
      console.error('Error deleting product:', err);
      res.status(500).send('Internal Server Error');
  }
})

app.post('/remove-from-cart/:id', verifyToken, async (req, res) => {
  const productId = req.params.id;
  const userId = req.user.id;

  try {
    // Delete item from cart_items table
    const result = await db.query(
      'DELETE FROM cart_items WHERE product_id = $1 AND user_id = $2 RETURNING *',
      [productId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    res.redirect("/cart"); // Redirect to cart page after removing item
  } catch (err) {
    console.error('Error removing item from cart:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

passport.use(
  "local",
  new LocalStrategy(async function verify(username, password, done) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [username]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return done(err);
          } else if (valid) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Incorrect password" });
          }
        });
      } else {
        return done(null, false, { message: "User not found" });
      }
    } catch (err) {
      console.log(err);
      return done(err);
    }
  })
);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [profile.emails[0].value]);
        if (result.rows.length > 0) {
          return done(null, result.rows[0]);
        } else {
          const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [profile.emails[0].value, "google"]
          );
          return done(null, newUser.rows[0]);
        }
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    if (result.rows.length > 0) {
      done(null, result.rows[0]);
    } else {
      done(new Error("User not found"), null);
    }
  } catch (err) {
    done(err, null);
  }
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
