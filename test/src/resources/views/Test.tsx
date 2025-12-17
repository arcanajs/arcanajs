import { useLazyFetch } from "arcanajs/client";
import { useEffect, useState } from "react";

const Test = () => {
  const [count, setCount] = useState(0);

  const { execute, pending, data, error } = useLazyFetch("/api/test/submit", {
    method: "POST",
    body: { count, message: "Hello from client" },
  });

  useEffect(() => {
    console.log("Test component mounted");
  }, [count]);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Test Route</h1>
      <p>
        This is a test route to verify that the server is working correctly.
      </p>

      <div style={{ margin: "1rem 0" }}>
        <button
          onClick={() => setCount(count + 1)}
          style={{ marginRight: "1rem" }}
        >
          Counter: {count}
        </button>

        <button onClick={() => execute()} disabled={pending}>
          {pending ? "Submitting..." : "Test POST Request (CSRF Check)"}
        </button>
      </div>

      {error && (
        <div style={{ color: "red", marginTop: "1rem" }}>
          <h3>Error:</h3>
          <pre>{JSON.stringify(error.message, null, 2)}</pre>
        </div>
      )}

      {data && (
        <div style={{ color: "yellow", marginTop: "1rem" }}>
          <h3>Success! Server Response:</h3>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
        
      )}

      <p>Check the console for mount logs.</p>
    </div>
  );
};

export default Test;
