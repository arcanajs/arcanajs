import type { Request, Response } from "arcanajs/server";

class TestController {
  async submit(req: Request, res: Response) {
    try {
      setTimeout(() => {
        // Echo back the received data to confirm correct processing
        res.success(
          {
            received: req.body,
            csrfToken: req.get("x-csrf-token") ? "Received" : "Missing",
          },
          "Test POST request successful!",
          200
        );
      }, 1000);
    } catch (error) {
      res.error("Test submission failed", 500, error);
    }
  }
}

export default TestController;
