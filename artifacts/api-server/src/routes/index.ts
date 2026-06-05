import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionsRouter from "./sessions";
import memoryRouter from "./memory";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionsRouter);
router.use(memoryRouter);

export default router;
