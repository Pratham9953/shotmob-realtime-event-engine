import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { loginUser, registerUser } from "./auth.service";
import { loginSchema, registerSchema } from "./auth.schemas";

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const result = await registerUser(input);
    res.status(201).json({ success: true, data: result });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);
    res.json({ success: true, data: result });
  })
);
