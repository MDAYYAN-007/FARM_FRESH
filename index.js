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

// PostgreSQL connection
const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

// Middleware to verify JWT token
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
    return res.redirect('/login');
  }
};

app.get("/", (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return res.redirect(`/recipes/${decoded.id}`);
    } catch (err) {
      console.error("Error verifying token:", err);
    }
  }
  res.redirect('/register');
});

app.get("/register", (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return res.redirect(`/recipes/${decoded.id}`);
    } catch (err) {
      console.error("Error verifying token:", err);
    }
  }else{
    res.render("register.ejs");
  }
});

app.get("/login", (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return res.redirect(`/recipes/${decoded.id}`);
    } catch (err) {
      console.error("Error verifying token:", err);
    }
  }else{
    res.render("login.ejs");
  }
});

// Display recipes for a specific user
app.get("/recipes/:id", verifyToken, async (req, res) => {
  const userId = req.params.id;
  const result = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
  const userName = result.rows[0].email;

  if (req.user.email === userName) {
    try {
      const result = await db.query("SELECT * FROM recipes WHERE user_id = $1 ORDER BY id ASC", [userId]);
      res.render("recipes.ejs", {
        content: result.rows,
        userId: userId,
        email: req.user.email
      });
    } catch (error) {
      console.error("Error fetching recipes:", error);
    }
  } else {
    res.redirect('/login');
  }
});

// Initiate Google OAuth authentication
app.get("/auth/google", passport.authenticate("google", {
  scope: ["profile", "email"],
}));

// Handle Google OAuth callback and redirect to recipes
app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), async (req, res) => {
  try {
    const existingUser = await db.query("SELECT * FROM users WHERE email = $1", [req.user.email]);

    if (existingUser.rows.length > 0) {
      // User already exists, log them in
      const userId = existingUser.rows[0].id;
      const token = jwt.sign({ email: req.user.email, id: userId }, JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true });
      res.redirect(`/recipes/${userId}`);
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
      res.redirect(`/recipes/${userId}`);
    }
  } catch (err) {
    console.error("Error handling Google OAuth callback:", err);
    res.redirect("/login"); // Handle error appropriately
  }
});

app.get("/edit/:id", verifyToken, async (req, res) => {
  try {
    const recipeId = req.params.id;
    const result = await db.query("SELECT * FROM recipes WHERE id = $1", [recipeId]);
    const userId = result.rows[0].user_id;
    const result2 = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
    const userName = result2.rows[0].email;
    const recipe = result.rows[0];
    if (req.user.email === userName) {
      res.render("create.ejs", {
        type: "Edit Post",
        submit: "Edit Post",
        userId: userId,
        recipe: recipe,
        email: req.user.email 
      });
    } else {
      res.redirect('/login');
    }
  } catch (error) {
    console.error("Error fetching recipe for edit:", error);
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie('token');
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/register");
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
          res.redirect(`/recipes/${user.id}`);
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
      return res.redirect("/login");
    }
    const token = jwt.sign({ email: user.email, id: user.id }, JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true });
    return res.redirect(`/recipes/${user.id}`);
  })(req, res, next);
});

app.post("/new/:id", verifyToken, (req, res) => {
  const userId = req.params.id;
  res.render("create.ejs", {
    type: "New Post",
    submit: "Create Post",
    userId: userId,
    email: req.user.email
  });
});

app.post("/post/:id", verifyToken, async (req, res) => {
  const userId = req.params.id;
  const newName = req.body.name;
  let newIngredients = req.body.ingredients;
  newIngredients = newIngredients.replace(/\r\n/g, '\\n');
  let newSteps = req.body.steps;
  newSteps = newSteps.replace(/\r\n/g, '\\n');
  const d = new Date();
  await db.query(
    "INSERT INTO recipes (name, ingredients, steps, user_id, date) VALUES ($1, $2, $3, $4, $5)",
    [newName, newIngredients, newSteps, userId, d]
  );
  res.redirect(`/recipes/${userId}`);
});

app.post("/edited/:id", verifyToken, async (req, res) => {
  const recipeId = req.params.id;
  const newName = req.body.name;
  let newIngredients = req.body.ingredients;
  newIngredients = newIngredients.replace(/\r\n/g, '\\n');
  let newSteps = req.body.steps;
  newSteps = newSteps.replace(/\r\n/g, '\\n');
  const result = await db.query("SELECT * FROM recipes WHERE id = $1", [recipeId]);
  const userId = result.rows[0].user_id;
  const d = new Date();
  await db.query("UPDATE recipes SET name=$1,ingredients=$2, steps=$3, date=$5 WHERE id=$4", [newName, newIngredients, newSteps, recipeId, d]);
  res.redirect(`/recipes/${userId}`);
});

app.post("/delete/:id", verifyToken, async (req, res) => {
  const recipeId = req.params.id;
  const result = await db.query("SELECT * FROM recipes WHERE id = $1", [recipeId]);
  const userId = result.rows[0].user_id;
  await db.query("DELETE FROM recipes WHERE id = $1", [recipeId]);
  res.redirect(`/recipes/${userId}`);
});

app.post("/closed/:id", (req, res) => {
  const userId = req.params.id;
  res.redirect(`/recipes/${userId}`);
});

// Local authentication strategy
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

// Google authentication strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/callback",
    },
    async (token, tokenSecret, profile, done) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [profile.emails[0].value]);
        if (result.rows.length > 0) {
          return done(null, result.rows[0]);
        } else {
          const newUser = await db.query(
            "INSERT INTO users (email,password) VALUES ($1,$2) RETURNING *",
            [profile.emails[0].value,"google"]
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
