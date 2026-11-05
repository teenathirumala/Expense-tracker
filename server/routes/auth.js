import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import validate from "../middleware/validate.js";
import { registerBody, loginBody } from "../validation/schemas.js";

const router = Router();

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email });

router.post("/register", validate({ body: registerBody }), async (req, res, next) => {
  try {
    // Already checked and cleaned by validate(): strings only, trimmed, email lower-cased
    const { name, email, password } = req.valid.body;

    if (await User.findOne({ email })) return res.status(409).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });
    res.status(201).json({ token: signToken(user._id), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", validate({ body: loginBody }), async (req, res, next) => {
  try {
    const { email, password } = req.valid.body;
    const user = await User.findOne({ email });

    // Same message whether the email or the password is wrong, so attackers can't use this endpoint to find out which emails are registered.
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    res.json({ token: signToken(user._id), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;