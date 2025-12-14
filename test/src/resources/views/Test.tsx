"use client";
import { useEffect, useState } from "react";

const Test = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    console.log("Test component mounted");
  }, [count]);

  return (
    <div>
      <h1>Test Route</h1>
      <p>
        This is a test route to verify that the server is working correctly.
      </p>
      <button onClick={() => setCount(count + 1)}>
        Click me! Count: {count}
      </button>
      <p>Check the console for mount logs.</p>
    </div>
  );
};

export default Test;
