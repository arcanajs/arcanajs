import React from "react";

const ErrorPage: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div style={{ padding: "20px", color: "red" }}>
      <h1>500 - Server Error</h1>
      <p>Something went wrong.</p>
      {data && data.message && <p>Error: {data.message}</p>}
    </div>
  );
};

export default ErrorPage;
