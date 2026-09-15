require("dotenv").config();

const express = require("express"),
  cookie = require("cookie-session"),
  bodyParser = require("body-parser"),
  compression = require("compression"),
  morgan = require("morgan"),
  favicon = require("serve-favicon"),
  crypto = require("crypto"),
  { MongoClient, ObjectId } = require("mongodb"),
  app = express();

app.use(express.json());

const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@${process.env.HOST}`;
console.log("uri:", uri);
const client = new MongoClient(uri);

let collection = null;
let users = null;

const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(compression());

app.use(morgan("dev"));

app.use(favicon("public/favicon.ico"));

app.use(
  cookie({
    name: "session",
    keys: [process.env.SESSION_KEY],
    httpOnly: true,
    sameSite: "lax",
    secure: false,
  }),
);

async function run() {
  await client.connect();
  collection = await client.db("necessity_tracker").collection("Collection1");
  users = await client.db("necessity_tracker").collection("users");

  app.use((req, res, next) => {
    if (collection !== null) {
      next();
    } else {
      res.status(503).send();
    }
  });

  app.post("/register", async (req, res) => {
    try {
      const username = req.body.username;
      const password = req.body.password;

      if (!username || !password) {
        return res.send("Username and password are required");
      }

      const existingUser = await users.findOne({ username: username });

      if (existingUser) {
        return res.send("Username already exists");
      }

      const salt = crypto.randomBytes(16).toString("hex");

      const passwordHash = crypto
        .scryptSync(password, salt, 64)
        .toString("hex");

      await users.insertOne({
        username: username,
        passwordHash: passwordHash,
        salt: salt,
      });

      res.send("Account created successfully");
    } catch (err) {
      console.error(err);
      res.status(500).send("Something went wrong");
    }
  });

  app.post("/login", async (req, res) => {
    try {
      const username = req.body.username;
      const password = req.body.password;

      const user = await users.findOne({ username: username });

      if (!user) {
        return res.send("Incorrect username or password");
      }

      const passwordHash = crypto
        .scryptSync(password, user.salt, 64)
        .toString("hex");

      if (passwordHash !== user.passwordHash) {
        return res.send("Incorrect username or password");
      }

      req.session.login = true;
      req.session.userId = user._id.toString();

      console.log("LOGIN SUCCESS");
      console.log("Session:", req.session);

      res.redirect("/main.html");
    } catch (err) {
      console.error(err);
      res.status(500).send("Something went wrong");
    }
  });
  app.use((req, res, next) => {
    if (
      req.session.login === true ||
      req.path === "/" ||
      req.path.startsWith("/css/") ||
      req.path.startsWith("/js/")
    ) {
      next();
    } else {
      res.redirect("/");
    }
  });

  app.post("/logout", (req, res) => {
    req.session = null;
    res.redirect("/");
  });

  app.use(express.static("public"));

  app.get("/data", async (req, res) => {
    const docs = await collection
      .find({ userId: req.session.userId })
      .toArray();

    res.json(docs);
  });

  app.post("/submit", async (req, res) => {
    const data = req.body;
    const quantity = Number(data.quantity);
    const utilization = data.utilization;

    let status;
    if (
      (quantity <= 1 &&
        (utilization === "High" || utilization === "Very High")) ||
      quantity <= 0
    ) {
      status = "⚠ Need ⚠";
    } else {
      status = "✓ Have ✓";
    }

    const newItem = {
      item: data.item,
      category: data.category,
      quantity: quantity,
      utilization: utilization,
      status: status,
      notes: data.notes,
      userId: req.session.userId,
    };

    await collection.insertOne(newItem);
    const updatedData = await collection
      .find({ userId: req.session.userId })
      .toArray();
    res.json(updatedData);
  });

  app.patch("/data/:id", async (req, res) => {
    try {
      const quantity = Number(req.body.quantity);

      const item = await collection.findOne({
        _id: new ObjectId(req.params.id),
        userId: req.session.userId,
      });

      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }

      let status;

      if (
        (quantity <= 1 &&
          (item.utilization === "High" || item.utilization === "Very High")) ||
        quantity <= 0
      ) {
        status = "⚠ Need ⚠";
      } else {
        status = "✓ Have ✓";
      }

      await collection.updateOne(
        {
          _id: new ObjectId(req.params.id),
          userId: req.session.userId,
        },
        {
          $set: {
            quantity: quantity,
            status: status,
          },
        },
      );

      const updatedData = await collection
        .find({ userId: req.session.userId })
        .toArray();

      res.json(updatedData);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: "Invalid ID" });
    }
  });

  app.delete("/delete/:id", async (req, res) => {
    try {
      await collection.deleteOne({
        _id: new ObjectId(req.params.id),
        userId: req.session.userId,
      });

      const updatedData = await collection
        .find({ userId: req.session.userId })
        .toArray();

      res.json(updatedData);
    } catch (err) {
      res.status(400).json({ error: "Invalid ID" });
    }
  });
}

run();

app.listen(process.env.PORT || 3000, () => {
  console.log("Server is running on port 3000");
});
