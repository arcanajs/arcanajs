import React from "react";
const TestPage: React.FC<{ data: any; navigateTo: (url: string) => void }> = ({
  data,
  navigateTo,
}) => {
  return (
    <div>
      <h1>Test Page</h1>
      <p>{data.message}</p>
      <p>Timestamp: {new Date(data.timestamp).toLocaleString()}</p>
      <button onClick={() => navigateTo("/")}>Go Home</button>
    </div>
  );
};

export default TestPage;
